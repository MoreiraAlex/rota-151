import { describe, it, expect, afterEach } from 'vitest'
import {
  initPhysics,
  disposePhysics,
  stepPhysics,
  getRapier,
  getRapierWorld,
} from './physicsWorld'
import { castRay } from './raycast'
import { TEST_LEVEL } from '../data/testLevel'
import {
  buildGameLevelAtOrigin,
  clearGameLevelChunks,
} from '@/test/gameLevelChunks'

// Collider recém-criado só entra na consideração do castRay depois de pelo
// menos um world.step() — a broad-phase só é construída no step (ver a nota
// no docstring de `castRay`, em raycast.js). No jogo real isso nunca é
// perceptível (o nível estático não se move — a broad-phase "de um tick
// atrás" continua válida); aqui, sem loop nenhum rodando, precisa dar o
// primeiro step manualmente antes de testar qualquer raycast.
function settle() {
  stepPhysics()
}

describe('castRay', () => {
  afterEach(() => {
    disposePhysics()
    clearGameLevelChunks()
  })

  it('sem física inicializada, devolve null em vez de lançar erro', () => {
    const hit = castRay({ x: 0, y: 5, z: 0 }, { x: 0, y: -1, z: 0 }, 10)
    expect(hit).toBeNull()
  })

  it('acerta o chão de cima, com a distância/ponto certos', async () => {
    await initPhysics()
    buildGameLevelAtOrigin()
    settle()

    const hit = castRay({ x: 0, y: 5, z: 0 }, { x: 0, y: -1, z: 0 }, 10)

    expect(hit).not.toBeNull()
    expect(hit.distance).toBeCloseTo(5)
    expect(hit.point.y).toBeCloseTo(0)
  })

  it('sem nada dentro do alcance, devolve null', async () => {
    await initPhysics()
    buildGameLevelAtOrigin()
    settle()

    const hit = castRay({ x: 0, y: 5, z: 0 }, { x: 0, y: -1, z: 0 }, 2)

    expect(hit).toBeNull()
  })

  it('com o chunk da origem carregado, acerta o relevo embaixo', async () => {
    await initPhysics()
    buildGameLevelAtOrigin()
    settle()
    const { terrain } = TEST_LEVEL
    const ground = terrain.heightAt(0, 0)

    const down = castRay(
      { x: 0, y: ground + 50, z: 0 },
      { x: 0, y: -1, z: 0 },
      100,
    )
    expect(down.point.y).toBeCloseTo(ground, 3)
  })

  it('excludeColliderHandle tira um collider específico da consideração', async () => {
    await initPhysics()
    const RAPIER = getRapier()
    const world = getRapierWorld()

    const body = world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(0, 0, 0),
    )
    const collider = world.createCollider(
      RAPIER.ColliderDesc.cuboid(1, 1, 1),
      body,
    )
    settle()

    const origin = { x: 0, y: 5, z: 0 }
    const direction = { x: 0, y: -1, z: 0 }

    expect(castRay(origin, direction, 10)).not.toBeNull()
    expect(
      castRay(origin, direction, 10, {
        excludeColliderHandle: collider.handle,
      }),
    ).toBeNull()
  })
})
