import { describe, expect, it } from 'vitest'
import LGPE_COLLIDERS from '../lgpeColliders.json'
import { MUSIC_TRACKS } from '../audio/musicTracks'
import { listBiomes } from '../biomes'
import {
  getInterior,
  interiorCollidersOf,
  interiorOfBuilding,
  listInteriors,
} from '.'

// As salas por dentro dos prédios (docs/features/068-interior-dos-
// predios.md): regras que valem para qualquer sala da lista.
const inside = (box, x, z) =>
  x >= box[0] && x <= box[3] && z >= box[2] && z <= box[5]

describe('salas por dentro dos prédios', () => {
  it('cada sala se acha pelo id e pelo prédio', () => {
    for (const interior of listInteriors()) {
      expect(getInterior(interior.id)).toBe(interior)
      expect(interiorOfBuilding(interior.building)).toBe(interior)
      expect(interior.enterText).toBeTruthy()
      expect(interior.exitText).toBeTruthy()
    }
    expect(getInterior('sala-que-nao-existe')).toBeNull()
  })

  it('a música de cada sala existe e repete', () => {
    for (const { music } of listInteriors()) {
      if (!music) continue
      expect(MUSIC_TRACKS[music]?.loopEnd).toBeGreaterThan(
        MUSIC_TRACKS[music].loopStart,
      )
    }
  })

  it('o prédio de cada sala existe e nasce nas cidades', () => {
    const landmarks = listBiomes().flatMap(
      (biome) => biome.town?.landmarks ?? [],
    )
    for (const { building } of listInteriors()) {
      expect(LGPE_COLLIDERS[building]?.box).toBeTruthy()
      expect(landmarks.some(({ model }) => model === building)).toBe(true)
    }
  })

  it('a colisão: a saída fica no piso, livre de paredes e móveis', () => {
    for (const interior of listInteriors()) {
      const { floor, walls, solids, exit } = interiorCollidersOf(interior)
      expect(exit.x).toBeGreaterThanOrEqual(floor.minX)
      expect(exit.x).toBeLessThanOrEqual(floor.maxX)
      expect(exit.z).toBeGreaterThanOrEqual(floor.minZ)
      expect(exit.z).toBeLessThanOrEqual(floor.maxZ)
      for (const box of [...walls, ...solids]) {
        expect(inside(box, exit.x, exit.z)).toBe(false)
      }
    }
  })

  it('os objetos soltos ficam no piso da sala', () => {
    for (const interior of listInteriors()) {
      const { floor, props = [] } = interiorCollidersOf(interior)
      for (const prop of props) {
        expect(prop.model).toBeTruthy()
        expect(prop.x).toBeGreaterThanOrEqual(floor.minX)
        expect(prop.x).toBeLessThanOrEqual(floor.maxX)
        expect(prop.z).toBeGreaterThanOrEqual(floor.minZ)
        expect(prop.z).toBeLessThanOrEqual(floor.maxZ)
        expect(prop.y).toBeCloseTo(floor.y, 2)
      }
    }
  })

  it('a colisão: móveis em cima do piso; paredes fechando o piso', () => {
    for (const interior of listInteriors()) {
      const { floor, walls, solids } = interiorCollidersOf(interior)
      for (const box of solids) {
        expect(box[1]).toBeGreaterThanOrEqual(floor.y - 1e-6)
        expect(box[4]).toBeGreaterThan(floor.y)
      }
      // Andando para fora do piso, por qualquer lado, bate numa parede.
      const middleX = (floor.minX + floor.maxX) / 2
      const middleZ = (floor.minZ + floor.maxZ) / 2
      const step = 0.1
      const beyond = [
        [floor.minX - step, middleZ],
        [floor.maxX + step, middleZ],
        [middleX, floor.minZ - step],
        [middleX, floor.maxZ + step],
      ]
      for (const [x, z] of beyond) {
        expect(walls.some((box) => inside(box, x, z))).toBe(true)
      }
    }
  })
})
