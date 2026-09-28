import { afterEach, describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { createWorld } from 'koota'
import { Fainted } from '@/core/traits'
import {
  registerTailFire,
  unregisterTailFire,
} from '@/view/registry/tailFireRegistry'
import { tailFireSystem } from './tailFireSystem'

// Chama falsa: guarda a `intensity` que o system pediu em cada update.
function fakeFlame() {
  return {
    group: new THREE.Group(),
    intensities: [],
    update(delta, overrides = {}) {
      this.intensities.push(overrides.intensity ?? 1)
    },
    dispose() {},
  }
}

const worlds = []
const registered = []

function spawnWithFire(config = {}) {
  const world = createWorld()
  worlds.push(world)
  const entity = world.spawn()
  const flame = fakeFlame()
  const bone = new THREE.Object3D()
  bone.add(flame.group)
  registerTailFire(entity, flame, bone, config)
  registered.push(entity)
  return { entity, flame }
}

function run(seconds, step = 0.05) {
  for (let t = 0; t < seconds; t += step) tailFireSystem({ delta: step })
}

afterEach(() => {
  while (registered.length) unregisterTailFire(registered.pop())
  while (worlds.length) worlds.pop().destroy()
})

describe('tailFireSystem — desmaio', () => {
  it('controle: acordada, o fogo fica aceso na intensidade da espécie', () => {
    const { flame } = spawnWithFire({ intensity: 0.8 })

    run(1)

    expect(flame.group.visible).toBe(true)
    expect(flame.intensities.at(-1)).toBeCloseTo(0.8)
  })

  it('desmaiada: o fogo vai apagando e some (invisível, sem simular)', () => {
    const { entity, flame } = spawnWithFire()
    entity.add(Fainted)

    tailFireSystem({ delta: 0.1 })
    // Apagando aos poucos, não de uma vez.
    expect(flame.intensities.at(-1)).toBeGreaterThan(0)
    expect(flame.intensities.at(-1)).toBeLessThan(1)

    run(1)
    const updates = flame.intensities.length
    run(1)

    expect(flame.group.visible).toBe(false)
    expect(flame.intensities.length).toBe(updates)
  })

  it('acordou: reacende até a intensidade cheia', () => {
    const { entity, flame } = spawnWithFire()
    entity.add(Fainted)
    run(1)

    entity.remove(Fainted)
    run(1)

    expect(flame.group.visible).toBe(true)
    expect(flame.intensities.at(-1)).toBeCloseTo(1)
  })
})
