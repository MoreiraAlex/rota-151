import { createWorld } from 'koota'
import { GAME_CONFIG } from '../gameConfig'
import { getSpecies, PLAYER_SPECIES_ID } from '../data/species'
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
} from '../traits'

export const world = createWorld()

// Jogador é só mais uma entrada do registro de espécies — corpo (cápsula) e
// movimento (velocidades) vêm de lá, não são constante global. PLAYER_SPECIES_ID
// mora em core/data/species/index.js — único lugar que define isso, também
// usado por view/scene/PlayerView.jsx, pra nunca ficarem apontando pra
// espécies diferentes um do outro.
const PLAYER_SPECIES = getSpecies(PLAYER_SPECIES_ID)

export const playerEntity = world.spawn(
  Position({ x: 0, y: 2, z: 0 }),
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

export const cameraEntity = world.spawn(
  OrbitCamera({
    yaw: GAME_CONFIG.CAMERA.INITIAL_YAW,
    pitch: GAME_CONFIG.CAMERA.INITIAL_PITCH,
    distance: GAME_CONFIG.CAMERA.INITIAL_DISTANCE,
  }),
)
