import { describe, expect, it } from 'vitest'
import { GAME_CONFIG } from '@/core/gameConfig'
import { fogRange, hazeFactorAt } from './fogRange'

const { CHUNK_SIZE, LOAD_RADIUS } = GAME_CONFIG.TERRAIN
const { START_FRACTION, MIN_DISTANCE } = GAME_CONFIG.FOG
const { MAX_DISTANCE } = GAME_CONFIG.CAMERA

const range = (overrides = {}) =>
  fogRange({
    loadRadius: LOAD_RADIUS,
    chunkSize: CHUNK_SIZE,
    cameraMaxDistance: MAX_DISTANCE,
    startFraction: START_FRACTION,
    minDistance: MIN_DISTANCE,
    ...overrides,
  })

describe('fogRange', () => {
  it('fecha antes do chunk mais perto que pode estar nascendo, vista da câmera', () => {
    const { far } = range()
    const nearestNewChunk = LOAD_RADIUS * CHUNK_SIZE - MAX_DISTANCE
    expect(far).toBeLessThanOrEqual(Math.max(nearestNewChunk, MIN_DISTANCE))
  })

  it('menos chunks carregados, névoa mais perto', () => {
    expect(range({ loadRadius: LOAD_RADIUS + 1 }).far).toBeGreaterThan(
      range().far,
    )
    expect(range({ chunkSize: CHUNK_SIZE * 2 }).far).toBeGreaterThan(
      range().far,
    )
  })

  it('começa antes de fechar', () => {
    const { near, far } = range()
    expect(near).toBeLessThan(far)
  })

  it('nunca fecha mais perto que o mínimo', () => {
    expect(range({ loadRadius: 0 }).far).toBe(MIN_DISTANCE)
  })
})

describe('hazeFactorAt (docs/features/051-montanha.md)', () => {
  const { HAZE_START, HAZE_LENGTH, HAZE_MAX, EDGE_FRACTION } = GAME_CONFIG.FOG
  const fog = { near: HAZE_START, far: GAME_CONFIG.FAR_TERRAIN.RADIUS }
  const params = {
    hazeLength: HAZE_LENGTH,
    hazeMax: HAZE_MAX,
    edgeFraction: EDGE_FRACTION,
  }
  const at = (distance) => hazeFactorAt(distance, fog, params)

  it('nada antes de começar', () => {
    expect(at(0)).toBe(0)
    expect(at(fog.near)).toBe(0)
  })

  it('engrossa ao se afastar, sem passar do máximo antes da borda', () => {
    let previous = 0
    for (let d = fog.near; d < fog.far * EDGE_FRACTION; d += 10) {
      expect(at(d)).toBeGreaterThanOrEqual(previous)
      expect(at(d)).toBeLessThanOrEqual(HAZE_MAX)
      previous = at(d)
    }
  })

  it('fecha de vez na borda do relevo distante', () => {
    expect(at(fog.far)).toBe(1)
    expect(at(fog.far * 2)).toBe(1)
  })
})
