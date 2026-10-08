import { getSpecies } from '@/core/data/species'
import { createLevelState } from '@/core/data/species/experience'
import { createMovesState } from '@/core/data/species/moves'
import {
  ActionState,
  AiMovement,
  AttackAim,
  CharacterController,
  CreatureLevel,
  CreatureMoves,
  IndividualValues,
  Mood,
  MovementStats,
  PathState,
  PhysicsBody,
  Position,
  Rotation,
  Velocity,
  WanderState,
  WildBehavior,
  WildCreature,
  vitalsFromSpecies,
} from '@/core/traits'

/**
 * Um selvagem de teste com a composição do `wildCreatureSpawnSystem` (sem
 * física de verdade: `PhysicsBody` sem handles). `individualValues` fixos
 * pra comparar com o registro depois da captura
 * (docs/features/043-captura.md).
 */
export function spawnWild(
  world,
  {
    speciesId = 'charmander',
    at = { x: 0, y: 1, z: 5 },
    level,
    temperament = 'peaceful',
    individualValues = {
      hp: 7,
      attack: 3,
      defense: 11,
      sp_atk: 5,
      sp_def: 9,
      speed: 1,
    },
  } = {},
) {
  const species = getSpecies(speciesId)
  const levelState = createLevelState(species, level ?? species.level ?? 1)
  return world.spawn(
    WildCreature({ speciesId }),
    WildBehavior({ temperament }),
    AiMovement,
    Position(at),
    Rotation,
    Velocity,
    MovementStats(species.movement),
    CharacterController(species.body),
    PhysicsBody({ bodyHandle: -1, colliderHandle: -1 }),
    PathState,
    WanderState({ homeX: at.x, homeZ: at.z }),
    Mood,
    ActionState,
    AttackAim,
    IndividualValues(individualValues),
    CreatureLevel(levelState),
    CreatureMoves(createMovesState(species)),
    vitalsFromSpecies(species, individualValues, levelState.level),
  )
}
