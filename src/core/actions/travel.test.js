import { afterEach, describe, expect, it } from 'vitest'
import { makeWorld } from '@/test/makeWorld'
import { listBiomes } from '../data/biomes'
import { TEST_LEVEL } from '../data/testLevel'
import { GAME_CONFIG } from '../gameConfig'
import { streetStrengthAt } from '../town/townPlan'
import { CameraSnap, Indoors, OrbitCamera, Position, Velocity } from '../traits'
import { cityArrivalPoint, irPara } from './travel'

const TOWN = listBiomes().find(({ town }) => town)?.town
const worlds = []

afterEach(() => {
  while (worlds.length) worlds.pop().destroy()
})

function setup() {
  const made = makeWorld()
  worlds.push(made.world)
  return made
}

describe.runIf(TOWN)('cityArrivalPoint', () => {
  it('cai numa rua, perto do meio da cidade', () => {
    for (const city of [
      { x: 0, z: 0 },
      { x: 913.4, z: -271.8 },
      { x: -455.1, z: 1388.2 },
    ]) {
      const point = cityArrivalPoint(city, TOWN)
      expect(streetStrengthAt(TOWN, point.x, point.z)).toBe(1)
      expect(
        Math.hypot(point.x - city.x, point.z - city.z),
      ).toBeLessThanOrEqual(TOWN.blockSize / 2)
    }
  })
})

describe('irPara', () => {
  it('leva o treinador para o ponto, parado, em cima do chão', () => {
    const { world, player } = setup()
    player.set(Velocity, { x: 3, y: -2, z: 1 })
    const target = { x: 250, z: -130 }

    expect(irPara(world, player, target.x, target.z)).toBe(true)

    const position = player.get(Position)
    expect(position.x).toBe(target.x)
    expect(position.z).toBe(target.z)
    expect(position.y).toBeGreaterThan(
      TEST_LEVEL.terrain.heightAt(target.x, target.z),
    )
    expect(player.get(Velocity)).toEqual({ x: 0, y: 0, z: 0 })
  })

  it('a câmera vai junto, sem a suavização', () => {
    const { world, player } = setup()
    irPara(world, player, 40, 40)
    expect(world.queryFirst(OrbitCamera).has(CameraSnap)).toBe(true)
  })

  it('dentro de um prédio, nada', () => {
    const { world, player } = setup()
    player.add(Indoors)
    const before = { ...player.get(Position) }
    expect(irPara(world, player, 300, 300)).toBe(false)
    expect(player.get(Position)).toEqual(before)
  })

  it('chega acima do chão pela folga de nascer', () => {
    const { world, player } = setup()
    irPara(world, player, 60, 20)
    const ground = TEST_LEVEL.terrain.heightAt(60, 20)
    expect(player.get(Position).y - ground).toBeGreaterThanOrEqual(
      GAME_CONFIG.TERRAIN.SPAWN_HEIGHT,
    )
  })
})
