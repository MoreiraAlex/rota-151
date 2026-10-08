import { describe, it, expect } from 'vitest'
import {
  findDeadTailStart,
  stripRootMotion,
  trimDeadTail,
} from './itemClipCleanup'

function track(name, times, values) {
  return { name, times: [...times], values: [...values] }
}

describe('itemClipCleanup', () => {
  it('corta o clipe onde a escala zera até o fim', () => {
    const clip = {
      duration: 1,
      tracks: [
        track(
          'rock.scale',
          [0, 0.5, 0.8, 1],
          [1, 1, 1, 1.1, 1, 1, 0, 0, 0, 0, 0, 0],
        ),
        track(
          'rock.quaternion',
          [0, 0.5, 0.8, 1],
          [0, 0, 0, 1, 0, 0, 0.1, 1, 0, 0, 0, 0, 0, 0, 0, 0],
        ),
      ],
    }
    expect(findDeadTailStart(clip.tracks)).toBe(0.8)

    trimDeadTail(clip)

    expect(clip.duration).toBe(0.5)
    expect(clip.tracks[0].times).toEqual([0, 0.5])
    expect(clip.tracks[0].values).toEqual([1, 1, 1, 1.1, 1, 1])
    expect(clip.tracks[1].values).toHaveLength(8)
  })

  it('escala zero que não vai até o fim (nascer do nada) não corta', () => {
    const clip = {
      duration: 1,
      tracks: [track('ball.scale', [0, 0.5, 1], [0, 0, 0, 1, 1, 1, 1, 1, 1])],
    }
    expect(findDeadTailStart(clip.tracks)).toBe(null)
    trimDeadTail(clip)
    expect(clip.duration).toBe(1)
  })

  it('clipe sem escala ou íntegro fica como está', () => {
    const clip = {
      duration: 0.4,
      tracks: [track('body.quaternion', [0, 0.4], [0, 0, 0, 1, 0, 1, 0, 0])],
    }
    trimDeadTail(clip)
    expect(clip.duration).toBe(0.4)
  })
})

describe('stripRootMotion', () => {
  it('tira só a posição dos nós da raiz; peças e giro da raiz ficam', () => {
    const clip = {
      tracks: [
        track('poke-ball.position', [0], [0, 1, 0]),
        track('poke-ball.quaternion', [0], [0, 0, 0, 1]),
        track('hinge.position', [0], [0, 0, 1]),
        track('hinge.quaternion', [0], [0, 0, 0, 1]),
      ],
    }
    stripRootMotion(clip, ['poke-ball'])
    expect(clip.tracks.map((t) => t.name)).toEqual([
      'poke-ball.quaternion',
      'hinge.position',
      'hinge.quaternion',
    ])
  })
})
