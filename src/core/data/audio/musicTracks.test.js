import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { oggDuration } from '@/test/oggDuration'
import { GAME_CONFIG } from '../../gameConfig'
import { listBiomes } from '../biomes'
import {
  BIOME_MUSIC,
  DEFAULT_MUSIC_FREQUENCY,
  MUSIC,
  MUSIC_FALLBACK_BIOME,
  MUSIC_FREQUENCIES,
  MUSIC_TRACKS,
} from './musicTracks'

// Música de fundo (docs/features/065-sons-do-mundo.md, Parte 2): o dado
// conferido contra os arquivos de verdade.
const filePath = (path) => join(process.cwd(), 'public', path)

describe('faixas de música', () => {
  it.each(Object.entries(MUSIC_TRACKS))('%s: o arquivo existe', (_, track) => {
    expect(existsSync(filePath(track.path))).toBe(true)
    expect(track.volume).toBeGreaterThan(0)
  })

  it('faixa com loop: o loop cabe no arquivo', () => {
    const looping = Object.values(MUSIC_TRACKS).filter(
      (track) => track.loopEnd !== undefined,
    )
    for (const track of looping) {
      expect(track.loopStart).toBeGreaterThanOrEqual(0)
      expect(track.loopEnd).toBeGreaterThan(track.loopStart)
      expect(track.loopEnd).toBeLessThanOrEqual(
        oggDuration(filePath(track.path)),
      )
    }
  })
})

describe('música por bioma', () => {
  it('todo bioma visível da beta tem música de dia e de noite', () => {
    const visible = listBiomes().filter(
      ({ id }) => !GAME_CONFIG.BIOMES.HIDDEN.includes(id),
    )
    for (const { id } of visible) {
      expect(BIOME_MUSIC[id]?.day?.length, id).toBeGreaterThan(0)
      expect(BIOME_MUSIC[id]?.night?.length, id).toBeGreaterThan(0)
    }
  })

  it('toda música citada existe e não repete o loop (toca uma vez)', () => {
    expect(BIOME_MUSIC[MUSIC_FALLBACK_BIOME]).toBeDefined()
    for (const { day, night } of Object.values(BIOME_MUSIC)) {
      for (const id of [...day, ...night]) {
        expect(MUSIC_TRACKS[id], id).toBeDefined()
        expect(MUSIC_TRACKS[id].loopEnd, id).toBeUndefined()
      }
    }
  })
})

describe('tempos', () => {
  it('toda frequência tem um intervalo válido, e a padrão existe', () => {
    expect(MUSIC_FREQUENCIES[DEFAULT_MUSIC_FREQUENCY]).toBeDefined()
    for (const range of [
      ...Object.values(MUSIC_FREQUENCIES),
      MUSIC.FIRST_DELAY,
    ]) {
      expect(range.min).toBeGreaterThanOrEqual(0)
      expect(range.max).toBeGreaterThanOrEqual(range.min)
    }
    expect(MUSIC.FADE_OUT).toBeGreaterThan(0)
    expect(MUSIC.BATTLE_HOLD).toBeGreaterThan(0)
  })

  it('a música de batalha existe e repete (tem loop)', () => {
    const battle = MUSIC_TRACKS[MUSIC.BATTLE_TRACK]
    expect(battle).toBeDefined()
    expect(battle.loopEnd).toBeGreaterThan(battle.loopStart)
  })
})
