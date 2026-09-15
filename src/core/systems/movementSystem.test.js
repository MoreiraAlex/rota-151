import { describe, it, expect } from 'vitest'
import { makeWorld } from '@/test/makeWorld'
import { getSpecies } from '@/core/data/species'
import { GAME_CONFIG } from '@/core/gameConfig'
import {
  Position,
  Rotation,
  Velocity,
  InputState,
  Vitals,
  OrbitCamera,
} from '@/core/traits'
import { movementSystem } from './movementSystem'

const { walkSpeed: WALK_SPEED, runSpeed: RUN_SPEED } =
  getSpecies('fox').movement
const { RUN_STAMINA_DRAIN_PER_SECOND } = GAME_CONFIG.VITALS

function setup(yaw = 0, delta = 1 / 60) {
  const { world, player, camera } = makeWorld()
  camera.set(OrbitCamera, { yaw })
  const tick = (intent) => {
    player.set(InputState, intent)
    movementSystem({ world, delta, input: {} })
  }
  return { player, tick }
}

describe('movementSystem', () => {
  it('com yaw = 0, "frente" (z = -1) vira velocidade -z', () => {
    const { player, tick } = setup(0)
    tick({ x: 0, z: -1 })
    const vel = player.get(Velocity)
    expect(vel.z).toBeCloseTo(-WALK_SPEED)
    expect(vel.x).toBeCloseTo(0)
  })

  it('com yaw = 0, "direita" (x = 1) vira velocidade +x — sem inversão', () => {
    const { player, tick } = setup(0)
    tick({ x: 1, z: 0 })
    const vel = player.get(Velocity)
    expect(vel.x).toBeCloseTo(WALK_SPEED)
    expect(vel.z).toBeCloseTo(0)
  })

  it('com yaw = π/2, "frente" é relativo à câmera (vira -x)', () => {
    const { player, tick } = setup(Math.PI / 2)
    tick({ x: 0, z: -1 })
    const vel = player.get(Velocity)
    expect(vel.x).toBeCloseTo(-WALK_SPEED)
    expect(vel.z).toBeCloseTo(0)
  })

  it('com run = true, usa RUN_SPEED em vez de WALK_SPEED', () => {
    const { player, tick } = setup(0)
    tick({ x: 0, z: -1, run: true })
    expect(player.get(Velocity).z).toBeCloseTo(-RUN_SPEED)
  })

  it('correr drena stamina proporcionalmente ao delta, só enquanto em movimento', () => {
    const { player, tick } = setup(0, 1)
    tick({ x: 0, z: -1, run: true })
    expect(player.get(Vitals).stamina).toBeCloseTo(
      100 - RUN_STAMINA_DRAIN_PER_SECOND,
    )
  })

  it('segurar corrida parado (sem intenção de movimento) não drena stamina', () => {
    const { player, tick } = setup(0, 1)
    tick({ x: 0, z: 0, run: true })
    expect(player.get(Vitals).stamina).toBe(100)
  })

  it('sem stamina, corrida cai pra WALK_SPEED em vez de travar', () => {
    const { player, tick } = setup(0)
    player.set(Vitals, { stamina: 0 })
    tick({ x: 0, z: -1, run: true })
    expect(player.get(Velocity).z).toBeCloseTo(-WALK_SPEED)
    expect(player.get(Vitals).stamina).toBe(0) // não fica negativa
  })

  it('correr até quase zerar não deixa continuar correndo com sobra insuficiente pro próximo tick', () => {
    // Regressão: exigir só `stamina > 0` permitia continuar correndo com uma
    // sobra menor que o custo do próprio tick (ex.: regenerada entre ticks),
    // nunca de fato "cansando" o jogador. O gate precisa ser >= custo do
    // tick, igual dash/pulo já exigem >= custo da ação.
    const { player, tick } = setup(0, 1)
    player.set(Vitals, { stamina: RUN_STAMINA_DRAIN_PER_SECOND - 0.01 })
    tick({ x: 0, z: -1, run: true })
    expect(player.get(Velocity).z).toBeCloseTo(-WALK_SPEED)
    expect(player.get(Vitals).stamina).toBeCloseTo(
      RUN_STAMINA_DRAIN_PER_SECOND - 0.01,
    ) // não drenou — a ação não "meio aconteceu"
  })

  it('lê GAME_CONFIG.VITALS a cada tick — mudar em tempo real (ex.: menu de configurações) já vale no próximo tick', () => {
    const { player, tick } = setup(0, 1)
    const original = GAME_CONFIG.VITALS.RUN_STAMINA_DRAIN_PER_SECOND
    GAME_CONFIG.VITALS.RUN_STAMINA_DRAIN_PER_SECOND = original * 2

    try {
      tick({ x: 0, z: -1, run: true })
      expect(player.get(Vitals).stamina).toBeCloseTo(100 - original * 2)
    } finally {
      GAME_CONFIG.VITALS.RUN_STAMINA_DRAIN_PER_SECOND = original
    }
  })

  it('correr reseta o delay de regeneração de stamina', () => {
    const { player, tick } = setup(0, 1)
    tick({ x: 0, z: -1, run: true })
    expect(player.get(Vitals).staminaRegenDelay).toBeCloseTo(
      GAME_CONFIG.VITALS.STAMINA_REGEN_DELAY_AFTER_USE,
    )
  })

  it('gira Rotation.y em direção ao movimento', () => {
    const { player, tick } = setup(0)
    for (let i = 0; i < 120; i++) tick({ x: 1, z: 0 })
    // movendo em +x, facing = atan2(1, 0) = π/2
    expect(player.get(Rotation).y).toBeCloseTo(Math.PI / 2, 1)
  })

  it('não escreve em Position (quem move é a física)', () => {
    const { player, tick } = setup(0)
    const before = { ...player.get(Position) }
    for (let i = 0; i < 60; i++) tick({ x: 1, z: 1 })
    expect(player.get(Position)).toMatchObject(before)
  })
})
