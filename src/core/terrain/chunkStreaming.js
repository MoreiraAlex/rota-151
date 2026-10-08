import { chunkCoordAt, chunkKey } from './terrainChunk'

/**
 * Regras puras do carregar/descarregar chunks (docs/features/046-sistema-
 * de-chunks.md) — quem aplica é o `chunkStreamingSystem`.
 *
 * Distância entre chunks = a maior das diferenças em X e em Z (um raio de
 * chunks forma um quadrado em volta do centro). Um chunk vale pela distância
 * até o centro MAIS PERTO (treinador ou criatura controlada).
 */

/** Distância (em chunks) de `(chunkX, chunkZ)` até o centro mais perto. */
function distanceToNearest(chunkX, chunkZ, centerChunks) {
  let nearest = Infinity
  for (const center of centerChunks) {
    const distance = Math.max(
      Math.abs(chunkX - center.chunkX),
      Math.abs(chunkZ - center.chunkZ),
    )
    nearest = Math.min(nearest, distance)
  }
  return nearest
}

const toCenterChunks = (centers, chunkSize) =>
  centers.map(({ x, z }) => ({
    chunkX: chunkCoordAt(x, chunkSize),
    chunkZ: chunkCoordAt(z, chunkSize),
  }))

/**
 * O plano do tick: o que carregar (os mais perto primeiro), o que
 * descarregar e o que fica carregado só pela folga entre os raios.
 *
 * - Carregar: até `loadRadius` de algum centro e ainda não carregado.
 *   `toLoadNow` são os de até `nearRadius` — o chão debaixo e em volta de
 *   quem é centro, que não espera a vez; o resto (`toLoadLater`) entra no
 *   limite por tick.
 * - Descarregar: carregado e a mais de `unloadRadius` de todos os centros.
 * - `kept`: carregado, fora do `loadRadius`, dentro do `unloadRadius`.
 *
 * Sem centro nenhum, não carrega nem descarrega nada.
 *
 * @param {object} input
 * @param {{ x: number, z: number }[]} input.centers - posições de mundo
 * @param {{ chunkX: number, chunkZ: number }[]} input.loaded
 * @param {number} input.chunkSize
 * @param {number} input.loadRadius
 * @param {number} input.unloadRadius
 * @param {number} input.nearRadius
 */
export function planChunkStreaming({
  centers,
  loaded,
  chunkSize,
  loadRadius,
  unloadRadius,
  nearRadius,
}) {
  const plan = { toLoadNow: [], toLoadLater: [], toUnload: [], kept: [] }
  if (centers.length === 0) return plan

  const centerChunks = toCenterChunks(centers, chunkSize)
  const loadedKeys = new Set(
    loaded.map(({ chunkX, chunkZ }) => chunkKey(chunkX, chunkZ)),
  )

  const wanted = new Map()
  for (const center of centerChunks) {
    for (let dx = -loadRadius; dx <= loadRadius; dx++) {
      for (let dz = -loadRadius; dz <= loadRadius; dz++) {
        const chunkX = center.chunkX + dx
        const chunkZ = center.chunkZ + dz
        const key = chunkKey(chunkX, chunkZ)
        if (loadedKeys.has(key) || wanted.has(key)) continue
        wanted.set(key, {
          chunkX,
          chunkZ,
          distance: distanceToNearest(chunkX, chunkZ, centerChunks),
        })
      }
    }
  }

  // Mais perto primeiro; empate pela distância de verdade até o centro,
  // depois pela posição (ordem estável).
  const byNearest = [...wanted.values()].sort(
    (a, b) =>
      a.distance - b.distance ||
      nearestSquared(a, centerChunks) - nearestSquared(b, centerChunks) ||
      a.chunkX - b.chunkX ||
      a.chunkZ - b.chunkZ,
  )
  for (const { chunkX, chunkZ, distance } of byNearest) {
    const list = distance <= nearRadius ? plan.toLoadNow : plan.toLoadLater
    list.push({ chunkX, chunkZ })
  }

  for (const { chunkX, chunkZ } of loaded) {
    const distance = distanceToNearest(chunkX, chunkZ, centerChunks)
    if (distance > unloadRadius) plan.toUnload.push({ chunkX, chunkZ })
    else if (distance > loadRadius) plan.kept.push({ chunkX, chunkZ })
  }

  return plan
}

function nearestSquared({ chunkX, chunkZ }, centerChunks) {
  let nearest = Infinity
  for (const center of centerChunks) {
    nearest = Math.min(
      nearest,
      (chunkX - center.chunkX) ** 2 + (chunkZ - center.chunkZ) ** 2,
    )
  }
  return nearest
}
