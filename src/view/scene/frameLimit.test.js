import { describe, expect, it } from 'vitest'
import { nextDrawnFrame } from './frameLimit'

// Conta quantos quadros são desenhados em `seconds` numa tela de
// `screenHz`, com o limite `maxFps`.
function drawnFrames(screenHz, maxFps, seconds = 10) {
  let last = null
  let drawn = 0
  const frames = Math.round(screenHz * seconds)
  for (let frame = 0; frame < frames; frame++) {
    const next = nextDrawnFrame((frame * 1000) / screenHz, last, maxFps)
    if (next === null) continue
    last = next
    drawn += 1
  }
  return drawn / seconds
}

describe('nextDrawnFrame', () => {
  it('sem limite, desenha todo quadro da tela', () => {
    expect(drawnFrames(60, 0)).toBe(60)
    expect(drawnFrames(144, 0)).toBe(144)
  })

  it('o primeiro quadro sempre desenha', () => {
    expect(nextDrawnFrame(1234, null, 30)).toBe(1234)
  })

  it.each([
    [60, 30],
    [60, 40],
    [60, 45],
    [144, 30],
    [144, 60],
    [120, 50],
  ])('tela de %i Hz com limite %i: a média fica no limite', (hz, maxFps) => {
    expect(Math.abs(drawnFrames(hz, maxFps) - maxFps)).toBeLessThanOrEqual(1)
  })

  it('limite acima da tela: desenha todo quadro da tela', () => {
    expect(drawnFrames(60, 120)).toBe(60)
  })

  it('depois de uma parada longa, não desenha uma rajada para compensar', () => {
    const interval = 1000 / 30
    const afterPause = nextDrawnFrame(10000, 0, 30)
    expect(afterPause).toBe(10000)
    expect(nextDrawnFrame(afterPause + interval / 2, afterPause, 30)).toBeNull()
  })
})
