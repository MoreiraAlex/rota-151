import { afterEach, describe, it, expect, vi } from 'vitest'
import { createWorld } from 'koota'
import { makeWorld, ownedByPlayer } from '@/test/makeWorld'
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
  Vitals,
  WildCreature,
} from '@/core/traits'
import { GAME_CONFIG } from '@/core/gameConfig'
import { creatureFollowSystem, resolveFollowGait } from './creatureFollowSystem'

// Física e navegação no nível plano de antes do relevo (as peças que estes
// testes usam) — ver `src/test/flatTestLevel.js`.
vi.mock('@/core/data/testLevel', async (importOriginal) => {
  const { withFlatTestLevel } = await import('@/test/flatTestLevel')
  return withFlatTestLevel(await importOriginal())
})

// `party` é exclusivo do treinador (`getPlayerSpecies()`, ver
// docs/features/018-troca-de-controle-treinador-criatura.md) — sempre a
// espécie do treinador de verdade, não a usada pras criaturas abaixo.
const {
  followMinDistance: FOLLOW_MIN_DISTANCE,
  runDistance: RUN_DISTANCE,
  followResumeDistance: FOLLOW_RESUME_DISTANCE,
  avoidanceRadius: AVOIDANCE_RADIUS,
  avoidanceStartRadius: AVOIDANCE_START_RADIUS,
} = getPlayerSpecies().party
const { walkSpeed: WALK_SPEED, runSpeed: RUN_SPEED } =
  getSpecies('charmander').movement

function spawnCreature(world, position) {
  return world.spawn(
    Position(position),
    Rotation,
    Velocity,
    SummonedCreature({ slot: 'slot1' }),
    ...ownedByPlayer(world),
    MovementStats(getSpecies('charmander').movement),
    PathState,
    PhysicsBody, // toda SummonedCreature real também tem (ver partySummonSystem.js)
    // A query de seguidores agora é por CharacterController, não mais por
    // SummonedCreature (ver docstring do system — troca de controle,
    // docs/features/018-troca-de-controle-treinador-criatura.md) — toda
    // SummonedCreature real também tem (partySummonSystem.js).
    CharacterController,
    Vitals, // toda criatura real tem — correr gasta stamina dela
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

  it('correndo pra alcançar, gasta stamina (igual ao jogador)', () => {
    const { world } = makeWorld({ playerPosition: { x: 0, y: 1, z: 0 } })
    const creature = spawnCreature(world, { x: RUN_DISTANCE + 5, y: 1, z: 0 })
    const before = creature.get(Vitals).stamina

    for (let i = 0; i < 30; i++) tick(world)

    expect(creature.get(Vitals).stamina).toBeLessThan(before)
  })

  it('sem stamina, anda (walkSpeed) mesmo longe — não corre de graça', () => {
    const { world } = makeWorld({ playerPosition: { x: 0, y: 1, z: 0 } })
    const creature = spawnCreature(world, { x: RUN_DISTANCE + 5, y: 1, z: 0 })
    creature.set(Vitals, { stamina: 0, staminaRegenPercent: 0 })

    for (let i = 0; i < 120; i++) tick(world)

    const vel = creature.get(Velocity)
    expect(Math.hypot(vel.x, vel.z)).toBeCloseTo(
      getSpecies('charmander').movement.walkSpeed,
    )
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

  it('contorna a "wall" em vez de ir em linha reta', () => {
    // wall: position [0, 1, -7], size [10, 2, 0.5] — bloqueia ir direto de
    // z=-15 até o treinador em z=5, ambos em x=0.
    const { world } = makeWorld({ playerPosition: { x: 0, y: 1, z: 5 } })
    const creature = spawnCreature(world, { x: 0, y: 1, z: -15 })

    tick(world)

    // O caminho passa pela ponta da parede (|x| > metade dela).
    const { waypoints } = creature.get(PathState)
    expect(waypoints.some((point) => Math.abs(point.x) > 5)).toBe(true)
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
      WildCreature({ speciesId: 'charmander' }),
      MovementStats(getSpecies('charmander').movement),
      PathState,
      PhysicsBody,
      CharacterController,
      Vitals,
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

describe('resolveFollowGait — histerese da marcha', () => {
  const bands = {
    stopDistance: FOLLOW_MIN_DISTANCE,
    resumeDistance: FOLLOW_RESUME_DISTANCE,
    runDistance: RUN_DISTANCE,
  }
  const between = (FOLLOW_MIN_DISTANCE + FOLLOW_RESUME_DISTANCE) / 2
  const upper = (FOLLOW_RESUME_DISTANCE + RUN_DISTANCE) / 2

  it('fora da folga decide só pela distância', () => {
    for (const previous of ['stop', 'walk', 'run']) {
      expect(resolveFollowGait(previous, FOLLOW_MIN_DISTANCE, bands)).toBe(
        'stop',
      )
      expect(resolveFollowGait(previous, RUN_DISTANCE + 0.01, bands)).toBe(
        'run',
      )
    }
  })

  it('parada continua parada até passar de followResumeDistance', () => {
    expect(resolveFollowGait('stop', between, bands)).toBe('stop')
    expect(resolveFollowGait('stop', FOLLOW_RESUME_DISTANCE, bands)).toBe(
      'stop',
    )
    expect(resolveFollowGait('stop', upper, bands)).toBe('walk')
  })

  it('correndo continua correndo até chegar em followResumeDistance', () => {
    expect(resolveFollowGait('run', upper, bands)).toBe('run')
    expect(resolveFollowGait('run', FOLLOW_RESUME_DISTANCE, bands)).toBe('walk')
  })

  it('andando continua andando na faixa toda', () => {
    expect(resolveFollowGait('walk', between, bands)).toBe('walk')
    expect(resolveFollowGait('walk', upper, bands)).toBe('walk')
  })
})

describe('creatureFollowSystem — sem oscilar no limiar', () => {
  // O treinador se afastando aos poucos (passo menor que o da criatura):
  // antes, cada tick em que passava de FOLLOW_MIN_DISTANCE virava um tick
  // de andar — para, anda, para.
  it('parada, não volta a andar com o alvo se afastando pouco do limiar', () => {
    const { world, player } = makeWorld({
      playerPosition: { x: 0, y: 1, z: 0 },
    })
    const creature = spawnCreature(world, {
      x: FOLLOW_MIN_DISTANCE - 0.1,
      y: 1,
      z: 0,
    })
    tick(world)
    expect(creature.get(PathState).gait).toBe('stop')

    player.set(Position, { x: -0.3, y: 1, z: 0 })
    tick(world)

    const vel = creature.get(Velocity)
    expect(Math.hypot(vel.x, vel.z)).toBe(0)

    world.destroy()
  })

  // O treinador andando (entre o andar e o correr da criatura): antes, ela
  // passava a andar assim que caía abaixo de RUN_DISTANCE e voltava a
  // correr ao ficar pra trás — trocando quase todo tick.
  it('correndo, continua correndo logo abaixo de RUN_DISTANCE', () => {
    const { world } = makeWorld({ playerPosition: { x: 0, y: 1, z: 0 } })
    const creature = spawnCreature(world, { x: RUN_DISTANCE + 1, y: 1, z: 0 })
    tick(world)
    creature.set(Position, { x: RUN_DISTANCE - 0.1, y: 1, z: 0 })

    tick(world)

    const vel = creature.get(Velocity)
    expect(Math.hypot(vel.x, vel.z)).toBeCloseTo(RUN_SPEED)

    world.destroy()
  })

  // Vazia, o primeiro pouco regenerado pagava um tick de corrida e
  // reiniciava o atraso do regen — um tranco de corrida a cada ~2s.
  it('sem energia, descansa: não corre com o pouco que regenerou', () => {
    const { world } = makeWorld({ playerPosition: { x: 0, y: 1, z: 0 } })
    const creature = spawnCreature(world, { x: RUN_DISTANCE + 5, y: 1, z: 0 })
    creature.set(Vitals, { stamina: 0 })
    tick(world)
    expect(creature.get(PathState).resting).toBe(true)

    // Regenerou o bastante pra pagar alguns ticks de corrida, longe do fim
    // do descanso (`REST_EXIT_FRACTION`).
    const { maxStamina } = creature.get(Vitals)
    creature.set(Vitals, { stamina: maxStamina * 0.1 })
    tick(world)

    const vel = creature.get(Velocity)
    expect(Math.hypot(vel.x, vel.z)).toBeCloseTo(WALK_SPEED)
    expect(creature.get(Vitals).stamina).toBeCloseTo(maxStamina * 0.1)

    world.destroy()
  })

  // Parada, com outro chegando devagar: antes andava um tick, saía de
  // avoidanceRadius, parava e ele entrava de novo — mini-passos.
  describe('desvio parada com histerese', () => {
    const between = (AVOIDANCE_START_RADIUS + AVOIDANCE_RADIUS) / 2
    let world
    afterEach(() => world.destroy())

    function parkedPair(gap) {
      // As duas a FOLLOW_MIN_DISTANCE do treinador (parada), separadas
      // por `gap` ao longo de z.
      const x = Math.sqrt(FOLLOW_MIN_DISTANCE ** 2 - (gap / 2) ** 2) - 0.01
      const a = spawnCreature(world, { x, y: 1, z: -gap / 2 })
      const b = spawnCreature(world, { x, y: 1, z: gap / 2 })
      return [a, b]
    }

    it('alguém entre os dois raios não tira da parada', () => {
      ;({ world } = makeWorld({ playerPosition: { x: 0, y: 1, z: 0 } }))
      const [a] = parkedPair(between)
      a.set(PathState, { gait: 'stop' })

      tick(world)

      const vel = a.get(Velocity)
      expect(Math.hypot(vel.x, vel.z)).toBe(0)
    })

    it('já se afastando, continua até sair de avoidanceRadius', () => {
      ;({ world } = makeWorld({ playerPosition: { x: 0, y: 1, z: 0 } }))
      const [a] = parkedPair(between)
      a.set(PathState, { gait: 'stop', separating: true })

      tick(world)

      const vel = a.get(Velocity)
      expect(Math.hypot(vel.x, vel.z)).toBeCloseTo(WALK_SPEED)
      expect(a.get(PathState).separating).toBe(true)
    })

    it('alguém dentro de avoidanceStartRadius tira da parada', () => {
      ;({ world } = makeWorld({ playerPosition: { x: 0, y: 1, z: 0 } }))
      const [a] = parkedPair(AVOIDANCE_START_RADIUS - 0.3)
      a.set(PathState, { gait: 'stop' })

      tick(world)

      const vel = a.get(Velocity)
      expect(Math.hypot(vel.x, vel.z)).toBeCloseTo(WALK_SPEED)
    })
  })
})
