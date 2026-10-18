import { describe, it, expect } from 'vitest'
import { GAME_CONFIG } from '../gameConfig'
import {
  approachFlightVelocity,
  canTakeOff,
  gastarStaminaDeVoo,
  limitFlightVerticalSpeed,
  resolveFlightCeiling,
  resolveFlightDashDirection,
  resolveFlightDirection,
  resolveFlightIntent,
} from './flight'

const { FLIGHT } = GAME_CONFIG
const NEUTRAL = FLIGHT.NEUTRAL_PITCH
const FORWARD = { x: 0, z: -1 }

// a câmera mexendo na altura (FLIGHT.CAMERA_PITCH_CONTROL ligado)
const PITCH = { pitchControl: true }

describe('resolveFlightDirection', () => {
  it('no pitch neutro, a frente é reta e igual à do movimento no chão', () => {
    const yaw = 0.7
    const dir = resolveFlightDirection(FORWARD, yaw, NEUTRAL)
    expect(dir.y).toBeCloseTo(0)
    // mesma rotação do movementSystem: worldX = x·cos + z·sin
    expect(dir.x).toBeCloseTo(FORWARD.z * Math.sin(yaw))
    expect(dir.z).toBeCloseTo(FORWARD.z * Math.cos(yaw))
  })

  it('câmera olhando mais pra baixo desce; mais pra cima sobe', () => {
    expect(
      resolveFlightDirection(FORWARD, 0, NEUTRAL + 0.4, PITCH).y,
    ).toBeLessThan(0)
    expect(
      resolveFlightDirection(FORWARD, 0, NEUTRAL - 0.4, PITCH).y,
    ).toBeGreaterThan(0)
  })

  it('voltar (S) faz o contrário da frente', () => {
    const ahead = resolveFlightDirection(FORWARD, 0.3, NEUTRAL + 0.5, PITCH)
    const back = resolveFlightDirection(
      { x: 0, z: 1 },
      0.3,
      NEUTRAL + 0.5,
      PITCH,
    )
    expect(back.x).toBeCloseTo(-ahead.x)
    expect(back.y).toBeCloseTo(-ahead.y)
    expect(back.z).toBeCloseTo(-ahead.z)
  })

  it('os lados ficam na horizontal, mesmo com a câmera inclinada', () => {
    expect(
      resolveFlightDirection({ x: 1, z: 0 }, 0, NEUTRAL + 0.8, PITCH).y,
    ).toBe(0)
  })

  it('com a câmera fora da altura, olhar pra cima ou pra baixo não sobe nem desce', () => {
    const off = { pitchControl: false }
    for (const pitch of [NEUTRAL - 0.6, NEUTRAL, NEUTRAL + 0.6]) {
      const dir = resolveFlightDirection(FORWARD, 0.4, pitch, off)
      expect(dir.y).toBe(0)
      expect(Math.hypot(dir.x, dir.z)).toBeCloseTo(1)
    }
    expect(
      resolveFlightDirection(FORWARD, 0, NEUTRAL + 0.6, { ...off, vertical: 1 })
        .y,
    ).toBeGreaterThan(0)
  })

  it('o vetor nunca passa de comprimento 1', () => {
    const dir = resolveFlightDirection(
      { x: 1, z: -1 },
      1.2,
      NEUTRAL + 0.6,
      PITCH,
    )
    expect(Math.hypot(dir.x, dir.y, dir.z)).toBeLessThanOrEqual(1 + 1e-9)
  })
})

describe('resolveFlightCeiling', () => {
  it('é a fração de stamina vezes o teto máximo', () => {
    const max = 10
    expect(resolveFlightCeiling({ stamina: 10, maxStamina: 10 })).toBe(
      FLIGHT.MAX_HEIGHT,
    )
    expect(resolveFlightCeiling({ stamina: 5, maxStamina: max })).toBeCloseTo(
      FLIGHT.MAX_HEIGHT / 2,
    )
    expect(resolveFlightCeiling({ stamina: 0, maxStamina: max })).toBe(0)
  })
})

describe('canTakeOff', () => {
  it('só decola com a stamina mínima', () => {
    const maxStamina = 10
    const min = maxStamina * FLIGHT.MIN_TAKEOFF_STAMINA
    expect(canTakeOff({ stamina: min, maxStamina })).toBe(true)
    expect(canTakeOff({ stamina: min - 0.01, maxStamina })).toBe(false)
  })
})

describe('limitFlightVerticalSpeed', () => {
  const delta = 1 / 60

  it('acima do teto, desce na velocidade de descida', () => {
    const vy = limitFlightVerticalSpeed({
      vy: 5,
      feetY: 10,
      groundY: 0,
      ceiling: 4,
      delta,
    })
    expect(vy).toBe(-FLIGHT.CEILING_DESCENT_SPEED)
  })

  it('acima do teto por pouco, desce devagar — mais longe, mais rápido', () => {
    const at = (feetY) =>
      limitFlightVerticalSpeed({ vy: 0, feetY, groundY: 0, ceiling: 4, delta })
    const near = at(4.1)
    const far = at(4.5)
    expect(near).toBeLessThan(0)
    expect(near).toBeGreaterThan(far)
    expect(far).toBeGreaterThanOrEqual(-FLIGHT.CEILING_DESCENT_SPEED)
  })

  it('caindo pelo teto, chega nele sem passar', () => {
    let feetY = 6
    for (let i = 0; i < 600; i++) {
      const vy = limitFlightVerticalSpeed({
        vy: 0,
        feetY,
        groundY: 0,
        ceiling: 4,
        delta,
      })
      feetY += vy * delta
      expect(feetY).toBeGreaterThanOrEqual(4)
    }
    expect(feetY).toBeCloseTo(4, 1)
  })

  it('subindo, freia chegando perto do teto e não passa dele', () => {
    let feetY = 2
    for (let i = 0; i < 600; i++) {
      feetY +=
        limitFlightVerticalSpeed({
          vy: 100,
          feetY,
          groundY: 0,
          ceiling: 4,
          delta,
        }) * delta
      expect(feetY).toBeLessThanOrEqual(4)
    }
    const nearTop = limitFlightVerticalSpeed({
      vy: 100,
      feetY: 3.9,
      groundY: 0,
      ceiling: 4,
      delta,
    })
    expect(nearTop).toBeLessThan(1)
  })

  it('sem stamina (teto zero), chega ao chão em pelo menos TOUCHDOWN_SPEED', () => {
    const vy = limitFlightVerticalSpeed({
      vy: 0,
      feetY: 0.01,
      groundY: 0,
      ceiling: 0,
      delta,
    })
    expect(vy).toBeLessThanOrEqual(-FLIGHT.TOUCHDOWN_SPEED)
    expect(vy).toBeGreaterThanOrEqual(-FLIGHT.CEILING_DESCENT_SPEED)
  })

  it('não desce abaixo do piso (água funda), nem com o teto zerado', () => {
    const floorY = GAME_CONFIG.TERRAIN.WATER_LEVEL
    const vy = limitFlightVerticalSpeed({
      vy: -5,
      feetY: floorY,
      groundY: floorY - 10,
      ceiling: 0,
      floorY,
      delta,
    })
    expect(vy).toBeGreaterThanOrEqual(0)
  })
})

describe('gastarStaminaDeVoo', () => {
  const fresh = () => ({
    stamina: 10,
    maxStamina: 10,
    hp: 10,
    maxHp: 10,
    staminaRegenDelay: 0,
    staminaRegenDelayAfterUse: 1,
  })

  it('voar rápido gasta mais que devagar', () => {
    const slow = fresh()
    const fast = fresh()
    gastarStaminaDeVoo(slow, 5, 1, false)
    expect(gastarStaminaDeVoo(fast, 5, 1, true)).toBe(true)
    expect(fast.stamina).toBeLessThan(slow.stamina)
    expect(slow.stamina).toBeLessThan(10)
  })

  it('segura a regeneração e para em zero', () => {
    const vitals = { ...fresh(), stamina: 0.0001 }
    gastarStaminaDeVoo(vitals, 5, 1, false)
    expect(vitals.stamina).toBe(0)
    expect(vitals.staminaRegenDelay).toBe(vitals.staminaRegenDelayAfterUse)
  })

  it('sem stamina pro rápido, voa devagar', () => {
    const vitals = { ...fresh(), stamina: 0 }
    expect(gastarStaminaDeVoo(vitals, 5, 1, true)).toBe(false)
  })
})

describe('subir e descer (Espaço/C) por cima da câmera', () => {
  const camera = { yaw: 0, pitch: NEUTRAL }
  const still = { x: 0, z: 0 }

  it('Espaço sozinho sobe reto; C sozinho desce reto', () => {
    const up = resolveFlightIntent(still, { ascend: true }, camera)
    expect(up.active).toBe(true)
    expect(up.dir).toEqual({ x: 0, y: 1, z: 0 })
    const down = resolveFlightIntent(still, { descend: true }, camera)
    expect(down.dir.y).toBe(-1)
  })

  it('os dois juntos se anulam', () => {
    const both = resolveFlightIntent(
      still,
      { ascend: true, descend: true },
      camera,
    )
    expect(both.active).toBe(false)
  })

  it('W com Espaço vai pra frente subindo, sem passar de comprimento 1', () => {
    const { dir } = resolveFlightIntent(FORWARD, { ascend: true }, camera)
    expect(dir.y).toBeGreaterThan(0)
    expect(Math.hypot(dir.x, dir.z)).toBeGreaterThan(0)
    expect(Math.hypot(dir.x, dir.y, dir.z)).toBeCloseTo(1)
  })
})

describe('resolveFlightDashDirection', () => {
  const camera = { yaw: 0, pitch: NEUTRAL }

  it('sem intenção, a frente do corpo na horizontal', () => {
    const yaw = 1.1
    expect(resolveFlightDashDirection({ x: 0, z: 0 }, {}, camera, yaw)).toEqual(
      { x: Math.sin(yaw), y: 0, z: Math.cos(yaw) },
    )
  })

  it('com intenção, a direção do voo, unitária', () => {
    const dir = resolveFlightDashDirection(
      { x: 0, z: 0 },
      { ascend: true },
      camera,
      0,
    )
    expect(dir).toEqual({ x: 0, y: 1, z: 0 })
  })
})

describe('approachFlightVelocity', () => {
  const target = { x: 4, y: 0, z: 0 }

  it('vai até a pedida aos poucos, sem passar', () => {
    const vel = { x: 0, y: 0, z: 0 }
    approachFlightVelocity(vel, target, true, 1 / 60)
    expect(vel.x).toBeGreaterThan(0)
    expect(vel.x).toBeLessThan(target.x)
    for (let i = 0; i < 600; i++)
      approachFlightVelocity(vel, target, true, 1 / 60)
    expect(vel.x).toBeCloseTo(target.x)
  })

  it('sem tecla, freia pelo BRAKE; com tecla, pela ACCELERATION', () => {
    const rates = { ACCELERATION: 8, BRAKE: 2 }
    const braking = { x: 4, y: 0, z: 0 }
    const turning = { x: 4, y: 0, z: 0 }
    const stop = { x: 0, y: 0, z: 0 }
    approachFlightVelocity(braking, stop, false, 0.1, rates)
    approachFlightVelocity(turning, stop, true, 0.1, rates)
    expect(turning.x).toBeLessThan(braking.x)
  })

  it('o resultado não depende de quebrar o tempo em passos', () => {
    const one = { x: 0, y: 0, z: 0 }
    const many = { x: 0, y: 0, z: 0 }
    approachFlightVelocity(one, target, true, 0.2)
    for (let i = 0; i < 4; i++) approachFlightVelocity(many, target, true, 0.05)
    expect(many.x).toBeCloseTo(one.x)
  })
})
