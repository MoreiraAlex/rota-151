import { describe, expect, it } from 'vitest'
import {
  bite,
  createFoodMotion,
  shouldBite,
  squashScale,
  stepSquash,
} from './foodMotion'

const DELTA = 1 / 60

describe('foodMotion', () => {
  it('a mordida achata, a mola estica um pouco e assenta', () => {
    const motion = createFoodMotion(1, () => 0)
    bite(motion, 0.2)
    let stretched = false

    for (let i = 0; i < 120; i++) {
      stepSquash(motion, DELTA, 300)
      if (motion.squash < 0) stretched = true
    }

    expect(stretched).toBe(true)
    expect(Math.abs(motion.squash)).toBeLessThan(0.01)
  })

  it('morde quando o relógio zera, e recomeça', () => {
    const motion = createFoodMotion(0.5, () => 0)

    expect(shouldBite(motion, 0.3, 0.5, -1)).toBe(false)
    expect(shouldBite(motion, 0.3, 0.5, -1)).toBe(true)
    expect(shouldBite(motion, 0.3, 0.5, -1)).toBe(false)
  })

  it('morde quando o pedaço do modelo troca (mas não no primeiro)', () => {
    const motion = createFoodMotion(10, () => 0)

    expect(shouldBite(motion, DELTA, 10, 0)).toBe(false)
    expect(shouldBite(motion, DELTA, 10, 0)).toBe(false)
    expect(shouldBite(motion, DELTA, 10, 1)).toBe(true)
  })

  it('achatada é mais baixa e mais larga; esticada, o contrário', () => {
    const [wx, wy] = squashScale(0.2)
    expect(wy).toBeLessThan(1)
    expect(wx).toBeGreaterThan(1)

    const [sx, sy] = squashScale(-0.2)
    expect(sy).toBeGreaterThan(1)
    expect(sx).toBeLessThan(1)
  })

  it('um frame longo não faz a mola explodir', () => {
    const motion = createFoodMotion(1, () => 0)
    bite(motion, 0.2)

    stepSquash(motion, 1, 300)

    expect(Math.abs(motion.squash)).toBeLessThan(0.2)
  })
})
