import * as THREE from 'three'
import { getBiome } from '@/core/data/biomes'
import { densityAt } from '@/core/vegetation/vegetationDensity'
import { vegetationEntryOf } from '@/core/vegetation/vegetationEntry'
import { tintAt } from './instancing'

/**
 * Tinta por bioma (docs/features/054-savana-lgpe-e-saida-do-megakit.md): a
 * entrada do `vegetation` pode ter `tint: { color, amount }` — o tom dos
 * modelos do Let's Go do tipo puxa para `color` (0 a 1, `amount`),
 * mantendo o claro e escuro da textura (toonMaterial.js) — o verde
 * virando o amarelado da savana. Cada instância leva a tinta misturada
 * pelo peso dos biomas no ponto (borda suave): a cor pela força de cada
 * um, a força pela média. Calculado ao montar as malhas: mexer no F2 só
 * aparece ao remontar.
 */

const scratch = new THREE.Color()

/** A tinta da entrada (`null` sem tinta ou com força 0). */
const tintOfEntry = (entry) => (entry?.tint?.amount > 0 ? entry.tint : null)

/**
 * A tinta de `kind` no chunk, ou `null` quando nenhum bioma do chunk tinge
 * o tipo (nada a fazer).
 *
 * @returns {null | ((x: number, z: number) => number[])} `[r, g, b,
 *   força]` (cor linear) em `(x, z)`
 */
export function createBiomeTint(chunk, kind) {
  const tints = chunk.biomeIds.map((id) =>
    tintOfEntry(vegetationEntryOf(getBiome(id), kind)),
  )
  if (!tints.some(Boolean)) return null

  // Cor vezes força (para misturar pela força) e a força, por bioma.
  const channels = [0, 1, 2, 3].map(() => new Float32Array(tints.length))
  tints.forEach((tint, index) => {
    if (!tint) return
    scratch.set(tint.color)
    channels[0][index] = scratch.r * tint.amount
    channels[1][index] = scratch.g * tint.amount
    channels[2][index] = scratch.b * tint.amount
    channels[3][index] = tint.amount
  })
  return (x, z) => {
    const [r, g, b, amount] = channels.map((values) =>
      densityAt(chunk, values, x, z),
    )
    if (amount <= 0) return [0, 0, 0, 0]
    return [r / amount, g / amount, b / amount, amount]
  }
}

/**
 * O tom e a tinta de cada objeto de `kind` no chunk: `tint` é o do lugar
 * (`tintAt`, até `variation`); `recolor`, a tinta do bioma
 * (`createBiomeTint`, ou `undefined`).
 *
 * @returns {(x: number, z: number) => { tint: THREE.Color,
 *   recolor?: number[] }}
 */
export function createTint(chunk, kind, variation) {
  const biomeTint = createBiomeTint(chunk, kind)
  return (x, z) => ({
    tint: tintAt(x, z, variation),
    recolor: biomeTint?.(x, z),
  })
}
