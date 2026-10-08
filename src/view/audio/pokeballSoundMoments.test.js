import { describe, it, expect } from 'vitest'
import { POKEBALL_SOUNDS } from '@/core/data/audio/pokeballSounds'
import {
  resolveBallGoneMoments,
  resolveBallSoundMoments,
} from './pokeballSoundMoments'

const ball = (state, extra = {}) => ({
  state,
  shakes: 0,
  landings: 0,
  ...extra,
})

describe('sons da Pokébola por momento', () => {
  it('cada passagem de fase toca o som dela', () => {
    expect(resolveBallSoundMoments(null, ball('flying'))).toEqual(['throw'])
    expect(resolveBallSoundMoments(ball('flying'), ball('absorbing'))).toEqual([
      'hit',
      'open',
    ])
    expect(resolveBallSoundMoments(ball('absorbing'), ball('falling'))).toEqual(
      ['shut'],
    )
    expect(resolveBallSoundMoments(ball('falling'), ball('shaking'))).toEqual([
      'bounce',
    ])
    expect(
      resolveBallSoundMoments(
        ball('shaking', { shakes: 1 }),
        ball('shaking', { shakes: 2 }),
      ),
    ).toEqual(['shake'])
    expect(resolveBallSoundMoments(ball('shaking'), ball('caught'))).toEqual([
      'caught',
    ])
    expect(resolveBallSoundMoments(ball('shaking'), ball('escaped'))).toEqual([
      'break',
    ])
  })

  it('sem mudança, nada; a que errou quica e quebra ao sumir', () => {
    expect(resolveBallSoundMoments(ball('flying'), ball('flying'))).toEqual([])
    expect(
      resolveBallSoundMoments(ball('missed'), ball('missed', { landings: 1 })),
    ).toEqual(['bounce'])
    expect(resolveBallGoneMoments(ball('missed'))).toEqual(['break'])
    expect(resolveBallGoneMoments(ball('caught'))).toEqual([])
  })

  it('todo momento tem som configurado com arquivos', () => {
    const moments = [
      'throw',
      'hit',
      'open',
      'shut',
      'bounce',
      'shake',
      'caught',
      'break',
      'sendOut',
      'recall',
    ]
    for (const moment of moments) {
      expect(POKEBALL_SOUNDS[moment]?.files.length).toBeGreaterThan(0)
    }
  })
})
