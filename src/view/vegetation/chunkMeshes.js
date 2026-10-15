import * as THREE from 'three'
import { getBiome, listBiomes } from '@/core/data/biomes'
import { GAME_CONFIG } from '@/core/gameConfig'
import { createKindDensity } from '@/core/vegetation/vegetationDensity'
import {
  ROCK_KIND,
  STANDING_TREE_KINDS,
  rockBaseY,
} from '@/core/vegetation/solidPlacement'
import { createTint } from './biomeColor'
import {
  buildKindMeshes,
  buildLodKindMeshes,
  buildModelMeshes,
} from './instancing'
import { entryOf, groupByBiome, lgpePlantScale, modelsOf } from './biomeModels'
import { scatterArea } from './vegetationScatter'

/**
 * Malhas por chunk (docs/features/049-vegetacao-e-floresta.md): os
 * objetos sólidos do core (`chunk.solids` — árvores e
 * pedras, os mesmos do colisor) e o sub-bosque só visual (arbustos,
 * samambaias e plantas de folha larga, sorteados aqui com as
 * clareiras e as manchas e fora das pegadas dos sólidos). Cada função devolve uma lista de malhas (vazia sem
 * nada no chunk); os modelos vêm de `useVegetationModels`.
 */

// Separa os sorteios do sub-bosque (`scatterArea`; o dos arbustos é do
// core, `BUSH_SALT`).
const SALTS = {
  fern: 301,
  'leafy-plant': 501,
  pebble: 601,
}
// Quanto o tom da pedra varia de uma para outra.
const ROCK_TINT_VARIATION = 0.12

/**
 * Árvores do chunk (as do core), cada uma nos modelos da espécie dela no
 * bioma onde está (`modelsOf`) e com o próprio tom, com LOD por árvore
 * (`buildLodKindMeshes`): `setNear` liga e desliga a sombra das de perto.
 */
export function buildTreeMeshes(chunk, models) {
  const trees = chunk.solids?.trees ?? []
  const { TINT_VARIATION } = GAME_CONFIG.TREES
  const sets = STANDING_TREE_KINDS.flatMap((kind) => {
    const tintOf = createTint(chunk, kind, TINT_VARIATION)
    const ofKind = trees
      .filter((tree) => tree.kind === kind)
      .map((tree) => ({ ...tree, ...tintOf(tree.x, tree.z) }))
    return [...groupByBiome(chunk, ofKind, kind)].map(([biomeId, group]) =>
      buildLodKindMeshes(modelsOf(models, kind, biomeId), group, {
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
 * Sub-bosque de um tipo (`bush`, `fern`, `leafy-plant`, `pebble`) no
 * chunk inteiro (os arbustos já vêm sorteados do core, `chunk.bushes`): pontos com as clareiras e as manchas e fora das pegadas
 * dos sólidos, o tamanho das plantas do LGPE (`lgpePlantScale`) e o tom
 * de cada planta. Com LOD (`buildLodKindMeshes`):
 * `setNear` diz quais plantas desenhar (as de perto).
 */
export function buildUndergrowthMeshes(chunk, kind, models) {
  if (kind === 'bush') return buildBushMeshes(chunk, models)
  const { GRASS, TERRAIN, VEGETATION_QUALITY, TREES } = GAME_CONFIG
  const spec = {
    fern: GAME_CONFIG.FERNS,
    'leafy-plant': GAME_CONFIG.LEAFY_PLANTS,
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
  const tintOf = createTint(chunk, kind, TREES.TINT_VARIATION)
  const instances = Array.from({ length: points.count }, (_, i) => {
    const [x, y, z] = points.positions.subarray(i * 3, i * 3 + 3)
    return {
      x,
      y,
      z,
      yaw: points.yaws[i],
      size: points.sizes[i],
      variant: points.variants[i],
      ...tintOf(x, z),
    }
  })
  return buildPlantMeshes(chunk, kind, instances, models)
}

/**
 * Os arbustos do bloco (os do core, `bushes` do relevo do bloco — os mesmos
 * que o F vasculha nos chunks dele, docs/features/055-itens-no-mundo.md):
 * todos, em qualquer qualidade (um arbusto que não aparece não pode dar
 * fruta).
 */
function buildBushMeshes(chunk, models) {
  const tintOf = createTint(chunk, 'bush', GAME_CONFIG.TREES.TINT_VARIATION)
  const instances = (chunk.bushes ?? []).map((bush) => ({
    ...bush,
    ...tintOf(bush.x, bush.z),
  }))
  return buildPlantMeshes(chunk, 'bush', instances, models)
}

// As malhas de plantas do sub-bosque já sorteadas, por bioma.
function buildPlantMeshes(chunk, kind, instances, models) {
  // Por bioma: os modelos dele e o tamanho (`scale` da entrada). De
  // longe, nada (`far` vazio): só desenha perto da câmera.
  const sets = [...groupByBiome(chunk, instances, kind)].map(
    ([biomeId, group]) => {
      const list = modelsOf(models, kind, biomeId)
      const entry = entryOf(biomeId, kind)
      const sized = group.map((item) => ({
        ...item,
        scale: lgpePlantScale(item.size, entry),
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
 * Pedras do chunk (as do core), afundadas um pouco, com a tinta do bioma
 * (`tint`).
 */
export function buildRockMeshes(chunk, models) {
  const rocks = chunk.solids?.rocks ?? []
  const { ROCKS } = GAME_CONFIG
  const tintOf = createTint(chunk, ROCK_KIND, ROCK_TINT_VARIATION)
  const instances = rocks.map((rock) => ({
    ...rock,
    y: rockBaseY(rock, ROCKS),
    ...tintOf(rock.x, rock.z),
  }))
  return [...groupByBiome(chunk, instances, ROCK_KIND)].flatMap(
    ([biomeId, group]) =>
      buildKindMeshes(modelsOf(models, ROCK_KIND, biomeId), group),
  )
}

/**
 * Prédios e objetos de rua das cidades do chunk (os do core,
 * docs/features/056-bioma-cidade.md): cada um no próprio modelo do LGPE
 * (`model`), uma malha instanciada por modelo e tema. O prédio com `paint`
 * (o ginásio) leva a cor do tema da cidade (`gymColor`) só nas partes de
 * `paint.materials`. Modelo ainda não carregado: nada.
 */
export function buildBuildingMeshes(chunk, models) {
  const groups = new Map()
  for (const building of chunk.solids?.buildings ?? []) {
    const key = `${building.model}:${building.theme ?? ''}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(building)
  }
  return [...groups.values()].flatMap((group) => {
    const [first] = group
    const model = models.lgpe[first.model]
    if (!model) return []
    const paint = paintOf(first)
    return buildModelMeshes(model, group, {
      recolorOf: (part) =>
        paint && paint.materials.includes(part.materialName)
          ? paint.recolor
          : undefined,
    })
  })
}

// A tinta do ginásio de um prédio da cidade (a cor do tema dele), ou `null`.
const scratchColor = new THREE.Color()
function paintOf(building) {
  const town = getBiome(building.biome)?.town
  const paint = town?.landmarks.find(
    ({ model }) => model === building.model,
  )?.paint
  const color = town?.themes.find(({ id }) => id === building.theme)?.gymColor
  if (!paint || !color) return null
  scratchColor.set(color)
  return {
    materials: paint.materials,
    recolor: [scratchColor.r, scratchColor.g, scratchColor.b, paint.amount],
  }
}
