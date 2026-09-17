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
} from '@/core/traits'
import {
  initPhysics,
  disposePhysics,
  getRapierWorld,
} from '@/core/physics/physicsWorld'
import { quaternionFromAxisAngle } from '@/core/math'
import { createCharacterBody } from '@/core/physics/colliders'
import { getSpecies } from '@/core/data/species'
import { inputSystem } from './inputSystem'
import { physicsBootstrapSystem } from './physicsBootstrapSystem'
import { cameraControlSystem } from './cameraControlSystem'
import { movementSystem } from './movementSystem'
import { characterPhysicsSystem } from './characterPhysicsSystem'
import { physicsStepSystem } from './physicsStepSystem'
import { syncPhysicsSystem } from './syncPhysicsSystem'

const FOX = getSpecies('fox')

/** Extensão vertical da cápsula acima do chão em repouso — raio+meia-altura
 * em pé ('y'), só o raio deitada ('x'/'z', onde a meia-altura vira extensão
 * horizontal). */
function restingHeightFor({ capsuleRadius, capsuleHalfHeight, capsuleAxis }) {
  return capsuleAxis === 'y' ? capsuleRadius + capsuleHalfHeight : capsuleRadius
}

/** Como makeWorld, mas com um CharacterController customizado — pra testar
 * corpos com capsuleAxis diferente do Fox sem mudar o helper compartilhado. */
function makeWorldWithBody(body, playerPosition = { x: 0, y: 3, z: 0 }) {
  const world = createWorld()
  const player = world.spawn(
    Position(playerPosition),
    Rotation,
    Velocity,
    InputState,
    InputControlled,
    MovementStats(FOX.movement),
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
    const restingHeight = restingHeightFor(FOX.body)
    expect(pos.y).toBeGreaterThan(restingHeight - 0.05)
    expect(pos.y).toBeLessThan(restingHeight + 0.3)
    expect(player.has(Grounded)).toBe(true)
  })

  it('cápsula deitada (capsuleAxis x) repousa numa altura diferente — só o raio, não raio+meia-altura', () => {
    const body = {
      ...FOX.body,
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
      playerPosition: { x: 0, y: 1, z: 0 },
    })
    run(world, 6)
    const yFlat = player.get(Position).y
    // Ticks suficientes pra percorrer bem além da rampa, derivado da
    // velocidade de andar ATUAL da espécie — não um número fixo (já
    // quebrou uma vez quando FOX.movement.walkSpeed mudou de 4 pra 2).
    const ticksToClimb = Math.ceil((8 / FOX.movement.walkSpeed) * 60)
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

  it('pular desconta o custo de stamina uma vez; sem stamina suficiente, não pula', () => {
    // Vitals do player de teste vem de 'fox' (test/makeWorld.js) —
    // JUMP_STAMINA_COST/STAMINA_REGEN_DELAY_AFTER_USE deixaram de ser
    // globais e viraram parte de `vitals` por espécie (ver
    // docs/features/018-troca-de-controle-treinador-criatura.md).
    const { jumpStaminaCost: JUMP_STAMINA_COST } = FOX.vitals
    const { world, player } = makeWorld({
      playerPosition: { x: 0, y: 1, z: 0 },
    })
    run(world, 30)
    const yGround = player.get(Position).y

    tick(world, { jump: true })
    expect(player.get(Vitals).stamina).toBeCloseTo(100 - JUMP_STAMINA_COST)
    expect(player.get(Vitals).staminaRegenDelay).toBeCloseTo(
      FOX.vitals.staminaRegenDelayAfterUse,
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
      MovementStats(FOX.movement),
      Vitals,
      PhysicsBody,
      CharacterController(FOX.body),
    )
    const handles = createCharacterBody(creature.get(Position), {
      radius: FOX.body.capsuleRadius,
      halfHeight: FOX.body.capsuleHalfHeight,
      axis: FOX.body.capsuleAxis,
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
    const creature = world.spawn(
      Position({ x: 3, y: 1, z: 0 }),
      Rotation,
      Velocity,
      MovementStats(FOX.movement),
      Vitals,
      PhysicsBody,
      CharacterController(FOX.body),
    )
    const handles = createCharacterBody(creature.get(Position), {
      radius: FOX.body.capsuleRadius,
      halfHeight: FOX.body.capsuleHalfHeight,
      axis: FOX.body.capsuleAxis,
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
})
