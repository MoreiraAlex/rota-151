import { afterEach, describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { createWorld } from 'koota'
import { attackResolved } from '@/core/events'
import { GAME_CONFIG } from '@/core/gameConfig'
import { CharacterController, Position } from '@/core/traits'
import { damageNumberPool } from '../vfx/damageNumberPool'
import { damageNumberSystem, formatDamage } from './damageNumberSystem'

const { LIFETIME, CRIT_LIFETIME, HEAD_MARGIN, SPREAD } =
  GAME_CONFIG.FEEDBACK.DAMAGE_NUMBER
const BODY = { capsuleRadius: 0.3, capsuleHalfHeight: 0.15, capsuleAxis: 'y' }

const worlds = []
function spawnTarget(position) {
  const world = createWorld()
  worlds.push(world)
  return world.spawn(Position(position), CharacterController(BODY))
}

// Câmera parada olhando pra -Z: a "direita" dela é +X.
const camera = new THREE.PerspectiveCamera()
camera.updateMatrixWorld()

function hit(target, damage, critical = false) {
  return attackResolved({
    attacker: 'atacante',
    target,
    attackId: 'scratch',
    slot: 'primary',
    origin: { x: 0, y: 0, z: 0 },
    impactPoint: { x: 0, y: 0, z: 1 },
    contactPoint: { x: 0, y: 0, z: 0.8 },
    damage,
    critical,
  })
}

function run(frameEvents, delta = 0) {
  damageNumberSystem({ delta, frameEvents, camera })
}

const activeSlots = () => damageNumberPool.slots.filter((slot) => slot.active)

afterEach(() => {
  run([], 1000) // apaga tudo do pool compartilhado
  while (worlds.length) worlds.pop().destroy()
})

describe('damageNumberSystem', () => {
  it('acerto cria um número acima da cabeça do alvo, com o dano arredondado', () => {
    const target = spawnTarget({ x: 2, y: 0.45, z: -1 })

    run([hit(target, 7.6)])

    const [slot] = activeSlots()
    expect(slot.text).toBe('8')
    expect(slot.critical).toBe(false)
    expect(slot.lifetime).toBeCloseTo(LIFETIME)
    // topo da cápsula (0.45 + 0.3 + 0.15) + folga
    expect(slot.y).toBeCloseTo(0.9 + HEAD_MARGIN)
  })

  it('crítico fica marcado e dura mais', () => {
    const target = spawnTarget({ x: 0, y: 0.45, z: 0 })

    run([hit(target, 20, true)])

    const [slot] = activeSlots()
    expect(slot.critical).toBe(true)
    expect(slot.lifetime).toBeCloseTo(CRIT_LIFETIME)
  })

  it('miss não cria número', () => {
    const miss = attackResolved({
      attacker: 'atacante',
      attackId: 'scratch',
      slot: 'primary',
      origin: { x: 0, y: 0, z: 0 },
      impactPoint: { x: 0, y: 0, z: 1 },
    })

    run([miss])

    expect(activeSlots()).toHaveLength(0)
  })

  it('golpes seguidos no mesmo alvo se afastam de lado (direita da câmera), não empilham', () => {
    const target = spawnTarget({ x: 0, y: 0.45, z: 0 })

    run([hit(target, 5), hit(target, 5), hit(target, 5)])

    const xs = activeSlots()
      .map((slot) => slot.x)
      .sort((a, b) => a - b)
    expect(xs).toHaveLength(3)
    expect(xs[0]).toBeCloseTo(-SPREAD)
    expect(xs[1]).toBeCloseTo(0)
    expect(xs[2]).toBeCloseTo(SPREAD)
  })

  it('o número some ao fim da vida', () => {
    const target = spawnTarget({ x: 0, y: 0.45, z: 0 })
    run([hit(target, 5)])

    run([], LIFETIME + 0.01)

    expect(activeSlots()).toHaveLength(0)
  })
})

describe('formatDamage', () => {
  it('inteiro arredondado, nunca menos que 1', () => {
    expect(formatDamage(7.4)).toBe('7')
    expect(formatDamage(7.5)).toBe('8')
    expect(formatDamage(0.2)).toBe('1')
  })
})
