import { GAME_CONFIG } from '../gameConfig'
import { createHeightSampler } from './terrainHeight'
import {
  chunkCoordAt,
  chunkHeightAt,
  chunkKey,
  generateTerrainChunk,
  latticeHeightAt,
} from './terrainChunk'

/**
 * Os chunks de relevo carregados agora (docs/features/046-sistema-de-
 * chunks.md). Só guarda os dados: quem decide o que carregar é o
 * `chunkStreamingSystem`, e o colisor e a grade de navegação de cada chunk
 * vêm das actions `carregarChunk`/`descarregarChunk`
 * (`core/actions/chunks.js`).
 *
 * `heightAt(x, z)` não depende do que está carregado: com o chunk, a altura
 * dele (mesmos triângulos do colisor); sem, a mesma conta direto do ruído
 * (`latticeHeightAt`). Quem nasce, o save e a navegação podem perguntar a
 * altura de qualquer lugar.
 *
 * `streamingStatus` diz, por chave, os chunks que o streaming quer e ainda
 * não carregou (`pending`) e os carregados que só ficam pela folga entre os
 * raios (`kept`) — para o debug. Quem desenha assina as mudanças
 * (`subscribe`/`getRevision`).
 *
 * Dono de escrita: `carregarChunk`/`descarregarChunk` (chunks),
 * `chunkStreamingSystem` (`streamingStatus`), `rebuildTerrainDependentLevel`
 * (`reconfigure`).
 *
 * @typedef {object} TerrainChunkSet
 * @property {(x: number, z: number) => number} heightAt
 * @property {(chunkX: number, chunkZ: number) => import('./terrainChunk').TerrainChunk} load
 * @property {(chunkX: number, chunkZ: number) => import('./terrainChunk').TerrainChunk | null} unload
 * @property {(chunkX: number, chunkZ: number) => boolean} isLoaded
 * @property {(x: number, z: number) => boolean} isLoadedAt
 * @property {() => import('./terrainChunk').TerrainChunk[]} loadedChunks
 * @property {(status: StreamingStatus) => void} setStreamingStatus
 * @property {() => StreamingStatus} streamingStatus
 * @property {(seed: number, params?: object) => void} reconfigure
 * @property {() => number} chunkSize
 * @property {() => number} getRevision
 * @property {(listener: () => void) => () => void} subscribe
 */

/** @typedef {{ pending: string[], kept: string[] }} StreamingStatus */

const NO_STATUS = { pending: [], kept: [] }

const sameKeys = (a, b) =>
  a.length === b.length && a.every((key, index) => key === b[index])

/** @returns {TerrainChunkSet} */
export function createTerrainChunkSet({ seed, params = GAME_CONFIG.TERRAIN }) {
  let sampler = createHeightSampler(seed, params)
  // Cópia: o painel de ajuste mexe no `GAME_CONFIG.TERRAIN` ao vivo, e os
  // chunks carregados seguem a receita com que nasceram até o
  // `reconfigure`.
  let recipe = { ...params }
  const chunks = new Map()
  let status = NO_STATUS
  let revision = 0
  const listeners = new Set()

  const notify = () => {
    revision += 1
    for (const listener of listeners) listener()
  }

  const size = () => recipe.CHUNK_SIZE
  const chunkAt = (x, z) =>
    chunks.get(chunkKey(chunkCoordAt(x, size()), chunkCoordAt(z, size())))

  return {
    heightAt(x, z) {
      const chunk = chunkAt(x, z)
      return chunk
        ? chunkHeightAt(chunk, x, z)
        : latticeHeightAt(sampler, x, z, size())
    },

    load(chunkX, chunkZ) {
      const key = chunkKey(chunkX, chunkZ)
      if (chunks.has(key)) return chunks.get(key)
      const chunk = generateTerrainChunk(sampler, chunkX, chunkZ, recipe)
      chunks.set(key, chunk)
      notify()
      return chunk
    },

    unload(chunkX, chunkZ) {
      const key = chunkKey(chunkX, chunkZ)
      const chunk = chunks.get(key)
      if (!chunk) return null
      chunks.delete(key)
      notify()
      return chunk
    },

    isLoaded: (chunkX, chunkZ) => chunks.has(chunkKey(chunkX, chunkZ)),
    isLoadedAt: (x, z) => Boolean(chunkAt(x, z)),
    loadedChunks: () => [...chunks.values()],

    setStreamingStatus(next) {
      const isSame =
        sameKeys(next.pending, status.pending) &&
        sameKeys(next.kept, status.kept)
      if (isSame) return
      status = next
      notify()
    },
    streamingStatus: () => status,

    /**
     * Troca a seed e a receita (ajuste em tempo real). Só com nada
     * carregado: os chunks de antes têm colisor e grade que só as actions
     * sabem desfazer.
     */
    reconfigure(newSeed, newParams = GAME_CONFIG.TERRAIN) {
      if (chunks.size > 0) {
        throw new Error('reconfigure com chunks carregados')
      }
      sampler = createHeightSampler(newSeed, newParams)
      recipe = { ...newParams }
      status = NO_STATUS
      notify()
    },

    chunkSize: size,
    getRevision: () => revision,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}
