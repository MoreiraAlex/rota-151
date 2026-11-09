import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { WATER_AMBIENT } from './waterSounds'

// Som de fundo da água (docs/features/065-sons-do-mundo.md, Parte 5).
const KINDS = ['lake', 'river']

describe('WATER_AMBIENT', () => {
  it.each(KINDS)('%s: arquivo existe e alcance válido', (kind) => {
    const sound = WATER_AMBIENT[kind]
    expect(existsSync(join(process.cwd(), 'public', sound.path))).toBe(true)
    expect(sound.volume).toBeGreaterThan(0)
    expect(sound.maxDistance).toBeGreaterThan(sound.refDistance)
  })

  it('a busca alcança todo som que ainda se ouve', () => {
    for (const kind of KINDS) {
      expect(WATER_AMBIENT.SEARCH_RADIUS).toBeGreaterThanOrEqual(
        WATER_AMBIENT[kind].maxDistance,
      )
    }
    expect(WATER_AMBIENT.SEARCH_STEP).toBeGreaterThan(0)
    expect(WATER_AMBIENT.SEARCH_DIRECTIONS).toBeGreaterThan(0)
    expect(WATER_AMBIENT.PROBE_INTERVAL).toBeGreaterThan(0)
  })
})
