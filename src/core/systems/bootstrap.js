import { registerSystem, GAME_PHASES } from './index'
import { testSystem } from './debug/test-system'
import { SyncTransformSystem } from './presentation/SyncTransformSystem'

let initialized = false

export function registerGameSystems() {
  if (initialized) {
    return
  }

  initialized = true
  registerSystem(GAME_PHASES.SIMULATION, testSystem)
  registerSystem(GAME_PHASES.PRESENTATION, SyncTransformSystem)
}
