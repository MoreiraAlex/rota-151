import { getSpecies } from '../data/species'
import { rollIndividualValues } from '../data/species/stats'
import { createLevelState } from '../data/species/experience'
import { rollTemperament } from '../battle/wildBehavior'
import { wildDespawned, wildSpawned } from '../events'
import { GAME_CONFIG } from '../gameConfig'
import { gameplayRng } from '../rng'
import { isPhysicsReady } from '../physics/physicsWorld'
import { createCharacterBody, destroyCharacterBody } from '../physics/colliders'
import {
  ActionState,
  AttackCooldowns,
  AnimationState,
  CharacterController,
  CreatureLevel,
  IndividualValues,
  Mood,
  MovementStats,
  PathState,
  PhysicsBody,
  Position,
  Rotation,
  Velocity,
  vitalsFromSpecies,
  WanderState,
  AiMovement,
  WildAwareness,
  WildBehavior,
  WildCreature,
  WildSpawnInfo,
  WildSpawnState,
} from '../traits'

/**
 * Nascer e sumir das selvagens (docs/features/062-spawn-estilo-
 * cobblemon.md). Quem decide quando é o `wildSpawnSystem`/
 * `wildDespawnSystem`; o save usa as mesmas (`wildCreaturesSave.js`).
 */

/**
 * Uma selvagem da espécie `speciesId` nasce em `position` (o centro do
 * corpo), no nível `level` (o do lugar, `core/wildSpawn/wildLevel.js`; sem
 * ele, o da primeira cidade). Sem `individual`, sorteia o indivíduo (IV,
 * temperamento);
 * com ele (o restore do save), usa o salvo: `{ individualValues,
 * levelState, temperament, age, rotationY }`. Com `events`, avisa que
 * nasceu. Devolve a entidade, ou `null` se a espécie não existe.
 *
 * Corpo físico: com a física pronta, o de verdade; senão um placeholder
 * (`bodyHandle: -1`) que o `physicsBootstrapSystem` troca pelo de verdade
 * quando ela fica pronta.
 */
export function nascerSelvagem(
  world,
  events,
  { speciesId, position, level = null, individual = null, rng = gameplayRng },
) {
  const species = getSpecies(speciesId)
  if (!species) return null

  const { x, y, z } = position
  const physicsBody = isPhysicsReady()
    ? createCharacterBody(
        { x, y, z },
        {
          radius: species.body.capsuleRadius,
          halfHeight: species.body.capsuleHalfHeight,
          axis: species.body.capsuleAxis,
        },
      )
    : { bodyHandle: -1, colliderHandle: -1 }

  // IV e nível por indivíduo, sorteados uma vez e nunca mais
  // (docs/features/037-experiencia-e-nivel.md).
  const individualValues =
    individual?.individualValues ??
    rollIndividualValues(rng, {
      min: GAME_CONFIG.BATTLE.IV_MIN,
      max: GAME_CONFIG.BATTLE.IV_MAX,
    })
  const levelState =
    individual?.levelState ??
    createLevelState(species, level ?? GAME_CONFIG.WILD_SPAWN.LEVEL.FIRST_CITY)
  const temperament = individual?.temperament ?? rollTemperament(rng, species)

  const { MIN_PAUSE, MAX_PAUSE } = GAME_CONFIG.WILD_WANDER
  const entity = world.spawn(
    Position({ x, y, z }),
    Rotation({ x: 0, y: individual?.rotationY ?? 0, z: 0 }),
    WildCreature({ speciesId }),
    WildSpawnInfo({ age: individual?.age ?? 0 }),
    WildBehavior({ temperament }),
    // Percepção (cone de visão + raio, emotes — 063).
    WildAwareness,
    // Movimento na luta (desvio, recuo, rodear, dash — `aiMovement.js`).
    AiMovement,
    IndividualValues(individualValues),
    CreatureLevel(levelState),
    AnimationState,
    ActionState,
    // Ataque da selvagem (cooldown por slot, o mesmo do time).
    AttackCooldowns,
    Velocity,
    CharacterController(species.body),
    MovementStats(species.movement),
    // Exigido mesmo fora de combate: a física integra a velocidade de quem
    // tem `Vitals`.
    vitalsFromSpecies(species, individualValues, levelState.level),
    PhysicsBody(physicsBody),
    PathState,
    WanderState({
      homeX: x,
      homeZ: z,
      targetX: x,
      targetZ: z,
      // Atraso inicial sorteado: as selvagens não começam a andar juntas.
      pauseTimer: MIN_PAUSE + rng() * (MAX_PAUSE - MIN_PAUSE),
      chaseTimer: 0,
    }),
    Mood,
  )

  if (events) {
    events.emit(wildSpawned({ entity, speciesId, position: { x, y, z } }))
    registrarSpawnNoLog(world, { kind: 'spawn', speciesId, reason: null, x, z })
  }
  return entity
}

/**
 * A selvagem `entity` sai do mundo pelo despawn (`reason`: `'far'`,
 * `'aged'` ou `'fled'` — fugiu, a fuga clássica da 063), com o corpo
 * físico. Com `events`, avisa.
 */
export function despawnarSelvagem(world, events, entity, reason) {
  if (!entity?.isAlive?.()) return
  const speciesId = entity.get(WildCreature)?.speciesId ?? null
  const { x, y, z } = entity.get(Position) ?? { x: 0, y: 0, z: 0 }
  removerSelvagem(entity)
  if (events) {
    events.emit(wildDespawned({ speciesId, reason, position: { x, y, z } }))
  }
  registrarSpawnNoLog(world, { kind: 'despawn', speciesId, reason, x, z })
}

/** Tira a selvagem do mundo sem aviso (o restore do save troca todas). */
export function removerSelvagem(entity) {
  if (!entity?.isAlive?.()) return
  if (entity.has(PhysicsBody)) {
    destroyCharacterBody(entity.get(PhysicsBody).bodyHandle)
  }
  entity.destroy()
}

/** Guarda um spawn ou despawn no registro do debug (os últimos, só). */
export function registrarSpawnNoLog(world, entry) {
  if (!world.has(WildSpawnState)) return
  const state = world.get(WildSpawnState)
  state.log.push(entry)
  const extra = state.log.length - GAME_CONFIG.WILD_SPAWN.DEBUG_LOG_SIZE
  if (extra > 0) state.log.splice(0, extra)
}
