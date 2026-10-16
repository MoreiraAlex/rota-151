import { describe, expect, it } from 'vitest'
import { LGPE_EYE_ATLAS } from './lgpeEyeAtlas'

// Mesma conta do `eyeBlinkSystem`/`useAnimatedModel`: offset = (1 - repeat)/2 + célula.
const offsetOf = (cell) => ({
  x: (1 - LGPE_EYE_ATLAS.repeat.x) / 2 + cell.x,
  y: (1 - LGPE_EYE_ATLAS.repeat.y) / 2 + cell.y,
})

const cells = Object.values(LGPE_EYE_ATLAS.eyeStates).flatMap((state) => [
  state.open,
  state.closed,
])

describe('atlas do olho do LGPE', () => {
  it('toda célula usada cai inteira dentro da textura, alinhada à grade', () => {
    for (const cell of cells) {
      const { x, y } = offsetOf(cell)
      for (const [start, size] of [
        [x, LGPE_EYE_ATLAS.repeat.x],
        [y, LGPE_EYE_ATLAS.repeat.y],
      ]) {
        expect(start).toBeGreaterThanOrEqual(0)
        expect(start + size).toBeLessThanOrEqual(1 + 1e-9)
        expect((start / size) % 1).toBeCloseTo(0)
      }
    }
  })

  it('acordado e bravo piscam (aberto e fechado são células diferentes)', () => {
    for (const mood of ['awake', 'angry']) {
      const { open, closed } = LGPE_EYE_ATLAS.eyeStates[mood]
      expect(closed).not.toEqual(open)
    }
  })

  it('dormindo fica de olho fechado, o mesmo fechado do acordado', () => {
    const { sleeping, awake } = LGPE_EYE_ATLAS.eyeStates
    expect(sleeping.open).toEqual(awake.closed)
    expect(sleeping.closed).toEqual(awake.closed)
  })
})
