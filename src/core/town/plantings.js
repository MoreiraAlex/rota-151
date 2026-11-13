import { getBiome } from '../data/biomes'
import { hash01 } from '../vegetation/scatter'
import { vegetationEntryOf } from '../vegetation/vegetationEntry'
import { DECOR_KIND } from './townPlan'

/**
 * As flores plantadas nos vasos e canteiros da cidade
 * (docs/features/069-revisao-do-bioma-cidade.md): os modelos do Let's Go
 * vêm só com a terra (no original as flores ficam por fora), e o sorteio
 * da vegetação não entra na pegada deles. Cada objeto de `PLANTINGS` ganha
 * as flores do bioma dele (as mesmas do gramado), numa grade em cima da
 * terra, como enfeites (sem colisão nem pegada). Vale para todo lugar onde
 * o modelo é posto (a cidade montada à mão e as praças procedurais). Puro e
 * determinístico: o sorteio sai da posição do objeto.
 *
 * Por modelo (m, no tamanho do modelo, com o meio dele na origem):
 * - `soil`: `[minX, minZ, maxX, maxZ]`, a terra onde as flores ficam;
 * - `top`: a altura da terra a partir da base;
 * - `spacing`: o lado da célula da grade (uma flor por célula);
 * - `scale`: o tamanho da flor, vezes o do objeto.
 */
export const PLANTINGS = {
  'viridian-pot': {
    soil: [-0.285, -0.13, 0.285, 0.13],
    top: 0.33,
    spacing: 0.28,
    scale: 0.35,
  },
  'viridian-pot-long': {
    soil: [-0.39, -1.255, 0.39, 1.255],
    top: 0.33,
    spacing: 0.4,
    scale: 0.45,
  },
  'log-flower-bed': {
    soil: [-1.9, -1.2, 1.9, 1.15],
    top: 0.11,
    spacing: 0.6,
    scale: 0.65,
  },
}

// O tipo de vegetação das flores (as do bioma do objeto).
const FLOWER_KIND = 'flower'
// Quanto a flor escorrega do meio da célula (fração do lado dela).
const JITTER = 0.25
// Separa o sorteio das flores plantadas.
const SALT = 151

/** Os modelos de flor que o objeto plantado usa (os do bioma dele). */
export function plantingModelsOf(biomeId) {
  return vegetationEntryOf(getBiome(biomeId), FLOWER_KIND)?.models ?? []
}

/**
 * As flores de um objeto plantado (`PLANTINGS[building.model]`), já no
 * mundo: a grade sobre a terra, girada e no tamanho do objeto, com a base
 * na altura da terra. Sem plantio ou sem flor no bioma, nenhuma.
 *
 * @param {object} building - a forma de `SolidPlacement` (com `y`)
 * @returns {object[]} enfeites (`DECOR_KIND`)
 */
export function plantingsOf(building) {
  const planting = PLANTINGS[building.model]
  const models = planting ? plantingModelsOf(building.biome) : []
  if (models.length === 0) return []
  const { soil, top, spacing } = planting
  const [minX, minZ, maxX, maxZ] = soil
  const cols = Math.max(1, Math.round((maxX - minX) / spacing))
  const rows = Math.max(1, Math.round((maxZ - minZ) / spacing))
  const stepX = (maxX - minX) / cols
  const stepZ = (maxZ - minZ) / rows
  const { x, y, z, scale } = building
  const yaw = building.yaw ?? 0
  const cos = Math.cos(yaw)
  const sin = Math.sin(yaw)
  const seedX = Math.round(x * 100)
  const seedZ = Math.round(z * 100)
  const roll = (index, salt) => hash01(seedX + index, seedZ, SALT + salt)
  const flowers = []
  for (let col = 0; col < cols; col++) {
    for (let row = 0; row < rows; row++) {
      const index = col * rows + row
      const localX =
        minX + (col + 0.5 + (roll(index, 1) - 0.5) * JITTER) * stepX
      const localZ =
        minZ + (row + 0.5 + (roll(index, 2) - 0.5) * JITTER) * stepZ
      flowers.push({
        kind: DECOR_KIND,
        model: models[Math.floor(roll(index, 3) * models.length)],
        // O giro em Y do three (o mesmo do `setInstance` da view).
        x: x + (localX * cos + localZ * sin) * scale,
        y: y + top * scale,
        z: z + (-localX * sin + localZ * cos) * scale,
        yaw: roll(index, 4) * Math.PI * 2,
        scale: scale * planting.scale,
        variant: 0,
        biome: building.biome,
      })
    }
  }
  return flowers
}

/** Os objetos com as flores dos plantados logo depois. */
export function withPlantings(buildings) {
  return buildings.flatMap((building) => [building, ...plantingsOf(building)])
}
