import { getSystems } from './registry'

function runPhase(phase, context) {
  const phaseSystems = getSystems(phase)

  if (!phaseSystems) {
    return
  }

  for (const system of phaseSystems) {
    system(context)
  }
}

export function runFixedPipeline(context) {
  runPhase('input', context)
  runPhase('simulation', context)
  runPhase('events', context)
}

export function runRenderPipeline(context) {
  runPhase('presentation', context)
}
