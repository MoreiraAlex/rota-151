import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createWorld } from 'koota'
import { makeWorld } from '@/test/makeWorld'
import {
  Position,
  Rotation,
  Velocity,
  InputState,
  InputControlled,
  MovementStats,
  Vitals,
  OrbitCamera,
  CameraTarget,
  PhysicsBody,
  CharacterController,
  Grounded,
  MovementBlocked,
  Jumped,
  Jumping,
  ActionState,
} from '@/core/traits'
import {
  initPhysics,
  disposePhysics,
  getRapierWorld,
} from '@/core/physics/physicsWorld'
import { quaternionFromAxisAngle } from '@/core/math'
import { createCharacterBody } from '@/core/physics/colliders'
import { getSpecies } from '@/core/data/species'
import { desmaiar } from '@/core/actions/faint'
import { inputSystem } from './inputSystem'
import { physicsBootstrapSystem } from './physicsBootstrapSystem'
import { cameraControlSystem } from './cameraControlSystem'
import { movementSystem } from './movementSystem'
import { characterPhysicsSystem } from './characterPhysicsSystem'
import { physicsStepSystem } from './physicsStepSystem'
import { syncPhysicsSystem } from './syncPhysicsSystem'

const PLAYER = getSpecies('boy')
const CREATURE = getSpecies('charmander')

/** Extensão vertical da cápsula acima do chão em repouso — raio+meia-altura
 * em pé ('y'), só o raio deitada ('x'/'z', onde a meia-altura vira extensão
 * horizontal). */
function restingHeightFor({ capsuleRadius, capsuleHalfHeight, capsuleAxis }) {
  return capsuleAxis === 'y' ? capsuleRadius + capsuleHalfHeight : capsuleRadius
}

/** Como makeWorld, mas com um CharacterController customizado — pra testar
 * corpos com capsuleAxis diferente do player sem mudar o helper compartilhado. */
function makeWorldWithBody(body, playerPosition = { x: 0, y: 3, z: 0 }) {
  const world = createWorld()
  const player = world.spawn(
    Position(playerPosition),
    Rotation,
    Velocity,
    InputState,
    InputControlled,
    MovementStats(PLAYER.movement),
    Vitals,
    CameraTarget,
    PhysicsBody,
    CharacterController(body),
  )
  const camera = world.spawn(OrbitCamera())
  return { world, player, camera }
}

/** Roda o pipeline fixo completo, na mesma ordem do registerSystems. */
function tick(world, input = {}) {
  const ctx = { world, delta: 1 / 60, input }
  inputSystem(ctx)
  physicsBootstrapSystem(ctx)
  cameraControlSystem(ctx)
  movementSystem(ctx)
  characterPhysicsSystem(ctx)
  physicsStepSystem(ctx)
  syncPhysicsSystem(ctx)
}

const run = (world, n, input) => {
  for (let i = 0; i < n; i++) tick(world, input)
}

describe('characterPhysicsSystem + integração Rapier', () => {
  beforeEach(async () => {
    await initPhysics()
  })
  afterEach(() => {
    disposePhysics()
  })

  it('cai da posição inicial e repousa no chão', () => {
    const { world, player } = makeWorld({
      playerPosition: { x: 0, y: 3, z: 0 },
    })
    run(world, 180)
    const pos = player.get(Position)
    // Repouso ≈ extensão vertical da cápsula acima do chão — deriva da
    // espécie (corpo e orientação) em vez de literal fixo, pra não quebrar
    // sempre que o corpo for redimensionado/reorientado.
    const restingHeight = restingHeightFor(PLAYER.body)
    expect(pos.y).toBeGreaterThan(restingHeight - 0.05)
    expect(pos.y).toBeLessThan(restingHeight + 0.3)
    expect(player.has(Grounded)).toBe(true)
  })

  it('cápsula deitada (capsuleAxis x) repousa numa altura diferente — só o raio, não raio+meia-altura', () => {
    const body = {
      ...PLAYER.body,
      capsuleRadius: 0.5,
      capsuleHalfHeight: 0.4, // bem alongada, pra diferença ficar clara
      capsuleAxis: 'x',
    }
    const { world, player } = makeWorldWithBody(body)
    run(world, 180)
    const pos = player.get(Position)
    const restingHeight = restingHeightFor(body)
    expect(restingHeight).toBeCloseTo(0.5) // confirma que a meia-altura não conta
    expect(pos.y).toBeGreaterThan(restingHeight - 0.05)
    expect(pos.y).toBeLessThan(restingHeight + 0.3)
    expect(player.has(Grounded)).toBe(true)
  })

  it('o corpo físico gira com Rotation.y — necessário pra cápsula deitada acompanhar a frente ao virar', () => {
    const { world, player } = makeWorld({
      playerPosition: { x: 0, y: 1, z: 0 },
    })
    run(world, 90, { right: true }) // gira até encarar +x
    const rot = player.get(Rotation)
    expect(rot.y).not.toBeCloseTo(0) // confirma que de fato girou

    const { bodyHandle } = player.get(PhysicsBody)
    const actualRotation = getRapierWorld().getRigidBody(bodyHandle).rotation()
    const expectedRotation = quaternionFromAxisAngle('y', rot.y)
    expect(actualRotation.y).toBeCloseTo(expectedRotation.y)
    expect(actualRotation.w).toBeCloseTo(expectedRotation.w)
  })

  it('é bloqueado pela parede em z = -7', () => {
    const { world, player } = makeWorld({
      playerPosition: { x: 0, y: 1, z: 0 },
    })
    run(world, 150, { forward: true })
    expect(player.get(Position).z).toBeGreaterThan(-7)
    expect(player.get(Position).z).toBeLessThan(-3)
  })

  it('marca MovementBlocked ao empurrar reto contra a parede — desmarca ao soltar o input', () => {
    const { world, player } = makeWorld({
      playerPosition: { x: 0, y: 1, z: 0 },
    })
    // Ainda longe da parede — deslocamento pedido bate com o real.
    run(world, 30, { forward: true })
    expect(player.has(MovementBlocked)).toBe(false)

    // Segue empurrando até encostar de vez na parede e ficar preso nela.
    run(world, 170, { forward: true })
    expect(player.has(MovementBlocked)).toBe(true)

    // Sem input, não pede deslocamento nenhum — não é "bloqueado", é parado.
    tick(world)
    expect(player.has(MovementBlocked)).toBe(false)
  })

  it('sobe a rampa andando em +x', () => {
    const { world, player } = makeWorld({
      playerPosition: { x: 0, y: 2, z: 0 },
    })
    // Cai e assenta antes de andar — a cápsula em pé do player de teste
    // (2m) nascendo mais baixo já encosta no chão e não sai do lugar.
    run(world, 60)
    const yFlat = player.get(Position).y
    // Ticks suficientes pra percorrer bem além da rampa, derivado da
    // velocidade de andar ATUAL da espécie — não um número fixo (já
    // quebrou uma vez quando o walkSpeed do player de teste mudou de 4 pra 2).
    const ticksToClimb = Math.ceil((8 / PLAYER.movement.walkSpeed) * 60)
    run(world, ticksToClimb, { right: true })
    const pos = player.get(Position)
    expect(pos.x).toBeGreaterThan(4)
    expect(pos.y).toBeGreaterThan(yFlat + 0.4)
  })

  it('pula a partir do chão e volta a repousar', () => {
    const { world, player } = makeWorld({
      playerPosition: { x: 0, y: 1, z: 0 },
    })
    run(world, 30)
    const yGround = player.get(Position).y

    tick(world, { jump: true })
    let peak = yGround
    for (let i = 0; i < 100; i++) {
      tick(world)
      peak = Math.max(peak, player.get(Position).y)
    }

    expect(peak).toBeGreaterThan(yGround + 0.8)
    // Tolerância mais larga que um toBeCloseTo padrão: a precisão do pouso
    // depende da forma/orientação da cápsula (agora por espécie, ver
    // 008-colisao-e-movimento-por-especie.md), não só da altura do pulo —
    // uma cápsula bem alongada e deitada tem mais folga de contato ao
    // assentar do que uma quase esférica em pé.
    expect(Math.abs(player.get(Position).y - yGround)).toBeLessThan(0.15)
  })

  it('atordoada (ação "hit", golpe interrompido) não pula', () => {
    const { world, player } = makeWorld({
      playerPosition: { x: 0, y: 1, z: 0 },
    })
    run(world, 30)
    player.set(ActionState, { current: 'hit' })

    tick(world, { jump: true })

    expect(player.has(Jumped)).toBe(false)
    // este arquivo não destrói os worlds, e o koota aceita no máximo 16
    world.destroy()
  })

  it('comendo (ação "eat", docs/features/042-itens-da-beta.md) não pula', () => {
    const { world, player } = makeWorld({
      playerPosition: { x: 0, y: 1, z: 0 },
    })
    run(world, 30)
    player.set(ActionState, { current: 'eat' })

    tick(world, { jump: true })

    expect(player.has(Jumped)).toBe(false)
    world.destroy()
  })

  it('pulo de verdade adiciona o pulso `Jumped` — sem tentar pular, ou sem conseguir, não adiciona', () => {
    const { world, player } = makeWorld({
      playerPosition: { x: 0, y: 1, z: 0 },
    })
    run(world, 30)
    expect(player.has(Jumped)).toBe(false)

    tick(world, { jump: true })
    expect(player.has(Jumped)).toBe(true)

    // O system só ADICIONA — nunca remove sozinho (ver docstring do
    // trait, core/traits/components/physics.js). Continuar tickando sem
    // pular de novo não deveria fazer a tag sumir sozinha.
    for (let i = 0; i < 30; i++) tick(world)
    expect(player.has(Jumped)).toBe(true)
  })

  it('`Jumping` dura do pulo até aterrissar — subindo e descendo', () => {
    const { world, player } = makeWorld({
      playerPosition: { x: 0, y: 1, z: 0 },
    })
    run(world, 30)
    expect(player.has(Jumping)).toBe(false)

    tick(world, { jump: true })
    expect(player.has(Jumping)).toBe(true)

    // Sobe e começa a descer ainda no ar — continua pulando.
    let sawDescending = false
    let guard = 0
    while (!player.has(Grounded) || guard < 5) {
      tick(world)
      if (player.get(Velocity).y < 0 && !player.has(Grounded)) {
        sawDescending = true
        expect(player.has(Jumping)).toBe(true)
      }
      guard++
      if (guard > 300) throw new Error('nunca aterrissou')
    }

    expect(sawDescending).toBe(true)
    expect(player.has(Jumping)).toBe(false)
  })

  it('cair de uma borda sem pular não é `Jumping`', () => {
    const { world, player } = makeWorld({
      playerPosition: { x: 0, y: 4, z: 0 },
    })

    for (let i = 0; i < 10; i++) {
      tick(world)
      expect(player.has(Jumping)).toBe(false)
    }
    expect(player.has(Grounded)).toBe(false)
  })

  it('sem `input.jump`, ou no ar (sem `Grounded`), não adiciona `Jumped`', () => {
    const { world, player } = makeWorld({
      playerPosition: { x: 0, y: 1, z: 0 },
    })
    run(world, 30)

    tick(world) // sem input.jump
    expect(player.has(Jumped)).toBe(false)

    tick(world, { jump: true }) // pula de verdade — dispara Jumped
    player.remove(Jumped) // limpa pra testar o próximo tick isolado

    tick(world, { jump: true }) // ainda no ar (subindo) — não pula de novo
    expect(player.has(Jumped)).toBe(false)
  })

  it('pular desconta o custo de stamina uma vez; sem stamina suficiente, não pula', () => {
    // Vitals do player de teste vem de 'boy' (test/makeWorld.js) —
    // JUMP_STAMINA_COST/STAMINA_REGEN_DELAY_AFTER_USE deixaram de ser
    // globais e viraram parte de `vitals` por espécie (ver
    // docs/features/018-troca-de-controle-treinador-criatura.md).
    const { jumpStaminaCost: JUMP_STAMINA_COST } = PLAYER.vitals
    const { world, player } = makeWorld({
      playerPosition: { x: 0, y: 1, z: 0 },
    })
    run(world, 30)
    const yGround = player.get(Position).y
    const { maxStamina, staminaRegenDelayAfterUse } = player.get(Vitals)

    tick(world, { jump: true })
    expect(player.get(Vitals).stamina).toBeCloseTo(
      maxStamina - JUMP_STAMINA_COST,
    )
    expect(player.get(Vitals).staminaRegenDelay).toBeCloseTo(
      staminaRegenDelayAfterUse,
    )

    // pousa de novo antes de tentar o segundo pulo
    for (let i = 0; i < 100; i++) tick(world)

    player.set(Vitals, { stamina: JUMP_STAMINA_COST - 1 })
    tick(world, { jump: true })
    let peak = player.get(Position).y
    for (let i = 0; i < 20; i++) {
      tick(world)
      peak = Math.max(peak, player.get(Position).y)
    }
    // não subiu — o pulo não disparou (tolerância larga: ver nota de
    // precisão de assentamento no teste "pula a partir do chão" acima)
    expect(Math.abs(peak - yGround)).toBeLessThan(0.15)
  })

  it('entidade sem InputControlled (ex.: SummonedCreature) não pula, mesmo com input.jump — só o jogador pula', () => {
    const { world, player } = makeWorld({
      playerPosition: { x: 0, y: 1, z: 0 },
    })
    // Corpo dinâmico criado na hora, mesma função que
    // `partySummonSystem.js` usa pra dar física de verdade a uma
    // criatura invocada (physicsBootstrapSystem só roda uma vez, no
    // início — não alcança uma entidade spawnada depois, ver
    // docs/features/017-locomocao-e-recolhimento-de-criaturas.md).
    const creature = world.spawn(
      Position({ x: 3, y: 1, z: 0 }),
      Rotation,
      Velocity,
      MovementStats(CREATURE.movement),
      Vitals,
      PhysicsBody,
      CharacterController(CREATURE.body),
    )
    const handles = createCharacterBody(creature.get(Position), {
      radius: CREATURE.body.capsuleRadius,
      halfHeight: CREATURE.body.capsuleHalfHeight,
      axis: CREATURE.body.capsuleAxis,
    })
    creature.set(PhysicsBody, handles)

    run(world, 30) // ambos assentam no chão
    const playerGroundY = player.get(Position).y
    const creatureGroundY = creature.get(Position).y

    let playerPeak = playerGroundY
    let creaturePeak = creatureGroundY
    for (let i = 0; i < 100; i++) {
      tick(world, { jump: true })
      playerPeak = Math.max(playerPeak, player.get(Position).y)
      creaturePeak = Math.max(creaturePeak, creature.get(Position).y)
    }

    expect(playerPeak).toBeGreaterThan(playerGroundY + 0.8) // jogador pulou
    expect(creaturePeak - creatureGroundY).toBeLessThan(0.15) // criatura não
  })

  it('personagens colidem entre si de verdade — não se atravessam (pedido explícito do usuário)', () => {
    // Uma tentativa anterior fazia personagens se ignorarem entre si
    // (`InteractionGroups`) — revertida: o usuário não quer que jogador e
    // criaturas se atravessem, só que tenham controle pra não esbarrar
    // (evasão proativa, ver creatureFollowSystem.test.js). No nível físico
    // puro, sem nenhuma evasão rodando, uma criatura parada no caminho do
    // jogador continua sendo um obstáculo sólido de verdade, igual a
    // qualquer outro collider.
    const { world, player } = makeWorld({
      playerPosition: { x: 0, y: 1, z: 0 },
    })
    // Nível montado antes de criar o corpo da criatura na mão — criada
    // antes do 1º tick, o `physicsBootstrapSystem` dava a ela um SEGUNDO
    // corpo, e o primeiro ficava órfão no lugar (era ele que barrava o
    // jogador, enquanto o corpo de verdade era empurrado).
    run(world, 1)
    const creature = world.spawn(
      Position({ x: 3, y: 1, z: 0 }),
      Rotation,
      Velocity,
      MovementStats(CREATURE.movement),
      Vitals,
      PhysicsBody,
      CharacterController(CREATURE.body),
    )
    const handles = createCharacterBody(creature.get(Position), {
      radius: CREATURE.body.capsuleRadius,
      halfHeight: CREATURE.body.capsuleHalfHeight,
      axis: CREATURE.body.capsuleAxis,
    })
    creature.set(PhysicsBody, handles)

    run(world, 200, { right: true }) // pra +x — reta contra a criatura

    // Barrado pela criatura bem antes de alcançar x=3 (a cápsula dela +
    // a do jogador somam raio suficiente pra parar bem antes disso).
    expect(player.get(Position).x).toBeLessThan(2.5)
    // A criatura continua exatamente onde foi colocada — corpo cinemático
    // não é empurrado por colisão, só quem escreve a Velocity dele move.
    expect(creature.get(Position).x).toBeCloseTo(3, 1)
  })

  describe('colado noutro personagem', () => {
    const CHARMANDER = getSpecies('charmander')

    // Personagem (em pé) parado logo à direita de onde o jogador vai
    // encostar. Nível montado antes (mesmo motivo de `spawnCreatureAhead`).
    function spawnNeighbor(world, at) {
      run(world, 1)
      const neighbor = world.spawn(
        Position(at),
        Rotation,
        Velocity,
        MovementStats(CHARMANDER.movement),
        Vitals,
        PhysicsBody,
        CharacterController(CHARMANDER.body),
      )
      neighbor.set(
        PhysicsBody,
        createCharacterBody(at, {
          radius: CHARMANDER.body.capsuleRadius,
          halfHeight: CHARMANDER.body.capsuleHalfHeight,
          axis: CHARMANDER.body.capsuleAxis,
        }),
      )
      return neighbor
    }

    // O defeito do controller do Rapier depende da posição no mundo — por
    // isso várias (ver `getCharacterAvoidanceController`). Faixa z = -30: livre
    // dos obstáculos do nível de teste (z = 20 tem a escadaria).
    const STARTS = [-30, -7.5, 0, 10.3, 25]
    const LANE_Z = -30

    it('encostado e apoiado no chão, consegue se afastar (não fica preso no vizinho)', async () => {
      for (const x0 of STARTS) {
        // física nova a cada posição (corpos da anterior não podem sobrar)
        disposePhysics()
        await initPhysics()
        const { world, player } = makeWorld({
          playerPosition: { x: x0, y: 1, z: LANE_Z },
        })
        try {
          spawnNeighbor(world, { x: x0 + 1.5, y: 1, z: LANE_Z })
          run(world, 30) // assenta no chão
          run(world, 90, { right: true }) // anda até encostar nele
          const touching = player.get(Position).x
          expect(touching, `x0=${x0}: premissa, chegou perto`).toBeGreaterThan(
            x0 + 0.3,
          )

          run(world, 30, { left: true }) // tenta ir embora

          expect(
            touching - player.get(Position).x,
            `x0=${x0}: se afastou`,
          ).toBeGreaterThan(0.3)
        } finally {
          world.destroy()
        }
      }
    })

    it('andar contra ele para na folga do controller, sem entrar', () => {
      const { world, player } = makeWorld({
        playerPosition: { x: 0, y: 1, z: 0 },
      })
      const neighbor = spawnNeighbor(world, { x: 1.5, y: 1, z: 0 })
      run(world, 30)
      run(world, 120, { right: true })

      const rapier = getRapierWorld()
      const mine = rapier.getCollider(player.get(PhysicsBody).colliderHandle)
      const theirs = rapier.getCollider(
        neighbor.get(PhysicsBody).colliderHandle,
      )
      expect(mine.contactCollider(theirs, 1).distance).toBeGreaterThan(0)
      world.destroy()
    })
  })

  describe('criatura desmaiada no caminho', () => {
    // Nível montado ANTES de criar o corpo dela na mão: o
    // `physicsBootstrapSystem` cria um corpo pra todo `CharacterController`
    // no 1º tick — criada antes, ela ficaria com dois (o da mão, órfão,
    // viraria uma parede que o desmaio não desliga).
    function spawnCreatureAhead(world) {
      run(world, 1)
      const creature = world.spawn(
        Position({ x: 3, y: 1, z: 0 }),
        Rotation,
        Velocity,
        MovementStats(CREATURE.movement),
        Vitals,
        PhysicsBody,
        CharacterController(CREATURE.body),
      )
      creature.set(
        PhysicsBody,
        createCharacterBody(creature.get(Position), {
          radius: CREATURE.body.capsuleRadius,
          halfHeight: CREATURE.body.capsuleHalfHeight,
          axis: CREATURE.body.capsuleAxis,
        }),
      )
      return creature
    }

    it('o jogador passa por cima e ela não sai do lugar (não é empurrada)', () => {
      const { world, player } = makeWorld({
        playerPosition: { x: 0, y: 1, z: 0 },
      })
      const creature = spawnCreatureAhead(world)
      run(world, 30) // assenta no chão
      const resting = { ...creature.get(Position) }
      desmaiar(world, creature)

      run(world, 200, { right: true }) // reta contra ela, e além

      expect(player.get(Position).x).toBeGreaterThan(4)
      // Tolerância de 5cm: a cápsula deitada ainda assenta ~1cm no chão
      // sozinha (acordada ou não). Empurrada, ia metros pra frente.
      expect(creature.get(Position).x).toBeCloseTo(resting.x, 1)
      expect(creature.get(Position).z).toBeCloseTo(resting.z, 1)
    })

    it('continua caindo e pisando no chão (só o terreno vale pra ela)', () => {
      const { world } = makeWorld({ playerPosition: { x: -10, y: 1, z: 0 } })
      run(world, 1)
      const creature = world.spawn(
        Position({ x: 3, y: 3, z: 0 }),
        Rotation,
        Velocity,
        MovementStats(CREATURE.movement),
        Vitals,
        PhysicsBody,
        CharacterController(CREATURE.body),
      )
      creature.set(
        PhysicsBody,
        createCharacterBody(creature.get(Position), {
          radius: CREATURE.body.capsuleRadius,
          halfHeight: CREATURE.body.capsuleHalfHeight,
          axis: CREATURE.body.capsuleAxis,
        }),
      )
      desmaiar(world, creature)

      run(world, 180)

      expect(creature.get(Position).y).toBeCloseTo(
        restingHeightFor(CREATURE.body),
        1,
      )
    })
  })
})
