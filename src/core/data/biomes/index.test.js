import { describe, expect, it } from 'vitest'
import { CLIMATE_AXES } from '../../terrain/biomeMap'
import { WEATHER_TYPES } from '../../weather/weatherMap'
import { BIOME_REGISTRY, getBiome, listBiomes } from '.'

const HEX_COLOR = /^#[0-9a-f]{6}$/i
const PALETTE_COLORS = ['bed', 'shore', 'low', 'high', 'slope', 'debug']
const RELIEF_FIELDS = [
  'baseHeight',
  'hillHeight',
  'hillSize',
  'roughness',
  'flatness',
]

describe('registro de biomas', () => {
  it('cada bioma está registrado pelo próprio id', () => {
    for (const [id, biome] of Object.entries(BIOME_REGISTRY)) {
      expect(biome.id).toBe(id)
      expect(getBiome(id)).toBe(biome)
    }
    expect(getBiome('nao-existe')).toBeNull()
  })

  it.each(listBiomes())('$id tem nome e tamanho', (biome) => {
    expect(biome.name).toEqual(expect.any(String))
    expect(biome.size).toBeGreaterThan(0)
  })

  it.each(listBiomes())('$id: faixas de clima dentro de 0 a 1', (biome) => {
    for (const [axis, range] of Object.entries(biome.climate)) {
      expect(CLIMATE_AXES).toContain(axis)
      const [min, max] = range
      expect(min).toBeGreaterThanOrEqual(0)
      expect(max).toBeLessThanOrEqual(1)
      expect(min).toBeLessThanOrEqual(max)
    }
  })

  it.each(listBiomes())('$id: relevo completo e válido', ({ relief }) => {
    for (const field of RELIEF_FIELDS) {
      expect(relief[field]).toEqual(expect.any(Number))
    }
    expect(relief.hillHeight).toBeGreaterThanOrEqual(0)
    expect(relief.hillSize).toBeGreaterThan(0)
    expect(relief.roughness).toBeGreaterThanOrEqual(0)
    expect(relief.roughness).toBeLessThanOrEqual(1)
    expect(relief.flatness).toBeGreaterThan(0)
  })

  it.each(listBiomes())('$id: paleta com todas as cores', ({ palette }) => {
    for (const color of PALETTE_COLORS) {
      expect(palette[color]).toMatch(HEX_COLOR)
    }
    expect(palette.highHeight).toBeGreaterThan(0)
    if (palette.peak) {
      expect(palette.peak).toMatch(HEX_COLOR)
      expect(palette.peakHeight).toEqual(expect.any(Number))
    }
  })

  it.each(listBiomes())(
    '$id: vegetação declarada e tags de spawn',
    ({ vegetation, tags }) => {
      expect(vegetation.length).toBeGreaterThan(0)
      for (const { kind, density } of vegetation) {
        expect(kind).toEqual(expect.any(String))
        expect(density).toBeGreaterThanOrEqual(0)
        expect(density).toBeLessThanOrEqual(1)
      }
      expect(tags.length).toBeGreaterThan(0)
      for (const tag of tags) expect(tag).toEqual(expect.any(String))
    },
  )

  it.each(listBiomes())(
    '$id: chances de clima para cada tipo (docs/features/048-*.md)',
    ({ weather }) => {
      let total = 0
      for (const type of WEATHER_TYPES) {
        expect(weather[type]).toBeGreaterThanOrEqual(0)
        total += weather[type]
      }
      expect(total).toBeGreaterThan(0)
      expect(Object.keys(weather).sort()).toEqual([...WEATHER_TYPES].sort())
    },
  )
})
