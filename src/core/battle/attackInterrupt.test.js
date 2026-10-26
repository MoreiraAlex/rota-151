import { describe, it, expect } from 'vitest'
import { isInterruptible } from './attackInterrupt'

const GROWL = {
  duration: 1.2,
  effectAt: 0.5,
  execution: 'instant',
  damage: null,
  effects: [{ type: 'statStage', stat: 'attack', stages: -1, duration: 60 }],
}
const GROWTH = { ...GROWL, area: 'self', execution: 'charge', duration: 1 }
const TACKLE = { duration: 0.8, effectAt: 0.3, damage: { power: 40 } }

function attacking(elapsed, duration = 1) {
  return { current: 'attack', elapsed, animationSpeed: 1 / duration }
}

describe('isInterruptible — só o golpe de carga, na carga', () => {
  it('de carga, antes do effectAt, pode ser interrompido — com dano ou sem', () => {
    expect(isInterruptible(attacking(0.49), GROWTH)).toBe(true)
    const charged = { ...TACKLE, execution: 'charge' }
    expect(isInterruptible(attacking(0.1, 0.8), charged)).toBe(true)
  })

  it('depois do effectAt não: o efeito já foi aplicado', () => {
    expect(isInterruptible(attacking(0.8), GROWTH)).toBe(false)
  })

  it('golpe que não é de carga nunca é interrompido, nem de status', () => {
    expect(isInterruptible(attacking(0.2, 1.2), GROWL)).toBe(false)
    expect(isInterruptible(attacking(0.1, 0.8), TACKLE)).toBe(false)
  })

  it('fora de ataque não', () => {
    expect(isInterruptible({ current: 'dash', elapsed: 0 }, GROWTH)).toBe(false)
  })
})
