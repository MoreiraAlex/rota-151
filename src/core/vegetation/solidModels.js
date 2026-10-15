import { getBiome } from '../data/biomes'
import LGPE_COLLIDERS from '../data/lgpeColliders.json'
import { heightIndex } from '../terrain/terrainChunk'
import { vegetationEntryOf } from './vegetationEntry'

/**
 * O modelo de cada objeto da vegetação por bioma (docs/features/052-
 * assets-do-lgpe-e-floresta.md): a entrada do `vegetation` pode dizer os
 * dela (`models`, ids do LGPE); sem isso o tipo não nasce lá
 * (`vegetationEntryOf`).
 * Cada objeto usa os do bioma de mais peso onde ele está entre os que têm
 * o tipo — o que fez ele nascer: na fronteira, a planta de um bioma não
 * troca de modelo por cair do lado de um vizinho que não tem esse tipo.
 *
 * Mora no core porque o colisor dos sólidos segue o modelo: os pontos do
 * casco de cada prop do LGPE (`data/lgpeColliders.json`, gerado por
 * `scripts/lgpe/colliders.js` a partir dos `.glb`).
 */

/** A entrada do tipo no bioma, se ele nasce lá (ou `null`). */
export function entryOf(biomeId, kind) {
  return vegetationEntryOf(getBiome(biomeId), kind)
}

/**
 * O bioma de mais peso no vértice mais perto de `(x, z)`. Com `kind`, só
 * entre os biomas que têm esse tipo no `vegetation` (se nenhum tiver,
 * entre todos).
 */
export function dominantBiomeAt(chunk, x, z, kind) {
  const { biomeIds, biomeWeights, resolution, minX, minZ, size } = chunk
  if (biomeIds.length === 1) return biomeIds[0]
  const step = size / resolution
  const ix = Math.min(resolution, Math.max(0, Math.round((x - minX) / step)))
  const iz = Math.min(resolution, Math.max(0, Math.round((z - minZ) / step)))
  const first = heightIndex(resolution, ix, iz) * biomeIds.length
  const all = biomeIds.map((_, index) => index)
  const withKind = all.filter((index) => entryOf(biomeIds[index], kind))
  const pool = kind && withKind.length > 0 ? withKind : all
  let best = pool[0]
  for (const biome of pool) {
    if (biomeWeights[first + biome] > biomeWeights[first + best]) best = biome
  }
  return biomeIds[best]
}

/** Qual de `count` modelos o `variant` (0 a 1) escolhe. */
export const modelIndexOf = (variant, count) =>
  Math.min(count - 1, Math.floor(variant * count))

/**
 * O colisor do LGPE de um sólido (`SolidPlacement`, com o `biome`): os
 * pontos do casco no tamanho do modelo e o `reach` (afastamento do eixo no
 * chão). `null` quando o modelo não tem casco.
 *
 * @returns {{ points: number[], reach: number } | null}
 */
export function lgpeColliderOf(solid) {
  // Os da cidade já dizem o modelo.
  if (solid.model) return LGPE_COLLIDERS[solid.model] ?? null
  const ids = entryOf(solid.biome, solid.kind)?.models
  if (!ids?.length) return null
  return LGPE_COLLIDERS[ids[modelIndexOf(solid.variant, ids.length)]] ?? null
}

/**
 * O maior `reach` (no tamanho do modelo) dos colisores do LGPE do tipo nos
 * biomas `biomeIds` — 0 se nenhum usa modelo do LGPE.
 */
export function largestReachOf(kind, biomeIds) {
  let largest = 0
  for (const biomeId of biomeIds) {
    for (const id of entryOf(biomeId, kind)?.models ?? []) {
      largest = Math.max(largest, LGPE_COLLIDERS[id]?.reach ?? 0)
    }
  }
  return largest
}
