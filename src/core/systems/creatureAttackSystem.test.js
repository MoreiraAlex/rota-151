import { describe, it, expect, afterEach } from 'vitest'
import { createWorld } from 'koota'
import { getSpecies } from '@/core/data/species'
import { resolveCreatureAttack } from '@/core/data/attacks'
import { computeAimRay } from '@/core/camera/orbitCamera'
import { disposePhysics } from '@/core/physics/physicsWorld'
import { createEventQueue, EVENT_TYPES } from '@/core/events'
import { castRay } from '@/core/physics/raycast'
import { resolveGroundY } from '@/core/battle/attackGeometry'
import {
  addStaticBox,
  initTestTerrain,
  settleTerrain,
} from '@/test/physicsTerrain'
import {
  ActionState,
  AttackAim,
  AttackCooldowns,
  AttackEffect,
  AttackPulse,
  CombatMode,
  Mood,
  CharacterController,
  IndividualValues,
  InputControlled,
  OrbitCamera,
  PhysicsBody,
  Position,
  resolveMaxStamina,
  Rotation,
  SummonedCreature,
  Vitals,
  vitalsFromSpecies,
  WildCreature,
} from '@/core/traits'
import {
  creatureAttackSystem,
  resolveCastMode,
  resolveAttackImpactPoint,
  resolveAttackTarget,
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

// Fila de eventos compartilhada pelos ticks de cada teste — mesma que o
// `GameLoop.jsx` passa em `context.events`; esvaziada entre testes.
const events = createEventQueue()

afterEach(() => {
  while (spawnedWorlds.length) spawnedWorlds.pop().destroy()
  events.drain()
})

function spawnControlledCreature(
  world,
  { speciesId = 'fox', position, individualValues = null } = {},
) {
  return world.spawn(
    Position(position ?? { x: 0, y: 1, z: 0 }),
    Rotation,
    ActionState,
    AttackCooldowns,
    AttackAim,
    Mood,
    CharacterController(getSpecies(speciesId).body),
    PhysicsBody,
    vitalsFromSpecies(getSpecies(speciesId), individualValues),
    SummonedCreature({ slot: 'slot1', speciesId }),
    InputControlled,
    IndividualValues(individualValues ?? {}),
  )
}

function spawnWildCreature(
  world,
  { speciesId = 'charmander', position, individualValues = null } = {},
) {
  return world.spawn(
    Position(position ?? { x: 0, y: 1, z: 0 }),
    Rotation,
    CharacterController(getSpecies(speciesId).body),
    PhysicsBody,
    vitalsFromSpecies(getSpecies(speciesId), individualValues),
    WildCreature({ speciesId }),
    IndividualValues(individualValues ?? {}),
  )
}

// A maioria dos testes aqui cobre a MECÂNICA do golpe (dano, trajetória,
// cooldown...), não o modo de lançamento — então força lançar na hora no
// primeiro aperto. Os testes do indicador (`castMode: 'confirm'`) passam
// `REAL_CAST_MODE`, que respeita a definição de cada ataque.
const INSTANT_CAST = { castModeOverride: 'instant' }
const REAL_CAST_MODE = { castModeOverride: null }

function tick(world, input = {}, settings = INSTANT_CAST) {
  creatureAttackSystem({ world, delta: DELTA, input, events, settings })
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
      vitalsFromSpecies(getSpecies('fox')),
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
      vitalsFromSpecies(getSpecies('fox')),
      SummonedCreature({ slot: 'slot1', speciesId: 'nao-existe' }),
      InputControlled,
      IndividualValues,
    )

    tick(world, { primary: true })

    expect(creature.get(ActionState).current).toBe(null)
  })

  it('sem câmera no world (teste isolado), cai no fallback "pra frente" (+Z) — mesmo comportamento de resolveAimDirection/resolveAimPoint', () => {
    const world = spawnWorld()
    spawnControlledCreature(world, { position: { x: 2, y: 1, z: 3 } })

    tick(world, { primary: true })
    const effect = advanceUntilEffectSpawns(world)

    // O golpe sai do centro do corpo (`Position`, centro da cápsula) —
    // `fox` não declara `body.attackOriginHeight`.
    const pos = effect.get(Position)
    expect(pos.x).toBeCloseTo(2)
    expect(pos.y).toBeCloseTo(1)
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

  it('corpo a corpo sem alvo (charmander/scratch): segue o giro horizontal da câmera, mas sai reto — não inclina pro chão com a câmera olhando de cima', () => {
    const world = spawnWorld()
    const startPos = { x: 0, y: 1, z: 0 }
    const species = getSpecies('charmander')
    const scratch = resolveCreatureAttack(species.attacks.primary)
    const creature = spawnControlledCreature(world, {
      speciesId: 'charmander',
      position: startPos,
    })
    creature.set(Rotation, { y: 2 }) // deve ser sobrescrito pra encarar a câmera
    const orbit = { yaw: Math.PI / 4, pitch: 0.3, distance: 10 }
    world.spawn(OrbitCamera(orbit))
    expect(scratch.aim).toBe('melee') // premissa do teste

    tick(world, { primary: true })

    // Reproduz `computeAimRay` de forma independente, com o enquadramento
    // da espécie — sem física carregada, a colisão da câmera não corrige
    // nada.
    const { direction } = computeAimRay(
      startPos,
      orbit,
      -1,
      species.camera.targetHeight,
      species.camera.shoulderOffset,
    )
    const horizontalLength = Math.hypot(direction.x, direction.z)
    expect(direction.y).toBeLessThan(0) // premissa: câmera olha pra baixo
    expect(creature.get(Rotation).y).toBeCloseTo(
      Math.atan2(direction.x, direction.z),
    )

    const effect = advanceUntilEffectSpawns(world)
    const pos = effect.get(Position)
    expect(pos.x).toBeCloseTo((direction.x / horizontalLength) * scratch.range)
    expect(pos.y).toBeCloseTo(startPos.y)
    expect(pos.z).toBeCloseTo((direction.z / horizontalLength) * scratch.range)
    expect(effect.get(Rotation).y).toBeCloseTo(creature.get(Rotation).y)
    expect(effect.get(Rotation).x).toBeCloseTo(0)
  })

  it('à distância (charmander/ember): segue só o giro horizontal da câmera — sem inclinação (combate 2.5D)', () => {
    const world = spawnWorld()
    const startPos = { x: 0, y: 1, z: 0 }
    const creature = spawnControlledCreature(world, {
      speciesId: 'charmander',
      position: startPos,
    })
    const orbit = { yaw: Math.PI / 4, pitch: 0.3, distance: 10 }
    world.spawn(OrbitCamera(orbit))
    const ember = resolveCreatureAttack(
      getSpecies('charmander').attacks.secondary1,
    )
    expect(ember.aim).toBe('ranged') // premissa do teste

    tick(world, { secondary1: true })

    const { direction } = computeAimRay(
      startPos,
      orbit,
      -1,
      getSpecies('charmander').camera.targetHeight,
      getSpecies('charmander').camera.shoulderOffset,
    )
    const effect = advanceUntilEffectSpawns(world)
    const pos = effect.get(Position)
    const horizontalLength = Math.hypot(direction.x, direction.z)
    expect(direction.y).toBeLessThan(0) // premissa: câmera olha pra baixo
    expect(pos.x).toBeCloseTo((direction.x / horizontalLength) * ember.range)
    expect(pos.y).toBeCloseTo(startPos.y)
    expect(pos.z).toBeCloseTo((direction.z / horizontalLength) * ember.range)
    expect(effect.get(Rotation).y).toBeCloseTo(creature.get(Rotation).y)
    expect(effect.get(Rotation).x).toBeCloseTo(0)
  })

  it('corpo a corpo com a câmera olhando de cima: acerta um alvo pequeno de lado e mais baixo (assistência puxa o giro; altura não importa no plano)', () => {
    const world = spawnWorld()
    spawnControlledCreature(world, {
      speciesId: 'bulbasaur',
      position: { x: 0, y: 1, z: 0 },
    })
    const orbit = { yaw: 0, pitch: 0.35, distance: 10 }
    world.spawn(OrbitCamera(orbit))
    // Alvo a 1.2m, 40° de lado de pra onde a câmera aponta (dentro do
    // cone de 45°) e bem mais baixo que a origem do golpe (y=1). Um golpe
    // reto pra frente passaria longe (lateral ~0.77m + altura ~0.55m >
    // alcance 0.35 + 0.3) — só acerta se a assistência puxar a direção.
    const { direction } = computeAimRay(
      { x: 0, y: 1, z: 0 },
      orbit,
      -1,
      getSpecies('bulbasaur').camera.targetHeight,
      getSpecies('bulbasaur').camera.shoulderOffset,
    )
    const horizontalLength = Math.hypot(direction.x, direction.z)
    const fx = direction.x / horizontalLength
    const fz = direction.z / horizontalLength
    const side = (40 * Math.PI) / 180
    const target = spawnWildCreature(world, {
      speciesId: 'charmander',
      position: {
        x: (fx * Math.cos(side) + fz * Math.sin(side)) * 1.2,
        y: 0.3,
        z: (-fx * Math.sin(side) + fz * Math.cos(side)) * 1.2,
      },
    })
    const hpBefore = target.get(Vitals).hp

    tick(world, { primary: true })
    advanceUntilEffectSpawns(world)

    expect(target.get(Vitals).hp).toBeLessThan(hpBefore)
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
    // IV explícito (não `null`) — bulbasaur tem `stats` migrado (base/ev,
    // sem `iv`/`stat` fixo na espécie, ver docs/features/029-*.md), então
    // o stamina máximo de verdade depende do IV desta entidade, não de
    // um literal na espécie.
    const individualValues = {
      hp: 20,
      attack: 20,
      defense: 20,
      sp_atk: 20,
      sp_def: 20,
      speed: 20,
    }
    const creature = spawnControlledCreature(world, {
      speciesId: 'bulbasaur',
      individualValues,
    })
    const vineWhip = resolveCreatureAttack(
      getSpecies('bulbasaur').attacks.secondary1,
    )
    const maxStamina = resolveMaxStamina(
      getSpecies('bulbasaur'),
      individualValues,
    )

    tick(world, { secondary1: true })

    expect(creature.get(ActionState).current).toBe('attack')
    expect(creature.get(ActionState).pendingSlot).toBe('secondary1')
    expect(creature.get(Vitals).stamina).toBeCloseTo(
      maxStamina - vineWhip.staminaCost,
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

describe('resolveAttackImpactPoint — trajetória 2.5D acompanhando o terreno', () => {
  afterEach(() => {
    disposePhysics()
  })

  const FORWARD = { x: 0, y: 0, z: 1 }

  it('sem física carregada, segue reto na horizontal até o range', () => {
    const point = resolveAttackImpactPoint({ x: 1, y: 2, z: 3 }, FORWARD, 5, -1)

    expect(point).toEqual({ x: 1, y: 2, z: 8 })
  })

  it('ignora a inclinação da direção: sempre anda o range na horizontal', () => {
    const tilted = { x: 0, y: -0.6, z: 0.8 }
    const point = resolveAttackImpactPoint({ x: 0, y: 2, z: 0 }, tilted, 3, -1)

    expect(point.y).toBeCloseTo(2)
    expect(point.z).toBeCloseTo(3)
  })

  it('chão plano sem obstáculo: anda o range inteiro na mesma altura', async () => {
    await initTestTerrain()
    settleTerrain()

    const point = resolveAttackImpactPoint(
      { x: 0, y: 0.45, z: 0 },
      FORWARD,
      3,
      -1,
    )

    expect(point.x).toBeCloseTo(0)
    expect(point.y).toBeCloseTo(0.45)
    expect(point.z).toBeCloseTo(3)
  })

  it('rampa subindo: acompanha o terreno em vez de bater no próprio chão', async () => {
    await initTestTerrain()
    // Rampa subindo em +z (~0.31m por metro).
    addStaticBox({
      center: [0, 0, 5],
      halfExtents: [2, 0.1, 5],
      rotation: { axis: 'x', angle: -0.3 },
    })
    settleTerrain()
    const groundAtStart = resolveGroundY(0, 5, 5, 10)
    const origin = { x: 0, y: groundAtStart + 0.45, z: 5 }

    // Premissa: um golpe reto na horizontal bateria na rampa antes do range.
    const straight = castRay(origin, FORWARD, 3)
    expect(straight).not.toBeNull()
    expect(straight.distance).toBeLessThan(3)

    const point = resolveAttackImpactPoint(origin, FORWARD, 3, -1)

    expect(point.z).toBeCloseTo(8)
    expect(point.y - resolveGroundY(0, 5, 8, 10)).toBeCloseTo(0.45)
  })

  it('parede no caminho: para na face da parede', async () => {
    await initTestTerrain()
    addStaticBox({ center: [0, 1, 2], halfExtents: [2, 1, 0.1] }) // face em z=1.9
    settleTerrain()

    const point = resolveAttackImpactPoint(
      { x: 0, y: 0.45, z: 0 },
      FORWARD,
      3,
      -1,
    )

    expect(point.z).toBeCloseTo(1.9, 2)
  })

  it('borda de terraço subindo: para na borda', async () => {
    await initTestTerrain()
    addStaticBox({ center: [0, 0.9, 2.5], halfExtents: [2, 0.9, 1] }) // borda em z=1.5, topo 1.8m
    settleTerrain()

    const point = resolveAttackImpactPoint(
      { x: 0, y: 0.45, z: 0 },
      FORWARD,
      3,
      -1,
    )

    expect(point.z).toBeCloseTo(1.5, 2)
  })

  it('borda de terraço descendo: para antes de cair', async () => {
    await initTestTerrain()
    addStaticBox({ center: [0, 0.9, 2.5], halfExtents: [2, 0.9, 1] })
    settleTerrain()

    const point = resolveAttackImpactPoint(
      { x: 0, y: 1.8 + 0.45, z: 3 },
      { x: 0, y: 0, z: -1 },
      3,
      -1,
    )

    expect(point.z).toBeGreaterThanOrEqual(1.5)
    expect(point.z).toBeLessThan(1.8)
    expect(point.y).toBeCloseTo(1.8 + 0.45)
  })
})

describe('resolveAttackTarget — combate 2.5D ao longo da trajetória', () => {
  // Trajetória padrão destes testes: de z=0 até z=4, na altura y=1.
  const ORIGIN = { x: 0, y: 1, z: 0 }
  const IMPACT = { x: 0, y: 1, z: 4 }
  const RADIUS = 0.3
  const ON_GROUND = 0

  function hit(world, origin = ORIGIN, impact = IMPACT, elevation = ON_GROUND) {
    return resolveAttackTarget(world, origin, impact, RADIUS, elevation)
  }

  afterEach(() => {
    disposePhysics()
  })

  it('acerta um alvo no MEIO da trajetória, não só na ponta', () => {
    const world = spawnWorld()
    const wild = spawnWildCreature(world, { position: { x: 0, y: 1, z: 2 } })

    const target = hit(world)

    expect(target.entity).toBe(wild)
    // Trajetória atravessa o eixo do corpo — contato é o próprio ponto dela.
    expect(target.contactPoint).toEqual({ x: 0, y: 1, z: 2 })
  })

  it('altura absoluta não importa: alvo mais alto/baixo na horizontal certa é atingido', () => {
    const world = spawnWorld()
    const acima = spawnWildCreature(world, { position: { x: 0, y: 1.8, z: 1 } })

    expect(hit(world)?.entity).toBe(acima)
    acima.set(Position, { x: 0, y: -0.5, z: 1 })
    expect(hit(world)?.entity).toBe(acima)
  })

  it('alvo de lado: acerta se radius + capsuleRadius alcança no plano, contato na superfície do corpo', () => {
    const world = spawnWorld()
    // charmander: capsuleRadius 0.3 → alcance lateral 0.3 + 0.3 = 0.6.
    spawnWildCreature(world, { position: { x: 0.5, y: 1, z: 2 } })

    const target = hit(world)

    expect(target).not.toBeNull()
    expect(target.contactPoint.x).toBeCloseTo(0.2)
    expect(target.contactPoint.y).toBeCloseTo(1)
    expect(target.contactPoint.z).toBeCloseTo(2)
  })

  it('ignora alvo de lado fora de radius + capsuleRadius', () => {
    const world = spawnWorld()
    spawnWildCreature(world, { position: { x: 0.8, y: 1, z: 2 } })

    expect(hit(world)).toBeNull()
  })

  it('ignora alvo além do fim da trajetória', () => {
    const world = spawnWorld()
    spawnWildCreature(world, { position: { x: 0, y: 1, z: 5.5 } })

    expect(hit(world)).toBeNull()
  })

  it('ignora WildCreature já sem HP (morta)', () => {
    const world = spawnWorld()
    const wild = spawnWildCreature(world, { position: { x: 0, y: 1, z: 2 } })
    wild.set(Vitals, { hp: 0 })

    expect(hit(world)).toBeNull()
  })

  it('com vários alvos no caminho, acerta o PRIMEIRO da trajetória (não o mais perto da ponta)', () => {
    const world = spawnWorld()
    const primeiro = spawnWildCreature(world, {
      position: { x: 0, y: 1, z: 1.5 },
    })
    spawnWildCreature(world, { position: { x: 0, y: 1, z: 3.8 } })

    expect(hit(world).entity).toBe(primeiro)
  })

  it('cápsula deitada acompanha o yaw do alvo (bulbasaur, axis z)', () => {
    // bulbasaur: capsuleRadius 0.4, halfHeight 0.15 deitado em z.
    // Alcance lateral = 0.3 + 0.4 = 0.7. Com o centro em x=0.8:
    // - yaw 0: eixo paralelo à trajetória, distância 0.8 → erra;
    // - yaw 90°: eixo vira x, ponta mais perto em x=0.65 → acerta.
    const world = spawnWorld()
    const wild = spawnWildCreature(world, {
      speciesId: 'bulbasaur',
      position: { x: 0.8, y: 1, z: 2 },
    })

    expect(hit(world)).toBeNull()

    wild.set(Rotation, { y: Math.PI / 2 })
    expect(hit(world)?.entity).toBe(wild)
  })

  it('nunca escolhe uma SummonedCreature como alvo (só WildCreature — sem fogo amigo/PvP)', () => {
    const world = spawnWorld()
    spawnControlledCreature(world, { position: { x: 0, y: 1, z: 2 } })

    expect(hit(world)).toBeNull()
  })

  it('fora do plano de combate: diferença de elevação acima de MAX_COMBAT_HEIGHT_DIFF não acerta', async () => {
    await initTestTerrain()
    settleTerrain()
    const world = spawnWorld()
    const origin = { x: 0, y: 0.45, z: 0 }
    const impact = { x: 0, y: 0.45, z: 3 }
    // charmander pulando: pé a 1.5m do chão, bem em cima da trajetória.
    spawnWildCreature(world, { position: { x: 0, y: 0.45 + 1.5, z: 1.5 } })

    expect(hit(world, origin, impact, ON_GROUND)).toBeNull()
    // Atacante também no ar, na mesma faixa: aí combate normalmente.
    expect(hit(world, origin, impact, 1.2)).not.toBeNull()
  })

  it('borda de terraço bloqueia, mesmo com os dois "no chão" (elevação 0 cada um)', async () => {
    await initTestTerrain()
    addStaticBox({ center: [0, 0.9, 2.5], halfExtents: [2, 0.9, 1] }) // borda em z=1.5, topo 1.8m
    settleTerrain()
    const world = spawnWorld()
    const embaixo = { x: 0, y: 0.45, z: 0 }
    const noTopo = spawnWildCreature(world, {
      position: { x: 0, y: 1.8 + 0.45, z: 2.2 },
    })

    // Premissa: no plano de combate, e ao alcance se não fosse a borda.
    expect(hit(world, embaixo, { x: 0, y: 0.45, z: 3 })?.entity).toBe(noTopo)

    const impact = resolveAttackImpactPoint(
      embaixo,
      { x: 0, y: 0, z: 1 },
      3,
      -1,
    )
    expect(hit(world, embaixo, impact)).toBeNull()
  })

  it('borda de terraço bloqueia de cima pra baixo também', async () => {
    await initTestTerrain()
    addStaticBox({ center: [0, 0.9, 2.5], halfExtents: [2, 0.9, 1] })
    settleTerrain()
    const world = spawnWorld()
    const noTopo = { x: 0, y: 1.8 + 0.45, z: 3 }
    const embaixo = spawnWildCreature(world, {
      position: { x: 0, y: 0.45, z: 0.8 },
    })

    expect(hit(world, noTopo, { x: 0, y: 1.8 + 0.45, z: 0 })?.entity).toBe(
      embaixo,
    )

    const impact = resolveAttackImpactPoint(
      noTopo,
      { x: 0, y: 0, z: -1 },
      3,
      -1,
    )
    expect(hit(world, noTopo, impact)).toBeNull()
  })
})

describe('creatureAttackSystem — dano de verdade', () => {
  // Sem câmera no world, a direção cai no fallback pra frente (+Z) e o
  // golpe sai do centro do corpo (`Position`) — bulbasaur em (0,1,0) com
  // vine-whip (range 1.8) varre de z=0 até z=1.8, na altura y=1.
  function spawnBulbasaurAttacker(world) {
    return spawnControlledCreature(world, {
      speciesId: 'bulbasaur',
      position: { x: 0, y: 1, z: 0 },
    })
  }

  it('atinge uma WildCreature no meio da trajetória e aplica dano via applyDamage', () => {
    const world = spawnWorld()
    spawnBulbasaurAttacker(world)
    const target = spawnWildCreature(world, {
      speciesId: 'charmander',
      position: { x: 0, y: 1, z: 0.9 },
    })
    const hpBefore = target.get(Vitals).hp

    tick(world, { primary: true })
    advanceUntilEffectSpawns(world)

    expect(target.get(Vitals).hp).toBeLessThan(hpBefore)
    expect(target.get(Vitals).hpRegenDelay).toBeCloseTo(
      target.get(Vitals).hpRegenDelayAfterDamage,
    )
  })

  it('WildCreature fora da trajetória não recebe dano', () => {
    const world = spawnWorld()
    spawnBulbasaurAttacker(world)
    const target = spawnWildCreature(world, {
      speciesId: 'charmander',
      position: { x: 0, y: 1, z: 50 },
    })
    const hpBefore = target.get(Vitals).hp

    tick(world, { primary: true })
    advanceUntilEffectSpawns(world)

    expect(target.get(Vitals).hp).toBe(hpBefore)
  })

  it('uma SummonedCreature no meio da trajetória não recebe dano (só WildCreature é alvo)', () => {
    const world = spawnWorld()
    spawnBulbasaurAttacker(world)
    const bystander = spawnControlledCreature(world, {
      speciesId: 'charmander',
      position: { x: 0, y: 1, z: 0.9 },
    })
    const hpBefore = bystander.get(Vitals).hp

    tick(world, { primary: true })
    advanceUntilEffectSpawns(world)

    expect(bystander.get(Vitals).hp).toBe(hpBefore)
  })

  it('acerto emite `attackResolved` com hit, alvo, ponto de contato e o dano aplicado', () => {
    const world = spawnWorld()
    const attacker = spawnBulbasaurAttacker(world)
    const target = spawnWildCreature(world, {
      speciesId: 'charmander',
      position: { x: 0, y: 1, z: 0.9 },
    })
    const hpBefore = target.get(Vitals).hp

    tick(world, { primary: true })
    advanceUntilEffectSpawns(world)
    const resolved = events
      .drain()
      .filter((event) => event.type === EVENT_TYPES.ATTACK_RESOLVED)

    expect(resolved).toHaveLength(1)
    const [event] = resolved
    expect(event.result).toBe('hit')
    expect(event.attacker).toBe(attacker)
    expect(event.target).toBe(target)
    expect(event.attackId).toBe('vine-whip')
    expect(event.slot).toBe('primary')
    expect(event.contactPoint).not.toBeNull()
    expect(event.damage).toBeCloseTo(hpBefore - target.get(Vitals).hp)
    expect(event.damage).toBeGreaterThan(0)
    expect(typeof event.critical).toBe('boolean')
  })

  it('golpe no vazio emite `attackResolved` com miss, sem alvo nem dano', () => {
    const world = spawnWorld()
    spawnBulbasaurAttacker(world)

    tick(world, { primary: true })
    advanceUntilEffectSpawns(world)
    const [event] = events.drain()

    expect(event.type).toBe(EVENT_TYPES.ATTACK_RESOLVED)
    expect(event.result).toBe('miss')
    expect(event.target).toBeNull()
    expect(event.contactPoint).toBeNull()
    expect(event.damage).toBe(0)
  })

  it('resolveCreatureAttack com damage=null (ataque sem poder configurado) preserva o restante da definição — o system trata isso como no-op gracioso (`if (ATTACK.damage)`)', () => {
    // Cobre a decisão de design sem precisar mutar o registro real de
    // espécies/ataques (`core/data/attacks/`) nem montar um world inteiro
    // pra exercitar um guard de uma linha: qualquer ataque referenciado
    // com `overrides: { damage: null }` continua resolvendo normalmente
    // (VFX/som), só `ATTACK.damage` fica `null` — exatamente a condição
    // que o system usa pra pular a busca de alvo.
    const withoutDamage = resolveCreatureAttack({
      id: 'vine-whip',
      overrides: { damage: null },
    })

    expect(withoutDamage.damage).toBeNull()
    expect(withoutDamage.range).toBe(resolveCreatureAttack('vine-whip').range)
  })
})

describe('creatureAttackSystem — indicador antes de lançar (castMode)', () => {
  // bulbasaur: primary = vine-whip, secondary1 = razor-leaf — os dois com
  // `castMode: 'confirm'` na definição real (premissa conferida abaixo).
  function real(world, input) {
    tick(world, input, REAL_CAST_MODE)
  }

  it('premissa: os ataques usados aqui estão configurados como confirm', () => {
    expect(resolveCreatureAttack('vine-whip').castMode).toBe('confirm')
    expect(resolveCreatureAttack('razor-leaf').castMode).toBe('confirm')
  })

  it('1º clique só abre o indicador (sem golpe, sem gastar stamina); 2º clique lança', () => {
    const world = spawnWorld()
    const creature = spawnControlledCreature(world, { speciesId: 'bulbasaur' })
    const staminaBefore = creature.get(Vitals).stamina

    real(world, { primary: true })
    expect(creature.get(AttackAim).slot).toBe('primary')
    expect(creature.get(ActionState).current).toBe(null)
    expect(creature.get(Vitals).stamina).toBe(staminaBefore)

    real(world, {}) // sem apertar nada: indicador continua aberto
    expect(creature.get(AttackAim).slot).toBe('primary')

    real(world, { primary: true })
    expect(creature.get(ActionState).current).toBe('attack')
    expect(creature.get(ActionState).pendingSlot).toBe('primary')
    expect(creature.get(AttackAim).slot).toBe(null)
  })

  it('Q abre o indicador da skill; clique esquerdo confirma a SKILL (não o ataque básico)', () => {
    const world = spawnWorld()
    const creature = spawnControlledCreature(world, { speciesId: 'bulbasaur' })

    real(world, { secondary1: true })
    expect(creature.get(AttackAim).slot).toBe('secondary1')

    real(world, { primary: true })
    expect(creature.get(ActionState).pendingSlot).toBe('secondary1')
    expect(creature.get(AttackAim).slot).toBe(null)
  })

  it('apertar a mesma tecla de novo também confirma', () => {
    const world = spawnWorld()
    const creature = spawnControlledCreature(world, { speciesId: 'bulbasaur' })

    real(world, { secondary1: true })
    real(world, { secondary1: true })

    expect(creature.get(ActionState).pendingSlot).toBe('secondary1')
  })

  it('outra tecla de ataque troca o indicador aberto', () => {
    const world = spawnWorld()
    const creature = spawnControlledCreature(world, { speciesId: 'bulbasaur' })

    real(world, { primary: true })
    real(world, { secondary1: true })

    expect(creature.get(AttackAim).slot).toBe('secondary1')
    expect(creature.get(ActionState).current).toBe(null)
  })

  it('botão direito cancela o indicador', () => {
    const world = spawnWorld()
    const creature = spawnControlledCreature(world, { speciesId: 'bulbasaur' })

    real(world, { primary: true })
    real(world, { secondaryHeld: true })

    expect(creature.get(AttackAim).slot).toBe(null)
    expect(creature.get(ActionState).current).toBe(null)
  })

  it('slot em cooldown não abre indicador', () => {
    const world = spawnWorld()
    const creature = spawnControlledCreature(world, { speciesId: 'bulbasaur' })
    creature.set(AttackCooldowns, { secondary1: 1 })

    real(world, { secondary1: true })

    expect(creature.get(AttackAim).slot).toBe(null)
  })

  it('confirmar com outra ação em andamento não lança, e o indicador continua aberto', () => {
    const world = spawnWorld()
    const creature = spawnControlledCreature(world, { speciesId: 'bulbasaur' })

    real(world, { primary: true })
    creature.set(ActionState, { current: 'dash', elapsed: 0.1 })
    real(world, { primary: true })

    expect(creature.get(ActionState).current).toBe('dash')
    expect(creature.get(AttackAim).slot).toBe('primary')
  })
})

describe('creatureAttackSystem — modo combate', () => {
  it('lançar um ataque põe a criatura em modo combate (olho angry)', () => {
    const world = spawnWorld()
    const creature = spawnControlledCreature(world)

    tick(world, { primary: true })

    expect(creature.has(CombatMode)).toBe(true)
    expect(creature.get(Mood).state).toBe('angry')
  })

  it('só abrir o indicador (castMode confirm) não entra em combate', () => {
    const world = spawnWorld()
    const creature = spawnControlledCreature(world, { speciesId: 'bulbasaur' })

    tick(world, { primary: true }, REAL_CAST_MODE)

    expect(creature.get(AttackAim).slot).toBe('primary') // premissa
    expect(creature.has(CombatMode)).toBe(false)
    expect(creature.get(Mood).state).toBe('awake')
  })
})

describe('resolveCastMode', () => {
  it('segue a definição do ataque; sem o campo, lança na hora', () => {
    expect(resolveCastMode({ castMode: 'confirm' }, null)).toBe('confirm')
    expect(resolveCastMode({ castMode: 'instant' }, null)).toBe('instant')
    expect(resolveCastMode({}, null)).toBe('instant')
  })

  it('override (modo debug) ganha da definição', () => {
    expect(resolveCastMode({ castMode: 'instant' }, 'confirm')).toBe('confirm')
    expect(resolveCastMode({}, 'confirm')).toBe('confirm')
  })
})
