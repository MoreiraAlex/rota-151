import { describe, it, expect, afterEach } from 'vitest'
import { createWorld } from 'koota'
import { getSpecies } from '@/core/data/species'
import { resolveCreatureAttack } from '@/core/data/attacks'
import { computeAimRay } from '@/core/camera/orbitCamera'
import {
  initPhysics,
  disposePhysics,
  stepPhysics,
} from '@/core/physics/physicsWorld'
import { createStaticLevel } from '@/core/physics/colliders'
import {
  ActionState,
  AttackCooldowns,
  AttackEffect,
  AttackPulse,
  CharacterController,
  InputControlled,
  OrbitCamera,
  PhysicsBody,
  Position,
  Rotation,
  SummonedCreature,
  Vitals,
  vitalsFromSpecies,
} from '@/core/traits'
import {
  creatureAttackSystem,
  resolveAttackImpactPoint,
  resolveEffectRotation,
} from './creatureAttackSystem'

const DELTA = 1 / 60
// Espécie estável de teste (mesma usada por `test/makeWorld.js`) — o
// ataque é exclusivo de `kind: 'pokemon'` (o treinador não ataca direto,
// ver docs/backlog.md), então lido daqui, não de `getPlayerSpecies()`.
// `fox` referencia `'scratch'` sem override (ver core/data/species/fox/
// index.js) — `ATTACK` aqui é a definição JÁ RESOLVIDA
// (`resolveCreatureAttack`, core/data/attacks/index.js), não mais um
// bloco inline em `actions.attack`.
const ATTACK = resolveCreatureAttack(getSpecies('fox').attacks.primary)
const FOX_BODY = getSpecies('fox').body

const spawnedWorlds = []
function spawnWorld() {
  const world = createWorld()
  spawnedWorlds.push(world)
  return world
}

afterEach(() => {
  while (spawnedWorlds.length) spawnedWorlds.pop().destroy()
})

function spawnControlledCreature(world, { speciesId = 'fox', position } = {}) {
  return world.spawn(
    Position(position ?? { x: 0, y: 1, z: 0 }),
    Rotation,
    ActionState,
    AttackCooldowns,
    CharacterController(getSpecies(speciesId).body),
    PhysicsBody,
    vitalsFromSpecies(getSpecies(speciesId).vitals),
    SummonedCreature({ slot: 'slot1', speciesId }),
    InputControlled,
  )
}

function tick(world, input = {}, delta = DELTA) {
  creatureAttackSystem({ world, delta, input })
}

function advanceUntilFree(world, creature) {
  let guard = 0
  while (creature.get(ActionState).current !== null) {
    tick(world, {})
    guard++
    if (guard > 1000) throw new Error('ação nunca terminou (guard estourado)')
  }
}

/** Avança até o `AttackEffect` nascer (instante `effectAt`) e o devolve. */
function advanceUntilEffectSpawns(world) {
  const totalTicks = Math.ceil(ATTACK.duration / DELTA) + 2
  for (let i = 0; i < totalTicks; i++) {
    tick(world, {})
    const [effect] = world.query(AttackEffect)
    if (effect) return effect
  }
  throw new Error('AttackEffect nunca nasceu (guard estourado)')
}

describe('creatureAttackSystem', () => {
  it('botão esquerdo (primary) dispara a ação "attack" numa criatura controlada e desconta STAMINA_COST uma única vez', () => {
    const world = spawnWorld()
    const creature = spawnControlledCreature(world)
    const staminaBefore = creature.get(Vitals).stamina

    tick(world, { primary: true })

    expect(creature.get(ActionState).current).toBe('attack')
    expect(creature.get(ActionState).elapsed).toBeCloseTo(DELTA)
    expect(creature.get(Vitals).stamina).toBeCloseTo(
      staminaBefore - ATTACK.staminaCost,
    )
    expect(creature.get(Vitals).staminaRegenDelay).toBeCloseTo(
      creature.get(Vitals).staminaRegenDelayAfterUse,
    )
  })

  it('sem stamina suficiente, o ataque não dispara nem desconta nada', () => {
    const world = spawnWorld()
    const creature = spawnControlledCreature(world)
    creature.set(Vitals, { stamina: ATTACK.staminaCost - 1 })

    tick(world, { primary: true })

    expect(creature.get(ActionState).current).toBe(null)
    expect(creature.get(Vitals).stamina).toBeCloseTo(ATTACK.staminaCost - 1)
  })

  it('sem primary, não faz nada', () => {
    const world = spawnWorld()
    const creature = spawnControlledCreature(world)

    tick(world, {})

    expect(creature.get(ActionState).current).toBe(null)
  })

  it('sem InputControlled, primary não dispara nada (criatura não pilotada agora)', () => {
    const world = spawnWorld()
    const creature = world.spawn(
      Position({ x: 0, y: 1, z: 0 }),
      Rotation,
      ActionState,
      AttackCooldowns,
      CharacterController(FOX_BODY),
      PhysicsBody,
      vitalsFromSpecies(getSpecies('fox').vitals),
      SummonedCreature({ slot: 'slot1', speciesId: 'fox' }),
    )

    tick(world, { primary: true })

    expect(creature.get(ActionState).current).toBe(null)
  })

  it('espécie desconhecida (sem attacks.primary pra resolver) não ataca, sem quebrar', () => {
    const world = spawnWorld()
    const creature = world.spawn(
      Position({ x: 0, y: 1, z: 0 }),
      Rotation,
      ActionState,
      AttackCooldowns,
      CharacterController(FOX_BODY),
      PhysicsBody,
      vitalsFromSpecies(getSpecies('fox').vitals),
      SummonedCreature({ slot: 'slot1', speciesId: 'nao-existe' }),
      InputControlled,
    )

    tick(world, { primary: true })

    expect(creature.get(ActionState).current).toBe(null)
  })

  it('sem câmera no world (teste isolado), cai no fallback "pra frente" (+Z) — mesmo comportamento de resolveAimDirection/resolveAimPoint', () => {
    const world = spawnWorld()
    spawnControlledCreature(world, { position: { x: 2, y: 1, z: 3 } })

    tick(world, { primary: true })
    const effect = advanceUntilEffectSpawns(world)

    const pos = effect.get(Position)
    expect(pos.x).toBeCloseTo(2)
    expect(pos.y).toBeCloseTo(
      1 + FOX_BODY.capsuleRadius + FOX_BODY.capsuleHalfHeight,
    )
    expect(pos.z).toBeCloseTo(3 + ATTACK.range)
    expect(effect.get(AttackEffect).radius).toBeCloseTo(ATTACK.radius)
    expect(effect.get(AttackEffect).effectGroup).toBe(ATTACK.visual.effectGroup)
    expect(effect.get(AttackEffect).revealDuration).toBeCloseTo(
      ATTACK.visual.revealDuration,
    )
    expect(effect.get(AttackEffect).visualScale).toBeCloseTo(
      ATTACK.visual.scale,
    )
    expect(effect.get(AttackEffect).lifetime).toBeCloseTo(
      ATTACK.visual.effectVisualDuration,
    )
  })

  it('override por criatura (ex.: charmander, range sobrescrito pra 1 em vez do 1.4 base de scratch) é respeitado de ponta a ponta', () => {
    const world = spawnWorld()
    const charmanderAttack = resolveCreatureAttack(
      getSpecies('charmander').attacks.primary,
    )
    expect(charmanderAttack.range).toBe(1) // confere a premissa do teste
    expect(charmanderAttack.range).not.toBe(ATTACK.range) // diferente da base

    spawnControlledCreature(world, {
      speciesId: 'charmander',
      position: { x: 0, y: 1, z: 0 },
    })
    tick(world, { primary: true })
    const effect = advanceUntilEffectSpawns(world)

    // Sem câmera, direção cai no fallback (0,0,1) — z reflete o RANGE
    // sobrescrito (1), não o 1.4 da definição base de 'scratch'.
    expect(effect.get(Position).z).toBeCloseTo(1)
  })

  it('marca AttackPulse na CRIATURA exatamente quando o AttackEffect nasce (mesmo instante EFFECT_AT) — som do impacto, ver attackAudioSystem.js', () => {
    const world = spawnWorld()
    const creature = spawnControlledCreature(world)

    tick(world, { primary: true })
    expect(creature.has(AttackPulse)).toBe(false) // ainda antes de EFFECT_AT

    advanceUntilEffectSpawns(world)
    expect(creature.has(AttackPulse)).toBe(true)
  })

  it('a direção do golpe (corpo E área efetiva) respeita a câmera — yaw/pitch, não só a Rotation.y de antes do disparo', () => {
    const world = spawnWorld()
    const startPos = { x: 0, y: 1, z: 0 }
    const creature = spawnControlledCreature(world, { position: startPos })
    creature.set(Rotation, { y: 2 }) // deve ser sobrescrito pra encarar a câmera
    const orbit = { yaw: Math.PI / 4, pitch: 0.3, distance: 10 }
    world.spawn(OrbitCamera(orbit))

    tick(world, { primary: true })

    // Reproduz `resolveAimDirection`/`computeAimRay` de forma independente
    // (mesmo padrão de `resolveExpectedAimPoint` em
    // `partySummonSystem.test.js`) — sem física carregada, a colisão da
    // câmera não corrige nada, então o `excludeColliderHandle` (-1, default
    // de `PhysicsBody`) não muda o resultado.
    const { direction } = computeAimRay(startPos, orbit, -1)
    expect(creature.get(Rotation).y).toBeCloseTo(
      Math.atan2(direction.x, direction.z),
    )

    const effect = advanceUntilEffectSpawns(world)
    const pos = effect.get(Position)
    const originY =
      startPos.y + FOX_BODY.capsuleRadius + FOX_BODY.capsuleHalfHeight
    expect(pos.x).toBeCloseTo(direction.x * ATTACK.range)
    expect(pos.y).toBeCloseTo(originY + direction.y * ATTACK.range)
    expect(pos.z).toBeCloseTo(direction.z * ATTACK.range)
    // O VFX orienta pela direção 3D COMPLETA (pitch + yaw) — não só o
    // yaw horizontal que o CORPO usa (pedido do usuário: "a orientação
    // deve ser configurável, permitindo rotacionar o efeito livremente").
    const horizontalLength = Math.hypot(direction.x, direction.z)
    const expectedPitch = Math.atan2(-direction.y, horizontalLength)
    expect(effect.get(Rotation).y).toBeCloseTo(creature.get(Rotation).y)
    expect(effect.get(Rotation).x).toBeCloseTo(expectedPitch)
  })

  it('rotationOffset (visual.rotationOffset, graus) é somado por cima do yaw/pitch calculados (resolveEffectRotation)', () => {
    const direction = { x: 0, y: 0, z: 1 } // pra frente, nível (yaw=0, pitch=0)

    const semOffset = resolveEffectRotation(direction, { x: 0, y: 0, z: 0 })
    expect(semOffset).toEqual({ x: 0, y: 0, z: 0 })

    const comOffset = resolveEffectRotation(direction, { x: 10, y: 45, z: 0 })
    expect(comOffset.x).toBeCloseTo(10 * (Math.PI / 180))
    expect(comOffset.y).toBeCloseTo(45 * (Math.PI / 180))
    expect(comOffset.z).toBe(0)
  })

  it('resolveEffectRotation usa a direção 3D completa (pitch) quando o golpe mira pra cima/baixo, sem offset nenhum', () => {
    const olhandoParaCima = { x: 0, y: 1, z: 0 }
    const rotation = resolveEffectRotation(olhandoParaCima, null)

    // horizontalLength = 0 aqui → atan2(-1, 0) = -PI/2.
    expect(rotation.x).toBeCloseTo(-Math.PI / 2)
    expect(rotation.z).toBe(0)
  })

  it('a ação termina sozinha (current volta a null) depois de DURATION', () => {
    const world = spawnWorld()
    const creature = spawnControlledCreature(world)

    tick(world, { primary: true })
    advanceUntilFree(world, creature)

    expect(creature.get(ActionState).current).toBe(null)
  })

  it('não inicia um segundo ataque enquanto o primeiro está em andamento (segura primary)', () => {
    const world = spawnWorld()
    const creature = spawnControlledCreature(world)

    tick(world, { primary: true })
    const elapsedAfterFirst = creature.get(ActionState).elapsed
    tick(world, { primary: true })

    expect(creature.get(ActionState).current).toBe('attack')
    expect(creature.get(ActionState).elapsed).toBeCloseTo(
      elapsedAfterFirst + DELTA,
    )
  })

  it('ignora uma ActionState ocupada por outra ação (ex.: dash) — não sobrescreve nem soma elapsed', () => {
    const world = spawnWorld()
    const creature = spawnControlledCreature(world)
    creature.set(ActionState, { current: 'dash', elapsed: 0.1 })

    tick(world, { primary: true })

    expect(creature.get(ActionState).current).toBe('dash')
    expect(creature.get(ActionState).elapsed).toBeCloseTo(0.1)
  })

  it('disparo trava AttackCooldowns.primary em ATTACK.cooldown (hoje 0 no ataque comum — no-op, só stamina trava de verdade)', () => {
    const world = spawnWorld()
    const creature = spawnControlledCreature(world)

    tick(world, { primary: true })

    expect(creature.get(AttackCooldowns).primary).toBe(ATTACK.cooldown)
  })

  it('AttackCooldowns.primary > 0 impede o disparo do mouse mesmo com stamina cheia', () => {
    const world = spawnWorld()
    const creature = spawnControlledCreature(world)
    creature.set(AttackCooldowns, { primary: 1 })

    tick(world, { primary: true })

    expect(creature.get(ActionState).current).toBe(null)
  })

  it('AttackCooldowns.primary decrementa todo tick, mesmo sem nenhuma ação em andamento — e nunca fica negativo', () => {
    const world = spawnWorld()
    const creature = spawnControlledCreature(world)
    creature.set(AttackCooldowns, { primary: DELTA * 1.5 })

    tick(world, {})
    expect(creature.get(AttackCooldowns).primary).toBeCloseTo(DELTA * 0.5)

    tick(world, {})
    expect(creature.get(AttackCooldowns).primary).toBe(0)
  })

  it('secondary1 (tecla Q) dispara a skill própria da espécie (ex.: bulbasaur → vine-whip), independente do mouse', () => {
    const world = spawnWorld()
    const creature = spawnControlledCreature(world, { speciesId: 'bulbasaur' })
    const vineWhip = resolveCreatureAttack(
      getSpecies('bulbasaur').attacks.secondary1,
    )

    tick(world, { secondary1: true })

    expect(creature.get(ActionState).current).toBe('attack')
    expect(creature.get(ActionState).pendingSlot).toBe('secondary1')
    expect(creature.get(Vitals).stamina).toBeCloseTo(
      getSpecies('bulbasaur').vitals.maxStamina - vineWhip.staminaCost,
    )
  })

  it('cooldown de secondary1 (skill) não trava o ataque comum do mouse (primary), e vice-versa — cada slot tem o PRÓPRIO cooldown', () => {
    const world = spawnWorld()
    const creature = spawnControlledCreature(world, { speciesId: 'bulbasaur' })
    // Simula "secondary1 acabou de ser usado e está em cooldown" direto
    // no trait — não depende do valor de `VINE_WHIP_ATTACK.cooldown`
    // configurado agora (dado de balanceamento, pode mudar; o que este
    // teste garante é o MECANISMO de isolamento entre slots, não um
    // número específico).
    creature.set(AttackCooldowns, { secondary1: 1 })

    tick(world, { primary: true })

    // O ataque comum (cooldown próprio, `primary`) dispara normalmente,
    // sem ser bloqueado pelo cooldown da SKILL (`secondary1`).
    expect(creature.get(ActionState).current).toBe('attack')
    expect(creature.get(ActionState).pendingSlot).toBe('primary')
  })

  it('segurando mouse E Q ao mesmo tempo, só o mouse (primary) dispara — prioridade da lista, um slot por tick', () => {
    const world = spawnWorld()
    const creature = spawnControlledCreature(world, { speciesId: 'bulbasaur' })

    tick(world, { primary: true, secondary1: true })

    expect(creature.get(ActionState).pendingSlot).toBe('primary')
  })

  it('espécie sem secondary1 configurado (ex.: fox) — tecla Q não dispara nada, sem quebrar', () => {
    const world = spawnWorld()
    const creature = spawnControlledCreature(world) // fox, sem secondary1

    tick(world, { secondary1: true })

    expect(creature.get(ActionState).current).toBe(null)
  })
})

describe('resolveAttackImpactPoint — respeita o trajeto, não só o destino', () => {
  afterEach(() => {
    disposePhysics()
  })

  it('sem física carregada, cai no ponto cheio (origin + direction * range)', () => {
    const origin = { x: 1, y: 2, z: 3 }
    const direction = { x: 0, y: 0, z: 1 }

    const point = resolveAttackImpactPoint(origin, direction, 5, -1)

    expect(point).toEqual({ x: 1, y: 2, z: 8 })
  })

  it('sem nada no caminho (com física real carregada), também cai no ponto cheio', async () => {
    await initPhysics()
    createStaticLevel()
    stepPhysics() // broad-phase só existe depois de um step (ver raycast.js)

    // Longe de qualquer obstáculo do nível de teste (mesmas coordenadas
    // já usadas por `summonBallSystem.test.js`/`projectileSystem.test.js`
    // pro mesmo propósito).
    const origin = { x: 20, y: 5, z: 20 }
    const direction = { x: 0, y: 0, z: 1 }

    const point = resolveAttackImpactPoint(origin, direction, 3, -1)

    expect(point).toEqual({ x: 20, y: 5, z: 23 })
  })

  it('com o CHÃO no caminho (mirando pra baixo com range grande, simulando um chicote), para no ponto de impacto — não atravessa', async () => {
    await initPhysics()
    createStaticLevel()
    stepPhysics()

    const origin = { x: 20, y: 2, z: 20 } // 2m acima do chão (y=0)
    const direction = { x: 0, y: -1, z: 0 }
    // range bem maior que a distância real até o chão — sem o raycast,
    // "teleportaria" o ponto de impacto pra bem abaixo da superfície.
    const point = resolveAttackImpactPoint(origin, direction, 50, -1)

    expect(point.x).toBeCloseTo(20)
    expect(point.y).toBeCloseTo(0, 1)
    expect(point.z).toBeCloseTo(20)
  })
})
