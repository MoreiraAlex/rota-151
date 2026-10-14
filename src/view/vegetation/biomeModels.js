import { GAME_CONFIG } from '@/core/gameConfig'
import { dominantBiomeAt, entryOf } from '@/core/vegetation/solidModels'

export { dominantBiomeAt, entryOf }

/**
 * Os modelos de cada tipo por bioma (docs/features/052-assets-do-lgpe-e-
 * floresta.md): a entrada do `vegetation` pode dizer os dela (`models`, ids
 * do LGPE); sem isso vale o padrão do tipo (`VEGETATION_MODELS`, MegaKit).
 * Cada objeto usa os do bioma de mais peso onde ele está entre os que têm
 * o tipo (`dominantBiomeAt`, no core — o colisor dos sólidos segue o
 * modelo).
 */

/**
 * Os modelos do tipo no bioma: os do LGPE da entrada (`models`) ou o
 * padrão do tipo. `isLgpe` diz qual dos dois (o tamanho das plantas muda:
 * os do LGPE já vêm em metros).
 */
export function modelsOf(models, kind, biomeId) {
  const ids = entryOf(biomeId, kind)?.models
  if (ids?.length) {
    return {
      list: ids.map((id) => models.lgpe[id]).filter(Boolean),
      isLgpe: true,
    }
  }
  return { list: models.kinds[kind] ?? [], isLgpe: false }
}

/**
 * As instâncias de um tipo divididas pelo bioma de mais peso de cada uma
 * entre os que têm o tipo (`dominantBiomeAt`; os sólidos já vêm com o
 * `biome` do core).
 */
export function groupByBiome(chunk, instances, kind) {
  const groups = new Map()
  for (const item of instances) {
    const biomeId = item.biome ?? dominantBiomeAt(chunk, item.x, item.z, kind)
    if (!groups.has(biomeId)) groups.set(biomeId, [])
    groups.get(biomeId).push(item)
  }
  return groups
}

/**
 * Tamanho de uma planta do LGPE: o sorteado (`size`, 0 a 1) no intervalo
 * `LGPE.PLANT_SCALE`, vezes o `scale` da entrada do bioma.
 */
export function lgpePlantScale(size, entry) {
  const [min, max] = GAME_CONFIG.LGPE.PLANT_SCALE
  return (min + (max - min) * size) * (entry?.scale ?? 1)
}
