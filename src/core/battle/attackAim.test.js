import { afterEach, describe, expect, it } from 'vitest'
import { createWorld } from 'koota'
import { computeAimRay } from '@/core/camera/orbitCamera'
import {
  CharacterController,
  OrbitCamera,
  Position,
  Rotation,
  Vitals,
  WildCreature,
} from '@/core/traits'
import { resolveAttackDirection } from './attackAim'

const SMALL_BODY = {
  capsuleRadius: 0.3,
  capsuleHalfHeight: 0.15,
  capsuleAxis: 'y',
}
const TALL_BODY = { capsuleRadius: 0.5, capsuleHalfHeight: 1, capsuleAxis: 'y' }
const SPECIES = {
  camera: { targetHeight: 0.5, shoulderOffset: 0 },
  body: SMALL_BODY,
}
// Atacante em pé no chão (y=0): centro da cápsula a 0.45m.
const ATTACKER_POS = { x: 0, y: 0.45, z: 0 }
const FORWARD = { x: 0, y: 0, z: 1 }
// Câmera acima da criatura olhando pra baixo — a situação normal de jogo.
const LOOKING_DOWN = { yaw: 0, pitch: 0.35, distance: 10 }

const worlds = []
function spawnWorld() {
  const world = createWorld()
  worlds.push(world)
  return world
}

afterEach(() => {
  while (worlds.length) worlds.pop().destroy()
})

function spawnTarget(world, position, body = SMALL_BODY) {
  return world.spawn(
    Position(position),
    Rotation,
    CharacterController(body),
    Vitals,
    WildCreature({ speciesId: 'charmander' }),
  )
}

function direction(world) {
  return resolveAttackDirection(world, ATTACKER_POS, -1, SPECIES)
}

function cameraHorizontal() {
  const camera = computeAimRay(ATTACKER_POS, LOOKING_DOWN, -1, 0.5, 0).direction
  const length = Math.hypot(camera.x, camera.z)
  return { camera, x: camera.x / length, z: camera.z / length }
}

describe('resolveAttackDirection — o giro da câmera, sempre na horizontal', () => {
  it('sai reto na horizontal mesmo com a câmera olhando de cima', () => {
    const world = spawnWorld()
    world.spawn(OrbitCamera(LOOKING_DOWN))

    const dir = direction(world)
    const { camera, x, z } = cameraHorizontal()

    expect(camera.y).toBeLessThan(0) // premissa: câmera inclinada pra baixo
    expect(dir.y).toBe(0)
    expect(dir.x).toBeCloseTo(x)
    expect(dir.z).toBeCloseTo(z)
  })

  it('alvo mais baixo ou mais alto à frente: continua horizontal (sem mira vertical)', () => {
    const world = spawnWorld()
    spawnTarget(world, { x: 0, y: -0.3, z: 1.2 })
    spawnTarget(world, { x: 0, y: 1.5, z: 1.5 }, TALL_BODY)

    expect(direction(world)).toEqual(FORWARD)
  })

  it('sem assistência de mira: um alvo de lado não puxa o golpe', () => {
    const world = spawnWorld()
    world.spawn(OrbitCamera(LOOKING_DOWN))
    const side = (40 * Math.PI) / 180
    spawnTarget(world, {
      x: Math.sin(side) * 1.2,
      y: 0.45,
      z: Math.cos(side) * 1.2,
    })

    const dir = direction(world)
    const { x, z } = cameraHorizontal()

    expect(dir.x).toBeCloseTo(x)
    expect(dir.z).toBeCloseTo(z)
  })
})
