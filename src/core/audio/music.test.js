import { describe, expect, it } from 'vitest'
import {
  DEFAULT_MUSIC_FREQUENCY,
  MUSIC_FALLBACK_BIOME,
} from '../data/audio/musicTracks'
import { musicPool, pickTrack, randomBetween, silenceDuration } from './music'

// Regras da música de fundo (docs/features/065-sons-do-mundo.md, Parte 2).
// Faixas, biomas e tempos só como dado de teste.
const TABLE = {
  plains: { day: ['p1', 'p2'], night: ['n1'] },
  forest: { day: ['f1'], night: ['n1'] },
}
const FREQUENCIES = { fast: { min: 1, max: 2 }, slow: { min: 10, max: 20 } }
const fixed = (value) => () => value

describe('musicPool', () => {
  it('escolhe a lista do bioma e da hora', () => {
    expect(musicPool('plains', true, TABLE)).toEqual(['p1', 'p2'])
    expect(musicPool('plains', false, TABLE)).toEqual(['n1'])
  })

  it('bioma sem lista usa a do bioma de reserva', () => {
    expect(musicPool('vulcao', true)).toEqual(
      musicPool(MUSIC_FALLBACK_BIOME, true),
    )
  })
})

describe('pickTrack', () => {
  it('não repete a última se há outra', () => {
    for (const value of [0, 0.5, 0.99]) {
      expect(pickTrack(['a', 'b', 'c'], 'b', fixed(value))).not.toBe('b')
    }
  })

  it('com uma só, repete', () => {
    expect(pickTrack(['a'], 'a', fixed(0.5))).toBe('a')
  })

  it('lista vazia não sorteia nada', () => {
    expect(pickTrack([], null, fixed(0.5))).toBeNull()
  })

  it('o aleatório no máximo não sai da lista', () => {
    expect(['a', 'b']).toContain(pickTrack(['a', 'b'], null, fixed(1)))
  })
})

describe('silenceDuration', () => {
  it('fica entre o mínimo e o máximo da frequência', () => {
    for (const value of [0, 0.5, 0.999]) {
      const silence = silenceDuration('slow', fixed(value), FREQUENCIES)
      expect(silence).toBeGreaterThanOrEqual(FREQUENCIES.slow.min)
      expect(silence).toBeLessThanOrEqual(FREQUENCIES.slow.max)
    }
  })

  it('frequência desconhecida usa a padrão', () => {
    expect(silenceDuration('nunca-mais', fixed(0.5))).toBe(
      silenceDuration(DEFAULT_MUSIC_FREQUENCY, fixed(0.5)),
    )
  })

  it('randomBetween vai do mínimo ao máximo', () => {
    expect(randomBetween({ min: 2, max: 4 }, fixed(0))).toBe(2)
    expect(randomBetween({ min: 2, max: 4 }, fixed(1))).toBe(4)
  })
})
