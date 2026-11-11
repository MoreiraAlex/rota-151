import { describe, expect, it } from 'vitest'
import { GAME_CONFIG } from '@/core/gameConfig'
import { NEUTRAL_GRADE, gradeColor, isNeutralGrade } from './colorGrade'

const SAMPLES = [
  [0, 0, 0],
  [1, 1, 1],
  [0.2, 0.6, 0.3],
  [0.9, 0.4, 0.1],
]
const luma = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b
const spread = (rgb) => Math.max(...rgb) - Math.min(...rgb)

describe('correção de cor (066)', () => {
  it('a do config começa neutra (o jogo não muda de cor sozinho)', () => {
    expect(isNeutralGrade(GAME_CONFIG.RENDER.GRADE)).toBe(true)
  })

  it('neutra, não muda nenhuma cor', () => {
    for (const rgb of SAMPLES) {
      gradeColor(rgb, NEUTRAL_GRADE).forEach((value, i) =>
        expect(value).toBeCloseTo(rgb[i], 6),
      )
    }
  })

  it('qualquer campo fora do neutro conta como correção', () => {
    for (const key of Object.keys(NEUTRAL_GRADE)) {
      expect(
        isNeutralGrade({ ...NEUTRAL_GRADE, [key]: NEUTRAL_GRADE[key] + 0.1 }),
      ).toBe(false)
    }
  })

  it('saturação zero deixa a cor cinza; mais saturação afasta os canais', () => {
    const color = SAMPLES[2]
    expect(
      spread(gradeColor(color, { ...NEUTRAL_GRADE, SATURATION: 0 })),
    ).toBeCloseTo(0, 6)
    expect(
      spread(gradeColor(color, { ...NEUTRAL_GRADE, SATURATION: 1.5 })),
    ).toBeGreaterThan(spread(color))
  })

  it('exposição para cima clareia; temperatura para cima puxa o vermelho sobre o azul', () => {
    const color = SAMPLES[2]
    expect(
      luma(gradeColor(color, { ...NEUTRAL_GRADE, EXPOSURE: 0.5 })),
    ).toBeGreaterThan(luma(color))
    const [r, , b] = gradeColor(color, { ...NEUTRAL_GRADE, TEMPERATURE: 1 })
    expect(r / b).toBeGreaterThan(color[0] / color[2])
  })

  it('o resultado fica sempre entre 0 e 1', () => {
    const strong = {
      SATURATION: 2,
      CONTRAST: 1.5,
      EXPOSURE: 2,
      GAMMA: 0.5,
      TEMPERATURE: 1,
    }
    for (const rgb of SAMPLES) {
      for (const value of gradeColor(rgb, strong)) {
        expect(value).toBeGreaterThanOrEqual(0)
        expect(value).toBeLessThanOrEqual(1)
      }
    }
  })
})
