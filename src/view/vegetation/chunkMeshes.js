import { listBiomes } from '@/core/data/biomes'
import { GAME_CONFIG } from '@/core/gameConfig'
import {
  createKindDensity,
  densityAt,
} from '@/core/vegetation/vegetationDensity'
import {
  ROCK_KIND,
  STANDING_TREE_KINDS,
  rockBaseY,
} from '@/core/vegetation/solidPlacement'
import { buildKindMeshes, buildLodKindMeshes, tintAt } from './instancing'
import { createBiomeColorFactor } from './biomeColor'
import { entryOf, groupByBiome, lgpePlantScale, modelsOf } from './biomeModels'
import { scatterArea } from './vegetationScatter'

/**
 * Malhas por chunk (docs/features/049-vegetacao-e-floresta.md): os
 * objetos sólidos do core (`chunk.solids` — árvores e
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
// Quanto o tom do cogumelo e da pedra varia de um para outro.
const MUSHROOM_TINT_VARIATION = 0.2
const ROCK_TINT_VARIATION = 0.12

const between = ([min, max], t) => min + (max - min) * t

/**
 * O tom de cada objeto de `kind` no chunk: o do lugar (`tintAt`) vezes a
 * cor do bioma, quando ele muda a do tipo (`color`).
 */
function createTint(chunk, kind, variation) {
  const biomeColor = createBiomeColorFactor(chunk, kind)
  return (x, z) => {
    const tint = tintAt(x, z, variation)
    return biomeColor ? biomeColor(x, z, tint) : tint
  }
}

/**
 * Árvores do chunk (as do core), cada uma nos modelos da espécie dela no
 * bioma onde está (`modelsOf`: os do LGPE da entrada ou o padrão) e com o
 * próprio tom de folha, com LOD por árvore (`buildLodKindMeshes`):
 * `setNear` divide entre o modelo inteiro e o de longe (sem galhos).
 */
export function buildTreeMeshes(chunk, models) {
  const trees = chunk.solids?.trees ?? []
  const { TINT_VARIATION } = GAME_CONFIG.TREES
  const sets = STANDING_TREE_KINDS.flatMap((kind) => {
    const tintOf = createTint(chunk, kind, TINT_VARIATION)
    const ofKind = trees
      .filter((tree) => tree.kind === kind)
      .map((tree) => ({ ...tree, tint: tintOf(tree.x, tree.z) }))
    return [...groupByBiome(chunk, ofKind, kind)].map(([biomeId, group]) =>
      buildLodKindMeshes(modelsOf(models, kind, biomeId).list, group, {
        castShadow: models.castCanopyShadow,
      }),
    )
  })
  return {
    meshes: sets.flatMap(({ meshes }) => meshes),
    setNear: (isNear) => {
      for (const { setNear } of sets) setNear(isNear)
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
export function buildUndergrowthMeshes(chunk, kind, models) {
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
  const tintOf = createTint(chunk, kind, variation)
  const instances = Array.from({ length: points.count }, (_, i) => {
    const [x, y, z] = points.positions.subarray(i * 3, i * 3 + 3)
    return {
      x,
      y,
      z,
      yaw: points.yaws[i],
      size: points.sizes[i],
      variant: points.variants[i],
      tint: tintOf(x, z),
    }
  })
  // Por bioma: os modelos dele e o tamanho (os do LGPE já vêm em metros).
  // De longe, nada (`far` vazio): só desenha perto da câmera.
  const sets = [...groupByBiome(chunk, instances, kind)].map(
    ([biomeId, group]) => {
      const { list, isLgpe } = modelsOf(models, kind, biomeId)
      const entry = entryOf(biomeId, kind)
      const sized = group.map((item) => ({
        ...item,
        scale: isLgpe
          ? lgpePlantScale(item.size, entry)
          : between(spec.SCALE, item.size),
      }))
      const nearOnly = list.map((model) => ({
        ...model,
        far: { name: `${model.name}-far`, parts: [] },
      }))
      return buildLodKindMeshes(nearOnly, sized, {
        castShadow: models.castCanopyShadow,
      })
    },
  )
  return {
    meshes: sets.flatMap(({ meshes }) => meshes),
    setNear: (isNear) => {
      for (const { setNear } of sets) setNear(isNear)
    },
  }
}

/**
 * Pedras do chunk (as do core), afundadas um pouco, com o musgo do bioma
 * no topo (`moss` da entrada `rock`) e a cor dele (`color`).
 */
export function buildRockMeshes(chunk, models) {
  const rocks = chunk.solids?.rocks ?? []
  const { ROCKS } = GAME_CONFIG
  const mossByBiome = Float32Array.from(chunk.biomeIds, (id) => {
    const biome = listBiomes().find((candidate) => candidate.id === id)
    const entry = biome?.vegetation.find(({ kind }) => kind === ROCK_KIND)
    return entry?.moss ?? 0
  })
  const tintOf = createTint(chunk, ROCK_KIND, ROCK_TINT_VARIATION)
  const instances = rocks.map((rock) => ({
    ...rock,
    y: rockBaseY(rock, ROCKS),
    moss: densityAt(chunk, mossByBiome, rock.x, rock.z),
    tint: tintOf(rock.x, rock.z),
  }))
  return [...groupByBiome(chunk, instances, ROCK_KIND)].flatMap(
    ([biomeId, group]) =>
      buildKindMeshes(modelsOf(models, ROCK_KIND, biomeId).list, group),
  )
}
