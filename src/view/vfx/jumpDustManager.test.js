import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { createJumpDustManager } from './jumpDustManager'

function setup() {
  const root = new THREE.Group()
  const spawned = []
  const manager = createJumpDustManager({
    root,
    minSpeed: 2,
    maxSpeed: 10,
    createSystem: ({ kind, strength }) => {
      const system = {
        kind,
        strength,
        group: new THREE.Group(),
        age: 0,
        disposed: false,
        update(delta) {
          this.age += delta
        },
        isDone() {
          return this.age >= 0.5
        },
        dispose() {
          this.disposed = true
        },
      }
      spawned.push(system)
      return system
    },
  })
  return { root, spawned, manager }
}

const entity = {}
const creature = (grounded, vy, position = [1, 0, 2]) => [
  { entity, grounded, vy, position },
]

describe('jumpDustManager', () => {
  it('criatura vista pela primeira vez só registra o estado (nada de poeira)', () => {
    const { manager, spawned } = setup()
    manager.update(creature(false, -9), 0.016)
    expect(spawned).toHaveLength(0)
  })

  it('decolagem de um pulo (sai do chão subindo) solta poeira nos pés', () => {
    const { manager, spawned, root } = setup()
    manager.update(creature(true, 0), 0.016)
    manager.update(creature(false, 8, [3, 0.5, -1]), 0.016)

    expect(spawned).toHaveLength(1)
    expect(spawned[0].kind).toBe('takeoff')
    expect(spawned[0].group.position.toArray()).toEqual([3, 0.5, -1])
    expect(root.children).toContain(spawned[0].group)
  })

  it('sair de uma borda caindo (vy <= 0) não solta poeira de decolagem', () => {
    const { manager, spawned } = setup()
    manager.update(creature(true, 0), 0.016)
    manager.update(creature(false, -0.5), 0.016)
    expect(spawned).toHaveLength(0)
  })

  it('aterrissagem de QUALQUER queda solta poeira, mais forte quanto mais rápida', () => {
    const slow = setup()
    slow.manager.update(creature(true, 0), 0.016)
    slow.manager.update(creature(false, -6), 0.016) // caiu da borda
    slow.manager.update(creature(true, 0), 0.016)
    const fast = setup()
    fast.manager.update(creature(true, 0), 0.016)
    fast.manager.update(creature(false, -10), 0.016)
    fast.manager.update(creature(true, 0), 0.016)

    expect(slow.spawned).toHaveLength(1)
    expect(slow.spawned[0].kind).toBe('landing')
    expect(slow.spawned[0].strength).toBeCloseTo(0.5)
    expect(fast.spawned[0].strength).toBe(1)
  })

  it('queda abaixo da velocidade mínima (degrau, rampa) não solta nada', () => {
    const { manager, spawned } = setup()
    manager.update(creature(true, 0), 0.016)
    manager.update(creature(false, -1), 0.016)
    manager.update(creature(true, 0), 0.016)
    expect(spawned).toHaveLength(0)
  })

  it('pulo completo: poeira na decolagem E na aterrissagem', () => {
    const { manager, spawned } = setup()
    manager.update(creature(true, 0), 0.016)
    manager.update(creature(false, 9), 0.016)
    manager.update(creature(false, 0), 0.016)
    manager.update(creature(false, -7), 0.016)
    manager.update(creature(true, 0), 0.016)
    expect(spawned.map((s) => s.kind)).toEqual(['takeoff', 'landing'])
  })

  it('descarta o sistema quando as partículas acabam', () => {
    const { manager, spawned, root } = setup()
    manager.update(creature(true, 0), 0.016)
    manager.update(creature(false, 8), 0.016)
    expect(manager.activeCount).toBe(1)

    manager.update([], 1)

    expect(manager.activeCount).toBe(0)
    expect(spawned[0].disposed).toBe(true)
    expect(root.children).toHaveLength(0)
  })
})
