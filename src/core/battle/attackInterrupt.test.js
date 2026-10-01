import { describe, it, expect } from 'vitest'
import { isInterruptible, isStatusAttack } from './attackInterrupt'

const GROWL = {
  duration: 1.2,
  effectAt: 0.5,
  damage: null,
  effects: [{ type: 'statStage', stat: 'attack', stages: -1, duration: 60 }],
}
const GROWTH = { ...GROWL, area: 'self', duration: 1 }
const TACKLE = { duration: 0.8, effectAt: 0.3, damage: { power: 40 } }

function attacking(elapsed, duration = 1) {
  return { current: 'attack', elapsed, animationSpeed: 1 / duration }
}

describe('isStatusAttack', () => {
  it('sem dano e com efeitos = status', () => {
    expect(isStatusAttack(GROWL)).toBe(true)
    expect(isStatusAttack(GROWTH)).toBe(true)
  })

  it('golpe de dano (mesmo com efeito junto) ou sem efeito nenhum não é', () => {
    expect(isStatusAttack(TACKLE)).toBe(false)
    expect(isStatusAttack({ ...TACKLE, effects: GROWL.effects })).toBe(false)
    expect(isStatusAttack({ damage: null })).toBe(false)
    expect(isStatusAttack(null)).toBe(false)
  })
})

describe('isInterruptible', () => {
  it('status na CARGA (antes do effectAt) pode ser interrompido — negativo ou em si mesmo', () => {
    expect(isInterruptible(attacking(0.2, 1.2), GROWL)).toBe(true)
    expect(isInterruptible(attacking(0.49), GROWTH)).toBe(true)
  })

  it('depois do effectAt não: o efeito já foi aplicado', () => {
    expect(isInterruptible(attacking(0.5, 1.2), GROWL)).toBe(false)
    expect(isInterruptible(attacking(0.8), GROWTH)).toBe(false)
  })

  it('golpe de dano nunca é interrompido', () => {
    expect(isInterruptible(attacking(0.1, 0.8), TACKLE)).toBe(false)
  })

  it('fora de ataque não', () => {
    expect(isInterruptible({ current: 'dash', elapsed: 0 }, GROWL)).toBe(false)
  })
})
