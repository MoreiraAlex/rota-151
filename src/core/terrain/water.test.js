import { describe, expect, it } from 'vitest'
import { GAME_CONFIG } from '../gameConfig'
import {
  isDeepWater,
  deepWaterEntry,
  nearWaterAt,
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
