import { describe, expect, it } from 'vitest'
import { GAME_CONFIG } from '../gameConfig'
import {
  isDeepWater,
  deepWaterEntry,
  nearWaterAt,
  nearestWaterPoints,
  shoreNear,
  shallowSpeedFactor,
  stepOutOfDeepWater,
  wadeLimit,
  waterDepthAt,
} from './water'

const { NAV_DEPTH, SHALLOW_MIN_SPEED, WADE_FRACTION } = GAME_CONFIG.WATER
// Até onde entra um corpo de teste (m).
const LIMIT = NAV_DEPTH * 3
const DEEP = LIMIT * 2

// Margem em x = 0: terra seca a oeste, a água desce para leste e fica funda
// a partir de x = 10.
const shoreDepth = (x) => Math.min(x, 10) * (DEEP / 10)
const depthAt = (x) => shoreDepth(x)
const deepFrom = (LIMIT / DEEP) * 10

describe('waterDepthAt', () => {
  it('é o quanto o chão fica abaixo do nível da água', () => {
    const heightAt = () => -3
    expect(waterDepthAt(heightAt, 0, 0, -1)).toBe(2)
    expect(waterDepthAt(heightAt, 0, 0, -5)).toBe(-2)
  })
})

describe('isDeepWater', () => {
  it('fundo só depois do trecho de raso da navegação', () => {
    expect(isDeepWater(NAV_DEPTH / 2)).toBe(false)
    expect(isDeepWater(NAV_DEPTH * 1.5)).toBe(true)
    expect(isDeepWater(-1)).toBe(false)
  })
})

describe('wadeLimit', () => {
  it('é uma fração da altura do corpo: quem é maior entra mais', () => {
    expect(wadeLimit(2)).toBeCloseTo(2 * WADE_FRACTION)
    expect(wadeLimit(0.4)).toBeLessThan(wadeLimit(1.6))
  })
})

describe('shallowSpeedFactor', () => {
  it('velocidade cheia na terra e cai com a profundidade até o mínimo', () => {
    expect(shallowSpeedFactor(-1, LIMIT)).toBe(1)
    expect(shallowSpeedFactor(0, LIMIT)).toBe(1)
    const half = shallowSpeedFactor(LIMIT / 2, LIMIT)
    expect(half).toBeLessThan(1)
    expect(half).toBeGreaterThan(SHALLOW_MIN_SPEED)
    expect(shallowSpeedFactor(LIMIT, LIMIT)).toBeCloseTo(SHALLOW_MIN_SPEED)
    expect(shallowSpeedFactor(LIMIT * 3, LIMIT)).toBeCloseTo(SHALLOW_MIN_SPEED)
  })
})

describe('stepOutOfDeepWater', () => {
  it('na terra e no raso o passo fica como está', () => {
    expect(stepOutOfDeepWater(-5, 0, 0.1, 0.05, depthAt, 0.5, LIMIT)).toEqual({
      dx: 0.1,
      dz: 0.05,
    })
    expect(stepOutOfDeepWater(1, 0, 0.1, 0, depthAt, 0.5, LIMIT)).toEqual({
      dx: 0.1,
      dz: 0,
    })
  })

  it('não entra na água funda: a ponta do corpo para na linha do fundo', () => {
    const reach = 0.5
    const x = deepFrom - reach - 0.05
    expect(stepOutOfDeepWater(x, 0, 0.2, 0, depthAt, reach, LIMIT)).toEqual({
      dx: 0,
      dz: 0,
    })
  })

  it('barrado de frente, desliza pela margem', () => {
    const reach = 0.5
    const x = deepFrom - reach - 0.05
    expect(stepOutOfDeepWater(x, 0, 0.2, 0.1, depthAt, reach, LIMIT)).toEqual({
      dx: 0,
      dz: 0.1,
    })
  })

  it('quem já está no fundo consegue sair (indo para o raso)', () => {
    expect(stepOutOfDeepWater(12, 0, -0.2, 0, depthAt, 0.5, LIMIT)).toEqual({
      dx: -0.2,
      dz: 0,
    })
  })
})

describe('nearWaterAt', () => {
  it('verdadeiro na água e na margem, falso longe dela', () => {
    expect(nearWaterAt(depthAt, 3, 0, 12)).toBe(true)
    expect(nearWaterAt(depthAt, -5, 0, 12)).toBe(true)
    expect(nearWaterAt(depthAt, -50, 0, 12)).toBe(false)
  })
})

describe('shoreNear', () => {
  it('fora da água funda, o próprio ponto', () => {
    expect(shoreNear(depthAt, -3, 2)).toEqual({ x: -3, z: 2 })
    expect(shoreNear(depthAt, 1, 2)).toEqual({ x: 1, z: 2 })
  })

  it('na água funda, o ponto seco mais perto', () => {
    const { x, z } = shoreNear(depthAt, 12, 0)
    expect(depthAt(x, z)).toBeLessThanOrEqual(0)
    // A terra mais perto fica a oeste, a uns 12 m.
    expect(Math.hypot(x - 12, z)).toBeLessThan(13)
  })
})

describe('deepWaterEntry', () => {
  const level = 0
  const deep = () => DEEP
  const shallow = () => NAV_DEPTH / 2

  it('descendo pela superfície da água funda: o ponto em que cruza', () => {
    const entry = deepWaterEntry(
      { x: 0, y: 1, z: 0 },
      { x: 2, y: -2, z: 0 },
      deep,
      level,
    )
    expect(entry).toEqual({ x: 1, y: level, z: 0 })
  })

  it('no raso, subindo ou sem cruzar a superfície: nada', () => {
    const from = { x: 0, y: 1, z: 0 }
    expect(deepWaterEntry(from, { x: 2, y: -2, z: 0 }, shallow, level)).toBe(
      null,
    )
    expect(deepWaterEntry(from, { x: 2, y: -0.5, z: 0 }, deep, level)).toBe(
      null,
    )
    expect(
      deepWaterEntry({ x: 0, y: -1, z: 0 }, { x: 0, y: 2, z: 0 }, deep, level),
    ).toBe(null)
  })
})

describe('shoreNear com o limite de um corpo', () => {
  it('dentro do limite fica onde está; além dele vai para a terra', () => {
    expect(shoreNear(depthAt, 4, 0, DEEP)).toEqual({ x: 4, z: 0 })
    const { x, z } = shoreNear(depthAt, 4, 0, depthAt(4) / 2)
    expect(depthAt(x, z)).toBeLessThanOrEqual(0)
  })
})

// docs/features/065-sons-do-mundo.md, Parte 5. Lago e rio de teste: um lago
// redondo a oeste e um rio (faixa com correnteza) a leste.
describe('nearestWaterPoints', () => {
  const SEARCH = { radius: 30, step: 1, directions: 16, riverFlow: 0.5 }
  const LAKE = { x: -12, z: 0, r: 4 }
  const RIVER_FROM_X = 8
  const lakeDepth = (x, z) => LAKE.r - Math.hypot(x - LAKE.x, z - LAKE.z)
  const depth = (x, z) => Math.max(lakeDepth(x, z), x >= RIVER_FROM_X ? 1 : -1)
  const flow = (x) => (x >= RIVER_FROM_X ? { x: 0, z: 1 } : { x: 0, z: 0 })

  it('acha os dois, cada um do seu tipo, dentro da água', () => {
    const found = nearestWaterPoints(depth, flow, 0, 0, SEARCH)

    expect(found.lake).not.toBeNull()
    expect(found.river).not.toBeNull()
    expect(lakeDepth(found.lake.x, found.lake.z)).toBeGreaterThan(0)
    expect(found.river.x).toBeGreaterThanOrEqual(RIVER_FROM_X)
  })

  it('o ponto achado fica perto da margem mais próxima', () => {
    const found = nearestWaterPoints(depth, flow, 0, 0, SEARCH)
    const toLake = Math.hypot(LAKE.x, LAKE.z) - LAKE.r

    expect(found.river.distance).toBeGreaterThanOrEqual(RIVER_FROM_X)
    expect(found.river.distance).toBeLessThanOrEqual(RIVER_FROM_X + SEARCH.step)
    expect(found.lake.distance).toBeGreaterThanOrEqual(toLake)
    expect(found.lake.distance).toBeLessThanOrEqual(toLake + SEARCH.step)
  })

  it('sem água no raio, nada', () => {
    const found = nearestWaterPoints(() => -1, flow, 0, 0, SEARCH)
    expect(found).toEqual({ lake: null, river: null })
  })

  it('em cima da água, distância zero', () => {
    const found = nearestWaterPoints(depth, flow, LAKE.x, LAKE.z, SEARCH)
    expect(found.lake.distance).toBe(0)
  })
})
