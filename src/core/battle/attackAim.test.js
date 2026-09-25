import { afterEach, describe, expect, it } from 'vitest'
import { createWorld } from 'koota'
import { computeAimRay } from '@/core/camera/orbitCamera'
import { disposePhysics } from '@/core/physics/physicsWorld'
import { initTestTerrain, settleTerrain } from '@/test/physicsTerrain'
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
const MELEE = { aim: 'melee', range: 1.4, radius: 0.3 }
const RANGED = { aim: 'ranged', range: 3, radius: 0.4 }
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
  disposePhysics()
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

function direction(world, attack = MELEE) {
  return resolveAttackDirection(world, ATTACKER_POS, -1, SPECIES, attack)
}

// Posição 1.2m à frente, 40° pro lado (dentro do cone de 45°).
function besideAt(y) {
  const side = (40 * Math.PI) / 180
  return { x: Math.sin(side) * 1.2, y, z: Math.cos(side) * 1.2 }
}

describe('resolveAttackDirection — corpo a corpo', () => {
  it('sem alvo, sai reto na horizontal mesmo com a câmera olhando de cima', () => {
    const world = spawnWorld()
    world.spawn(OrbitCamera(LOOKING_DOWN))

    const dir = direction(world)
    const camera = computeAimRay(
      ATTACKER_POS,
      LOOKING_DOWN,
      -1,
      0.5,
      0,
    ).direction
    const horizontalLength = Math.hypot(camera.x, camera.z)

    expect(camera.y).toBeLessThan(0) // premissa: câmera inclinada pra baixo
    expect(dir.y).toBe(0)
    expect(dir.x).toBeCloseTo(camera.x / horizontalLength)
    expect(dir.z).toBeCloseTo(camera.z / horizontalLength)
  })

  it('alvo mais baixo à frente: o golpe continua horizontal (sem mira vertical)', () => {
    const world = spawnWorld()
    spawnTarget(world, { x: 0, y: -0.3, z: 1.2 })

    expect(direction(world)).toEqual(FORWARD)
  })

  it('alvo alto à frente: o golpe continua horizontal', () => {
    const world = spawnWorld()
    spawnTarget(world, { x: 0, y: 1.5, z: 1.5 }, TALL_BODY)

    expect(direction(world)).toEqual(FORWARD)
  })

  it('puxa o giro horizontal pro alvo dentro do cone', () => {
    const world = spawnWorld()
    const target = besideAt(0.45)
    spawnTarget(world, target)

    const dir = direction(world)

    expect(dir.y).toBe(0)
    expect(Math.atan2(dir.x, dir.z)).toBeCloseTo(Math.atan2(target.x, target.z))
  })

  it('ignora alvo fora do cone (atrás)', () => {
    const world = spawnWorld()
    spawnTarget(world, { x: 0, y: 0.45, z: -1 })

    expect(direction(world)).toEqual(FORWARD)
  })

  it('ignora alvo além do alcance horizontal (range + radius + capsuleRadius)', () => {
    const world = spawnWorld()
    spawnTarget(world, { x: 0.5, y: 0.45, z: 2.5 })

    expect(direction(world)).toEqual(FORWARD)
  })

  it('ignora alvo sem HP', () => {
    const world = spawnWorld()
    const target = spawnTarget(world, besideAt(0.45))
    target.set(Vitals, { hp: 0 })

    expect(direction(world)).toEqual(FORWARD)
  })

  it('entre dois alvos, escolhe o mais perto de onde a câmera aponta', () => {
    const world = spawnWorld()
    spawnTarget(world, besideAt(0.45)) // 40° de lado
    spawnTarget(world, { x: 0.1, y: 0.45, z: 1.5 }) // quase na frente

    const dir = direction(world)

    expect(Math.atan2(dir.x, dir.z)).toBeCloseTo(Math.atan2(0.1, 1.5))
  })

  it('não puxa pra um alvo fora do plano de combate (pulando alto)', async () => {
    await initTestTerrain()
    settleTerrain()
    const world = spawnWorld()
    // Pé a 1.5m do chão — acima de MAX_COMBAT_HEIGHT_DIFF (1m).
    const target = spawnTarget(world, besideAt(0.45 + 1.5))
    expect(direction(world)).toEqual(FORWARD)

    // Mesmo alvo de volta ao chão: aí puxa.
    target.set(Position, besideAt(0.45))
    expect(direction(world)).not.toEqual(FORWARD)
  })
})

describe('resolveAttackDirection — à distância', () => {
  it('segue só o giro horizontal da câmera, sem inclinação nem assistência', () => {
    const world = spawnWorld()
    world.spawn(OrbitCamera(LOOKING_DOWN))
    spawnTarget(world, besideAt(0.45))

    const dir = direction(world, RANGED)
    const camera = computeAimRay(
      ATTACKER_POS,
      LOOKING_DOWN,
      -1,
      0.5,
      0,
    ).direction
    const horizontalLength = Math.hypot(camera.x, camera.z)

    expect(dir.y).toBe(0)
    expect(dir.x).toBeCloseTo(camera.x / horizontalLength)
    expect(dir.z).toBeCloseTo(camera.z / horizontalLength)
  })
})
