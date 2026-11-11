import { describe, expect, it } from 'vitest'
import { colorLayerGrass } from './terrainMaterial'
import { TERRAIN_COLOR_LAYERS } from './terrainLayers'

describe('tom do chão só na grama (066)', () => {
  const marked = (name) =>
    colorLayerGrass[TERRAIN_COLOR_LAYERS.findIndex(([layer]) => layer === name)]

  it('as camadas de grama levam o tom', () => {
    const grassy = TERRAIN_COLOR_LAYERS.map(([name]) => name).filter((name) =>
      name.includes('grass'),
    )
    expect(grassy.length).toBeGreaterThan(0)
    for (const name of grassy) expect(marked(name)).toBe(1)
  })

  it('trilha, margem, encosta e rua ficam como estão', () => {
    const others = TERRAIN_COLOR_LAYERS.map(([name]) => name).filter((name) =>
      /soil|sand|rock|cliff|street|tile|asphalt|stone/.test(name),
    )
    expect(others.length).toBeGreaterThan(0)
    for (const name of others) expect(marked(name)).toBe(0)
  })
})
