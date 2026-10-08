/**
 * Registro de biomas (docs/features/047-biomas.md). Mesma forma de
 * `core/data/species/` e `core/data/items/`: uma pasta por bioma, o molde
 * em `_template/`.
 *
 * Pra adicionar um bioma:
 * 1) copia `_template/` pra `<id>/`
 * 2) preenche `index.js`
 * 3) importa aqui embaixo e adiciona uma linha no BIOME_REGISTRY
 *
 * A ORDEM do registro é o índice de cada bioma nos pesos por vértice dos
 * chunks (`biomeWeights`, core/terrain/terrainChunk.js) — acrescentar no
 * fim, e subir `GAME_CONFIG.TERRAIN.GENERATION_VERSION`.
 *
 * O painel de ajuste (F2) mexe nos objetos daqui ao vivo; o relevo só usa a
 * mudança quando é refeito (`regenerarTerreno`).
 */
import { OCEAN } from './ocean'
import { BEACH } from './beach'
import { PLAINS } from './plains'
import { SAVANNA } from './savanna'
import { FOREST } from './forest'
import { JUNGLE } from './jungle'
import { SWAMP } from './swamp'
import { DESERT } from './desert'
import { MOUNTAIN } from './mountain'
import { VOLCANIC } from './volcanic'
import { TUNDRA } from './tundra'

export const BIOME_REGISTRY = {
  [OCEAN.id]: OCEAN,
  [BEACH.id]: BEACH,
  [PLAINS.id]: PLAINS,
  [SAVANNA.id]: SAVANNA,
  [FOREST.id]: FOREST,
  [JUNGLE.id]: JUNGLE,
  [SWAMP.id]: SWAMP,
  [DESERT.id]: DESERT,
  [MOUNTAIN.id]: MOUNTAIN,
  [VOLCANIC.id]: VOLCANIC,
  [TUNDRA.id]: TUNDRA,
}

export function getBiome(id, registry = BIOME_REGISTRY) {
  return registry[id] ?? null
}

export function listBiomes(registry = BIOME_REGISTRY) {
  return Object.values(registry)
}
