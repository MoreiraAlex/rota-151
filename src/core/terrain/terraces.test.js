import { describe, expect, it } from 'vitest'
import { rampShareAt, terraceHeight, terracedHeight } from './terraces'

const TERRACES = { step: 4, cliff: 0.9, tilt: 0.15, ramps: 0.3, rampSize: 40 }
const heights = Array.from({ length: 400 }, (_, i) => i * 0.05 - 2)

describe('platôs com barranco e rampa (066)', () => {
  it('sem degrau (cliff 0 ou step 0), o relevo fica como está', () => {
    for (const h of heights) {
      expect(terraceHeight(h, { ...TERRACES, cliff: 0 })).toBe(h)
      expect(terraceHeight(h, { ...TERRACES, step: 0 })).toBe(h)
    }
  })

  it('nunca desce quando o relevo sobe (o degrau não vira buraco)', () => {
    let previous = -Infinity
    for (const h of heights) {
      const stepped = terraceHeight(h, TERRACES)
      expect(stepped).toBeGreaterThanOrEqual(previous - 1e-9)
      previous = stepped
    }
  })

  it('cada patamar fica no nível dele (a altura de cada nível bate)', () => {
    for (let level = 0; level < 4; level++) {
      const h = level * TERRACES.step
      expect(terraceHeight(h, TERRACES)).toBeCloseTo(h, 6)
    }
  })

  it('o topo sobe bem menos que o relevo e o barranco, bem mais', () => {
    const { step } = TERRACES
    const rise = (a, b) =>
      terraceHeight(b, TERRACES) - terraceHeight(a, TERRACES)
    // No começo do patamar (topo): sobe só o `tilt` do relevo.
    const top = rise(step * 1.1, step * 1.3) / (step * 0.2)
    // No fim (barranco): sobe mais que o relevo.
    const cliff = rise(step * 1.96, step * 1.99) / (step * 0.03)
    expect(top).toBeLessThan(0.5)
    expect(cliff).toBeGreaterThan(1.5)
  })

  it('o topo nunca é plano de todo (o Rapier erra raio em chão plano)', () => {
    const { step } = TERRACES
    const a = terraceHeight(step * 1.2, TERRACES)
    const b = terraceHeight(step * 1.25, TERRACES)
    expect(b).toBeGreaterThan(a)
  })

  it('na rampa, volta o relevo natural; fora dela, o degrau', () => {
    for (const h of heights) {
      expect(terracedHeight(h, TERRACES, 1)).toBeCloseTo(h, 9)
      expect(terracedHeight(h, TERRACES, 0)).toBe(terraceHeight(h, TERRACES))
    }
  })

  it('a rampa ocupa a parte de maior ruído, do tamanho pedido', () => {
    expect(rampShareAt(0.99, TERRACES.ramps)).toBe(1)
    expect(rampShareAt(0.01, TERRACES.ramps)).toBe(0)
    expect(rampShareAt(0.99, 0)).toBe(0)
    // Ruído uniforme: a parte com rampa fica perto de `ramps`.
    const samples = Array.from({ length: 1000 }, (_, i) => (i + 0.5) / 1000)
    const share =
      samples.reduce((sum, n) => sum + rampShareAt(n, TERRACES.ramps), 0) /
      samples.length
    expect(share).toBeCloseTo(TERRACES.ramps, 1)
  })
})
