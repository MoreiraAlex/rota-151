import { describe, expect, it, vi } from 'vitest'
import { createFollowEffectManager } from './followEffectManager'

function fakeSystem() {
  const system = {
    group: { id: Math.random() },
    frames: [],
    cameras: [],
    updates: 0,
    ended: false,
    disposed: false,
    live: 0,
    setFrame(frame) {
      this.frames.push(frame)
    },
    setCameraPosition(position) {
      this.cameras.push(position)
    },
    endEmission() {
      this.ended = true
    },
    get emissionEnded() {
      return this.ended
    },
    update() {
      this.updates += 1
    },
    isDone() {
      return this.live === 0
    },
    dispose() {
      this.disposed = true
    },
  }
  return system
}

function setup() {
  const created = []
  const root = { add: vi.fn(), remove: vi.fn() }
  const manager = createFollowEffectManager({
    root,
    createSystem: () => {
      const system = fakeSystem()
      created.push(system)
      return system
    },
  })
  return { manager, root, created }
}

const entityA = { name: 'a' }
const entityB = { name: 'b' }
const dasher = (key, active, x = 0) => ({
  key,
  active,
  origin: [x, 0, 0],
  yaw: 0,
  height: 0.8,
})
const CAMERA = { x: 0, y: 5, z: 5 }

describe('createFollowEffectManager', () => {
  it('createSystem recebe o seguidor que fez o efeito nascer', () => {
    const received = []
    const manager = createFollowEffectManager({
      root: { add: vi.fn(), remove: vi.fn() },
      createSystem: (follower) => {
        received.push(follower)
        return fakeSystem()
      },
    })

    manager.update([dasher(entityA, true, 3)], 1 / 60, CAMERA)

    expect(received).toHaveLength(1)
    expect(received[0].key).toBe(entityA)
    expect(received[0].origin[0]).toBe(3)
  })

  it('quem não está dando dash não ganha efeito', () => {
    const { manager, created } = setup()

    manager.update([dasher(entityA, false)], 1 / 60, CAMERA)

    expect(created).toHaveLength(0)
    expect(manager.activeCount).toBe(0)
  })

  it('o dash começa: cria UM sistema, pendura na raiz e o acompanha a cada frame', () => {
    const { manager, root, created } = setup()

    manager.update([dasher(entityA, true, 0)], 1 / 60, CAMERA)
    manager.update([dasher(entityA, true, 2)], 1 / 60, CAMERA)

    expect(created).toHaveLength(1)
    expect(root.add).toHaveBeenCalledTimes(1)
    expect(created[0].frames.map((f) => f.origin[0])).toEqual([0, 2])
    expect(created[0].cameras.at(-1)).toBe(CAMERA)
    expect(created[0].updates).toBe(2)
  })

  it('o dash acabou: para de emitir, e o sistema só é descartado quando as partículas morrem', () => {
    const { manager, root, created } = setup()
    manager.update([dasher(entityA, true)], 1 / 60, CAMERA)
    created[0].live = 5

    manager.update([dasher(entityA, false)], 1 / 60, CAMERA)
    expect(created[0].ended).toBe(true)
    expect(created[0].disposed).toBe(false) // ainda tem partícula viva
    expect(manager.activeCount).toBe(1)

    created[0].live = 0
    manager.update([dasher(entityA, false)], 1 / 60, CAMERA)
    expect(created[0].disposed).toBe(true)
    expect(root.remove).toHaveBeenCalledTimes(1)
    expect(manager.activeCount).toBe(0)
  })

  it('um dash novo logo depois ganha um sistema novo; o antigo termina ao lado', () => {
    const { manager, created } = setup()
    manager.update([dasher(entityA, true)], 1 / 60, CAMERA)
    created[0].live = 3
    manager.update([dasher(entityA, false)], 1 / 60, CAMERA)

    manager.update([dasher(entityA, true)], 1 / 60, CAMERA)

    expect(created).toHaveLength(2)
    expect(created[0].ended).toBe(true)
    expect(created[1].ended).toBe(false)
    expect(manager.activeCount).toBe(2)
  })

  it('duas criaturas dando dash têm um efeito cada, independentes', () => {
    const { manager, created } = setup()

    manager.update(
      [dasher(entityA, true, 1), dasher(entityB, true, 9)],
      1 / 60,
      CAMERA,
    )

    expect(created).toHaveLength(2)
    expect(created[0].frames[0].origin[0]).toBe(1)
    expect(created[1].frames[0].origin[0]).toBe(9)

    manager.update(
      [dasher(entityA, false), dasher(entityB, true, 10)],
      1 / 60,
      CAMERA,
    )
    expect(created[0].ended).toBe(true)
    expect(created[1].ended).toBe(false)
  })

  it('criatura que some no meio do dash (recolhida/destruída) encerra o efeito', () => {
    const { manager, created } = setup()
    manager.update([dasher(entityA, true)], 1 / 60, CAMERA)

    manager.update([], 1 / 60, CAMERA)

    expect(created[0].ended).toBe(true)
  })

  it('dispose descarta tudo', () => {
    const { manager, root, created } = setup()
    manager.update(
      [dasher(entityA, true), dasher(entityB, true)],
      1 / 60,
      CAMERA,
    )

    manager.dispose()

    expect(created.every((system) => system.disposed)).toBe(true)
    expect(root.remove).toHaveBeenCalledTimes(2)
    expect(manager.activeCount).toBe(0)
  })
})

describe('createFollowEffectManager — comprimento no quadro', () => {
  it('o `length` do seguidor vai pro quadro (o feixe que segue a mira)', () => {
    const frames = []
    const manager = createFollowEffectManager({
      root: { add: () => {}, remove: () => {} },
      createSystem: () => ({
        group: {},
        setFrame: (frame) => frames.push(frame),
        setCameraPosition: () => {},
        update: () => {},
        isDone: () => false,
        emissionEnded: false,
        endEmission: () => {},
        dispose: () => {},
      }),
    })
    manager.update(
      [
        {
          key: 'a',
          active: true,
          origin: [0, 0, 0],
          yaw: 0,
          height: 0,
          length: 2.5,
        },
      ],
      1 / 60,
      { x: 0, y: 0, z: 0 },
    )
    expect(frames[0].length).toBe(2.5)
  })
})
