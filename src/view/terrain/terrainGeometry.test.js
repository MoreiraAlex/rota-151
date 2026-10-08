import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { GAME_CONFIG } from '@/core/gameConfig'
import { createHeightSampler } from '@/core/terrain/terrainHeight'
import {
  chunkHeightAt,
  generateTerrainChunk,
} from '@/core/terrain/terrainChunk'
import { buildTerrainChunkGeometry, terrainColorAt } from './terrainGeometry'
import { TERRAIN_PALETTE } from './terrainPalette'

const { WATER_LEVEL } = GAME_CONFIG.TERRAIN
const chunk = generateTerrainChunk(createHeightSampler(9), 1, 0)

describe('buildTerrainChunkGeometry', () => {
  const geometry = buildTerrainChunkGeometry(chunk, WATER_LEVEL)
  const position = geometry.getAttribute('position')

  it('um vértice por ponto do chunk e dois triângulos por célula', () => {
    expect(position.count).toBe((chunk.resolution + 1) ** 2)
    expect(geometry.getIndex().count).toBe(chunk.resolution ** 2 * 6)
    expect(geometry.getAttribute('color').count).toBe(position.count)
  })

  it('cada vértice está em cima do relevo do chunk', () => {
    for (let i = 0; i < position.count; i += 37) {
      expect(position.getY(i)).toBeCloseTo(
        chunkHeightAt(chunk, position.getX(i), position.getZ(i)),
        4,
      )
    }
  })

  it('os triângulos são os do colisor: um ponto no meio de qualquer triângulo bate com chunkHeightAt', () => {
    const index = geometry.getIndex()
    const triangle = new THREE.Triangle()
    const center = new THREE.Vector3()
    for (let t = 0; t < index.count; t += 3 * 41) {
      triangle.setFromAttributeAndIndices(
        position,
        index.getX(t),
        index.getX(t + 1),
        index.getX(t + 2),
      )
      triangle.getMidpoint(center)
      expect(center.y).toBeCloseTo(chunkHeightAt(chunk, center.x, center.z), 4)
    }
  })

  it('as faces apontam para cima', () => {
    const normal = geometry.getAttribute('normal')
    for (let i = 0; i < normal.count; i += 29) {
      expect(normal.getY(i)).toBeGreaterThan(0)
    }
  })
})

describe('terrainColorAt', () => {
  const color = (hex) => new THREE.Color(hex)

  it('abaixo da água é fundo de lago; logo acima, margem', () => {
    expect(terrainColorAt(-1, 1, new THREE.Color())).toEqual(
      color(TERRAIN_PALETTE.lakeBed),
    )
    expect(
      terrainColorAt(TERRAIN_PALETTE.SHORE_HEIGHT / 2, 1, new THREE.Color()),
    ).toEqual(color(TERRAIN_PALETTE.shore))
  })

  it('encosta íngreme puxa para a cor de encosta', () => {
    const height = TERRAIN_PALETTE.GRASS_TOP_HEIGHT / 2
    const flat = terrainColorAt(height, 1, new THREE.Color())
    const steep = terrainColorAt(
      height,
      TERRAIN_PALETTE.SLOPE_FULL,
      new THREE.Color(),
    )
    expect(flat.equals(steep)).toBe(false)
    expect(steep).toEqual(color(TERRAIN_PALETTE.slope))
  })
})
