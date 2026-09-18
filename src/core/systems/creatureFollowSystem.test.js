import { describe, it, expect } from 'vitest'
import { createWorld } from 'koota'
import { makeWorld } from '@/test/makeWorld'
import { getSpecies, getPlayerSpecies } from '@/core/data/species'
import {
  CharacterController,
  InputControlled,
  MovementBlocked,
  MovementStats,
  PathState,
  PhysicsBody,
  Position,
  Rotation,
  SummonedCreature,
  Velocity,
  WildCreature,
} from '@/core/traits'
import { GAME_CONFIG } from '@/core/gameConfig'
import { creatureFollowSystem } from './creatureFollowSystem'

// `party` é exclusivo do treinador (`getPlayerSpecies()`, ver
// docs/features/018-troca-de-controle-treinador-criatura.md) — sempre a
// espécie `bot` de verdade, não a `fox` usada pro player de teste abaixo.
const { followMinDistance: FOLLOW_MIN_DISTANCE, runDistance: RUN_DISTANCE } =
  getPlayerSpecies().party
const { walkSpeed: WALK_SPEED, runSpeed: RUN_SPEED } =
  getSpecies('fox').movement

function spawnCreature(world, position) {
  return world.spawn(
    Position(position),
    Rotation,
    Velocity,
    SummonedCreature({ slot: 'slot1' }),
    MovementStats(getSpecies('fox').movement),
    PathState,
    PhysicsBody, // toda SummonedCreature real também tem (ver partySummonSystem.js)
    // A query de seguidores agora é por CharacterController, não mais por
    // SummonedCreature (ver docstring do system — troca de controle,
    // docs/features/018-troca-de-controle-treinador-criatura.md) — toda
    // SummonedCreature real também tem (partySummonSystem.js).
    CharacterController,
  )
}

function tick(world, delta = 1 / 60) {
  creatureFollowSystem({ world, delta })
}

describe('creatureFollowSystem', () => {
  it('dentro de FOLLOW_MIN_DISTANCE, fica parada', () => {
    const { world } = makeWorld({ playerPosition: { x: 0, y: 1, z: 0 } })
    const creature = spawnCreature(world, {
      x: FOLLOW_MIN_DISTANCE - 0.5,
      y: 1,
      z: 0,
    })

    tick(world)

    const vel = creature.get(Velocity)
    expect(vel.x).toBe(0)
    expect(vel.z).toBe(0)
  })

  it('entre FOLLOW_MIN_DISTANCE e RUN_DISTANCE, anda (walkSpeed) em direção ao treinador', () => {
    const { world } = makeWorld({ playerPosition: { x: 0, y: 1, z: 0 } })
    const midDistance = (FOLLOW_MIN_DISTANCE + RUN_DISTANCE) / 2
    const creature = spawnCreature(world, { x: midDistance, y: 1, z: 0 })

    // Velocity segue Rotation, suavizada por turnSpeed (ver docstring do
    // system) — não bate com o alvo já no 1º tick de propósito (é a troca
    // de destino suave que resolve o esbarrão relatado jogando). Roda até
    // convergir, mesmo padrão do teste de rotação abaixo.
    for (let i = 0; i < 120; i++) tick(world)

    const vel = creature.get(Velocity)
    expect(vel.x).toBeCloseTo(-WALK_SPEED) // treinador está em -X daqui
    expect(vel.z).toBeCloseTo(0)
  })

  it('além de RUN_DISTANCE, corre (runSpeed) em direção ao treinador', () => {
    const { world } = makeWorld({ playerPosition: { x: 0, y: 1, z: 0 } })
    const creature = spawnCreature(world, {
      x: RUN_DISTANCE + 1,
      y: 1,
      z: 0,
    })

    for (let i = 0; i < 120; i++) tick(world)

    const vel = creature.get(Velocity)
    expect(vel.x).toBeCloseTo(-RUN_SPEED)
    expect(vel.z).toBeCloseTo(0)
  })

  it('gira em direção ao próprio movimento (suavizado por turnSpeed)', () => {
    const { world } = makeWorld({ playerPosition: { x: 0, y: 1, z: 0 } })
    const creature = spawnCreature(world, { x: RUN_DISTANCE + 1, y: 1, z: 0 })

    for (let i = 0; i < 120; i++) tick(world)

    // movendo em -X, facing = atan2(-1, 0) = -π/2
    expect(creature.get(Rotation).y).toBeCloseTo(-Math.PI / 2, 1)
  })

  it('parada (dentro de FOLLOW_MIN_DISTANCE) não gira', () => {
    const { world } = makeWorld({ playerPosition: { x: 0, y: 1, z: 0 } })
    const creature = spawnCreature(world, {
      x: FOLLOW_MIN_DISTANCE - 0.5,
      y: 1,
      z: 0,
    })
    creature.set(Rotation, { y: 1.7 })

    for (let i = 0; i < 60; i++) tick(world)

    expect(creature.get(Rotation).y).toBeCloseTo(1.7)
  })

  it('lê getPlayerSpecies().party a cada tick — mudar runDistance em tempo real já vale no próximo tick', () => {
    const { world } = makeWorld({ playerPosition: { x: 0, y: 1, z: 0 } })
    const creature = spawnCreature(world, { x: RUN_DISTANCE + 1, y: 1, z: 0 })
    const partyConfig = getPlayerSpecies().party
    const original = partyConfig.runDistance
    partyConfig.runDistance = 0 // qualquer distância > 0 já corre

    try {
      tick(world)
      // A MAGNITUDE de Velocity reflete `speed` desde o 1º tick, mesmo com
      // Velocity seguindo Rotation suavizada — só a direção (como esse
      // total se divide entre x/z) demora a convergir, a magnitude não
      // (sin²+cos²=1 sempre), então isso ainda confere config lido ao vivo
      // sem precisar convergir rotação nenhuma.
      const vel = creature.get(Velocity)
      expect(Math.hypot(vel.x, vel.z)).toBeCloseTo(RUN_SPEED)
    } finally {
      partyConfig.runDistance = original
    }
  })

  it('contorna a "wall" do TEST_LEVEL em vez de ir em linha reta', () => {
    // wall: position [0, 1, -7], size [10, 2, 0.5] — bloqueia ir direto de
    // z=-15 até o treinador em z=5, ambos em x=0.
    const { world } = makeWorld({ playerPosition: { x: 0, y: 1, z: 5 } })
    const creature = spawnCreature(world, { x: 0, y: 1, z: -15 })

    tick(world)

    // linha reta seria vel.x = 0 — o desvio exige um componente em x.
    expect(creature.get(Velocity).x).not.toBeCloseTo(0)
  })

  it('repathTimer conta regressivo e só reseta quando recalcula (throttle)', () => {
    const { world } = makeWorld({ playerPosition: { x: 0, y: 1, z: 0 } })
    const creature = spawnCreature(world, { x: RUN_DISTANCE + 1, y: 1, z: 0 })
    const { REPATH_INTERVAL } = GAME_CONFIG.PATHFINDING

    tick(world) // 1º tick sempre recalcula — repathTimer começa em 0
    expect(creature.get(PathState).repathTimer).toBeCloseTo(REPATH_INTERVAL)

    tick(world) // ainda dentro do intervalo — só decrementa, não recalcula
    expect(creature.get(PathState).repathTimer).toBeLessThan(REPATH_INTERVAL)
    expect(creature.get(PathState).repathTimer).toBeGreaterThan(0)
  })

  it('MovementBlocked desvia lateralmente em vez de continuar reto — e força recálculo imediato na borda de subida', () => {
    // Sem física real inicializada, castRay (core/physics/raycast.js)
    // devolve null pros dois lados (nada no caminho pra "acertar") — o
    // desvio ainda assim escolhe um lado de forma determinística (empate
    // vira esquerda), então dá pra testar sem subir o Rapier: o que importa
    // aqui é que a direção deixa de apontar reto pro treinador.
    const { world } = makeWorld({ playerPosition: { x: 0, y: 1, z: 0 } })
    // Treinador em +X daqui — sem MovementBlocked, a criatura iria reto em
    // +X (vel.z ficaria em 0).
    const creature = spawnCreature(world, {
      x: -(RUN_DISTANCE + 1),
      y: 1,
      z: 0,
    })
    creature.add(MovementBlocked)

    tick(world) // borda de subida (wasBlocked começa false) — recalcula

    const vel = creature.get(Velocity)
    expect(vel.z).not.toBeCloseTo(0) // desviou lateralmente, não foi reto
    // Recalculou JÁ (repathTimer volta a REPATH_INTERVAL, não fica em 0) —
    // só na borda de subida, não every tick enquanto travada (refazer o A*
    // a 60/s seria puro desperdício, ver docstring do system).
    const { REPATH_INTERVAL } = GAME_CONFIG.PATHFINDING
    expect(creature.get(PathState).repathTimer).toBeCloseTo(REPATH_INTERVAL)

    tick(world) // ainda travada, mas não é mais borda de subida
    expect(creature.get(PathState).repathTimer).toBeLessThan(REPATH_INTERVAL)
  })

  it('desvia proativamente de outra criatura próxima em vez de convergir reto pro treinador', () => {
    // Personagens colidem fisicamente de verdade entre si (pedido explícito
    // do usuário: não se atravessam) — sem evasão proativa, criaturas iam
    // esbarrar/empurrar ao convergir todas pro treinador. player em (0,0);
    // criatura-alvo em (7,0) iria reto em -X; outra criatura bem perto
    // dela, deslocada em +Z, deve empurrar a resultante pra -Z.
    const { world } = makeWorld({ playerPosition: { x: 0, y: 1, z: 0 } })
    const creature = spawnCreature(world, { x: 7, y: 1, z: 0 })
    spawnCreature(world, { x: 7, y: 1, z: 1 }) // 1m de distância — dentro de AVOIDANCE_RADIUS

    // Velocity segue Rotation suavizada — precisa de tempo pra convergir
    // (mesmo padrão dos outros testes de direção nesta suíte).
    for (let i = 0; i < 120; i++) tick(world)

    const vel = creature.get(Velocity)
    expect(vel.z).toBeLessThan(0) // afasta da outra criatura (que está em +Z)
    expect(vel.x).toBeLessThan(0) // ainda avança em direção ao treinador
  })

  it('mesmo dentro de FOLLOW_MIN_DISTANCE, desvia se outra criatura estiver perto demais', () => {
    // Sem isso, duas criaturas "estacionadas" na mesma distância do
    // treinador podiam ficar sobrepostas sem nenhuma se mexer.
    const { world } = makeWorld({ playerPosition: { x: 0, y: 1, z: 0 } })
    const stopX = FOLLOW_MIN_DISTANCE - 0.5
    const creature = spawnCreature(world, { x: stopX, y: 1, z: 0 })
    spawnCreature(world, { x: stopX, y: 1, z: 1 }) // 1m de distância

    for (let i = 0; i < 120; i++) tick(world)

    const vel = creature.get(Velocity)
    expect(Math.hypot(vel.x, vel.z)).toBeGreaterThan(0) // não ficou parada
    expect(vel.z).toBeLessThan(0) // pura repulsão, afasta da outra criatura
  })

  it('sem ninguém por perto, dentro de FOLLOW_MIN_DISTANCE continua parada normalmente', () => {
    // Regressão: a evasão não deve fazer uma criatura sozinha (sem outro
    // personagem por perto) se mexer à toa.
    const { world } = makeWorld({ playerPosition: { x: 0, y: 1, z: 0 } })
    const creature = spawnCreature(world, {
      x: FOLLOW_MIN_DISTANCE - 0.5,
      y: 1,
      z: 0,
    })

    tick(world)

    const vel = creature.get(Velocity)
    expect(vel.x).toBe(0)
    expect(vel.z).toBe(0)
  })

  it('trocando o controle pra criatura, o treinador vira seguidor e a criatura controlada não é sobrescrita', () => {
    // Simula o pós-troca de controle (controlSwitchSystem.js, ver
    // docs/features/018-troca-de-controle-treinador-criatura.md): o
    // treinador perde InputControlled, a criatura ganha.
    const { world, player } = makeWorld({
      playerPosition: { x: 0, y: 1, z: 0 },
    })
    const creature = spawnCreature(world, { x: 10, y: 1, z: 0 })
    player.remove(InputControlled)
    creature.add(InputControlled)
    creature.set(Velocity, { x: 0, y: 0, z: 0 })

    for (let i = 0; i < 120; i++) tick(world)

    // Treinador (agora "o bot") se move em direção à criatura, que está
    // em +X daqui.
    const trainerVel = player.get(Velocity)
    expect(trainerVel.x).toBeGreaterThan(0)

    // A criatura controlada não é seguidora de ninguém — este system nunca
    // toca a Velocity dela (fica como o teste deixou, sem se mover).
    const creatureVel = creature.get(Velocity)
    expect(creatureVel.x).toBe(0)
    expect(creatureVel.z).toBe(0)
  })

  it('sem jogador no world (nenhum InputControlled), não quebra', () => {
    const world = createWorld()
    spawnCreature(world, { x: 10, y: 1, z: 0 })

    expect(() => tick(world)).not.toThrow()

    world.destroy()
  })

  it('ignora WildCreature — não a puxa pro treinador nem mexe no PathState dela', () => {
    // Bug real, relatado jogando: sem este filtro, esta system e
    // wildWanderSystem.js brigavam pelo MESMO PathState de uma
    // WildCreature (esta aqui recalculando rumo ao treinador sempre que o
    // PRÓPRIO repathTimer vencia), fazendo a criatura selvagem ficar
    // trocando de rota toda hora em vez de vagar sozinha.
    const { world } = makeWorld({ playerPosition: { x: 0, y: 1, z: 0 } })
    const wild = world.spawn(
      Position({ x: 10, y: 1, z: 0 }),
      Rotation,
      Velocity,
      WildCreature({ speciesId: 'fox' }),
      MovementStats(getSpecies('fox').movement),
      PathState,
      PhysicsBody,
      CharacterController,
    )

    tick(world)

    const vel = wild.get(Velocity)
    expect(vel.x).toBe(0)
    expect(vel.z).toBe(0)
    // PathState nunca foi tocado (continua no default de spawn) — prova
    // que a entidade nem entrou na lógica de perseguir o treinador.
    expect(wild.get(PathState).waypoints).toEqual([])

    world.destroy()
  })
})
