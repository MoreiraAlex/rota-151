import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { disposePhysics, initPhysics, stepPhysics } from './physicsWorld'
import {
  characterClearance,
  createCharacterBody,
  createTerrainChunkCollider,
  debugRenderWithoutTerrain,
  destroyTerrainChunkCollider,
  resolveFreeTurn,
} from './colliders'
import { castRay } from './raycast'
import { GAME_CONFIG } from '../gameConfig'
import { createTerrainSampler } from '../terrain/terrainHeight'
import { chunkHeightAt, generateTerrainChunk } from '../terrain/terrainChunk'
import {
  STANDING_TREE_KINDS,
  solidParams,
  trunkOf,
} from '../vegetation/solidPlacement'

const OFFSET = GAME_CONFIG.PHYSICS.CHARACTER.CONTROLLER_OFFSET
// Bulbasaur: deitada ao longo da frente (+Z local), 1 m de ponta a ponta.
const LYING = { radius: 0.3, halfHeight: 0.2, axis: 'z' }
// Charmander: em pé.
const STANDING = { radius: 0.25, halfHeight: 0.09, axis: 'y' }

describe('resolveFreeTurn — girar sem enfiar a cápsula noutro personagem', () => {
  beforeEach(async () => {
    await initPhysics()
  })
  afterEach(() => {
    disposePhysics()
  })

  // Eu olhando pra +Z; o vizinho de lado (+X), encostado na lateral
  // (0.3 + 0.25 + folga). Virar 90° pra ele enfia a ponta (0.5 m) nele.
  function setup(me = LYING, gap = OFFSET + 0.01, where = 'side') {
    const at = { x: 0, y: 1, z: 0 }
    const mine = createCharacterBody(at, me)
    // de lado (+X), encostado na lateral; ou na frente (+Z), na ponta
    const reach = where === 'side' ? me.radius : me.radius + me.halfHeight
    const distance = reach + STANDING.radius + gap
    createCharacterBody(
      where === 'side'
        ? { x: distance, y: 1, z: 0 }
        : { x: 0, y: 1, z: distance },
      STANDING,
    )
    // as consultas só enxergam colliders novos depois de um passo
    stepPhysics()
    return { at, handle: mine.colliderHandle, me }
  }

  it('o giro que enfiaria a ponta no vizinho é cortado no ponto em que ainda cabe', () => {
    const { at, handle } = setup()

    const yaw = resolveFreeTurn(handle, at, 0, Math.PI / 2, 'z')

    expect(yaw).toBeGreaterThan(0)
    expect(yaw).toBeLessThan(Math.PI / 2)
    expect(
      characterClearance(handle, at, yaw, 'z', OFFSET),
    ).toBeGreaterThanOrEqual(OFFSET - 1e-3)
  })

  it('com o vizinho na frente, virar de lado é livre (a ponta sai de perto)', () => {
    const { at, handle } = setup(LYING, OFFSET + 0.01, 'front')
    expect(resolveFreeTurn(handle, at, 0, Math.PI / 2, 'z')).toBe(Math.PI / 2)
  })

  it('meia-volta é livre: a cápsula termina igual (ela é simétrica)', () => {
    const { at, handle } = setup()
    expect(resolveFreeTurn(handle, at, 0, Math.PI, 'z')).toBe(Math.PI)
  })

  it('sem ninguém perto, gira tudo', () => {
    const { at, handle } = setup(LYING, 2)
    expect(resolveFreeTurn(handle, at, 0, Math.PI / 2, 'z')).toBe(Math.PI / 2)
  })

  it('cápsula em pé gira sempre (é igual de qualquer lado)', () => {
    const { at, handle } = setup(STANDING)
    expect(resolveFreeTurn(handle, at, 0, Math.PI / 2, 'y')).toBe(Math.PI / 2)
  })

  it('já sobreposto, pode girar pra sair, nunca pra entrar mais', () => {
    const { at, handle } = setup()
    // começa já virado 60° pra dentro do vizinho (sobreposto)
    const inside = Math.PI / 3
    expect(characterClearance(handle, at, inside, 'z', OFFSET)).toBeLessThan(0)

    expect(resolveFreeTurn(handle, at, inside, 0, 'z')).toBe(0)
    const deeper = resolveFreeTurn(handle, at, inside, Math.PI / 2, 'z')
    expect(deeper).toBeCloseTo(inside, 2)
  })
})

describe('createTerrainChunkCollider — o colisor bate com o relevo do chunk', () => {
  beforeEach(async () => {
    await initPhysics()
  })
  afterEach(() => {
    disposePhysics()
  })

  const DOWN = { x: 0, y: -1, z: 0 }
  const RAY_START = 100

  function groundByRay(x, z) {
    const hit = castRay({ x, y: RAY_START, z }, DOWN, RAY_START * 2)
    return hit ? RAY_START - hit.distance : null
  }

  it('o raio para baixo acerta na altura de chunkHeightAt, em qualquer ponto', () => {
    const chunk = generateTerrainChunk(createTerrainSampler(5), 1, -1)
    createTerrainChunkCollider(chunk)
    stepPhysics()

    const step = chunk.size / chunk.resolution
    // Pontos fora da grade de vértices (os dois triângulos de cada célula).
    for (const [fx, fz] of [
      [0.13, 0.21],
      [0.77, 0.64],
      [0.5, 0.05],
      [0.31, 0.92],
      [0.95, 0.4],
    ]) {
      const x = chunk.minX + fx * chunk.size + step * 0.37
      const z = chunk.minZ + fz * chunk.size + step * 0.71
      expect(groundByRay(x, z)).toBeCloseTo(chunkHeightAt(chunk, x, z), 3)
    }
  })

  it('destroyTerrainChunkCollider tira o chão', () => {
    const chunk = generateTerrainChunk(createTerrainSampler(5), 0, 0)
    const handle = createTerrainChunkCollider(chunk)
    stepPhysics()
    expect(groundByRay(0, 0)).not.toBeNull()

    destroyTerrainChunkCollider(handle)
    stepPhysics()
    expect(groundByRay(0, 0)).toBeNull()
  })

  // docs/features/049-vegetacao-e-floresta.md
  it('árvore, pedra e tronco caído bloqueiam e saem junto com o chunk', () => {
    // Chão plano: o raio de lado só pode acertar os objetos.
    const chunk = generateTerrainChunk(createTerrainSampler(5), 0, 0)
    chunk.heights.fill(0)
    const at = (fx, fz) => {
      const x = chunk.minX + chunk.size * fx
      const z = chunk.minZ + chunk.size * fz
      return { x, y: chunkHeightAt(chunk, x, z), z, yaw: 0, variant: 0 }
    }
    // Uma árvore de cada espécie, cada uma com o tronco dela.
    const trees = STANDING_TREE_KINDS.map((kind, index) => ({
      ...at(0.15 + index * 0.1, 0.6),
      kind,
      scale: 1,
    }))
    const rock = { ...at(0.7, 0.3), scale: 0.5 }
    // Deitado ao longo do X (giro 0): o raio de lado (em Z) acerta.
    const log = { ...at(0.5, 0.8), scale: 4 }
    chunk.solids = { trees, rocks: [rock], logs: [log], footprints: [] }
    const handle = createTerrainChunkCollider(chunk)
    stepPhysics()

    const reach = 10
    const fromSide =
      ({ x, y, z }, height) =>
      () =>
        castRay({ x, y: y + height, z: z - reach }, { x: 0, y: 0, z: 1 }, reach)
    const probes = [
      ...trees.map((tree) => [
        fromSide(tree, 1),
        trunkOf(tree, solidParams()).radius,
      ]),
      [fromSide(rock, 0.3), GAME_CONFIG.ROCKS.RADIUS * rock.scale],
      [fromSide(log, GAME_CONFIG.LOGS.RADIUS * 0.7), GAME_CONFIG.LOGS.RADIUS],
    ]
    for (const [probe, radius] of probes) {
      const hit = probe()
      expect(hit).not.toBeNull()
      expect(hit.distance).toBeCloseTo(reach - radius, 1)
    }

    destroyTerrainChunkCollider(handle)
    stepPhysics()
    for (const [probe] of probes) expect(probe()).toBeNull()
  })
})

describe('debugRenderWithoutTerrain', () => {
  afterEach(() => disposePhysics())

  it('sem física, devolve null', () => {
    expect(debugRenderWithoutTerrain()).toBeNull()
  })

  it('deixa o relevo de fora e mantém os outros colliders', async () => {
    await initPhysics()
    const chunk = generateTerrainChunk(createTerrainSampler(5), 0, 0)
    createTerrainChunkCollider(chunk)
    const onlyTerrain = debugRenderWithoutTerrain()
    expect(onlyTerrain.vertices.length).toBe(0)

    createCharacterBody({ x: 0, y: 30, z: 0 }, { radius: 0.3, halfHeight: 0.5 })
    expect(debugRenderWithoutTerrain().vertices.length).toBeGreaterThan(0)
  })
})
