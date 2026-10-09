import { placeChunkSolids } from '../vegetation/solidPlacement'
import { carveTrails, chunkTrails } from './trails'
import {
  copyTerrainRecipe,
  createTerrainSampler,
  currentTerrainRecipe,
} from './terrainHeight'
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
 * Cada chunk carregado leva também os objetos sólidos dele (`solids`:
 * árvores, troncos caídos e pedras — `placeChunkSolids`,
 * docs/features/049-vegetacao-e-floresta.md) — o colisor e a grade de
 * navegação saem deles, e a view os desenha — e a seed da vegetação
 * (`vegetationSeed`, para a view sortear a vegetação só visual com as
 * mesmas clareiras).
 *
 * Os sólidos saem por BLOCO de `SOLIDS_BLOCK_SIZE` m (vários chunks): o
 * bloco é sorteado inteiro (com as alturas e as trilhas dele) quando o
 * primeiro chunk dele carrega, e cada chunk fica com os objetos de centro
 * dentro dele. Um objeto pode passar da borda do chunk (não da do bloco —
 * `placeChunkSolids` deixa a folga): com chunks pequenos, a folga em cada
 * chunk deixaria faixas sem árvore. `footprintsIn` procura nos blocos —
 * inclusive nos chunks ainda não carregados deles —, então a navegação de
 * um chunk já conta com a árvore do vizinho que entra nele.
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
 * @property {(x: number, z: number) => object} biomeAt - bioma de maior
 *   peso (`core/data/biomes/`)
 * @property {(chunkX: number, chunkZ: number) => import('./terrainChunk').TerrainChunk} load
 * @property {(chunkX: number, chunkZ: number) => import('./terrainChunk').TerrainChunk | null} unload
 * @property {(chunkX: number, chunkZ: number) => boolean} isLoaded
 * @property {(x: number, z: number) => boolean} isLoadedAt
 * @property {() => import('./terrainChunk').TerrainChunk[]} loadedChunks
 * @property {(minX: number, maxX: number, minZ: number, maxZ: number) => import('../vegetation/solidPlacement').Footprint[]} footprintsIn -
 *   pegadas dos objetos sólidos que tocam o retângulo (dos blocos dos
 *   chunks carregados)
 * @property {() => SolidsBlock[]} loadedBlocks - os blocos de sólidos com
 *   algum chunk carregado (a view desenha a vegetação por bloco)
 * @property {(status: StreamingStatus) => void} setStreamingStatus
 * @property {() => StreamingStatus} streamingStatus
 * @property {(seed: number, recipe?: import('./terrainHeight').TerrainRecipe) => void} reconfigure
 * @property {() => number} chunkSize
 * @property {() => number} getRevision
 * @property {(listener: () => void) => () => void} subscribe
 */

/** @typedef {{ pending: string[], kept: string[] }} StreamingStatus */

/**
 * @typedef {object} SolidsBlock
 * @property {string} key
 * @property {number} blockX
 * @property {number} blockZ
 * @property {import('./terrainChunk').TerrainChunk} ground - o relevo do
 *   bloco inteiro (com as trilhas, a seed da vegetação e os sólidos) — a
 *   view desenha a vegetação do bloco a partir dele
 * @property {import('../vegetation/solidPlacement').ChunkSolids} solids -
 *   os do bloco inteiro
 * @property {Set<string>} chunkKeys - os chunks carregados dele
 */

// O que de um bloco cai num chunk: os objetos de centro dentro dele e as
// pegadas (de qualquer um do bloco) que tocam o chunk.
function solidsOfChunk(blockSolids, chunk) {
  const isInside = ({ x, z }) =>
    x >= chunk.minX &&
    x < chunk.minX + chunk.size &&
    z >= chunk.minZ &&
    z < chunk.minZ + chunk.size
  return {
    trees: blockSolids.trees.filter(isInside),
    logs: blockSolids.logs.filter(isInside),
    rocks: blockSolids.rocks.filter(isInside),
    footprints: blockSolids.footprints.filter((circle) =>
      touchesRect(
        circle,
        chunk.minX,
        chunk.minX + chunk.size,
        chunk.minZ,
        chunk.minZ + chunk.size,
      ),
    ),
  }
}

const touchesRect = (circle, minX, maxX, minZ, maxZ) =>
  circle.x + circle.radius >= minX &&
  circle.x - circle.radius <= maxX &&
  circle.z + circle.radius >= minZ &&
  circle.z - circle.radius <= maxZ

const NO_STATUS = { pending: [], kept: [] }

const sameKeys = (a, b) =>
  a.length === b.length && a.every((key, index) => key === b[index])

/** @returns {TerrainChunkSet} */
export function createTerrainChunkSet({
  seed,
  recipe: initialRecipe = currentTerrainRecipe(),
}) {
  // Cópia: o painel de ajuste mexe no `GAME_CONFIG` e nos biomas ao vivo, e
  // os chunks carregados seguem a receita com que nasceram até o
  // `reconfigure`.
  let recipe = copyTerrainRecipe(initialRecipe)
  let vegetationSeed = seed
  let sampler = createTerrainSampler(seed, recipe)
  const chunks = new Map()
  const blocks = new Map()
  let status = NO_STATUS
  let revision = 0
  const listeners = new Set()

  const notify = () => {
    revision += 1
    for (const listener of listeners) listener()
  }

  const size = () => recipe.terrain.CHUNK_SIZE
  const blockSize = () => recipe.terrain.SOLIDS_BLOCK_SIZE

  // O chunk do relevo de um bloco inteiro, com as trilhas afundadas — de
  // onde saem os sólidos dele (a mesma conta dos chunks: as alturas batem).
  function blockGround(blockX, blockZ) {
    const ground = generateTerrainChunk(sampler, blockX, blockZ, {
      ...recipe.terrain,
      CHUNK_SIZE: blockSize(),
    })
    ground.trails = chunkTrails(ground, {
      seed: vegetationSeed,
      biomeList: recipe.biomeList,
      params: recipe.trails,
      waterLevel: recipe.terrain.WATER_LEVEL,
    })
    carveTrails(ground, ground.trails, recipe.trails)
    return ground
  }

  // O bloco do chunk, sorteado na primeira vez.
  function blockOf(chunk) {
    const blockX = chunkCoordAt(chunk.minX + chunk.size / 2, blockSize())
    const blockZ = chunkCoordAt(chunk.minZ + chunk.size / 2, blockSize())
    const key = chunkKey(blockX, blockZ)
    if (!blocks.has(key)) {
      const ground = blockGround(blockX, blockZ)
      ground.vegetationSeed = vegetationSeed
      ground.solids = placeChunkSolids(ground, {
        seed: vegetationSeed,
        biomeList: recipe.biomeList,
        terrain: recipe.terrain,
        params: recipe.solids,
      })
      blocks.set(key, {
        key,
        blockX,
        blockZ,
        ground,
        solids: ground.solids,
        chunkKeys: new Set(),
      })
    }
    return blocks.get(key)
  }
  const chunkAt = (x, z) =>
    chunks.get(chunkKey(chunkCoordAt(x, size()), chunkCoordAt(z, size())))

  return {
    heightAt(x, z) {
      const chunk = chunkAt(x, z)
      return chunk
        ? chunkHeightAt(chunk, x, z)
        : latticeHeightAt(sampler, x, z, size())
    },

    biomeAt: (x, z) => sampler.biomeAt(x, z),

    load(chunkX, chunkZ) {
      const key = chunkKey(chunkX, chunkZ)
      if (chunks.has(key)) return chunks.get(key)
      const chunk = generateTerrainChunk(
        sampler,
        chunkX,
        chunkZ,
        recipe.terrain,
      )
      chunk.vegetationSeed = vegetationSeed
      // As trilhas antes dos sólidos: nada nasce nelas.
      chunk.trails = chunkTrails(chunk, {
        seed: vegetationSeed,
        biomeList: recipe.biomeList,
        params: recipe.trails,
        waterLevel: recipe.terrain.WATER_LEVEL,
      })
      carveTrails(chunk, chunk.trails, recipe.trails)
      const block = blockOf(chunk)
      block.chunkKeys.add(key)
      chunk.solidsBlock = block.key
      chunk.solids = solidsOfChunk(block.solids, chunk)
      chunks.set(key, chunk)
      notify()
      return chunk
    },

    unload(chunkX, chunkZ) {
      const key = chunkKey(chunkX, chunkZ)
      const chunk = chunks.get(key)
      if (!chunk) return null
      chunks.delete(key)
      const block = blocks.get(chunk.solidsBlock)
      block?.chunkKeys.delete(key)
      if (block && block.chunkKeys.size === 0) blocks.delete(block.key)
      notify()
      return chunk
    },

    isLoaded: (chunkX, chunkZ) => chunks.has(chunkKey(chunkX, chunkZ)),
    isLoadedAt: (x, z) => Boolean(chunkAt(x, z)),
    loadedChunks: () => [...chunks.values()],

    footprintsIn(minX, maxX, minZ, maxZ) {
      const found = []
      for (const block of blocks.values()) {
        for (const circle of block.solids.footprints) {
          if (touchesRect(circle, minX, maxX, minZ, maxZ)) found.push(circle)
        }
      }
      return found
    },

    loadedBlocks: () => [...blocks.values()],

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
    reconfigure(newSeed, newRecipe = currentTerrainRecipe()) {
      if (chunks.size > 0) {
        throw new Error('reconfigure com chunks carregados')
      }
      recipe = copyTerrainRecipe(newRecipe)
      blocks.clear()
      vegetationSeed = newSeed
      sampler = createTerrainSampler(newSeed, recipe)
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
