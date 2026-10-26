import { trait } from 'koota'
import { buildReliefMesh, reliefHeightAt, resolveRelief } from './labRelief'
import {
  resolveHitTrigger,
  resolveTriggerEdge,
  resolveTriggerFrontEdge,
  resolveTriggerSegment,
} from '@/core/battle/hitTrigger'
import { GAME_CONFIG } from '@/core/gameConfig'
import { getSpecies } from '@/core/data/species'
import { createLevelState } from '@/core/data/species/experience'
import {
  createEmptyMoveSlots,
  createMovesState,
} from '@/core/data/species/moves'
import {
  resolveAttackForEntity,
  resolveDirectionTo,
  tryStartAttack,
} from '@/core/battle/attackCasting'
import { resolveEntityMoveSet } from '@/core/battle/creatureAttack'
import { removerCondicoes } from '@/core/actions/conditions'
import { readSpeedStage } from '@/core/battle/statStages'
import {
  getRapier,
  getRapierWorld,
  isPhysicsReady,
} from '@/core/physics/physicsWorld'
import {
  createCharacterBody,
  destroyCharacterBody,
  teleportCharacterBody,
  verticalClearance,
} from '@/core/physics/colliders'
import { creatureAttackSystem } from '@/core/systems/creatureAttackSystem'
import { creatureHitStunSystem } from '@/core/systems/creatureHitStunSystem'
import { conditionSystem } from '@/core/systems/conditionSystem'
import { combatModeSystem } from '@/core/systems/combatModeSystem'
import { attackEffectSystem } from '@/core/systems/attackEffectSystem'
import { statStageSystem } from '@/core/systems/statStageSystem'
import { attackLungeSystem } from '@/core/systems/attackLungeSystem'
import { characterPhysicsSystem } from '@/core/systems/characterPhysicsSystem'
import { physicsStepSystem } from '@/core/systems/physicsStepSystem'
import { syncPhysicsSystem } from '@/core/systems/syncPhysicsSystem'
import { animationStateSystem } from '@/core/systems/animationStateSystem'
import {
  ActionState,
  AiMovement,
  AnimationState,
  AttackAim,
  AttackCooldowns,
  CharacterController,
  CreatureLevel,
  CreatureMoves,
  FlightStats,
  Flying,
  HeldItem,
  IndividualValues,
  InputState,
  Mood,
  MovementStats,
  OwnedBy,
  Party,
  PathState,
  PhysicsBody,
  Position,
  Rotation,
  ScanMode,
  StatStages,
  SummonedCreature,
  Velocity,
  Vitals,
  WildBehavior,
  WildCreature,
  vitalsFromSpecies,
} from '@/core/traits'

/**
 * O mundo do laboratório de golpes (docs/features/061-revisao-das-skills.md,
 * Parte 1): um chão plano, um ATACANTE (criatura do time, sem controle) e
 * nenhum, um ou vários ALVOS (selvagens paradas). O golpe roda pelos systems
 * do jogo; aqui fica só o que é do laboratório — montar a cena, o chão na
 * física e o `skillLabSystem`, que relança o golpe escolhido em loop.
 *
 * `lab` (no `context` de cada passo) são as escolhas da página:
 * `{ attackerId, moveId, targets, aimAt, interval, attackerLevel, mastery,
 * resetBetween, relief }`. Cada alvo é `{ key, speciesId, level, x, y, z }`:
 * o centro no chão (m, com o atacante na origem olhando +Z) e a altura acima
 * do chão (> 0 = no ar, como quem voa). `aimAt` é o índice do alvo em que o
 * atacante mira, ou `null` pra frente (+Z). `relief` em `labRelief.js`.
 */

/**
 * Quem é do laboratório: o papel, o índice em `lab.targets` (alvos), a espera
 * até o próximo lançamento (atacante) e a pose de casa que já foi aplicada
 * (alvos — mudou na página, ele vai pro lugar novo na hora).
 */
export const LabActor = trait({ role: 'attacker', index: 0, wait: 0, home: '' })

/** Quantos alvos a cena aceita. */
export const LAB_MAX_TARGETS = 6

/** Marca o atacante (o anel de tempo da ação segue ele, não o controlado). */
export const LabAttacker = trait()

/** O slot em que o laboratório põe o golpe escolhido. */
export const LAB_SLOT = 'secondary1'
const LAB_MOVE_SLOT = 1

// Chão: malha de triângulos com o relevo escolhido (`labRelief.js`), não
// heightfield — o Rapier erra raio em célula plana de heightfield (083 no
// roadmap).
export const LAB_GROUND = { size: 60 }

// IV do meio da faixa em todo atributo: o atacante e o alvo nem rápidos nem
// lentos (a página mostra o tempo efetivo).
const MIDDLE_IV = Math.round(
  (GAME_CONFIG.BATTLE.IV_MIN + GAME_CONFIG.BATTLE.IV_MAX) / 2,
)
const LAB_IVS = Object.fromEntries(
  ['hp', 'attack', 'defense', 'sp_atk', 'sp_def', 'speed'].map((stat) => [
    stat,
    MIDDLE_IV,
  ]),
)

// Sem alvo, o relevo se mede até aqui (m).
const RELIEF_FALLBACK_DISTANCE = 2

/**
 * A distância (m, em Z) que o relevo usa de régua: até o primeiro alvo, ou
 * uma fixa sem alvo.
 */
export function resolveLabReferenceDistance(lab) {
  return lab.targets[0]?.z ?? RELIEF_FALLBACK_DISTANCE
}

/** O relevo da cena no mundo (`labRelief.js`). */
export function resolveLabRelief(lab) {
  return resolveRelief(lab.relief, resolveLabReferenceDistance(lab))
}

/** Quanto a borda da frente do trigger da espécie fica além do centro. */
function resolveFrontEdge(species) {
  return resolveTriggerFrontEdge(resolveHitTrigger(species.body))
}

/**
 * O Z do centro do alvo à frente do atacante (`x` 0) com `gap` de vão entre
 * os triggers: da borda da frente do atacante (de onde o `range` conta) até a
 * borda do alvo — com `gap` igual ao `range`, o golpe encosta.
 */
export function resolveTargetZForGap(attackerSpecies, targetSpecies, gap) {
  return (
    resolveFrontEdge(attackerSpecies) + gap + resolveFrontEdge(targetSpecies)
  )
}

/**
 * Onde cada um fica, em pé no relevo: o atacante na origem olhando +Z; o
 * alvo `index` no `x`/`z` dele, `y` acima do chão, virado pro atacante.
 */
export function resolveLabHome(role, species, lab, index = 0) {
  const entry = role === 'attacker' ? null : lab.targets[index]
  const x = entry?.x ?? 0
  const z = entry?.z ?? 0
  const y =
    reliefHeightAt(resolveLabRelief(lab), z) +
    verticalClearance(species.body) +
    Math.max(0, entry?.y ?? 0)
  return {
    position: { x, y, z },
    yaw: entry ? Math.atan2(-x, -z) : 0,
  }
}

function createBody(species, position) {
  if (!isPhysicsReady()) return { bodyHandle: -1, colliderHandle: -1 }
  return createCharacterBody(position, {
    radius: species.body.capsuleRadius,
    halfHeight: species.body.capsuleHalfHeight,
    axis: species.body.capsuleAxis,
  })
}

// O que as duas têm em comum (composição do `summonBallSystem` e do
// `wildCreatureSpawnSystem`, sem a IA de movimento).
function creatureTraits(species, level, home) {
  const levelState = createLevelState(species, level)
  return [
    Position(home.position),
    Rotation({ y: home.yaw }),
    IndividualValues(LAB_IVS),
    CreatureLevel(levelState),
    CreatureMoves(createMovesState(species)),
    AnimationState,
    ActionState,
    AttackCooldowns,
    AttackAim,
    Velocity,
    CharacterController(species.body),
    MovementStats(species.movement),
    ...(species.flight ? [FlightStats(species.flight)] : []),
    vitalsFromSpecies(species, LAB_IVS, levelState.level),
    PhysicsBody(createBody(species, home.position)),
    PathState,
    Mood,
  ]
}

/**
 * O golpe como o atacante do laboratório lança agora: base + espécie, com o
 * tempo escalado pelo `speed` dele, o custo da fórmula e o domínio (o mesmo
 * `resolveAttackForEntity` do jogo).
 */
export function resolveLabAttack(lab) {
  const species = getSpecies(lab.attackerId)
  return resolveAttackForEntity(species, LAB_SLOT, LAB_IVS, lab.attackerLevel, {
    ...createEmptyMoveSlots(),
    [LAB_MOVE_SLOT]: { id: lab.moveId, mastery: lab.mastery },
  })
}

/** Quanto do golpe em curso já passou (s), ou `null` sem golpe. */
export function readLabElapsed(world) {
  const attacker = findActor(world, 'attacker')
  const action = attacker?.get(ActionState)
  return action?.current === 'attack' ? action.elapsed : null
}

/**
 * Distância REAL agora (m, no chão) até o alvo `index`: o vão entre os
 * triggers, onde os dois estão de fato (a física pode ter empurrado um deles,
 * ex.: cápsula deitada batendo numa rampa) — do centro do atacante até a
 * borda do trigger do alvo, menos a borda do atacante nessa direção (de onde
 * o `range` conta). `null` sem esse alvo.
 */
export function readLabGap(world, index = 0) {
  const attacker = findActor(world, 'attacker')
  const target = findActor(world, 'target', index)
  if (!attacker || !target) return null
  const from = attacker.get(Position)
  const { a, b, radius } = resolveTriggerSegment(
    target.get(Position),
    target.get(Rotation).y,
    resolveHitTrigger(getSpecies(resolveSpeciesId(target)).body),
  )
  const abX = b.x - a.x
  const abZ = b.z - a.z
  const lengthSq = abX * abX + abZ * abZ
  const t =
    lengthSq > 0
      ? Math.min(
          1,
          Math.max(0, ((from.x - a.x) * abX + (from.z - a.z) * abZ) / lengthSq),
        )
      : 0
  const toTarget = { x: a.x + abX * t - from.x, z: a.z + abZ * t - from.z }
  const edge = resolveTriggerEdge(
    resolveHitTrigger(getSpecies(resolveSpeciesId(attacker)).body),
    attacker.get(Rotation).y,
    toTarget,
  )
  return Math.hypot(toTarget.x, toTarget.z) - radius - edge
}

/** Tira a cena do laboratório (corpos da física inclusive). */
export function desmontarLab(world) {
  const actors = world.query(LabActor)
  for (const entity of [...actors]) {
    const { bodyHandle } = entity.get(PhysicsBody)
    if (isPhysicsReady() && bodyHandle >= 0) destroyCharacterBody(bodyHandle)
    entity.destroy()
  }
}

/**
 * Monta a cena com as escolhas de `lab` (desmonta a anterior). O atacante é
 * do treinador do world (`OwnedBy`), como uma criatura do time de verdade.
 */
export function montarLab(world, lab) {
  desmontarLab(world)

  const attackerSpecies = getSpecies(lab.attackerId)
  const trainer = world.queryFirst(Party)
  world.spawn(
    LabActor({ role: 'attacker', wait: 0 }),
    LabAttacker,
    SummonedCreature({ slot: 'slot1', speciesId: attackerSpecies.id }),
    ...(trainer ? [OwnedBy(trainer)] : []),
    InputState,
    HeldItem,
    ScanMode,
    ...creatureTraits(
      attackerSpecies,
      lab.attackerLevel,
      resolveLabHome('attacker', attackerSpecies, lab),
    ),
  )

  lab.targets.slice(0, LAB_MAX_TARGETS).forEach((entry, index) => {
    const targetSpecies = getSpecies(entry.speciesId)
    if (!targetSpecies) return
    const target = world.spawn(
      LabActor({ role: 'target', index, wait: 0 }),
      WildCreature({ speciesId: targetSpecies.id }),
      WildBehavior({ temperament: 'peaceful' }),
      AiMovement,
      ...creatureTraits(
        targetSpecies,
        entry.level,
        resolveLabHome('target', targetSpecies, lab, index),
      ),
    )
    sendHome(target, 'target', lab, index)
  })
}

function findActor(world, role, index = 0) {
  for (const entity of world.query(LabActor)) {
    const actor = entity.get(LabActor)
    if (actor.role === role && (role === 'attacker' || actor.index === index)) {
      return entity
    }
  }
  return null
}

/** O atacante ou o alvo `index` do laboratório (`role`), ou `null`. */
export function findLabActor(world, role, index = 0) {
  return findActor(world, role, index)
}

/** Os alvos na cena, na ordem de `lab.targets`. */
export function listLabTargets(world) {
  return [...world.query(LabActor)]
    .filter((entity) => entity.get(LabActor).role === 'target')
    .sort((a, b) => a.get(LabActor).index - b.get(LabActor).index)
}

/** Espécie de quem está na cena. */
export function resolveLabActorSpecies(entity) {
  return getSpecies(resolveSpeciesId(entity))
}

// O chão de agora: o world do Rapier em que foi criado, o relevo dele e o
// corpo.
const ground = { rapierWorld: null, key: null, bodyHandle: null }

function buildGround(rapierWorld, relief) {
  const RAPIER = getRapier()
  if (ground.rapierWorld === rapierWorld && ground.bodyHandle !== null) {
    const old = rapierWorld.getRigidBody(ground.bodyHandle)
    if (old) rapierWorld.removeRigidBody(old)
  }
  const { vertices, indices } = buildReliefMesh(relief, LAB_GROUND.size)
  const body = rapierWorld.createRigidBody(RAPIER.RigidBodyDesc.fixed())
  rapierWorld.createCollider(
    RAPIER.ColliderDesc.trimesh(vertices, indices),
    body,
  )
  ground.rapierWorld = rapierWorld
  ground.bodyHandle = body.handle
}

/**
 * Física do laboratório: o chão (refeito quando o relevo muda — e aí os dois
 * voltam pra casa, em pé no chão novo) e o corpo de quem nasceu antes da
 * física ficar pronta. Faz o papel do `physicsBootstrapSystem` do jogo, sem
 * o nível de teste.
 */
export function labPhysicsSystem({ world, lab }) {
  if (!isPhysicsReady()) return
  const rapierWorld = getRapierWorld()
  const relief = lab ? resolveLabRelief(lab) : { kind: 'none' }
  const key = JSON.stringify(relief)
  if (ground.rapierWorld !== rapierWorld || ground.key !== key) {
    const rebuilt = ground.rapierWorld === rapierWorld
    buildGround(rapierWorld, relief)
    ground.key = key
    if (rebuilt && lab) sendEveryoneHome(world, lab)
  }

  world
    .query(LabActor, PhysicsBody, CharacterController, Position)
    .updateEach(([, body, controller, pos]) => {
      if (body.bodyHandle >= 0) return
      const handles = createCharacterBody(pos, {
        radius: controller.capsuleRadius,
        halfHeight: controller.capsuleHalfHeight,
        axis: controller.capsuleAxis,
      })
      body.bodyHandle = handles.bodyHandle
      body.colliderHandle = handles.colliderHandle
    })
}

// A pose de casa do alvo como a página pediu (muda → ele vai pro lugar).
function homeKey(lab, index) {
  const { x, y, z } = lab.targets[index] ?? {}
  return `${x}|${y}|${z}`
}

// Volta pra casa: posição, giro, parado. O alvo acima do chão fica no ar
// como quem voa (`Flying`: sem gravidade, e o golpe mede a altura dele).
function sendHome(entity, role, lab, index = 0) {
  const species = getSpecies(resolveSpeciesId(entity))
  const home = resolveLabHome(role, species, lab, index)
  entity.set(Position, home.position)
  entity.set(Rotation, { x: 0, y: home.yaw, z: 0 })
  entity.set(Velocity, { x: 0, y: 0, z: 0 })
  teleportCharacterBody(entity.get(PhysicsBody).bodyHandle, home.position)
  if (role !== 'target') return
  const airborne = (lab.targets[index]?.y ?? 0) > 0
  if (airborne && !entity.has(Flying)) entity.add(Flying)
  if (!airborne && entity.has(Flying)) entity.remove(Flying)
  entity.set(LabActor, { home: homeKey(lab, index) })
}

function sendEveryoneHome(world, lab) {
  const attacker = findActor(world, 'attacker')
  if (attacker) sendHome(attacker, 'attacker', lab)
  for (const target of listLabTargets(world)) {
    sendHome(target, 'target', lab, target.get(LabActor).index)
  }
}

function resolveSpeciesId(entity) {
  if (entity.has(SummonedCreature)) {
    return entity.get(SummonedCreature).speciesId
  }
  return entity.get(WildCreature).speciesId
}

// Sem estágios nem condições, com a vida cheia e sem dano recente.
function limparCondicoes(entity) {
  entity.remove(StatStages)
  removerCondicoes(entity)
  const { maxHp } = entity.get(Vitals)
  // sem dano recente: o golpe seguinte não conta como "apanhou há pouco"
  // (`recentDamageBoost.js`)
  entity.set(Vitals, { hp: maxHp, hpRegenDelay: 0, hpDamageAge: -1 })
  entity.set(ActionState, { current: null, elapsed: 0, pendingSlot: null })
}

// O alvo não desmaia: a vida que zerar volta cheia (o laboratório não roda o
// `faintSystem`).
function manterAlvoVivo(target) {
  const vitals = target.get(Vitals)
  if (vitals.hp <= 0) target.set(Vitals, { hp: vitals.maxHp })
}

// Golpe escolhido no slot do laboratório, com o domínio escolhido, e a
// energia e a recarga liberadas.
function prepararAtacante(attacker, lab) {
  attacker.set(CreatureMoves, {
    slots: {
      ...createEmptyMoveSlots(),
      [LAB_MOVE_SLOT]: { id: lab.moveId, mastery: lab.mastery },
    },
    training: {},
  })
  attacker.set(AttackCooldowns, { [LAB_SLOT]: 0 })
}

function lancar(world, attacker, aimTarget) {
  world
    .query(
      LabActor,
      ActionState,
      AttackCooldowns,
      PhysicsBody,
      Vitals,
      Position,
      Rotation,
      IndividualValues,
    )
    .updateEach(
      (
        [actor, action, cooldowns, physicsBody, vitals, pos, rot, ivs],
        entity,
      ) => {
        if (entity !== attacker) return
        const species = getSpecies(resolveSpeciesId(entity))
        const level = entity.get(CreatureLevel).level
        const moveSet = resolveEntityMoveSet(entity, species)
        const attack = resolveAttackForEntity(
          species,
          LAB_SLOT,
          ivs,
          level,
          moveSet,
          readSpeedStage(entity),
        )
        if (!attack) return
        vitals.stamina = Math.max(vitals.maxStamina, attack.staminaCost)

        const direction = aimTarget
          ? resolveDirectionTo(pos, aimTarget.get(Position), rot)
          : { x: Math.sin(rot.y), y: 0, z: Math.cos(rot.y) }
        tryStartAttack(
          {
            entity,
            world,
            species,
            individualValues: ivs,
            level,
            moveSet,
            action,
            cooldowns,
            vitals,
            pos,
            rot,
            physicsBody,
          },
          LAB_SLOT,
          direction,
        )
        actor.wait = 0
      },
    )
}

/**
 * Relança o golpe em loop: espera o atacante ficar livre, conta o
 * `interval` e lança de novo — sempre dos lugares de partida, com energia e
 * recarga liberadas, mirando no alvo `aimAt` (ou pra frente). Com
 * `resetBetween`, todos voltam também sem estágios, sem condições e com a
 * vida cheia; sem ele, efeitos acumulam. Alvo que a página moveu vai pro
 * lugar novo na hora.
 */
export function skillLabSystem({ world, delta, lab }) {
  if (!lab) return
  const attacker = findActor(world, 'attacker')
  if (!attacker) return
  const targets = listLabTargets(world)
  for (const target of targets) {
    manterAlvoVivo(target)
    const { index, home } = target.get(LabActor)
    if (home !== homeKey(lab, index)) sendHome(target, 'target', lab, index)
  }

  const busy = attacker.get(ActionState).current !== null
  const { wait } = attacker.get(LabActor)
  if (busy) {
    attacker.set(LabActor, { wait: lab.interval })
    return
  }
  if (wait > 0) {
    attacker.set(LabActor, { wait: wait - delta })
    return
  }

  sendEveryoneHome(world, lab)
  if (lab.resetBetween) {
    for (const entity of [attacker, ...targets]) limparCondicoes(entity)
  }
  prepararAtacante(attacker, lab)
  const aimTarget =
    lab.aimAt === null ? null : findActor(world, 'target', lab.aimAt ?? 0)
  lancar(world, attacker, aimTarget)
}

/**
 * Systems do passo fixo, na ordem do `registerSystems.js` do jogo — só os
 * que o golpe usa (sem chunks, IA, input, desmaio nem save).
 */
export const LAB_FIXED_SYSTEMS = [
  labPhysicsSystem,
  skillLabSystem,
  creatureAttackSystem,
  creatureHitStunSystem,
  conditionSystem,
  combatModeSystem,
  attackEffectSystem,
  statStageSystem,
  attackLungeSystem,
  characterPhysicsSystem,
  physicsStepSystem,
  syncPhysicsSystem,
  animationStateSystem,
]

/** Um passo fixo do laboratório. */
export function runLabFixedStep(context) {
  for (const system of LAB_FIXED_SYSTEMS) system(context)
}
