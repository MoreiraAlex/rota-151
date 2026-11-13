import { afterEach, describe, expect, it } from 'vitest'
import { makeWorld } from '@/test/makeWorld'
import { TEST_LEVEL } from '../data/testLevel'
import { getTownMap, townMapCollidersOf } from '../data/townMaps'
import { getActiveTownMap } from '../townMap/activeTownMap'
import { isInsideTownMap, townMapArrival } from '../townMap/townMapPlacement'
import {
  CameraSnap,
  Indoors,
  OnTownMap,
  OrbitCamera,
  Position,
  Rotation,
} from '../traits'
import { irPara } from './travel'
import { levelWaterDepthAt } from './water'
import {
  irParaMapaDaCidade,
  isOnTownMap,
  sairDoMapaDaCidade,
  townMapSaveOf,
  voltarParaOMapa,
} from './townMap'

// Ir e vir do mapa de uma cidade copiada (docs/features/069-revisao-do-
// bioma-cidade.md — Pallet).
const MAP_ID = 'pallet'
const worlds = []

afterEach(() => {
  while (worlds.length) {
    const world = worlds.pop()
    for (const player of world.query(OnTownMap))
      sairDoMapaDaCidade(world, player)
    world.destroy()
  }
})

function setup(position = { x: 35, y: 4, z: -12 }) {
  const made = makeWorld({ playerPosition: position })
  worlds.push(made.world)
  return made
}

const collidersOf = () => townMapCollidersOf(getTownMap(MAP_ID))

describe('irParaMapaDaCidade', () => {
  it('leva o treinador para a chegada do mapa, acima do relevo de onde estava', () => {
    const { world, player } = setup()
    const from = { ...player.get(Position) }

    expect(irParaMapaDaCidade(world, player, MAP_ID)).toBe(true)

    expect(isOnTownMap(player)).toBe(true)
    const place = player.get(OnTownMap)
    expect(place.x).toBe(from.x)
    expect(place.z).toBe(from.z)
    expect(place.y).toBeGreaterThan(TEST_LEVEL.terrain.heightAt(from.x, from.z))
    const arrival = townMapArrival(collidersOf(), place)
    const position = player.get(Position)
    expect(position.x).toBeCloseTo(arrival.x, 6)
    expect(position.z).toBeCloseTo(arrival.z, 6)
    expect(position.y).toBeGreaterThanOrEqual(arrival.y)
    expect(player.get(Rotation).y).toBe(arrival.yaw)
    expect(world.queryFirst(OrbitCamera).has(CameraSnap)).toBe(true)
  })

  it('a água das consultas do nível passa a ser a do mapa', () => {
    const { world, player } = setup()
    irParaMapaDaCidade(world, player, MAP_ID)
    const active = getActiveTownMap()
    expect(active.place).toMatchObject({ x: player.get(OnTownMap).x })
    const { x, z } = player.get(Position)
    expect(isInsideTownMap(active.colliders, active.place, x, z)).toBe(true)
    // Na chegada, chão seco.
    expect(levelWaterDepthAt(x, z)).toBeLessThanOrEqual(0)
  })

  it('já no mapa, dentro de um prédio ou mapa desconhecido: nada', () => {
    const { world, player } = setup()
    expect(irParaMapaDaCidade(world, player, 'mapa-que-nao-existe')).toBe(false)
    irParaMapaDaCidade(world, player, MAP_ID)
    expect(irParaMapaDaCidade(world, player, MAP_ID)).toBe(false)

    const other = setup()
    other.player.add(Indoors)
    expect(irParaMapaDaCidade(other.world, other.player, MAP_ID)).toBe(false)
  })

  it('no mapa, o "Ir para a cidade" não leva', () => {
    const { world, player } = setup()
    irParaMapaDaCidade(world, player, MAP_ID)
    expect(irPara(world, player, 300, 300)).toBe(false)
  })
})

describe('sairDoMapaDaCidade', () => {
  it('volta para onde estava, em cima do relevo, e o mapa deixa de valer', () => {
    const { world, player } = setup()
    const from = { ...player.get(Position) }
    irParaMapaDaCidade(world, player, MAP_ID)

    expect(sairDoMapaDaCidade(world, player)).toBe(true)

    expect(isOnTownMap(player)).toBe(false)
    expect(getActiveTownMap()).toBeNull()
    const position = player.get(Position)
    expect(position.x).toBe(from.x)
    expect(position.z).toBe(from.z)
    expect(position.y).toBeGreaterThan(
      TEST_LEVEL.terrain.heightAt(from.x, from.z),
    )
  })

  it('fora do mapa, nada', () => {
    const { world, player } = setup()
    expect(sairDoMapaDaCidade(world, player)).toBe(false)
  })
})

describe('save no mapa', () => {
  it('guarda o mapa e volta para ele no mesmo lugar', () => {
    const { world, player } = setup()
    irParaMapaDaCidade(world, player, MAP_ID)
    const saved = townMapSaveOf(player)
    const position = { ...player.get(Position) }
    sairDoMapaDaCidade(world, player)

    const other = setup({ x: 0, y: 2, z: 0 })
    expect(voltarParaOMapa(other.player, saved, position)).toBe(true)
    expect(isOnTownMap(other.player)).toBe(true)
    expect(other.player.get(Position)).toEqual(position)
    expect(getActiveTownMap()).not.toBeNull()
  })

  it('posição fora do mapa volta para a chegada', () => {
    const { world, player } = setup()
    irParaMapaDaCidade(world, player, MAP_ID)
    const saved = townMapSaveOf(player)
    sairDoMapaDaCidade(world, player)

    const other = setup({ x: 0, y: 2, z: 0 })
    voltarParaOMapa(other.player, saved, { x: 0, y: 2, z: 0 })
    const arrival = townMapArrival(collidersOf(), saved.place)
    expect(other.player.get(Position).x).toBeCloseTo(arrival.x, 6)
    expect(other.player.get(Position).z).toBeCloseTo(arrival.z, 6)
  })

  it('fora do mapa o save não tem mapa, e carregar sem ele tira o treinador de lá', () => {
    const { world, player } = setup()
    expect(townMapSaveOf(player)).toBeNull()
    irParaMapaDaCidade(world, player, MAP_ID)
    expect(voltarParaOMapa(player, null, null)).toBe(false)
    expect(isOnTownMap(player)).toBe(false)
    expect(getActiveTownMap()).toBeNull()
  })
})
