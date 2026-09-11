import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  registerSystem,
  clearSystems,
  GAME_PHASES,
  runFixedPipeline,
  runRenderPipeline,
} from './index'

describe('pipeline + registry', () => {
  beforeEach(() => {
    clearSystems()
  })

  it('executa os systems de uma fase na ordem de registro', () => {
    const calls = []
    registerSystem(GAME_PHASES.SIMULATION, () => calls.push('a'))
    registerSystem(GAME_PHASES.SIMULATION, () => calls.push('b'))

    runFixedPipeline({ world: null, delta: 0 })

    expect(calls).toEqual(['a', 'b'])
  })

  it('runFixedPipeline roda input → simulation → events; render roda presentation', () => {
    const calls = []
    registerSystem(GAME_PHASES.INPUT, () => calls.push('input'))
    registerSystem(GAME_PHASES.SIMULATION, () => calls.push('sim'))
    registerSystem(GAME_PHASES.EVENTS, () => calls.push('events'))
    registerSystem(GAME_PHASES.PRESENTATION, () => calls.push('present'))

    runFixedPipeline({ world: null, delta: 0 })
    expect(calls).toEqual(['input', 'sim', 'events'])

    runRenderPipeline({ world: null, delta: 0 })
    expect(calls).toEqual(['input', 'sim', 'events', 'present'])
  })

  it('repassa o mesmo context para cada system', () => {
    const spy = vi.fn()
    registerSystem(GAME_PHASES.SIMULATION, spy)
    const context = { world: {}, delta: 1 / 60, input: { forward: true } }

    runFixedPipeline(context)

    expect(spy).toHaveBeenCalledWith(context)
  })

  it('fase sem systems é no-op', () => {
    expect(() => runFixedPipeline({ world: null, delta: 0 })).not.toThrow()
  })
})
