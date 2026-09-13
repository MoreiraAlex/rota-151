import { describe, it, expect } from 'vitest'
import { evaluateCurve } from './curves'

const TWO_PI = Math.PI * 2

describe('evaluateCurve — constant', () => {
  it('devolve sempre o mesmo valor, independente de t', () => {
    const curve = { type: 'constant', value: 0.42 }
    expect(evaluateCurve(curve, 0, TWO_PI)).toBe(0.42)
    expect(evaluateCurve(curve, 5, TWO_PI)).toBe(0.42)
  })

  it('sem value definido, é zero', () => {
    expect(evaluateCurve({ type: 'constant' }, 1, TWO_PI)).toBe(0)
  })
})

describe('evaluateCurve — sine', () => {
  it('em t=0 e phaseTurns=0, começa em zero', () => {
    const curve = { type: 'sine', amplitude: 0.5 }
    expect(evaluateCurve(curve, 0, TWO_PI)).toBeCloseTo(0)
  })

  it('respeita a amplitude como valor máximo', () => {
    const curve = { type: 'sine', amplitude: 0.5 }
    // um quarto de ciclo (freq=2π, t=0.25 → ângulo = π/2 → sin = 1)
    expect(evaluateCurve(curve, 0.25, TWO_PI)).toBeCloseTo(0.5)
  })

  it('phaseTurns desloca em fração de ciclo (0.5 = meio ciclo = inverte o sinal)', () => {
    const withPhase = { type: 'sine', amplitude: 0.5, phaseTurns: 0.5 }
    const withoutPhase = { type: 'sine', amplitude: 0.5 }
    for (let t = 0; t < 1; t += 0.1) {
      expect(evaluateCurve(withPhase, t, TWO_PI)).toBeCloseTo(
        -evaluateCurve(withoutPhase, t, TWO_PI),
      )
    }
  })

  it('timeOffset atrasa a curva em segundos, fixo (não escala com freq)', () => {
    const curve = { type: 'sine', amplitude: 0.5, timeOffset: 0.2 }
    const base = { type: 'sine', amplitude: 0.5 }
    expect(evaluateCurve(curve, 0.2, TWO_PI)).toBeCloseTo(
      evaluateCurve(base, 0, TWO_PI),
    )
  })

  it('frequencyScale multiplica o ritmo do ciclo', () => {
    const doubled = { type: 'sine', amplitude: 0.5, frequencyScale: 2 }
    const base = { type: 'sine', amplitude: 0.5 }
    expect(evaluateCurve(doubled, 0.1, TWO_PI)).toBeCloseTo(
      evaluateCurve(base, 0.2, TWO_PI),
    )
  })
})

describe('evaluateCurve — clampedSine', () => {
  it('nunca passa dos limites configurados', () => {
    const curve = { type: 'clampedSine', amplitude: 1, min: 0, max: 0.6 }
    for (let t = 0; t < 2; t += 0.05) {
      const value = evaluateCurve(curve, t, TWO_PI)
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThanOrEqual(0.6)
    }
  })
})

describe('evaluateCurve — absSine', () => {
  it('nunca é negativo', () => {
    const curve = { type: 'absSine', amplitude: 0.5 }
    for (let t = 0; t < 2; t += 0.05) {
      expect(evaluateCurve(curve, t, TWO_PI)).toBeGreaterThanOrEqual(0)
    }
  })
})

describe('evaluateCurve — sum', () => {
  it('soma o resultado de todas as curvas internas', () => {
    const curve = {
      type: 'sum',
      curves: [
        { type: 'constant', value: 0.1 },
        { type: 'constant', value: 0.2 },
      ],
    }
    expect(evaluateCurve(curve, 0, TWO_PI)).toBeCloseTo(0.3)
  })
})

describe('evaluateCurve — tipo desconhecido', () => {
  it('devolve zero em vez de lançar erro', () => {
    expect(evaluateCurve({ type: 'nao-existe' }, 0, TWO_PI)).toBe(0)
  })
})
