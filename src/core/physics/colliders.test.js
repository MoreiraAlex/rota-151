import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  disposePhysics,
  initPhysics,
  stepPhysics,
  getRapierWorld,
} from './physicsWorld'
import {
  characterClearance,
  createCharacterBody,
  createInteriorColliders,
  createTerrainChunkCollider,
  destroyInteriorColliders,
  debugRenderWithoutTerrain,
  destroyTerrainChunkCollider,
  frameBoxesOf,
  resolveFreeTurn,
  ringBoxesOf,
} from './colliders'
import { castRay } from './raycast'
import { GAME_CONFIG } from '../gameConfig'
import { createTerrainSampler } from '../terrain/terrainHeight'
import { chunkHeightAt, generateTerrainChunk } from '../terrain/terrainChunk'
import { listBiomes } from '../data/biomes'
import {
  ROCK_KIND,
  STANDING_TREE_KINDS,
  rockBaseY,
  solidParams,
  trunkOf,
} from '../vegetation/solidPlacement'
import { lgpeColliderOf } from '../vegetation/solidModels'
import { interiorCollidersOf, listInteriors } from '../data/interiors'

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
  it('árvore e pedra bloqueiam e saem junto com o chunk', () => {
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
    chunk.solids = { trees, rocks: [rock], footprints: [] }
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

describe('colisor pelo modelo do LGPE', () => {
  beforeEach(async () => {
    await initPhysics()
  })
  afterEach(() => disposePhysics())

  // Uma árvore e uma pedra de bioma com modelo do LGPE (tirados dos biomas).
  const withModels = (kinds) =>
    listBiomes().flatMap(({ id, vegetation }) =>
      vegetation
        .filter(({ kind, models }) => kinds.includes(kind) && models)
        .map(({ kind }) => ({ kind, biome: id })),
    )[0]

  // docs/features/052-assets-do-lgpe-e-floresta.md
  it('o tronco e a pedra colidem dentro do casco; ao lado do tronco, nada', () => {
    const chunk = generateTerrainChunk(createTerrainSampler(5), 0, 0)
    chunk.heights.fill(0)
    const at = (fx, fz) => {
      const x = chunk.minX + chunk.size * fx
      const z = chunk.minZ + chunk.size * fz
      return { x, y: chunkHeightAt(chunk, x, z), z, yaw: 1, variant: 0 }
    }
    const tree = {
      ...at(0.3, 0.6),
      ...withModels(STANDING_TREE_KINDS),
      scale: 1.2,
    }
    const rock = { ...at(0.7, 0.3), ...withModels([ROCK_KIND]), scale: 1.5 }
    expect(lgpeColliderOf(tree)).not.toBeNull()
    expect(lgpeColliderOf(rock)).not.toBeNull()
    chunk.solids = { trees: [tree], rocks: [rock], footprints: [] }
    createTerrainChunkCollider(chunk)
    stepPhysics()

    const reach = 10
    const ray = ({ x, z }, y, side = 0) =>
      castRay({ x: x + side, y, z: z - reach }, { x: 0, y: 0, z: 1 }, reach)
    for (const [solid, y] of [
      [tree, tree.y + 0.1],
      [rock, rockBaseY(rock) + 0.1],
    ]) {
      const hit = ray(solid, y)
      expect(hit).not.toBeNull()
      expect(reach - hit.distance).toBeLessThanOrEqual(
        lgpeColliderOf(solid).reach * solid.scale + 1e-3,
      )
    }
    // Ao lado do tronco, na altura da copa: passa.
    const side = lgpeColliderOf(tree).reach * tree.scale + 0.05
    expect(ray(tree, tree.y + 2, side)).toBeNull()
  })

  // docs/features/056-bioma-cidade.md
  it('o prédio da cidade colide pelo casco do modelo; ao lado, nada', () => {
    const town = listBiomes().find((biome) => biome.town)?.town
    if (!town) return
    const chunk = generateTerrainChunk(createTerrainSampler(5), 0, 0)
    chunk.heights.fill(0)
    const x = chunk.minX + chunk.size / 2
    const z = chunk.minZ + chunk.size / 2
    const building = {
      kind: 'building',
      model: town.landmarks[0].model,
      x,
      y: 0,
      z,
      yaw: 0,
      scale: town.scale,
      variant: 0,
    }
    chunk.solids = {
      trees: [],
      rocks: [],
      buildings: [building],
      footprints: [],
    }
    createTerrainChunkCollider(chunk)
    stepPhysics()

    const { box } = lgpeColliderOf(building)
    const reach = 20
    const ray = (offsetX) =>
      castRay(
        { x: x + offsetX, y: 1, z: z - reach },
        { x: 0, y: 0, z: 1 },
        reach,
      )
    const hit = ray(0)
    expect(hit).not.toBeNull()
    // Bate na parede de trás da caixa (a frente é +Z).
    expect(z - reach + hit.distance).toBeCloseTo(z + box[1] * town.scale, 0)
    expect(ray(box[2] * town.scale + 0.5)).toBeNull()
  })

  // docs/features/069-revisao-do-bioma-cidade.md
  it('a fonte colide só na borda: dentro dela dá para entrar', () => {
    const town = listBiomes().find((biome) => biome.town?.props.fountain)?.town
    if (!town) return
    const chunk = generateTerrainChunk(createTerrainSampler(5), 0, 0)
    chunk.heights.fill(0)
    const x = chunk.minX + chunk.size / 2
    const z = chunk.minZ + chunk.size / 2
    const fountain = {
      kind: 'street-prop',
      model: town.props.fountain,
      x,
      y: 0,
      z,
      yaw: 0,
      scale: town.propScale,
      variant: 0,
    }
    chunk.solids = {
      trees: [],
      rocks: [],
      buildings: [fountain],
      footprints: [],
    }
    createTerrainChunkCollider(chunk)
    stepPhysics()

    const { ring } = lgpeColliderOf(fountain)
    expect(ring).toBeDefined()
    const low = (ring.height * fountain.scale) / 2
    // Do meio para fora, rente ao chão: bate na borda de dentro.
    const out = castRay({ x, y: low, z }, { x: 1, y: 0, z: 0 }, 10)
    expect(out).not.toBeNull()
    expect(out.distance).toBeCloseTo(ring.inner * fountain.scale, 1)
    // De cima, no meio: só o chão (nada para pousar em cima).
    const down = castRay({ x, y: 5, z }, { x: 0, y: -1, z: 0 }, 10)
    expect(down.distance).toBeCloseTo(5, 1)
    // De cima, na borda: a borda, na altura dela.
    const middle = ((ring.inner + ring.outer) / 2) * fountain.scale
    const onRim = castRay({ x: x + middle, y: 5, z }, { x: 0, y: -1, z: 0 }, 10)
    expect(5 - onRim.distance).toBeCloseTo(ring.height * fountain.scale, 1)
  })

  it('o canteiro de tronco colide só na moldura: dentro dele dá para entrar', () => {
    const town = listBiomes().find((biome) => biome.town?.props.flowerBed)?.town
    if (!town) return
    const chunk = generateTerrainChunk(createTerrainSampler(5), 0, 0)
    chunk.heights.fill(0)
    const x = chunk.minX + chunk.size / 2
    const z = chunk.minZ + chunk.size / 2
    const bed = {
      kind: 'street-prop',
      model: town.props.flowerBed,
      x,
      y: 0,
      z,
      yaw: 0,
      scale: town.propScale,
      variant: 0,
    }
    chunk.solids = { trees: [], rocks: [], buildings: [bed], footprints: [] }
    createTerrainChunkCollider(chunk)
    stepPhysics()

    const { frame } = lgpeColliderOf(bed)
    expect(frame).toBeDefined()
    const low = (frame.height * bed.scale) / 2
    // Do meio para fora, rente ao chão: bate na moldura de dentro.
    const out = castRay({ x, y: low, z }, { x: 1, y: 0, z: 0 }, 10)
    expect(out?.distance).toBeCloseTo(frame.inner[2] * bed.scale, 1)
    // De cima, no meio: só o chão.
    const down = castRay({ x, y: 5, z }, { x: 0, y: -1, z: 0 }, 10)
    expect(down.distance).toBeCloseTo(5, 1)
    // De cima, na moldura: ela, na altura dela.
    const { box } = lgpeColliderOf(bed)
    const onFrame = ((frame.inner[2] + box[2]) / 2) * bed.scale
    const hit = castRay({ x: x + onFrame, y: 5, z }, { x: 0, y: -1, z: 0 }, 10)
    expect(5 - hit.distance).toBeCloseTo(frame.height * bed.scale, 1)
  })
})

describe('frameBoxesOf', () => {
  const frame = { inner: [-1, -0.5, 1, 0.5], height: 0.4 }
  const box = [-1.5, -1, 1.5, 1]
  const solid = { x: 10, y: 2, z: -3, scale: 2, yaw: 0 }
  const inside = ({ x, z }, [minX, minZ, maxX, maxZ], margin = 1e-6) =>
    x > minX + margin &&
    x < maxX - margin &&
    z > minZ + margin &&
    z < maxZ - margin

  it('as quatro caixas cobrem a moldura, do chão até a altura dela, e deixam o vão livre', () => {
    const boxes = frameBoxesOf(frame, box, solid)
    expect(boxes).toHaveLength(4)
    const scaled = (rect) => [
      solid.x + rect[0] * solid.scale,
      solid.z + rect[1] * solid.scale,
      solid.x + rect[2] * solid.scale,
      solid.z + rect[3] * solid.scale,
    ]
    const hole = scaled(frame.inner)
    const outer = scaled(box)
    let area = 0
    for (const item of boxes) {
      const [halfX, halfY, halfZ] = item.halfExtents
      expect(item.y - halfY).toBeCloseTo(solid.y)
      expect(item.y + halfY).toBeCloseTo(solid.y + frame.height * solid.scale)
      // Nenhuma caixa invade o vão, e todas ficam dentro da caixa no chão.
      expect(inside(item, hole)).toBe(false)
      expect(item.x - halfX).toBeGreaterThanOrEqual(outer[0] - 1e-6)
      expect(item.x + halfX).toBeLessThanOrEqual(outer[2] + 1e-6)
      expect(item.z - halfZ).toBeGreaterThanOrEqual(outer[1] - 1e-6)
      expect(item.z + halfZ).toBeLessThanOrEqual(outer[3] + 1e-6)
      area += 4 * halfX * halfZ
    }
    const areaOf = ([minX, minZ, maxX, maxZ]) => (maxX - minX) * (maxZ - minZ)
    expect(area).toBeCloseTo(areaOf(outer) - areaOf(hole))
  })

  it('giram com o objeto', () => {
    const turned = frameBoxesOf(frame, box, { ...solid, yaw: Math.PI / 2 })
    for (const item of turned) {
      const reach = Math.hypot(item.x - solid.x, item.z - solid.z)
      const straight = frameBoxesOf(frame, box, solid).find(
        ({ halfExtents }) => halfExtents[0] === item.halfExtents[0],
      )
      expect(reach).toBeCloseTo(
        Math.hypot(straight.x - solid.x, straight.z - solid.z),
      )
      expect(item.yaw).toBeCloseTo(Math.PI / 2)
    }
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

// A colisão da sala por dentro de um prédio (docs/features/068-interior-
// dos-predios.md), posta num lugar qualquer do mundo, numa escala qualquer.
describe('createInteriorColliders', () => {
  beforeEach(async () => {
    await initPhysics()
  })
  afterEach(() => {
    disposePhysics()
  })

  const place = { x: 40, y: 300, z: -25, scale: 1.5 }
  const down = { x: 0, y: -1, z: 0 }

  it('o piso é chão para a câmera (malha de triângulos), na altura dele', () => {
    for (const interior of listInteriors()) {
      const colliders = interiorCollidersOf(interior)
      const handle = createInteriorColliders(colliders, place)
      stepPhysics()
      const { exit, floor } = colliders
      const from = {
        x: place.x + exit.x * place.scale,
        y: place.y + floor.y * place.scale + 1,
        z: place.z + exit.z * place.scale,
      }
      const hit = castRay(from, down, 5, { groundOnly: true })
      expect(hit?.point.y).toBeCloseTo(place.y + floor.y * place.scale, 4)
      destroyInteriorColliders(handle)
    }
  })

  it('paredes e móveis colidem; ao sair, a sala inteira some', () => {
    for (const interior of listInteriors()) {
      const colliders = interiorCollidersOf(interior)
      const handle = createInteriorColliders(colliders, place)
      stepPhysics()
      const [box] = colliders.solids
      const from = {
        x: place.x + ((box[0] + box[3]) / 2) * place.scale,
        y: place.y + box[4] * place.scale + 1,
        z: place.z + ((box[2] + box[5]) / 2) * place.scale,
      }
      const hit = castRay(from, down, 5)
      expect(hit?.point.y).toBeCloseTo(place.y + box[4] * place.scale, 4)

      destroyInteriorColliders(handle)
      expect(getRapierWorld().getRigidBody(handle)).toBeFalsy()
    }
  })
})

// docs/features/069-revisao-do-bioma-cidade.md
describe('ringBoxesOf', () => {
  const ring = { inner: 1, outer: 1.5, height: 0.6 }
  const solid = { x: 10, y: 2, z: -3, scale: 2 }

  it('as caixas ficam na borda, do chão até a altura dela', () => {
    for (const box of ringBoxesOf(ring, solid)) {
      const reach = Math.hypot(box.x - solid.x, box.z - solid.z)
      expect(reach).toBeCloseTo(((ring.inner + ring.outer) / 2) * solid.scale)
      expect(box.y - box.halfExtents[1]).toBeCloseTo(solid.y)
      expect(box.y + box.halfExtents[1]).toBeCloseTo(
        solid.y + ring.height * solid.scale,
      )
      expect(box.halfExtents[2] * 2).toBeCloseTo(
        (ring.outer - ring.inner) * solid.scale,
      )
    }
  })

  it('cada caixa aponta o +Z para fora (do meio para a borda)', () => {
    for (const box of ringBoxesOf(ring, solid)) {
      const outward = Math.atan2(box.x - solid.x, box.z - solid.z)
      expect(Math.cos(box.yaw - outward)).toBeCloseTo(1)
    }
  })

  it('as caixas vizinhas se encostam (sem fresta na borda de fora)', () => {
    const boxes = ringBoxesOf(ring, solid)
    const along = boxes[0].halfExtents[0] * 2
    const gap = 2 * ring.outer * solid.scale * Math.sin(Math.PI / boxes.length)
    expect(along).toBeGreaterThanOrEqual(gap)
  })
})
