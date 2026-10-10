import * as THREE from 'three'
import { listBiomes } from '@/core/data/biomes'
import { GAME_CONFIG } from '@/core/gameConfig'
import { densityAt } from '@/core/vegetation/vegetationDensity'

/**
 * Cor por bioma (docs/features/050-planicie-e-savana.md): a entrada do
 * `vegetation` pode ter `color`, que vence a cor do tipo no config naquele
 * bioma — o arbusto seco e a pedra de arenito da savana. A cor do material
 * continua a do config; cada instância leva o fator `color ÷ cor do tipo`,
 * misturado pelo peso dos biomas no ponto (borda suave). Calculado ao
 * montar as malhas: mexer na cor do tipo no F2 só acerta o fator ao
 * remontar.
 */

/**
 * A cor de cada tipo no config (a do material): a folha das árvores e do
 * arbusto, a pedra e o seixo.
 */
export const KIND_COLOR = {
  'broadleaf-tree': (config) => config.TREES.LEAF_COLOR,
  'ancient-tree': (config) => config.ANCIENT_TREES.LEAF_COLOR,
  'pine-tree': (config) => config.PINES.LEAF_COLOR,
  'acacia-tree': (config) => config.ACACIAS.LEAF_COLOR,
  bush: (config) => config.BUSHES.LEAF_COLOR,
  rock: (config) => config.ROCKS.COLOR,
  pebble: (config) => config.ROCKS.COLOR,
}

const species = new THREE.Color()
const biome = new THREE.Color()

/**
 * O fator de cor de `kind` no chunk, ou `null` quando nenhum bioma do chunk
 * muda a cor dele (nada a fazer).
 *
 * @returns {null | ((x: number, z: number, out: THREE.Color) => THREE.Color)}
 *   multiplica `out` pelo fator em `(x, z)`
 */
export function createBiomeColorFactor(chunk, kind) {
  const colorOf = KIND_COLOR[kind]
  if (!colorOf) return null
  const entries = chunk.biomeIds.map((id) =>
    listBiomes()
      .find((candidate) => candidate.id === id)
      ?.vegetation.find((entry) => entry.kind === kind),
  )
  if (!entries.some((entry) => entry?.color)) return null

  species.set(colorOf(GAME_CONFIG))
  const channels = [0, 1, 2].map(() => new Float32Array(entries.length))
  entries.forEach((entry, index) => {
    biome.set(entry?.color ?? species)
    channels[0][index] = biome.r / Math.max(species.r, 1e-3)
    channels[1][index] = biome.g / Math.max(species.g, 1e-3)
    channels[2][index] = biome.b / Math.max(species.b, 1e-3)
  })
  return (x, z, out) =>
    out.multiply(
      biome.setRGB(
        densityAt(chunk, channels[0], x, z),
        densityAt(chunk, channels[1], x, z),
        densityAt(chunk, channels[2], x, z),
      ),
    )
}
