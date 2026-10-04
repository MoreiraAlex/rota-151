import { describe, it, expect, afterEach } from 'vitest'
import { resolveFormulaLevel } from '../data/species/formulaLevel'
import { createWorld } from 'koota'
import { getPlayerSpecies, getSpecies } from '@/core/data/species'
import { resolveCreatureAttack } from '@/core/battle/creatureAttack'
import { resolveSkill } from '@/core/data/skills'
import { resolveChannelTickDamage } from '@/core/battle/calculateDamage'
import {
  isConeAttack,
  resolveChannelTickCount,
} from '@/core/battle/channelAttack'
import { computeAimRay } from '@/core/camera/orbitCamera'
import { disposePhysics } from '@/core/physics/physicsWorld'
import { createEventQueue, EVENT_TYPES } from '@/core/events'
import { castRay } from '@/core/physics/raycast'
import {
  createCharacterBody,
  verticalClearance,
} from '@/core/physics/colliders'
import { GAME_CONFIG } from '@/core/gameConfig'
import {
  calculateAttackDurationFactor,
  calculateStat,
} from '@/core/data/species/stats'
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
  CryPulse,
  Fainted,
  Mood,
  CharacterController,
  IndividualValues,
  InputControlled,
  LeechSeed,
  OrbitCamera,
  Party,
  PhysicsBody,
  Position,
  resolveMaxStamina,
  Rotation,
  SeededBy,
  StatStages,
  SummonedCreature,
  Vitals,
  vitalsFromSpecies,
  WantsToAttack,
  WildBehavior,
  WildCreature,
} from '@/core/traits'
import { creatureAttackSystem } from './creatureAttackSystem'
import {
  resolveAttackForEntity,
  resolveCastMode,
} from '@/core/battle/attackCasting'
import { resolveAttackImpactPoint } from '@/core/battle/attackTrajectory'
import { resolveAttackTarget } from '@/core/battle/attackTargets'
import {
  resolveEffectStart,
  resolveEffectRotation,
} from '@/core/battle/attackEffectPlacement'

// Slot (`secondary1-3`) em que o charmander tem a Brasa — achado, não fixo:
// a ordem das skills da espécie é configuração do usuário e muda.
const EMBER_SLOT = ['secondary1', 'secondary2', 'secondary3'].find(
  (slot) =>
    resolveCreatureAttack(getSpecies('charmander'), slot)?.id === 'ember',
)

const DELTA = 1 / 60
// Espécie estável de teste (o Bulbasaur) — o
// ataque é exclusivo de `kind: 'pokemon'` (o treinador não ataca direto,
// ver docs/backlog.md), então lido daqui, não de `getPlayerSpecies()`.
// `ATTACK` é o ataque básico próprio do `bulbasaur` (`basicAttack`, ver
// core/data/species/001-bulbasaur/basicAttack.js), resolvido pelo mesmo caminho do
// system (`resolveCreatureAttack(species, 'primary')`).
// Custo/recarga resolvidos pela fórmula (`withActionCost`) — a definição não
// escreve os seus (docs/features/035-balanceamento-de-acoes-e-correcoes.md).
const ATTACK = resolveAttackForEntity(getSpecies('bulbasaur'), 'primary', null)

// Ticks de um canalizado no básico do bulbasaur: a duração dele escala pelo
// `speed` (IV/nível), então a contagem sai do golpe resolvido, não da config.
function expectedBasicChannelTicks(creature) {
  return resolveChannelTickCount(
    resolveAttackForEntity(
      getSpecies('bulbasaur'),
      'primary',
      creature.get(IndividualValues),
    ),
  )
}
const BULBASAUR_BODY = getSpecies('bulbasaur').body

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
  { speciesId = 'bulbasaur', position, individualValues = null } = {},
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

// `sturdy`: vida que nunca acaba — pra testes que contam ticks/acertos e não
// podem depender de quantos golpes a selvagem aguenta (isso é balanceamento).
function spawnWildCreature(
  world,
  {
    speciesId = 'charmander',
    position,
    individualValues = null,
    sturdy = false,
  } = {},
) {
  const entity = world.spawn(
    Position(position ?? { x: 0, y: 1, z: 0 }),
    Rotation,
    CharacterController(getSpecies(speciesId).body),
    PhysicsBody,
    vitalsFromSpecies(getSpecies(speciesId), individualValues),
    WildCreature({ speciesId }),
    IndividualValues(individualValues ?? {}),
  )
  if (sturdy) {
    entity.set(Vitals, {
      hp: Number.MAX_SAFE_INTEGER,
      maxHp: Number.MAX_SAFE_INTEGER,
    })
  }
  return entity
}

// A maioria dos testes aqui cobre a MECÂNICA do golpe (dano, trajetória,
// cooldown...), não o modo de lançamento — então força lançar na hora no
// primeiro aperto. Os testes do indicador forçam `CONFIRM_CAST` — testam o
// mecanismo, não o `castMode` que cada golpe usa hoje (conteúdo, muda).
const INSTANT_CAST = { castModeOverride: 'instant' }
const CONFIRM_CAST = { castModeOverride: 'confirm' }

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

/**
 * Avança até o `AttackEffect` nascer (instante `effectAt`) e o devolve. Folga
 * fixa de 5 s — não a duração de um ataque específico: as espécies usadas nos
 * testes têm o básico balanceado pelo usuário (e escalado pelo `speed`).
 */
function advanceUntilEffectSpawns(world) {
  const totalTicks = Math.ceil(5 / DELTA)
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
    creature.set(Vitals, { stamina: ATTACK.staminaCost / 2 })

    tick(world, { primary: true })

    expect(creature.get(ActionState).current).toBe(null)
    expect(creature.get(Vitals).stamina).toBeCloseTo(ATTACK.staminaCost / 2)
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
      CharacterController(BULBASAUR_BODY),
      PhysicsBody,
      vitalsFromSpecies(getSpecies('bulbasaur')),
      SummonedCreature({ slot: 'slot1', speciesId: 'bulbasaur' }),
    )

    tick(world, { primary: true })

    expect(creature.get(ActionState).current).toBe(null)
  })

  it('espécie desconhecida (sem basicAttack pra resolver) não ataca, sem quebrar', () => {
    const world = spawnWorld()
    const creature = world.spawn(
      Position({ x: 0, y: 1, z: 0 }),
      Rotation,
      ActionState,
      AttackCooldowns,
      CharacterController(BULBASAUR_BODY),
      PhysicsBody,
      vitalsFromSpecies(getSpecies('bulbasaur')),
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
    // `bulbasaur` não declara `body.attackOriginHeight`.
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
    // distância da origem do golpe até onde o VFX nasce (o fim da trajetória)
    expect(effect.get(AttackEffect).length).toBeCloseTo(ATTACK.range)
  })

  it('visual.positionOffset do ataque só desloca a PARTIDA: o efeito continua nascendo no impacto do range, reorientado e com o length medido da nova partida', () => {
    const { visual } = getSpecies('bulbasaur').basicAttack
    const original = visual.positionOffset
    // yaw 0 (sem câmera: +Z), nível: x → +X, y → +Y, z → +Z (golpe adentro)
    visual.positionOffset = { x: 0.5, y: 0.25, z: 0.2 }
    try {
      const world = spawnWorld()
      spawnControlledCreature(world, { position: { x: 2, y: 1, z: 3 } })

      tick(world, { primary: true })
      const effect = advanceUntilEffectSpawns(world)

      // o impacto NÃO se mexe: continua em origem + range
      const pos = effect.get(Position)
      expect(pos.x).toBeCloseTo(2)
      expect(pos.y).toBeCloseTo(1)
      expect(pos.z).toBeCloseTo(3 + ATTACK.range)

      // a partida andou (2.5, 1.25, 3.2): o golpe agora vai dela até o impacto
      const dx = -0.5
      const dy = -0.25
      const dz = ATTACK.range - 0.2
      const length = Math.hypot(dx, dy, dz)
      expect(effect.get(AttackEffect).length).toBeCloseTo(length)
      const esperada = resolveEffectRotation(
        { x: dx / length, y: dy / length, z: dz / length },
        null,
      )
      expect(effect.get(Rotation).x).toBeCloseTo(esperada.x)
      expect(effect.get(Rotation).y).toBeCloseTo(esperada.y)
    } finally {
      visual.positionOffset = original
    }
  })

  it('impactType do AttackEffect: visual.impactType, senão damage.type, senão vazio', () => {
    const { visual, damage } = getSpecies('bulbasaur').basicAttack
    const originalVisual = visual.impactType
    const originalType = damage.type
    const spawnType = () => {
      const world = spawnWorld()
      spawnControlledCreature(world, { position: { x: 2, y: 1, z: 3 } })
      tick(world, { primary: true })
      return advanceUntilEffectSpawns(world).get(AttackEffect).impactType
    }
    try {
      expect(spawnType()).toBe('')

      damage.type = 'water'
      expect(spawnType()).toBe('water')

      visual.impactType = 'fire'
      expect(spawnType()).toBe('fire')
    } finally {
      visual.impactType = originalVisual
      damage.type = originalType
    }
  })

  describe('direcionar durante o aviso (antes do effectAt)', () => {
    const START = { x: 0, y: 1, z: 0 }
    const PITCH = 0.3

    // Direção horizontal que a câmera resolve pra um yaw — a mesma conta do
    // sistema (`computeAimRay`, sem assistência: Brasa é habilidade).
    function cameraDirection(yaw) {
      const species = getSpecies('charmander')
      const { direction } = computeAimRay(
        START,
        { yaw, pitch: PITCH, distance: 10 },
        -1,
        species.camera.targetHeight,
        species.camera.shoulderOffset,
      )
      const length = Math.hypot(direction.x, direction.z)
      return { x: direction.x / length, z: direction.z / length }
    }

    function setup() {
      const world = spawnWorld()
      const creature = spawnControlledCreature(world, {
        speciesId: 'charmander',
        position: START,
      })
      const camera = world.spawn(
        OrbitCamera({ yaw: 0, pitch: PITCH, distance: 10 }),
      )
      // premissa: Brasa (slot 2) é habilidade à distância
      expect(
        resolveCreatureAttack(getSpecies('charmander'), EMBER_SLOT)?.id,
      ).toBe('ember')
      return { world, creature, camera }
    }

    function runUntilEffect(world, limit = 240) {
      for (let i = 0; i < limit; i++) {
        tick(world, {})
        const [effect] = world.query(AttackEffect)
        if (effect) return effect
      }
      throw new Error('AttackEffect nunca nasceu')
    }

    it('girar a câmera durante a carga reaponta a direção e o corpo; o golpe sai pra onde ela olha NO instante do golpe', () => {
      const { world, creature, camera } = setup()

      tick(world, { [EMBER_SLOT]: true })
      const launch = cameraDirection(0)
      expect(creature.get(ActionState).dirX).toBeCloseTo(launch.x)
      expect(creature.get(ActionState).dirZ).toBeCloseTo(launch.z)

      // vira a câmera enquanto o aviso carrega
      camera.set(OrbitCamera, { yaw: Math.PI / 2 })
      tick(world, {})
      const turned = cameraDirection(Math.PI / 2)
      expect(turned.x).not.toBeCloseTo(launch.x) // premissa: girou de verdade
      expect(creature.get(ActionState).dirX).toBeCloseTo(turned.x)
      expect(creature.get(ActionState).dirZ).toBeCloseTo(turned.z)
      expect(creature.get(Rotation).y).toBeCloseTo(
        Math.atan2(turned.x, turned.z),
      )

      // o golpe sai na direção que a câmera tinha no instante do efeito
      const ember = resolveCreatureAttack(getSpecies('charmander'), EMBER_SLOT)
      const effect = runUntilEffect(world)
      const pos = effect.get(Position)
      expect(pos.x).toBeCloseTo(START.x + turned.x * ember.range)
      expect(pos.z).toBeCloseTo(START.z + turned.z * ember.range)
    })

    it('depois do effectAt a direção TRAVA: girar a câmera não mexe mais no golpe', () => {
      const { world, creature, camera } = setup()

      tick(world, { [EMBER_SLOT]: true })
      camera.set(OrbitCamera, { yaw: Math.PI / 2 })
      runUntilEffect(world)
      const locked = { ...creature.get(ActionState) }

      camera.set(OrbitCamera, { yaw: Math.PI })
      tick(world, {})

      expect(creature.get(ActionState).dirX).toBeCloseTo(locked.dirX)
      expect(creature.get(ActionState).dirZ).toBeCloseTo(locked.dirZ)
    })

    it('ATTACK_WINDUP_STEERING desligado: a direção trava no disparo, como antes', () => {
      const original = GAME_CONFIG.BATTLE.ATTACK_WINDUP_STEERING
      GAME_CONFIG.BATTLE.ATTACK_WINDUP_STEERING = false
      try {
        const { world, creature, camera } = setup()

        tick(world, { [EMBER_SLOT]: true })
        const launch = cameraDirection(0)
        camera.set(OrbitCamera, { yaw: Math.PI / 2 })
        tick(world, {})

        expect(creature.get(ActionState).dirX).toBeCloseTo(launch.x)
        expect(creature.get(ActionState).dirZ).toBeCloseTo(launch.z)
      } finally {
        GAME_CONFIG.BATTLE.ATTACK_WINDUP_STEERING = original
      }
    })

    it('só a criatura CONTROLADA é direcionada (quem perdeu o controle mira uma vez, no disparo)', () => {
      const { world, creature, camera } = setup()

      tick(world, { [EMBER_SLOT]: true })
      const launch = cameraDirection(0)
      creature.remove(InputControlled)
      camera.set(OrbitCamera, { yaw: Math.PI / 2 })
      tick(world, {})

      expect(creature.get(ActionState).dirX).toBeCloseTo(launch.x)
      expect(creature.get(ActionState).dirZ).toBeCloseTo(launch.z)
    })

    it('o ataque BÁSICO continua com a assistência enquanto carrega (puxa pro alvo, não só segue a câmera)', () => {
      const world = spawnWorld()
      const creature = spawnControlledCreature(world, {
        speciesId: 'bulbasaur',
      })
      // alvo 40° pro lado, ao alcance: sem câmera a base é +Z
      const side = (40 * Math.PI) / 180
      spawnWildCreature(world, {
        speciesId: 'charmander',
        position: { x: Math.sin(side) * 1.2, y: 1, z: Math.cos(side) * 1.2 },
      })

      tick(world, { primary: true })
      tick(world, {})

      expect(creature.get(ActionState).dirX).toBeGreaterThan(0.3)
    })
  })

  it('básico próprio de cada espécie (range do charmander ≠ do básico padrão) é respeitado de ponta a ponta', () => {
    const charmander = getSpecies('charmander')
    const original = charmander.basicAttack
    charmander.basicAttack = { ...original, range: 1.6 }
    try {
      const world = spawnWorld()
      expect(ATTACK.range).not.toBe(1.6) // diferente do básico padrão do teste

      spawnControlledCreature(world, {
        speciesId: 'charmander',
        position: { x: 0, y: 1, z: 0 },
      })
      tick(world, { primary: true })
      const effect = advanceUntilEffectSpawns(world)

      // Sem câmera, direção cai no fallback (0,0,1) — z reflete o range do
      // básico do charmander, não o do básico padrão.
      expect(effect.get(Position).z).toBeCloseTo(1.6)
    } finally {
      charmander.basicAttack = original
    }
  })

  it('marca AttackPulse na CRIATURA exatamente quando o AttackEffect nasce (mesmo instante EFFECT_AT) — som do impacto, ver attackAudioSystem.js', () => {
    const world = spawnWorld()
    const creature = spawnControlledCreature(world)

    tick(world, { primary: true })
    expect(creature.has(AttackPulse)).toBe(false) // ainda antes de EFFECT_AT

    advanceUntilEffectSpawns(world)
    expect(creature.has(AttackPulse)).toBe(true)
    expect(creature.get(AttackPulse).slot).toBe('primary')
  })

  it('o AttackPulse carrega o SLOT do ataque que disparou (habilidade, não só o básico) — cada slot tem o seu som', () => {
    const world = spawnWorld()
    const creature = spawnControlledCreature(world, { speciesId: 'charmander' })
    // premissa: o charmander tem uma habilidade de fogo no slot 2 (Brasa)
    expect(
      resolveCreatureAttack(getSpecies('charmander'), EMBER_SLOT)?.id,
    ).toBe('ember')

    tick(world, { [EMBER_SLOT]: true })
    // `advanceUntilEffectSpawns` mede o tempo pelo básico padrão; o
    // `effectAt` do Brasa do charmander é maior, então espera até 2 s.
    for (let i = 0; i < 120 && !creature.has(AttackPulse); i++) tick(world, {})

    expect(creature.has(AttackPulse)).toBe(true)
    expect(creature.get(AttackPulse).slot).toBe(EMBER_SLOT)
  })

  it('corpo a corpo sem alvo (charmander/tackle): segue o giro horizontal da câmera, mas sai reto — não inclina pro chão com a câmera olhando de cima', () => {
    const world = spawnWorld()
    const startPos = { x: 0, y: 1, z: 0 }
    const species = getSpecies('charmander')
    const tackle = resolveCreatureAttack(species, 'primary')
    const creature = spawnControlledCreature(world, {
      speciesId: 'charmander',
      position: startPos,
    })
    creature.set(Rotation, { y: 2 }) // deve ser sobrescrito pra encarar a câmera
    const orbit = { yaw: Math.PI / 4, pitch: 0.3, distance: 10 }
    world.spawn(OrbitCamera(orbit))
    expect(tackle.aim).toBe('melee') // premissa do teste

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
    expect(pos.x).toBeCloseTo((direction.x / horizontalLength) * tackle.range)
    expect(pos.y).toBeCloseTo(startPos.y)
    expect(pos.z).toBeCloseTo((direction.z / horizontalLength) * tackle.range)
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
    const ember = resolveCreatureAttack(getSpecies('charmander'), 'secondary1')
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

  it('positionOffset (visual.positionOffset, metros) desloca o PONTO DE PARTIDA no referencial do golpe (resolveEffectStart)', () => {
    const ponto = { x: 2, y: 1, z: 3 }

    // sem offset: o próprio ponto, sem copiar nada
    expect(resolveEffectStart(ponto, { x: 0, y: 0, z: 1 }, null)).toBe(ponto)
    expect(
      resolveEffectStart(ponto, { x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: 0 }),
    ).toBe(ponto)

    // yaw 0, nível: os eixos do efeito são os do mundo
    const nivel = resolveEffectStart(
      ponto,
      { x: 0, y: 0, z: 1 },
      { x: 1, y: 2, z: 3 },
    )
    expect(nivel.x).toBeCloseTo(3)
    expect(nivel.y).toBeCloseTo(3)
    expect(nivel.z).toBeCloseTo(6)
  })

  it('positionOffset acompanha a direção do golpe: +Z do offset é "golpe adentro", seja qual for o yaw', () => {
    // golpe pra +X (yaw = 90°): "pra frente" vira +X, "pro lado" vira -Z
    const frente = resolveEffectStart(
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 0, z: 0 },
      { x: 0, y: 0, z: 1 },
    )
    expect(frente.x).toBeCloseTo(1)
    expect(frente.z).toBeCloseTo(0)

    const lado = resolveEffectStart(
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 0, z: 0 },
      { x: 1, y: 0, z: 0 },
    )
    expect(lado.x).toBeCloseTo(0)
    expect(lado.z).toBeCloseTo(-1)
  })

  it('positionOffset em golpe inclinado: +Z do offset segue a trajetória (pitch) e +Y não vira "frente"', () => {
    const subindo = { x: 0, y: Math.SQRT1_2, z: Math.SQRT1_2 }
    const frente = resolveEffectStart({ x: 0, y: 0, z: 0 }, subindo, {
      x: 0,
      y: 0,
      z: 1,
    })
    expect(frente.x).toBeCloseTo(0)
    expect(frente.y).toBeCloseTo(Math.SQRT1_2)
    expect(frente.z).toBeCloseTo(Math.SQRT1_2)

    // os eixos são ortonormais: o tamanho do deslocamento se preserva
    const qualquer = resolveEffectStart(
      { x: 0, y: 0, z: 0 },
      { x: 0.6, y: 0.3, z: 0.74 },
      { x: 0.4, y: 0.5, z: 0.7 },
    )
    expect(Math.hypot(qualquer.x, qualquer.y, qualquer.z)).toBeCloseTo(
      Math.hypot(0.4, 0.5, 0.7),
    )
  })

  it('duration do básico da espécie é a BASE — o speed só escala em volta dela (e a animação acompanha)', () => {
    // Regressão: antes o `speed` gerava a duração inteira (0.05–0.5s) e
    // sobrescrevia a duração autorada em silêncio — o clipe de ataque
    // continuava rápido mesmo com `duration` maior.
    const squirtle = getSpecies('squirtle')
    const { duration } = squirtle.basicAttack
    const { REFERENCE, MIN_FACTOR, MAX_FACTOR } =
      GAME_CONFIG.BATTLE.ATTACK_SPEED
    const speed = calculateStat({
      base: squirtle.stats.speed.base,
      iv: 0,
      ev: squirtle.stats.speed.ev ?? 0,
      level: resolveFormulaLevel(squirtle.level),
    })
    const factor = calculateAttackDurationFactor(speed, {
      reference: REFERENCE,
      minFactor: MIN_FACTOR,
      maxFactor: MAX_FACTOR,
    })

    const world = spawnWorld()
    const creature = spawnControlledCreature(world, { speciesId: 'squirtle' })
    tick(world, { primary: true })

    expect(creature.get(ActionState).animationSpeed).toBeCloseTo(
      1 / (duration * factor),
    )
  })

  it('mesma espécie com speed maior (IV) ataca mais rápido', () => {
    const attackSpeedWith = (iv) => {
      const world = spawnWorld()
      const creature = spawnControlledCreature(world, {
        speciesId: 'squirtle',
        individualValues: { speed: iv },
      })
      tick(world, { primary: true })
      return creature.get(ActionState).animationSpeed
    }

    expect(attackSpeedWith(31)).toBeGreaterThan(attackSpeedWith(0))
  })

  it('animationFrames e animationKey do ataque chegam no ActionState no disparo e voltam a null no fim', () => {
    const world = spawnWorld()
    const creature = spawnControlledCreature(world, { speciesId: 'squirtle' })
    const species = getSpecies('squirtle')
    const original = species.basicAttack
    species.basicAttack = {
      ...original,
      animationFrames: 40,
      animation: { clipKey: 'attackRanged' },
    }
    try {
      tick(world, { primary: true })
      expect(creature.get(ActionState).animationFrames).toBe(40)
      expect(creature.get(ActionState).animationKey).toBe('attackRanged')

      advanceUntilFree(world, creature)
      expect(creature.get(ActionState).animationFrames).toBeNull()
      expect(creature.get(ActionState).animationKey).toBeNull()
    } finally {
      species.basicAttack = original
    }
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

  it('cooldown só começa a contar no FIM da ação, não no disparo', () => {
    // Regressão: a contagem começava no disparo — uma skill com `duration`
    // >= `cooldown` (ember do charmander) saía da ação já pronta de novo.
    const bulbasaur = getSpecies('bulbasaur')
    const original = bulbasaur.basicAttack
    bulbasaur.basicAttack = { ...original, cooldown: 1 }
    try {
      const world = spawnWorld()
      const creature = spawnControlledCreature(world)

      tick(world, { primary: true })
      expect(creature.get(ActionState).current).toBe('attack')
      expect(creature.get(AttackCooldowns).primary).toBe(0) // ainda não

      advanceUntilFree(world, creature)
      // Fim da ação: cooldown inteiro (menos, no máximo, o tick de agora).
      expect(creature.get(AttackCooldowns).primary).toBeGreaterThan(
        1 - 2 * DELTA,
      )

      // Travado até zerar...
      tick(world, { primary: true })
      expect(creature.get(ActionState).current).toBe(null)

      // ...e liberado depois.
      for (let t = 0; t < 1 + DELTA; t += DELTA) tick(world, {})
      tick(world, { primary: true })
      expect(creature.get(ActionState).current).toBe('attack')
    } finally {
      bulbasaur.basicAttack = original
    }
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
    const vineWhip = resolveAttackForEntity(
      getSpecies('bulbasaur'),
      'secondary1',
      individualValues,
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

  it('espécie sem secondary1 configurado — tecla Q não dispara nada, sem quebrar', () => {
    const bulbasaur = getSpecies('bulbasaur')
    const original = bulbasaur.skills
    bulbasaur.skills = {}
    try {
      const world = spawnWorld()
      const creature = spawnControlledCreature(world)

      tick(world, { secondary1: true })

      expect(creature.get(ActionState).current).toBe(null)
    } finally {
      bulbasaur.skills = original
    }
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

  it('corpo de criatura no caminho para a trajetória — exceto com terrainOnly (canal)', async () => {
    await initTestTerrain()
    createCharacterBody(
      { x: 0, y: 0.45, z: 1.5 },
      { radius: 0.3, halfHeight: 0.15, axis: 'y' },
    )
    settleTerrain()

    const origin = { x: 0, y: 0.45, z: 0 }
    const blocked = resolveAttackImpactPoint(origin, FORWARD, 4, -1)
    const through = resolveAttackImpactPoint(origin, FORWARD, 4, -1, {
      terrainOnly: true,
    })

    expect(blocked.z).toBeLessThan(1.5) // bateu no corpo
    expect(through.z).toBeCloseTo(4) // canal passa por ele
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
    return resolveAttackTarget(world, origin, impact, RADIUS, elevation, 'wild')
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
    // Alcance lateral = RADIUS + capsuleRadius do charmander (cápsula em pé).
    const { capsuleRadius } = getSpecies('charmander').body
    const x = RADIUS + capsuleRadius - 0.1
    spawnWildCreature(world, { position: { x, y: 1, z: 2 } })

    const target = hit(world)

    expect(target).not.toBeNull()
    expect(target.contactPoint.x).toBeCloseTo(x - capsuleRadius)
    expect(target.contactPoint.y).toBeCloseTo(1)
    expect(target.contactPoint.z).toBeCloseTo(2)
  })

  it('ignora alvo de lado fora de radius + capsuleRadius', () => {
    const world = spawnWorld()
    const { capsuleRadius } = getSpecies('charmander').body
    const x = RADIUS + capsuleRadius + 0.1
    spawnWildCreature(world, { position: { x, y: 1, z: 2 } })

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
    // bulbasaur: cápsula deitada em z. Alcance lateral = RADIUS +
    // capsuleRadius; centro meia `capsuleHalfHeight` além dele:
    // - yaw 0: eixo paralelo à trajetória, distância = x → erra;
    // - yaw 90°: eixo vira x, ponta mais perto em x - halfHeight → acerta.
    const { capsuleRadius, capsuleHalfHeight } = getSpecies('bulbasaur').body
    const x = RADIUS + capsuleRadius + capsuleHalfHeight / 2
    const world = spawnWorld()
    const wild = spawnWildCreature(world, {
      speciesId: 'bulbasaur',
      position: { x, y: 1, z: 2 },
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
  // golpe sai do centro do corpo (`Position`) — bulbasaur em (0,1,0) varre
  // de z=0 até o `range` do básico, na altura y=1.
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

  it('VFX nasce no ponto de CONTATO quando acerta, e no fim da trajetória quando erra', () => {
    const world = spawnWorld()
    spawnBulbasaurAttacker(world)
    const range = getSpecies('bulbasaur').basicAttack.range
    spawnWildCreature(world, {
      speciesId: 'charmander',
      position: { x: 0, y: 1, z: range / 2 },
    })

    events.drain()
    tick(world, { primary: true })
    const hitEffect = advanceUntilEffectSpawns(world)
    const [hit] = events
      .drain()
      .filter((event) => event.type === EVENT_TYPES.ATTACK_RESOLVED)
    // Nasce no contato que o próprio evento reporta (no meio do caminho),
    // não no fim do alcance.
    expect(hit.result).toBe('hit')
    expect(hitEffect.get(Position).z).toBeCloseTo(hit.contactPoint.z)
    expect(hitEffect.get(Position).z).toBeLessThan(range - 0.1)

    const empty = spawnWorld()
    spawnBulbasaurAttacker(empty)
    tick(empty, { primary: true })
    const missEffect = advanceUntilEffectSpawns(empty)
    expect(missEffect.get(Position).z).toBeCloseTo(range)
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
    expect(event.attackId).toBe('bulbasaur-basic') // básico próprio da espécie
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

  it('resolveSkill com damage=null (ataque sem poder configurado) preserva o restante da definição — o system trata isso como no-op gracioso (`if (ATTACK.damage)`)', () => {
    // Cobre a decisão de design sem precisar mutar o registro real de
    // espécies/ataques (`core/data/skills/`) nem montar um world inteiro
    // pra exercitar um guard de uma linha: qualquer ataque referenciado
    // com `overrides: { damage: null }` continua resolvendo normalmente
    // (VFX/som), só `ATTACK.damage` fica `null` — exatamente a condição
    // que o system usa pra pular a busca de alvo.
    const withoutDamage = resolveSkill({
      id: 'vine-whip',
      overrides: { damage: null },
    })

    expect(withoutDamage.damage).toBeNull()
    expect(withoutDamage.range).toBe(resolveSkill('vine-whip').range)
  })
})

describe('creatureAttackSystem — indicador antes de lançar (castMode)', () => {
  // Todo golpe em `castMode: 'confirm'` (`CONFIRM_CAST`) — bulbasaur só
  // pelo básico e pelo secondary1.
  function real(world, input) {
    tick(world, input, CONFIRM_CAST)
  }

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

    // apertar a tecla = aperto + tecla segurada no mesmo tick (como o
    // `keyboardInput.js` manda)
    real(world, { secondary1: true, secondary1Held: true })
    real(world, { secondary1: true, secondary1Held: true })

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

    tick(world, { primary: true }, CONFIRM_CAST)

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

describe('creatureAttackSystem — selvagem atacando (IA)', () => {
  // Selvagem pronta pra atacar, como o `wildCreatureSpawnSystem` cria.
  function spawnWildAttacker(world, position) {
    return world.spawn(
      Position(position),
      Rotation,
      ActionState,
      AttackCooldowns,
      Mood,
      CharacterController(getSpecies('charmander').body),
      PhysicsBody,
      vitalsFromSpecies(getSpecies('charmander')),
      WildCreature({ speciesId: 'charmander' }),
      IndividualValues,
    )
  }

  it('pedido de golpe (WantsToAttack) lança o ataque básico mirando no alvo do pedido', () => {
    const world = spawnWorld()
    const mine = spawnControlledCreature(world, {
      speciesId: 'bulbasaur',
      position: { x: 1, y: 1, z: 0 },
    })
    const wild = spawnWildAttacker(world, { x: 0, y: 1, z: 0 })
    const staminaBefore = wild.get(Vitals).stamina
    wild.add(WantsToAttack({ target: mine }))

    tick(world)

    expect(wild.get(ActionState)).toMatchObject({
      current: 'attack',
      pendingSlot: 'primary',
    })
    expect(wild.get(Vitals).stamina).toBeLessThan(staminaBefore)
    // Virada pro alvo (+X): yaw = atan2(1, 0) = 90°.
    expect(wild.get(Rotation).y).toBeCloseTo(Math.PI / 2)
    expect(wild.has(WantsToAttack)).toBe(false)
    expect(wild.has(CombatMode)).toBe(true)
  })

  it('pedido com slot lança a HABILIDADE pedida, mirando no alvo', () => {
    const world = spawnWorld()
    const mine = spawnControlledCreature(world, {
      speciesId: 'bulbasaur',
      position: { x: 1, y: 1, z: 0 },
    })
    const wild = spawnWildAttacker(world, { x: 0, y: 1, z: 0 })
    wild.add(WantsToAttack({ target: mine, slot: 'secondary3' }))

    tick(world)

    expect(wild.get(ActionState)).toMatchObject({
      current: 'attack',
      pendingSlot: 'secondary3',
    })
    expect(wild.get(Rotation).y).toBeCloseTo(Math.PI / 2)
  })

  it('feixe da IA (Water Gun) segue o alvo durante o canal, com giro limitado', () => {
    const world = spawnWorld()
    const mine = spawnControlledCreature(world, {
      speciesId: 'bulbasaur',
      position: { x: 0, y: 1, z: 3 },
    })
    const squirtle = getSpecies('squirtle')
    const wild = world.spawn(
      Position({ x: 0, y: 1, z: 0 }),
      Rotation,
      ActionState,
      AttackCooldowns,
      Mood,
      CharacterController(squirtle.body),
      PhysicsBody,
      vitalsFromSpecies(squirtle),
      WildCreature({ speciesId: 'squirtle' }),
      WildBehavior({ state: 'chase', target: mine }),
      IndividualValues,
    )
    wild.add(WantsToAttack({ target: mine, slot: 'secondary2' })) // water-gun
    tick(world)
    expect(wild.get(ActionState).dirZ).toBeCloseTo(1) // mirou em +Z

    // O alvo corre pro lado (+X): o feixe acompanha, sem pular direto.
    mine.set(Position, { x: 3, y: 1, z: 0 })
    tick(world)
    const yaw = Math.atan2(
      wild.get(ActionState).dirX,
      wild.get(ActionState).dirZ,
    )
    expect(yaw).toBeGreaterThan(0)
    expect(yaw).toBeLessThan(Math.PI / 2)
    expect(wild.get(Rotation).y).toBeCloseTo(yaw)
  })

  it('o golpe da selvagem acerta a criatura do jogador e emite o evento', () => {
    const world = spawnWorld()
    const mine = spawnControlledCreature(world, {
      speciesId: 'bulbasaur',
      position: { x: 0.9, y: 1, z: 0 },
    })
    const wild = spawnWildAttacker(world, { x: 0, y: 1, z: 0 })
    const hpBefore = mine.get(Vitals).hp
    wild.add(WantsToAttack({ target: mine }))

    for (let i = 0; i < 60; i++) tick(world)

    expect(mine.get(Vitals).hp).toBeLessThan(hpBefore)
    const hits = events
      .drain()
      .filter((event) => event.result === 'hit' && event.attacker === wild)
    expect(hits).toHaveLength(1)
    expect(hits[0].target).toBe(mine)
  })

  it('sem stamina pro golpe, o pedido é descartado sem atacar', () => {
    const world = spawnWorld()
    const mine = spawnControlledCreature(world, {
      position: { x: 1, y: 1, z: 0 },
    })
    const wild = spawnWildAttacker(world, { x: 0, y: 1, z: 0 })
    wild.set(Vitals, { stamina: 0 })
    wild.add(WantsToAttack({ target: mine }))

    tick(world)

    expect(wild.get(ActionState).current).toBe(null)
    expect(wild.has(WantsToAttack)).toBe(false)
  })

  it('alvo fora da luta (desmaiado), o pedido é descartado sem atacar', () => {
    const world = spawnWorld()
    const mine = spawnControlledCreature(world, {
      position: { x: 1, y: 1, z: 0 },
    })
    const wild = spawnWildAttacker(world, { x: 0, y: 1, z: 0 })
    mine.add(Fainted)
    wild.add(WantsToAttack({ target: mine }))

    tick(world)

    expect(wild.get(ActionState).current).toBe(null)
    expect(wild.has(WantsToAttack)).toBe(false)
  })

  it('criatura do time fora do controle (IA) também lança pelo pedido, mirando na selvagem', () => {
    const world = spawnWorld()
    const wild = spawnWildAttacker(world, { x: 1, y: 1, z: 0 })
    const mine = spawnControlledCreature(world, {
      speciesId: 'bulbasaur',
      position: { x: 0, y: 1, z: 0 },
    })
    mine.remove(InputControlled)
    mine.add(WantsToAttack({ target: wild }))

    tick(world)

    expect(mine.get(ActionState)).toMatchObject({
      current: 'attack',
      pendingSlot: 'primary',
    })
    expect(mine.get(Rotation).y).toBeCloseTo(Math.PI / 2)
  })

  it('cooldown também corre pra selvagem', () => {
    const world = spawnWorld()
    const wild = spawnWildAttacker(world, { x: 0, y: 1, z: 0 })
    wild.set(AttackCooldowns, { primary: 1 })

    tick(world)

    expect(wild.get(AttackCooldowns).primary).toBeCloseTo(1 - DELTA)
  })
})

describe('resolveAttackTarget — lado do jogador (golpe de selvagem)', () => {
  const ORIGIN = { x: 0, y: 1, z: 0 }
  const IMPACT = { x: 0, y: 1, z: 4 }

  it('acerta criatura do time e o treinador; nunca outra selvagem', () => {
    const world = spawnWorld()
    const otherWild = spawnWildCreature(world, {
      position: { x: 0, y: 1, z: 1 },
    })
    const trainer = world.spawn(
      Position({ x: 0, y: 1, z: 2 }),
      Rotation,
      CharacterController(getPlayerSpecies().body),
      Vitals,
      Party,
    )

    const hit = resolveAttackTarget(world, ORIGIN, IMPACT, 0.3, 0, 'player')

    // A selvagem está antes no caminho, mas é do mesmo lado — o golpe
    // segue e pega o treinador.
    expect(hit.entity).toBe(trainer)
    expect(hit.entity).not.toBe(otherWild)
  })

  it('criatura do time no caminho é atingida', () => {
    const world = spawnWorld()
    const mine = spawnControlledCreature(world, {
      position: { x: 0, y: 1, z: 1.5 },
    })

    const hit = resolveAttackTarget(world, ORIGIN, IMPACT, 0.3, 0, 'player')

    expect(hit.entity).toBe(mine)
  })
})

describe('creatureAttackSystem — ataque canalizado (damageMode channel)', () => {
  // Básico do bulbasaur trocado por um canalizado só dentro do teste: dano a cada
  // 0.25s de 0.25 até 1s (4 ticks), cone de 3m com meia-largura 1.5 na
  // ponta, cooldown 1s. Sem câmera, a direção é +Z a partir de (0,1,0).
  const CHANNEL = {
    damageMode: 'channel',
    damageInterval: 0.25,
    duration: 1,
    effectAt: 0.25,
    range: 3,
    radius: 1.5,
    cooldown: 1,
  }

  function withChannelBasic(run) {
    const bulbasaur = getSpecies('bulbasaur')
    const original = bulbasaur.basicAttack
    bulbasaur.basicAttack = { ...original, ...CHANNEL }
    try {
      run()
    } finally {
      bulbasaur.basicAttack = original
    }
  }

  function hitsOn(target) {
    return events
      .drain()
      .filter(
        (event) =>
          event.type === EVENT_TYPES.ATTACK_RESOLVED &&
          event.target === target &&
          event.result === 'hit',
      ).length
  }

  it('segurando até o fim: dano em TODOS os alvos do cone, a cada intervalo', () => {
    withChannelBasic(() => {
      const world = spawnWorld()
      const creature = spawnControlledCreature(world, {
        position: { x: 0, y: 1, z: 0 },
      })
      const near = spawnWildCreature(world, {
        position: { x: 0, y: 1, z: 1 },
        sturdy: true,
      })
      const wide = spawnWildCreature(world, {
        position: { x: 1, y: 1, z: 2.5 },
        sturdy: true,
      })
      const outside = spawnWildCreature(world, {
        position: { x: 3, y: 1, z: 1 },
      })
      const hpBefore = {
        near: near.get(Vitals).hp,
        wide: wide.get(Vitals).hp,
        outside: outside.get(Vitals).hp,
      }

      tick(world, { primary: true, primaryHeld: true })
      const hits = { near: 0, wide: 0, outside: 0 }
      for (let t = 0; t < 1.1; t += DELTA) {
        tick(world, { primaryHeld: true })
        const resolved = events.drain()
        for (const [key, entity] of Object.entries({ near, wide, outside })) {
          hits[key] += resolved.filter(
            (event) =>
              event.type === EVENT_TYPES.ATTACK_RESOLVED &&
              event.target === entity,
          ).length
        }
      }

      const ticks = expectedBasicChannelTicks(creature)
      expect(ticks).toBeGreaterThan(1)
      expect(hits.near).toBe(ticks)
      expect(hits.wide).toBe(ticks)
      expect(hits.outside).toBe(0)
      expect(near.get(Vitals).hp).toBeLessThan(hpBefore.near)
      expect(wide.get(Vitals).hp).toBeLessThan(hpBefore.wide)
      expect(outside.get(Vitals).hp).toBe(hpBefore.outside)
    })
  })

  function damageEventsOn(world, target) {
    const collected = []
    tick(world, { primary: true, primaryHeld: true })
    for (let t = 0; t < 1.1; t += DELTA) {
      tick(world, { primaryHeld: true })
      collected.push(
        ...events
          .drain()
          .filter(
            (event) =>
              event.type === EVENT_TYPES.ATTACK_RESOLVED &&
              event.target === target,
          ),
      )
    }
    return collected
  }

  function channelBudget(target) {
    // Orçamento do alvo = o dano de UM golpe (fator aleatório médio, sem
    // crítico) — `weight: 1` e crítico desligado pelo chamador.
    return resolveChannelTickDamage({
      attackerSpecies: getSpecies('bulbasaur'),
      attackerIndividualValues: {},
      defenderSpecies: getSpecies('charmander'),
      defenderIndividualValues: target.get(IndividualValues),
      damage: getSpecies('bulbasaur').basicAttack.damage,
      weight: 1,
      rng: () => 0.99,
    }).amount
  }

  function withCriticalChance(chance, run) {
    const original = GAME_CONFIG.BATTLE.CRITICAL_HIT_CHANCE
    GAME_CONFIG.BATTLE.CRITICAL_HIT_CHANCE = chance
    try {
      run()
    } finally {
      GAME_CONFIG.BATTLE.CRITICAL_HIT_CHANCE = original
    }
  }

  it('o canal inteiro vale o dano de UM golpe, repartido em ticks diferentes entre si', () => {
    withCriticalChance(0, () => {
      withChannelBasic(() => {
        const world = spawnWorld()
        const creature = spawnControlledCreature(world, {
          position: { x: 0, y: 1, z: 0 },
        })
        const target = spawnWildCreature(world, {
          position: { x: 0, y: 1, z: 1 },
          sturdy: true,
        })

        const hits = damageEventsOn(world, target)
        const total = hits.reduce((sum, event) => sum + event.damage, 0)

        expect(hits).toHaveLength(expectedBasicChannelTicks(creature))
        expect(total).toBeCloseTo(channelBudget(target), 6)
        expect(
          new Set(hits.map((e) => e.damage.toFixed(6))).size,
        ).toBeGreaterThan(1)
        expect(hits.every((e) => !e.critical)).toBe(true)
      })
    })
  })

  it('crítico é por tick e vale o dobro da fração daquele tick (bônus)', () => {
    withCriticalChance(1, () => {
      withChannelBasic(() => {
        const world = spawnWorld()
        spawnControlledCreature(world, { position: { x: 0, y: 1, z: 0 } })
        const target = spawnWildCreature(world, {
          position: { x: 0, y: 1, z: 1 },
        })
        const budget = withCriticalChanceZero(() => channelBudget(target))

        const hits = damageEventsOn(world, target)
        const total = hits.reduce((sum, event) => sum + event.damage, 0)

        expect(hits.every((e) => e.critical)).toBe(true)
        expect(total).toBeCloseTo(2 * budget, 6)
      })
    })
  })

  it('soltar o botão cancela na hora: sem mais dano, ação livre e cooldown começa', () => {
    withChannelBasic(() => {
      const world = spawnWorld()
      const creature = spawnControlledCreature(world, {
        position: { x: 0, y: 1, z: 0 },
      })
      const target = spawnWildCreature(world, {
        position: { x: 0, y: 1, z: 1 },
      })

      tick(world, { primary: true, primaryHeld: true })
      // Segura até o 1º tick de dano (0.25s) e um pouco mais.
      for (let t = 0; t < 0.3; t += DELTA) tick(world, { primaryHeld: true })
      expect(hitsOn(target)).toBe(1)

      tick(world, {}) // soltou
      expect(creature.get(ActionState).current).toBe(null)
      expect(creature.get(AttackCooldowns).primary).toBeGreaterThan(
        CHANNEL.cooldown - 2 * DELTA,
      )

      for (let t = 0; t < 1; t += DELTA) tick(world, {})
      expect(hitsOn(target)).toBe(0) // nada depois de cancelar
    })
  })

  it('ataque normal (sem channel) não cancela ao soltar', () => {
    const world = spawnWorld()
    const creature = spawnControlledCreature(world)

    tick(world, { primary: true })
    tick(world, {}) // sem segurar nada

    expect(creature.get(ActionState).current).toBe('attack')
  })
})

function withCriticalChanceZero(run) {
  const original = GAME_CONFIG.BATTLE.CRITICAL_HIT_CHANCE
  GAME_CONFIG.BATTLE.CRITICAL_HIT_CHANCE = 0
  try {
    return run()
  } finally {
    GAME_CONFIG.BATTLE.CRITICAL_HIT_CHANCE = original
  }
}

// O estágio e a duração do efeito vêm da própria skill (o usuário os ajusta).
const GROWL_EFFECT = resolveSkill('growl').effects[0]
const GROWL_STAGES = GROWL_EFFECT.stages
const GROWL_DURATION = GROWL_EFFECT.duration

describe('Growl — a primeira skill de STATUS (sem dano, baixa o ataque dos inimigos no cone)', () => {
  // Growl no slot 1 do charmander só nestes testes (a espécie real tem o
  // tackle ali) — restaura no fim.
  function withGrowl(run) {
    const charmander = getSpecies('charmander')
    const original = charmander.skills[1]
    charmander.skills[1] = 'growl'
    try {
      run()
    } finally {
      charmander.skills[1] = original
    }
  }

  function setup(positions = {}) {
    const world = spawnWorld()
    const creature = spawnControlledCreature(world, { speciesId: 'charmander' })
    const wild = (position) =>
      spawnWildCreature(world, { speciesId: 'charmander', position })
    const targets = Object.fromEntries(
      Object.entries(positions).map(([name, position]) => [
        name,
        wild(position),
      ]),
    )
    return { world, creature, targets }
  }

  // Dispara o Growl e avança até o `effectAt` (o pulso do grito marca o instante).
  function castGrowl(world, creature) {
    tick(world, { secondary1: true })
    for (let i = 0; i < 240 && !creature.has(CryPulse); i++) tick(world, {})
    expect(creature.has(CryPulse)).toBe(true)
  }

  const IN_CONE = { x: 0, y: 1, z: 1.5 }
  const IN_CONE_2 = { x: 0.3, y: 1, z: 2.2 }
  const SIDE = { x: 4, y: 1, z: 1.5 }
  const BEHIND = { x: 0, y: 1, z: -1.5 }
  const TOO_FAR = { x: 0, y: 1, z: 6 }

  it('a skill é de STATUS: sem dano, com um efeito de estágio e forma de cone', () => {
    const growl = resolveSkill('growl')

    expect(growl.damage).toBeNull()
    expect(growl.area).toBe('cone')
    expect(growl.effects).toHaveLength(1)
    expect(growl.effects[0]).toMatchObject({
      type: 'statStage',
      stat: 'attack',
    })
    expect(growl.effects[0].stages).toBeLessThan(0)
    expect(growl.effects[0].duration).toBeGreaterThan(0)
    expect(growl.visual.effectGroup).toBe('growl')
    expect(growl.audio.cry).toBe(true)
  })

  it('baixa o ataque de TODOS os inimigos dentro do cone (o estágio e a duração da skill) e só deles', () => {
    withGrowl(() => {
      const { world, creature, targets } = setup({
        a: IN_CONE,
        b: IN_CONE_2,
        side: SIDE,
        behind: BEHIND,
        far: TOO_FAR,
      })

      castGrowl(world, creature)

      for (const name of ['a', 'b']) {
        expect(targets[name].get(StatStages).attackStage).toBe(GROWL_STAGES)
        expect(targets[name].get(StatStages).attackTime).toBeCloseTo(
          GROWL_DURATION,
          0,
        )
      }
      for (const name of ['side', 'behind', 'far']) {
        expect(targets[name].has(StatStages), name).toBe(false)
      }
    })
  })

  it('não causa dano nenhum', () => {
    withGrowl(() => {
      const { world, creature, targets } = setup({ a: IN_CONE })
      const before = targets.a.get(Vitals).hp

      castGrowl(world, creature)

      expect(targets.a.get(Vitals).hp).toBe(before)
    })
  })

  describe('precisão (sorteio de acerto)', () => {
    // `accuracy: 0` no override: o sorteio SEMPRE erra — determinístico sem
    // mexer no `gameplayRng`.
    function withInaccurateGrowl(run) {
      const charmander = getSpecies('charmander')
      const original = charmander.skills[1]
      charmander.skills[1] = { id: 'growl', overrides: { accuracy: 0 } }
      try {
        run()
      } finally {
        charmander.skills[1] = original
      }
    }

    it('golpe de status que erra não aplica o efeito e emite um attackResolved `missed` por alvo', () => {
      withInaccurateGrowl(() => {
        const { world, creature, targets } = setup({ a: IN_CONE, b: IN_CONE_2 })

        castGrowl(world, creature)
        const emitted = events.drain()

        expect(targets.a.has(StatStages)).toBe(false)
        expect(targets.b.has(StatStages)).toBe(false)
        expect(
          emitted.filter((e) => e.type === EVENT_TYPES.STAT_STAGE_CHANGED),
        ).toHaveLength(0)
        const resolved = emitted.filter(
          (e) => e.type === EVENT_TYPES.ATTACK_RESOLVED,
        )
        expect(resolved).toHaveLength(2)
        for (const event of resolved) {
          expect(event.missed).toBe(true)
          expect(event.result).toBe('miss')
          expect(event.target).toBeTruthy()
        }
      })
    })

    it('com a precisão do atacante no mínimo, um golpe de 100% às vezes erra (e às vezes acerta)', () => {
      withGrowl(() => {
        const { world, creature, targets } = setup({ a: IN_CONE })
        creature.add(StatStages({ accuracyStage: -6, accuracyTime: 999 }))

        let hits = 0
        let misses = 0
        for (let i = 0; i < 40; i++) {
          // o recarregar do golpe: cada tentativa numa ação nova
          targets.a.remove(StatStages)
          castGrowl(world, creature)
          for (const event of events.drain()) {
            if (event.type !== EVENT_TYPES.ATTACK_RESOLVED) continue
            if (event.missed) misses += 1
            else hits += 1
          }
          advanceUntilFree(world, creature)
          creature.remove(CryPulse)
          creature.set(AttackCooldowns, { secondary1: 0 })
          // ...e a energia: o teste é da precisão, não do custo (035).
          creature.set(Vitals, { stamina: creature.get(Vitals).maxStamina })
        }

        expect(hits).toBeGreaterThan(0)
        expect(misses).toBeGreaterThan(0)
      })
    })

    it('golpe com precisão normal (100%, estágio 0) nunca erra', () => {
      withGrowl(() => {
        const { world, creature } = setup({ a: IN_CONE })

        castGrowl(world, creature)

        const [resolved] = events
          .drain()
          .filter((e) => e.type === EVENT_TYPES.ATTACK_RESOLVED)
        expect(resolved.missed).toBe(false)
        expect(resolved.result).toBe('hit')
      })
    })
  })

  it('emite um statStageChanged por alvo e um attackResolved de STATUS (damage 0) por alvo', () => {
    withGrowl(() => {
      const { world, creature, targets } = setup({
        a: IN_CONE,
        b: IN_CONE_2,
        far: TOO_FAR,
      })

      castGrowl(world, creature)
      const emitted = events.drain()

      const changed = emitted.filter(
        (e) => e.type === EVENT_TYPES.STAT_STAGE_CHANGED,
      )
      expect(changed).toHaveLength(2)
      expect(changed.map((e) => e.target)).toEqual(
        expect.arrayContaining([targets.a, targets.b]),
      )
      expect(changed[0]).toMatchObject({
        attacker: creature,
        attackId: 'growl',
        stat: 'attack',
        delta: GROWL_STAGES,
        stage: GROWL_STAGES,
      })

      const resolved = emitted.filter(
        (e) => e.type === EVENT_TYPES.ATTACK_RESOLVED,
      )
      expect(resolved).toHaveLength(2)
      for (const event of resolved) {
        expect(event).toMatchObject({
          result: 'hit',
          status: true,
          damage: 0,
          critical: false,
          attackId: 'growl',
        })
      }
    })
  })

  it('o golpe normal não marca status: attackResolved comum tem status false', () => {
    const world = spawnWorld()
    spawnControlledCreature(world)
    spawnWildCreature(world, { position: { x: 0, y: 1, z: 1 } })

    tick(world, { primary: true })
    advanceUntilEffectSpawns(world)

    const [event] = events
      .drain()
      .filter((e) => e.type === EVENT_TYPES.ATTACK_RESOLVED)
    expect(event.status).toBe(false)
  })

  it('nasce UM AttackEffect do grupo "growl" (as ondas), do tamanho do alcance', () => {
    withGrowl(() => {
      const { world, creature } = setup({ a: IN_CONE })

      castGrowl(world, creature)

      const effects = world.query(AttackEffect)
      expect(effects).toHaveLength(1)
      const effect = effects[0].get(AttackEffect)
      expect(effect.effectGroup).toBe('growl')
      expect(effect.length).toBeGreaterThan(0)
    })
  })

  it('a criatura VOCALIZA no instante do golpe (CryPulse) — o som é o grito dela', () => {
    withGrowl(() => {
      const { world, creature } = setup({ a: IN_CONE })
      tick(world, { secondary1: true })
      expect(creature.has(CryPulse)).toBe(false) // ainda antes do `effectAt`

      for (let i = 0; i < 240 && !creature.has(CryPulse); i++) tick(world, {})

      expect(creature.has(CryPulse)).toBe(true)
    })
  })

  it('o alvo desmaiado (ou sem HP) no cone não é afetado', () => {
    withGrowl(() => {
      const { world, creature, targets } = setup({ fainted: IN_CONE })
      targets.fainted.add(Fainted)

      castGrowl(world, creature)

      expect(targets.fainted.has(StatStages)).toBe(false)
    })
  })

  it('lançar de novo ACUMULA: o 2º Growl soma o estágio e renova o tempo', () => {
    withGrowl(() => {
      const { world, creature, targets } = setup({ a: IN_CONE })
      castGrowl(world, creature)
      advanceUntilFree(world, creature)
      creature.remove(CryPulse)
      // passa o cooldown (5 s) e um pouco do tempo do efeito
      for (let i = 0; i < 400; i++) tick(world, {})
      targets.a.set(StatStages, { attackTime: 3 })

      castGrowl(world, creature)

      expect(targets.a.get(StatStages).attackStage).toBe(GROWL_STAGES * 2)
      expect(targets.a.get(StatStages).attackTime).toBeCloseTo(
        GROWL_DURATION,
        0,
      )
    })
  })

  it('o estágio realmente reduz o dano que o alvo causa (ligado à fórmula)', () => {
    withGrowl(() => {
      const { world, creature, targets } = setup({ a: IN_CONE })
      const species = getSpecies('charmander')
      const hit = (attackerStages) =>
        resolveChannelTickDamage({
          attackerSpecies: species,
          attackerIndividualValues: null,
          defenderSpecies: species,
          defenderIndividualValues: null,
          damage: { power: 40, category: 'physical' },
          attackerStages,
          weight: 1,
          rng: () => 0.99,
        }).amount

      castGrowl(world, creature)
      const stages = {
        attack: targets.a.get(StatStages).attackStage,
        defense: 0,
        sp_atk: 0,
        sp_def: 0,
      }

      expect(hit(stages)).toBeLessThan(hit({ attack: 0 }))
    })
  })

  it('pelo CAMINHO COMPLETO do sistema: quem está com o ataque em -6 causa bem menos dano (golpe de poder alto, pro efeito passar do sorteio)', () => {
    // Poder 5 (o dos básicos hoje) esconde o efeito na fórmula (o `+2` fixo
    // domina) — aqui um golpe forte deixa o estágio aparecer. Média de várias
    // tentativas pra absorver o fator aleatório e o crítico.
    const bulbasaur = getSpecies('bulbasaur')
    const original = bulbasaur.basicAttack.damage
    bulbasaur.basicAttack.damage = { ...original, power: 100 }
    try {
      const averageLoss = (attackStage) => {
        let total = 0
        const trials = 12
        for (let i = 0; i < trials; i++) {
          // mundo próprio, destruído a cada tentativa (o koota limita 16)
          const world = createWorld()
          const attacker = spawnControlledCreature(world)
          if (attackStage !== 0) {
            attacker.add(StatStages({ attackStage, attackTime: 60 }))
          }
          const target = spawnWildCreature(world, {
            position: { x: 0, y: 1, z: 1 },
          })
          const before = target.get(Vitals).hp

          tick(world, { primary: true })
          advanceUntilEffectSpawns(world)

          total += before - target.get(Vitals).hp
          world.destroy()
        }
        return total / trials
      }

      const normal = averageLoss(0)
      const lowered = averageLoss(-6)

      expect(normal).toBeGreaterThan(0)
      expect(lowered).toBeLessThan(normal * 0.6)
    } finally {
      bulbasaur.basicAttack.damage = original
    }
  })
})

// Ticks até o `effectAt` do Growth (com folga) — sai da skill, que o usuário
// balanceia à vontade.
function ticksUntilGrowthEffect() {
  return Math.ceil(resolveSkill('growth').effectAt / DELTA) + 10
}

// Q segurado — golpe em si mesmo exige o botão durante a carga.
const HOLD_Q = { secondary1Held: true }

describe('Growth — skill de status em SI MESMO (sobe Ataque e Ataque Especial de quem usa)', () => {
  // Growth no slot 1 do charmander só nestes testes — restaura no fim.
  function withGrowth(run) {
    const charmander = getSpecies('charmander')
    const original = charmander.skills[1]
    charmander.skills[1] = 'growth'
    try {
      run()
    } finally {
      charmander.skills[1] = original
    }
  }

  // Inimigo bem na frente: o Growth não pode encostar nele.
  function setup() {
    const world = spawnWorld()
    const creature = spawnControlledCreature(world, { speciesId: 'charmander' })
    const enemy = spawnWildCreature(world, {
      speciesId: 'charmander',
      position: { x: 0, y: 1, z: 1 },
    })
    return { world, creature, enemy }
  }

  // Dispara e avança até o `effectAt` (o pulso do som marca o instante; o de
  // um disparo anterior sai antes — nos testes ninguém o consome).
  function castGrowth(world, creature) {
    creature.remove(AttackPulse)
    tick(world, { secondary1: true })
    for (
      let i = 0;
      i < ticksUntilGrowthEffect() && !creature.has(AttackPulse);
      i++
    ) {
      tick(world, HOLD_Q)
    }
    expect(creature.has(AttackPulse)).toBe(true)
  }

  it('a skill: sem dano, area self, +1 em attack e sp_atk', () => {
    const growth = resolveSkill('growth')

    expect(growth.damage).toBeNull()
    expect(growth.area).toBe('self')
    expect(growth.effects).toEqual([
      expect.objectContaining({ type: 'statStage', stat: 'attack', stages: 1 }),
      expect.objectContaining({ type: 'statStage', stat: 'sp_atk', stages: 1 }),
    ])
    expect(growth.visual.effectGroup).toBe('statup')
  })

  it('sobe o Ataque e o Ataque Especial de QUEM USOU, pela duração da skill; o inimigo à frente não muda', () => {
    withGrowth(() => {
      const { world, creature, enemy } = setup()
      const [effect] = resolveSkill('growth').effects

      castGrowth(world, creature)

      const stages = creature.get(StatStages)
      expect(stages.attackStage).toBe(1)
      expect(stages.sp_atkStage).toBe(1)
      expect(stages.attackTime).toBeCloseTo(effect.duration, 0)
      expect(enemy.has(StatStages)).toBe(false)
    })
  })

  it('usar de novo acumula (+2) e não passa de +6', () => {
    withGrowth(() => {
      const { world, creature } = setup()

      castGrowth(world, creature)
      advanceUntilFree(world, creature)
      creature.set(AttackCooldowns, { secondary1: 0 })
      castGrowth(world, creature)
      expect(creature.get(StatStages).attackStage).toBe(2)

      creature.set(StatStages, { attackStage: 6, sp_atkStage: 6 })
      advanceUntilFree(world, creature)
      creature.set(AttackCooldowns, { secondary1: 0 })
      creature.set(Vitals, { stamina: 100 })
      events.drain()
      castGrowth(world, creature)
      expect(creature.get(StatStages).attackStage).toBe(6)
      // já no limite: nada mudou, nenhum evento
      expect(
        events.drain().filter((e) => e.type === EVENT_TYPES.STAT_STAGE_CHANGED),
      ).toHaveLength(0)
    })
  })

  it('emite um statStageChanged por atributo, com attacker = target = quem usou, e NENHUM attackResolved', () => {
    withGrowth(() => {
      const { world, creature } = setup()

      castGrowth(world, creature)
      const emitted = events.drain()

      const changed = emitted.filter(
        (e) => e.type === EVENT_TYPES.STAT_STAGE_CHANGED,
      )
      expect(changed.map((e) => e.stat)).toEqual(['attack', 'sp_atk'])
      for (const event of changed) {
        expect(event).toMatchObject({
          attacker: creature,
          target: creature,
          attackId: 'growth',
          delta: 1,
          stage: 1,
        })
      }
      // sem alvo: ninguém se provoca nem defende
      expect(
        emitted.filter((e) => e.type === EVENT_TYPES.ATTACK_RESOLVED),
      ).toHaveLength(0)
    })
  })

  it('não erra, nem com a precisão no mínimo (golpe em si mesmo não sorteia)', () => {
    withGrowth(() => {
      const { world, creature } = setup()
      creature.add(StatStages({ accuracyStage: -6, accuracyTime: 60 }))

      castGrowth(world, creature)

      expect(creature.get(StatStages).attackStage).toBe(1)
    })
  })

  it('não gira a criatura: nem pra câmera no disparo, nem durante a ação', () => {
    withGrowth(() => {
      const { world, creature } = setup()
      creature.set(Rotation, { y: 1.2 })
      // câmera apontando pra outro lado
      const camera = world.spawn(
        OrbitCamera({ yaw: -2, pitch: 0.3, distance: 10 }),
      )

      tick(world, { secondary1: true })
      expect(creature.get(ActionState).current).toBe('attack')
      expect(creature.get(Rotation).y).toBeCloseTo(1.2)

      camera.set(OrbitCamera, { yaw: 2 })
      for (
        let i = 0;
        i < ticksUntilGrowthEffect() * 2 &&
        creature.get(ActionState).current !== null;
        i++
      ) {
        tick(world, HOLD_Q)
      }
      expect(creature.get(ActionState).current).toBeNull()
      expect(creature.get(Rotation).y).toBeCloseTo(1.2)
    })
  })

  it('exige o botão SEGURADO na carga: soltar antes do efeito cancela (sem efeito, cooldown começa, stamina não volta)', () => {
    withGrowth(() => {
      const { world, creature } = setup()
      const growth = resolveAttackForEntity(
        getSpecies('charmander'),
        'secondary1',
        creature.get(IndividualValues),
      )
      const staminaBefore = creature.get(Vitals).stamina

      tick(world, { secondary1: true })
      tick(world, HOLD_Q)
      expect(creature.get(ActionState).current).toBe('attack')

      tick(world, {}) // soltou o Q
      expect(creature.get(ActionState).current).toBeNull()
      expect(creature.get(AttackCooldowns).secondary1).toBeGreaterThan(
        growth.cooldown - 0.1,
      )
      expect(creature.get(Vitals).stamina).toBeLessThan(staminaBefore)

      for (let i = 0; i < ticksUntilGrowthEffect(); i++) tick(world, {})
      expect(creature.has(StatStages)).toBe(false)
      // cancelar soltando não é interrupção: sem "Interrompido!"
      expect(
        events.drain().filter((e) => e.type === EVENT_TYPES.ATTACK_INTERRUPTED),
      ).toHaveLength(0)
    })
  })

  it('depois do efeito, soltar o botão não cancela: o resto da animação segue', () => {
    withGrowth(() => {
      // efeito antes do fim da ação, seja qual for o balanceamento atual do
      // Growth (com `effectAt` = `duration` não sobra animação depois)
      const charmander = getSpecies('charmander')
      charmander.skills[1] = {
        id: 'growth',
        overrides: { duration: 2, effectAt: 1 },
      }
      const { world, creature } = setup()

      castGrowth(world, creature)
      expect(creature.get(StatStages).attackStage).toBe(1)

      tick(world, {}) // soltou o Q depois do efeito
      expect(creature.get(ActionState).current).toBe('attack')
    })
  })

  it('o AttackEffect "statup" nasce nos PÉS de quem usou, não à frente', () => {
    withGrowth(() => {
      const { world, creature } = setup()
      const pos = { ...creature.get(Position) }
      const clearance = verticalClearance(creature.get(CharacterController))

      castGrowth(world, creature)

      const effects = world.query(AttackEffect)
      expect(effects).toHaveLength(1)
      expect(effects[0].get(AttackEffect).effectGroup).toBe('statup')
      const at = effects[0].get(Position)
      expect(at.x).toBeCloseTo(pos.x)
      expect(at.z).toBeCloseTo(pos.z)
      expect(at.y).toBeCloseTo(pos.y - clearance)
    })
  })
})

describe('interrupção de golpe de STATUS por dano (só na carga)', () => {
  function withGrowth(run) {
    const charmander = getSpecies('charmander')
    const original = charmander.skills[1]
    charmander.skills[1] = 'growth'
    try {
      run()
    } finally {
      charmander.skills[1] = original
    }
  }

  // Selvagem pronta pra atacar, como o `wildCreatureSpawnSystem` cria.
  function spawnWildAttacker(world, position) {
    return world.spawn(
      Position(position),
      Rotation,
      ActionState,
      AttackCooldowns,
      Mood,
      CharacterController(getSpecies('charmander').body),
      PhysicsBody,
      vitalsFromSpecies(getSpecies('charmander')),
      WildCreature({ speciesId: 'charmander' }),
      IndividualValues,
    )
  }

  function setup() {
    const world = spawnWorld()
    const mine = spawnControlledCreature(world, {
      speciesId: 'charmander',
      position: { x: 0.9, y: 1, z: 0 },
    })
    const wild = spawnWildAttacker(world, { x: 0, y: 1, z: 0 })
    return { world, mine, wild }
  }

  // Avança até a selvagem acertar (o hp da minha cai) — devolve os eventos.
  function runUntilHit(world, mine) {
    const hpBefore = mine.get(Vitals).hp
    const emitted = []
    for (let i = 0; i < 120 && mine.get(Vitals).hp >= hpBefore; i++) {
      tick(world, HOLD_Q)
      emitted.push(...events.drain())
    }
    expect(mine.get(Vitals).hp).toBeLessThan(hpBefore)
    return emitted
  }

  it('levar dano durante a carga corta o Growth: sem efeito, cooldown começa, stamina não volta, sai "attackInterrupted"', () => {
    withGrowth(() => {
      const { world, mine, wild } = setup()
      const growth = resolveAttackForEntity(
        getSpecies('charmander'),
        'secondary1',
        mine.get(IndividualValues),
      )
      const staminaBefore = mine.get(Vitals).stamina

      tick(world, { secondary1: true })
      wild.add(WantsToAttack({ target: mine }))
      const emitted = runUntilHit(world, mine)

      // premissa: o golpe da selvagem chega antes do effectAt do Growth.
      // A ação vira o atordoamento (animação de hit, sem poder fazer nada).
      expect(mine.get(ActionState).current).toBe('hit')
      expect(mine.has(StatStages)).toBe(false)
      expect(mine.get(AttackCooldowns).secondary1).toBeGreaterThan(
        growth.cooldown - 0.1,
      )
      expect(mine.get(Vitals).stamina).toBeLessThan(staminaBefore)

      const interrupted = emitted.filter(
        (e) => e.type === EVENT_TYPES.ATTACK_INTERRUPTED,
      )
      expect(interrupted).toHaveLength(1)
      expect(interrupted[0]).toMatchObject({
        entity: mine,
        attackId: 'growth',
        slot: 'secondary1',
      })

      // e não volta: o resto da ação não aplica nada
      for (let i = 0; i < 90; i++) tick(world)
      expect(mine.has(StatStages)).toBe(false)
    })
  })

  it('depois do effectAt, levar dano não interrompe: o efeito já foi aplicado e a ação segue', () => {
    withGrowth(() => {
      const { world, mine, wild } = setup()

      tick(world, { secondary1: true })
      for (
        let i = 0;
        i < ticksUntilGrowthEffect() && !mine.has(StatStages);
        i++
      ) {
        tick(world, HOLD_Q)
      }
      expect(mine.get(StatStages).attackStage).toBe(1)

      wild.add(WantsToAttack({ target: mine }))
      const emitted = runUntilHit(world, mine)

      expect(
        emitted.filter((e) => e.type === EVENT_TYPES.ATTACK_INTERRUPTED),
      ).toHaveLength(0)
      expect(mine.get(StatStages).attackStage).toBe(1)
    })
  })
})

describe('Leech Seed — planta a semente no alvo (quem drena é o leechSeedSystem)', () => {
  function withLeechSeed(reference, run) {
    const charmander = getSpecies('charmander')
    const original = charmander.skills[1]
    charmander.skills[1] = reference
    try {
      run()
    } finally {
      charmander.skills[1] = original
    }
  }

  function setup() {
    const world = spawnWorld()
    const creature = spawnControlledCreature(world, { speciesId: 'charmander' })
    const target = spawnWildCreature(world, {
      speciesId: 'charmander',
      position: { x: 0, y: 1, z: 1.5 },
    })
    return { world, creature, target }
  }

  function cast(world, creature) {
    tick(world, { secondary1: true })
    for (let i = 0; i < 240 && !creature.has(AttackPulse); i++) tick(world, {})
    expect(creature.has(AttackPulse)).toBe(true)
  }

  it('acertando: o alvo ganha a semente, ligada a quem plantou, e não leva dano na hora', () => {
    // precisão `null` (nunca erra) só aqui: o sorteio de 90% fica de fora
    withLeechSeed({ id: 'leech-seed', overrides: { accuracy: null } }, () => {
      const { world, creature, target } = setup()
      const hp = target.get(Vitals).hp
      cast(world, creature)

      expect(target.has(LeechSeed)).toBe(true)
      expect(target.targetFor(SeededBy)).toBe(creature)
      const [effect] = resolveSkill('leech-seed').effects
      expect(target.get(LeechSeed)).toMatchObject({
        timeLeft: effect.duration,
        interval: effect.interval,
      })
      expect(target.get(Vitals).hp).toBe(hp)
    })
  })

  it('errando no sorteio de precisão: sem semente', () => {
    withLeechSeed({ id: 'leech-seed', overrides: { accuracy: 0 } }, () => {
      const { world, creature, target } = setup()
      cast(world, creature)
      expect(target.has(LeechSeed)).toBe(false)
    })
  })
})

describe('creatureAttackSystem — canalizado em FEIXE (area line)', () => {
  // Básico do bulbasaur trocado por um feixe só dentro do teste: 4 ticks (0.25 a
  // 1 s), cápsula de 3 m de alcance. Sem física, a trajetória vai até o alcance.
  const BEAM = {
    damageMode: 'channel',
    damageInterval: 0.25,
    area: 'line',
    duration: 1,
    effectAt: 0.25,
    range: 3,
    radius: 0.35,
    cooldown: 1,
  }

  // `speciesId`: o bulbasaur não tem `camera` (a mira pela câmera precisa) — o teste
  // de mirar usa o charmander
  function withBeamBasic(overrides, run, speciesId = 'bulbasaur') {
    const species = getSpecies(speciesId)
    const original = species.basicAttack
    species.basicAttack = {
      ...original,
      ...BEAM,
      ...overrides,
      visual: { ...original.visual, ...overrides.visual },
    }
    try {
      run()
    } finally {
      species.basicAttack = original
    }
  }

  const damageOn = (resolved, target) =>
    resolved.filter(
      (e) =>
        e.type === EVENT_TYPES.ATTACK_RESOLVED &&
        e.target === target &&
        e.result === 'hit',
    ).length

  it('só o PRIMEIRO corpo na linha leva cada tick (o de trás, não)', () => {
    withBeamBasic({}, () => {
      const world = spawnWorld()
      const creature = spawnControlledCreature(world, {
        position: { x: 0, y: 1, z: 0 },
      })
      const front = spawnWildCreature(world, {
        position: { x: 0, y: 1, z: 1 },
        sturdy: true,
      })
      const behind = spawnWildCreature(world, {
        position: { x: 0, y: 1, z: 2.2 },
      })

      tick(world, { primary: true, primaryHeld: true })
      const resolved = []
      for (let t = 0; t < 1.1; t += DELTA) {
        tick(world, { primaryHeld: true })
        resolved.push(...events.drain())
      }

      expect(damageOn(resolved, front)).toBe(
        expectedBasicChannelTicks(creature),
      )
      expect(damageOn(resolved, behind)).toBe(0)
    })
  })

  it('a forma é a cápsula, não o cone (indicador, aviso e alvos)', () => {
    expect(isConeAttack({ ...BEAM })).toBe(false)
    expect(isConeAttack({ ...BEAM, area: undefined })).toBe(true)
  })

  it('a criatura controlada continua mirando com a câmera DEPOIS do effectAt (o cone, não)', () => {
    const steeredAfterEffect = (overrides) => {
      let turned = false
      withBeamBasic(
        overrides,
        () => {
          const world = spawnWorld()
          const creature = spawnControlledCreature(world, {
            speciesId: 'charmander',
            position: { x: 0, y: 1, z: 0 },
          })
          const camera = world.spawn(
            OrbitCamera({ yaw: 0, pitch: 0.3, distance: 10 }),
          )
          tick(world, { primary: true, primaryHeld: true })
          for (let i = 0; i < 30; i++) tick(world, { primaryHeld: true }) // passou do effectAt
          const before = creature.get(ActionState).dirX

          camera.set(OrbitCamera, { yaw: Math.PI / 2 })
          tick(world, { primaryHeld: true })
          turned = Math.abs(creature.get(ActionState).dirX - before) > 0.5
        },
        'charmander',
      )
      return turned
    }

    expect(steeredAfterEffect({})).toBe(true)
    expect(steeredAfterEffect({ area: undefined })).toBe(false)
  })

  it('cada tick solta o efeito de impacto do feixe (`channelHitGroup`) onde bateu', () => {
    withBeamBasic(
      { visual: { effectGroup: 'none', channelHitGroup: 'water-gun-hit' } },
      () => {
        const world = spawnWorld()
        spawnControlledCreature(world, { position: { x: 0, y: 1, z: 0 } })
        spawnWildCreature(world, { position: { x: 0, y: 1, z: 1 } })

        tick(world, { primary: true, primaryHeld: true })
        for (let t = 0; t < 1.1; t += DELTA) tick(world, { primaryHeld: true })

        const hits = world
          .query(AttackEffect)
          .filter((e) => e.get(AttackEffect).effectGroup === 'water-gun-hit')
        expect(hits.length).toBeGreaterThanOrEqual(3)
        // no corpo da frente, não no fim do alcance (3 m)
        expect(hits[0].get(Position).z).toBeLessThan(1.5)
      },
    )
  })
})
