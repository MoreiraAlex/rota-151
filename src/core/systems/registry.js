import { GAME_PHASES } from './phases'

const systems = {
  [GAME_PHASES.INPUT]: [],
  [GAME_PHASES.SIMULATION]: [],
  [GAME_PHASES.EVENTS]: [],
  [GAME_PHASES.PRESENTATION]: [],
}

export function registerSystem(phase, system) {
  systems[phase].push(system)
}

export function getSystems(phase) {
  return systems[phase] ?? []
}
