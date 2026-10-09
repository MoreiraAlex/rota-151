import * as THREE from 'three'
import { listBiomes } from '@/core/data/biomes'
import { GAME_CONFIG } from '@/core/gameConfig'
import {
  createKindDensity,
  densityAt,
} from '@/core/vegetation/vegetationDensity'
import {
  ROCK_KIND,
  STANDING_TREE_KINDS,
} from '@/core/vegetation/solidPlacement'
import {
  allowShadow,
  buildKindMeshes,
  buildLodKindMeshes,
  finishMesh,
  setInstance,
  tintAt,
} from './instancing'
import { scatterArea } from './vegetationScatter'

/**
 * Malhas por chunk (docs/features/049-vegetacao-e-floresta.md): os
 * objetos sólidos do core (`chunk.solids` — árvores, troncos caídos e
 * pedras, os mesmos do colisor) e o sub-bosque só visual (arbustos,
 * samambaias, plantas de folha larga e cogumelos, sorteados aqui com as
 * clareiras e as manchas e fora das pegadas dos sólidos). Cada função devolve uma lista de malhas (vazia sem
 * nada no chunk); os modelos vêm de `useVegetationModels`.
 */

// Separa os sorteios do sub-bosque (`scatterArea`).
const SALTS = {
  bush: 201,
  fern: 301,
  mushroom: 401,
  'leafy-plant': 501,
  pebble: 601,
}
// Quanto o tom do cogumelo varia de um para outro.
const MUSHROOM_TINT_VARIATION = 0.2

const scratchColor = new THREE.Color()
const scratchScale = new THREE.Vector3()

const between = ([min, max], t) => min + (max - min) * t

/**
 * Árvores do chunk (as do core), cada uma nos modelos da espécie dela e com
 * o próprio tom de folha, com LOD por árvore (`buildLodKindMeshes`):
 * `setNear` divide entre o modelo inteiro e o de longe (sem galhos).
 */
export function buildTreeMeshes(chunk, { kinds, castCanopyShadow }) {
  const trees = chunk.solids?.trees ?? []
  const { TINT_VARIATION } = GAME_CONFIG.TREES
  const bySpecies = STANDING_TREE_KINDS.map((kind) =>
    buildLodKindMeshes(
      kinds[kind],
      trees
        .filter((tree) => tree.kind === kind)
        .map((tree) => ({
          ...tree,
          tint: tintAt(tree.x, tree.z, TINT_VARIATION),
        })),
      { castShadow: castCanopyShadow },
    ),
  )
  return {
    meshes: bySpecies.flatMap(({ meshes }) => meshes),
    setNear: (isNear) => {
      for (const { setNear } of bySpecies) setNear(isNear)
    },
  }
}

/**
 * Sub-bosque de um tipo (`bush`, `fern`, `leafy-plant`, `mushroom`,
 * `pebble`) no
 * chunk inteiro: pontos com as clareiras e as manchas e fora das pegadas
 * dos sólidos, tamanho entre o `SCALE` do tipo e o tom de cada planta. Com LOD (`buildLodKindMeshes`):
 * `setNear` diz quais plantas desenhar (as de perto).
 */
export function buildUndergrowthMeshes(
  chunk,
  kind,
  { kinds, castCanopyShadow },
) {
  const { GRASS, TERRAIN, VEGETATION_QUALITY, TREES } = GAME_CONFIG
  const spec = {
    bush: GAME_CONFIG.BUSHES,
    fern: GAME_CONFIG.FERNS,
    'leafy-plant': GAME_CONFIG.LEAFY_PLANTS,
    mushroom: GAME_CONFIG.MUSHROOMS,
    pebble: GAME_CONFIG.PEBBLES,
  }[kind]
  const quality = VEGETATION_QUALITY[VEGETATION_QUALITY.CURRENT]
  const points = scatterArea(chunk, {
    minX: chunk.minX,
    minZ: chunk.minZ,
    size: chunk.size,
    perM2: spec.PER_M2 * quality.density,
    density: createKindDensity(chunk, kind, {
      biomeList: listBiomes(),
      seed: chunk.vegetationSeed,
    }),
    salt: SALTS[kind],
    minHeight: TERRAIN.WATER_LEVEL + GRASS.SHORE_GAP,
    maxSlope: GRASS.MAX_SLOPE,
    avoid: chunk.solids?.footprints,
  })
  const variation =
    kind === 'mushroom' ? MUSHROOM_TINT_VARIATION : TREES.TINT_VARIATION
  const instances = Array.from({ length: points.count }, (_, i) => {
    const [x, y, z] = points.positions.subarray(i * 3, i * 3 + 3)
    return {
      x,
      y,
      z,
      yaw: points.yaws[i],
      scale: between(spec.SCALE, points.sizes[i]),
      variant: points.variants[i],
      tint: tintAt(x, z, variation),
    }
  })
  // De longe, nada (`far` vazio): só desenha perto da câmera.
  const models = kinds[kind].map((model) => ({
    ...model,
    far: { name: `${model.name}-far`, parts: [] },
  }))
  return buildLodKindMeshes(models, instances, {
    castShadow: castCanopyShadow,
  })
}

/**
 * Pedras do chunk (as do core), afundadas um pouco, com o musgo do bioma
 * no topo (`moss` da entrada `rock`).
 */
export function buildRockMeshes(chunk, { kinds }) {
  const rocks = chunk.solids?.rocks ?? []
  const { ROCKS } = GAME_CONFIG
  const mossByBiome = Float32Array.from(chunk.biomeIds, (id) => {
    const biome = listBiomes().find((candidate) => candidate.id === id)
    const entry = biome?.vegetation.find(({ kind }) => kind === ROCK_KIND)
    return entry?.moss ?? 0
  })
  const instances = rocks.map((rock) => ({
    ...rock,
    y: rock.y - ROCKS.SINK * ROCKS.HEIGHT * rock.scale,
    moss: densityAt(chunk, mossByBiome, rock.x, rock.z),
  }))
  return buildKindMeshes(kinds[ROCK_KIND], instances)
}

/**
 * Troncos caídos do chunk (os do core): um cilindro deitado (`log`, de
 * `useVegetationModels`) com a casca das árvores e as pontas de madeira.
 */
export function buildLogMeshes(chunk, { log }) {
  const logs = chunk.solids?.logs ?? []
  if (logs.length === 0) return []
  const { RADIUS } = GAME_CONFIG.LOGS

  const mesh = new THREE.InstancedMesh(log.geometry, log.materials, logs.length)
  logs.forEach((item, index) => {
    scratchScale.set(item.scale, RADIUS, RADIUS)
    setInstance(
      mesh,
      index,
      item.x,
      item.y + RADIUS * 0.7,
      item.z,
      item.yaw,
      scratchScale,
    )
    mesh.setColorAt(index, tintAt(item.x, item.z, 0.15, scratchColor))
  })
  allowShadow(mesh, true)
  mesh.receiveShadow = true
  return [finishMesh(mesh)]
}
