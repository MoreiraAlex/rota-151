import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { makeWorld } from '@/test/makeWorld'
import { spawnWild } from '@/test/spawnWild'
import { GAME_CONFIG } from '@/core/gameConfig'
import { listItems } from '@/core/data/items'
import { comecarAComer } from '@/core/actions/eating'
import {
  CaptureAim,
  CaptureAimStatus,
  CaptureAimTarget,
  HeldItem,
  InputControlled,
  OrbitCamera,
  Position,
  Vitals,
} from '@/core/traits'
import { traceCaptureFlight } from '@/core/battle/captureFlight'
import { captureAimSystem } from './captureAimSystem'

const POKEBALL = listItems().find((item) => item.category === 'pokeball').id
const BERRY = listItems().find((item) => item.category === 'berry')

let world
let player
let camera
const worlds = []
beforeEach(() => {
  ;({ world, player, camera } = makeWorld({
    playerPosition: { x: 0, y: 0, z: 0 },
  }))
  worlds.push(world)
  // Câmera atrás do treinador, olhando pra +Z, quase na horizontal.
  camera.set(OrbitCamera, { yaw: Math.PI, pitch: 0.05 })
  player.set(HeldItem, { itemId: POKEBALL })
})
afterEach(() => {
  while (worlds.length) worlds.pop().destroy()
})

function tick(input = { secondaryHeld: true }) {
  captureAimSystem({ world, delta: 1 / 60, input })
}

describe('captureAimSystem', () => {
  it('com a Pokébola na mão e o botão direito segurado, mira', () => {
    tick()
    expect(player.get(CaptureAim).active).toBe(true)
    expect(player.get(CaptureAimStatus).active).toBe(true)
    const { velocity } = player.get(CaptureAim)
    expect(Math.hypot(velocity.x, velocity.y, velocity.z)).toBeCloseTo(
      GAME_CONFIG.CAPTURE.THROW_SPEED,
    )
  })

  it('sem segurar o botão, sem Pokébola, sem o controle ou comendo, não mira', () => {
    tick({})
    expect(player.get(CaptureAim).active).toBe(false)

    player.set(HeldItem, { itemId: null })
    tick()
    expect(player.get(CaptureAim).active).toBe(false)

    player.set(HeldItem, { itemId: POKEBALL })
    player.remove(InputControlled)
    tick()
    expect(player.get(CaptureAim).active).toBe(false)

    player.add(InputControlled)
    player.set(Vitals, { hp: 1 })
    expect(comecarAComer(player, BERRY)).toBe(true)
    tick()
    expect(player.get(CaptureAim).active).toBe(false)
  })

  it('a previsão encontra o selvagem que a bola pegaria e marca o alvo', () => {
    tick()
    const { origin, velocity } = player.get(CaptureAim)
    // Um selvagem bem no meio do arco previsto.
    const t = 0.4
    const at = {
      x: origin.x + velocity.x * t,
      y: origin.y + velocity.y * t + 0.5 * GAME_CONFIG.CAPTURE.GRAVITY * t * t,
      z: origin.z + velocity.z * t,
    }
    const wild = spawnWild(world, { at })

    tick()

    expect(player.targetFor(CaptureAimTarget)).toBe(wild)
    expect(player.get(CaptureAimStatus).onWild).toBe(true)
    expect(player.get(CaptureAim).landed).toBe(true)
  })

  it('soltar o botão desliga a mira e tira o alvo', () => {
    tick()
    tick({})
    expect(player.get(CaptureAimStatus)).toMatchObject({
      active: false,
      onWild: false,
    })
    expect(player.targetFor(CaptureAimTarget)).toBeFalsy()
  })
})

describe('traceCaptureFlight', () => {
  it('sem nada no caminho, voa até o tempo máximo e não bate', () => {
    const flight = traceCaptureFlight(
      world,
      { x: 0, y: 1000, z: 0 },
      { x: 0, y: 5, z: 10 },
    )
    expect(flight.landed).toBe(false)
    expect(flight.time).toBeCloseTo(GAME_CONFIG.CAPTURE.MAX_FLIGHT_TIME, 1)
  })

  it('pega o selvagem que está no caminho', () => {
    const wild = spawnWild(world, { at: { x: 0, y: 1, z: 4 } })
    const flight = traceCaptureFlight(
      world,
      { x: 0, y: 1, z: 0 },
      // Sobe o que a gravidade tira até lá: passa na altura dele.
      { x: 0, y: -0.5 * GAME_CONFIG.CAPTURE.GRAVITY * 0.4, z: 10 },
    )
    expect(flight.wild).toBe(wild)
    expect(flight.landed).toBe(true)
    expect(flight.point.z).toBeLessThan(wild.get(Position).z)
  })
})
