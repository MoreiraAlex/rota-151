import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { GAME_CONFIG } from '../../gameConfig'
import { listBiomes } from '../biomes'
import {
  AMBIENCE,
  AMBIENT_BEDS,
  AMBIENT_FALLBACK_BIOME,
  AMBIENT_ONE_SHOTS,
  BIOME_AMBIENCE,
} from './ambientBeds'

// Som ambiente do mundo (docs/features/065-sons-do-mundo.md, Parte 4): o
// dado conferido contra os arquivos e os biomas de verdade.
const exists = (path) => existsSync(join(process.cwd(), 'public', path))

describe('fundos do ambiente', () => {
  it.each(Object.entries(AMBIENT_BEDS))('%s: arquivo existe', (_, bed) => {
    expect(exists(bed.path)).toBe(true)
    expect(bed.volume).toBeGreaterThan(0)
  })

  it('todo bioma visível da beta tem fundo de dia e de noite que existem', () => {
    const visible = listBiomes().filter(
      ({ id }) => !GAME_CONFIG.BIOMES.HIDDEN.includes(id),
    )
    for (const { id } of visible) {
      expect(BIOME_AMBIENCE[id], id).toBeDefined()
    }
    expect(BIOME_AMBIENCE[AMBIENT_FALLBACK_BIOME]).toBeDefined()
    for (const { day, night } of Object.values(BIOME_AMBIENCE)) {
      expect(AMBIENT_BEDS[day]).toBeDefined()
      expect(AMBIENT_BEDS[night]).toBeDefined()
    }
  })
})

describe('sons avulsos', () => {
  it.each(Object.entries(AMBIENT_ONE_SHOTS))('%s: dado válido', (_, shot) => {
    for (const path of shot.files) expect(exists(path)).toBe(true)
    expect(shot.volume).toBeGreaterThan(0)
    expect(shot.interval.max).toBeGreaterThanOrEqual(shot.interval.min)
    expect(['day', 'night']).toContain(shot.time)
    for (const biomeId of shot.biomes) {
      expect(BIOME_AMBIENCE[biomeId], biomeId).toBeDefined()
    }
    if (shot.spatial) {
      expect(shot.spatial.maxDistance).toBeGreaterThan(shot.spatial.refDistance)
      expect(shot.spatial.distance.max).toBeLessThan(shot.spatial.maxDistance)
    }
  })

  it('tempos e faixas válidos', () => {
    expect(AMBIENCE.TWILIGHT.max).toBeGreaterThan(AMBIENCE.TWILIGHT.min)
    expect(AMBIENCE.LEVEL_SMOOTHING).toBeGreaterThan(0)
    expect(AMBIENCE.PROBE_INTERVAL).toBeGreaterThan(0)
    expect(AMBIENCE.RAIN_DUCKING).toBeGreaterThanOrEqual(0)
    expect(AMBIENCE.RAIN_DUCKING).toBeLessThanOrEqual(1)
  })
})
