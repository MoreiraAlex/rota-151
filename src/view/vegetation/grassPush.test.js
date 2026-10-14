import { describe, expect, it } from 'vitest'
import { GAME_CONFIG } from '@/core/gameConfig'
import {
  footprintRadius,
  liftStrength,
  nearestPushers,
  springRate,
} from './grassPush'

const { GRASS_PUSH } = GAME_CONFIG
const STEP = 1 / 60

describe('springRate', () => {
  const maxStep = STEP * 2

  it('mais tempo, mola mais lenta', () => {
    expect(springRate(GRASS_PUSH.RECOVERY * 2, maxStep)).toBeLessThan(
      springRate(GRASS_PUSH.RECOVERY, maxStep),
    )
  })

  it('nunca passa do limite estável, nem sem tempo', () => {
    const limit = springRate(0, maxStep)
    expect(Number.isFinite(limit)).toBe(true)
    expect(limit * maxStep).toBeLessThan(1)
    expect(springRate(1e-6, maxStep)).toBe(limit)
  })

  it('deitar com o tempo do config é mais rápido que voltar', () => {
    expect(GRASS_PUSH.ATTACK).toBeLessThan(GRASS_PUSH.RECOVERY)
    expect(springRate(GRASS_PUSH.ATTACK, maxStep)).toBeGreaterThan(
      springRate(GRASS_PUSH.RECOVERY, maxStep),
    )
  })
})

describe('liftStrength', () => {
  const gate = GRASS_PUSH.HEIGHT_GATE

  it('no chão empurra inteiro; acima do limite, nada', () => {
    expect(liftStrength(0, gate)).toBe(1)
    expect(liftStrength(gate, gate)).toBe(0)
    expect(liftStrength(gate * 3, gate)).toBe(0)
  })

  it('cai sem degrau conforme sobe', () => {
    let previous = 1
    for (let h = 0; h <= gate; h += gate / 20) {
      const strength = liftStrength(h, gate)
      expect(strength).toBeLessThanOrEqual(previous)
      previous = strength
    }
  })
})

describe('nearestPushers', () => {
  const point = { x: 0, z: 0 }
  const candidates = [5, 1, 3, 2, 4].map((d) => ({ x: d, z: 0, d }))

  it('fica com os mais perto, do mais perto ao mais longe', () => {
    const chosen = nearestPushers(candidates, point, 3)
    expect(chosen.map(({ d }) => d)).toEqual([1, 2, 3])
  })

  it('com menos candidatos que vagas, fica com todos', () => {
    expect(nearestPushers(candidates, point, 10)).toHaveLength(5)
  })
})

describe('footprintRadius', () => {
  const body = { capsuleRadius: 0.4, capsuleHalfHeight: 0.3 }

  it('em pé, o raio da cápsula', () => {
    expect(footprintRadius({ ...body, capsuleAxis: 'y' })).toBe(
      body.capsuleRadius,
    )
  })

  it('deitada, o raio mais o comprimento', () => {
    expect(footprintRadius({ ...body, capsuleAxis: 'x' })).toBeGreaterThan(
      body.capsuleRadius,
    )
  })
})
