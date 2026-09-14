import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { actionSlotsDebugSystem } from './actionSlotsDebugSystem'

describe('actionSlotsDebugSystem', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('sem nenhum botão apertado, não loga nada', () => {
    actionSlotsDebugSystem({ input: {} })
    expect(console.warn).not.toHaveBeenCalled()
  })

  it('loga um aviso por botão apertado', () => {
    actionSlotsDebugSystem({
      input: { primary: true, secondary1: true, secondary2: false },
    })

    expect(console.warn).toHaveBeenCalledTimes(2)
    expect(console.warn).toHaveBeenCalledWith('[slots de ação] primary')
    expect(console.warn).toHaveBeenCalledWith('[slots de ação] secondary1')
  })

  it('sem context.input, não quebra', () => {
    expect(() => actionSlotsDebugSystem({})).not.toThrow()
  })
})
