import { afterEach, describe, expect, it } from 'vitest'
import { makeWorld } from '@/test/makeWorld'
import { DEFAULT_VOLUMES, VOLUME_KEYS } from '../data/audio/mixer'
import {
  DEFAULT_MUSIC_FREQUENCY,
  MUSIC_FREQUENCIES,
} from '../data/audio/musicTracks'
import { SoundSettings } from '../traits'
import { definirFrequenciaDaMusica, definirVolume } from './soundSettings'

// Ajustes de som do jogador (docs/features/065-sons-do-mundo.md).
const worlds = []
afterEach(() => {
  while (worlds.length) worlds.pop().destroy()
})

function setup() {
  const { world, player } = makeWorld()
  worlds.push(world)
  return player
}

describe('definirVolume', () => {
  it('o treinador nasce com os ajustes padrão', () => {
    expect(setup().get(SoundSettings)).toEqual({
      ...DEFAULT_VOLUMES,
      musicFrequency: DEFAULT_MUSIC_FREQUENCY,
    })
  })

  it('muda só a chave pedida', () => {
    const player = setup()
    for (const key of VOLUME_KEYS) {
      const before = player.get(SoundSettings)
      const value = before[key] === 0.5 ? 0.25 : 0.5

      expect(definirVolume(player, key, value)).toBe(true)

      expect(player.get(SoundSettings)).toEqual({ ...before, [key]: value })
    }
  })

  it('prende o valor entre 0 e 1', () => {
    const player = setup()
    const [key] = VOLUME_KEYS

    definirVolume(player, key, 2)
    expect(player.get(SoundSettings)[key]).toBe(1)
    definirVolume(player, key, -1)
    expect(player.get(SoundSettings)[key]).toBe(0)
  })

  it('ignora chave desconhecida e valor que não é número', () => {
    const player = setup()
    const before = player.get(SoundSettings)
    const [key] = VOLUME_KEYS

    expect(definirVolume(player, 'trovao', 0.5)).toBe(false)
    expect(definirVolume(player, key, Number.NaN)).toBe(false)
    expect(definirVolume(player, key, '0.5')).toBe(false)

    expect(player.get(SoundSettings)).toEqual(before)
  })
})

describe('definirFrequenciaDaMusica', () => {
  it('aceita toda frequência conhecida', () => {
    const player = setup()
    for (const frequency of Object.keys(MUSIC_FREQUENCIES)) {
      definirFrequenciaDaMusica(player, frequency)
      expect(player.get(SoundSettings).musicFrequency).toBe(frequency)
    }
  })

  it('ignora frequência desconhecida e não mexe nos volumes', () => {
    const player = setup()
    const before = player.get(SoundSettings)

    expect(definirFrequenciaDaMusica(player, 'nunca-mais')).toBe(false)

    expect(player.get(SoundSettings)).toEqual(before)
  })
})
