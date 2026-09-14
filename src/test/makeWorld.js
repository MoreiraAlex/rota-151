import { createWorld } from 'koota'
import { GAME_CONFIG } from '@/core/gameConfig'
import { getSpecies } from '@/core/data/species'
import {
  Position,
  Rotation,
  Velocity,
  InputState,
  InputControlled,
  MovementStats,
  OrbitCamera,
  CameraTarget,
  PhysicsBody,
  CharacterController,
  AnimationState,
  ActionState,
} from '@/core/traits'

// Fixado em 'fox' de propósito, não em PLAYER_SPECIES_ID — os testes usam
// uma espécie estável que eu mantenho, independente de qual espécie está
// configurada como jogador na build real (isso é o que quem estiver
// testando um modelo novo vai estar mexendo o tempo todo).
const PLAYER_SPECIES = getSpecies('fox')

/**
 * Cria um world koota isolado para testes, com um player e uma câmera compostos
 * como em `core/world/world.js` — mas sem o singleton, para os testes não
 * vazarem estado entre si.
 *
 * Retorna `{ world, player, camera }`.
 */
export function makeWorld({ playerPosition = { x: 0, y: 2, z: 0 } } = {}) {
  const world = createWorld()

  const player = world.spawn(
    Position(playerPosition),
    Rotation,
    Velocity,
    InputState,
    InputControlled,
    MovementStats(PLAYER_SPECIES.movement),
    CameraTarget,
    PhysicsBody,
    CharacterController(PLAYER_SPECIES.body),
    AnimationState,
    ActionState,
  )

  const camera = world.spawn(
    OrbitCamera({
      yaw: GAME_CONFIG.CAMERA.INITIAL_YAW,
      pitch: GAME_CONFIG.CAMERA.INITIAL_PITCH,
      distance: GAME_CONFIG.CAMERA.INITIAL_DISTANCE,
    }),
  )

  return { world, player, camera }
}
