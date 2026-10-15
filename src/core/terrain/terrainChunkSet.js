import { placeChunkBushes } from '../vegetation/bushPlacement'
import { createCityIndex } from '../town/cityIndex'
import { chunkRoads } from '../town/roads'
import { chunkStreets, withStreets } from '../town/townPlan'
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
 * Cada chunk carregado leva também os arbustos dele (`bushes`,
 * `placeChunkBushes`, sorteados por bloco como os sólidos — o F vasculha,
 * docs/features/055-itens-no-mundo.md), os objetos sólidos dele (`solids`:
 * árvores, pedras e os prédios das cidades — `placeChunkSolids`,
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
 * @property {(x: number, z: number) => { x: number, z: number }} flowAt -
 *   correnteza dos rios (docs/features/057-lagos-e-rios.md)
 * @property {(x: number, z: number, weightsOut?: Float64Array) => number} sample -
 *   altura do relevo da seed em `(x, z)` (sem trilhas), com os pesos dos
 *   biomas em `weightsOut` (na ordem de `recipe().biomeList`)
 * @property {() => import('./terrainHeight').TerrainRecipe} recipe - a
 *   receita em uso (troca no `reconfigure`)
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
 * @property {(x: number, z: number) => { city: import('../town/citySites').CitySite, distance: number } | null} nearestCity -
 *   a cidade da seed mais perto e a distância (m) até o centro dela
 * @property {() => SolidsBlock[]} loadedBlocks - os blocos de sólidos com
 *   algum chunk carregado (a view desenha a vegetação por bloco)
 * @property {(x: number, z: number, reach: number) => import('../vegetation/solidPlacement').Footprint[]} footprintsAround -
 *   pegadas dos objetos sólidos até `reach` m de `(x, z)`, com ou sem
 *   chunk carregado
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
// O ponto `(x, z)` está dentro do chunk?
const isInsideChunk = ({ x, z }, chunk) =>
  x >= chunk.minX &&
  x < chunk.minX + chunk.size &&
  z >= chunk.minZ &&
  z < chunk.minZ + chunk.size

function solidsOfChunk(blockSolids, chunk) {
  const isInside = (point) => isInsideChunk(point, chunk)
  return {
    trees: blockSolids.trees.filter(isInside),
    rocks: blockSolids.rocks.filter(isInside),
    buildings: (blockSolids.buildings ?? []).filter(isInside),
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

/**
 * O índice de cidades do mundo (core/town/cityIndex.js) pela receita e o
 * relevo da seed — `null` sem bioma de cidade. Um por `sampler`: as
 * cidades achadas ficam guardadas até a seed ou a receita mudar.
 */
function worldCityIndex(seed, recipe, sampler) {
  const { biomeList, terrain } = recipe
  const town = biomeList.find((biome) => biome.town)?.town
  if (!town) return null
  const isTown = biomeList.map((biome) => Boolean(biome.town))
  const weights = new Float64Array(biomeList.length)
  return createCityIndex({
    seed,
    town,
    terrain,
    shareAt(x, z) {
      sampler.sample(x, z, weights)
      let share = 0
      for (let i = 0; i < weights.length; i++) {
        if (isTown[i]) share += weights[i]
      }
      return share
    },
    heightAt: (x, z) => sampler.sample(x, z),
    sites: sampler.cities,
  })
}

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
  let cities = worldCityIndex(seed, recipe, sampler)
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

  // As estradas entre as cidades (docs/features/058-ajuste-dos-biomas.md):
  // afundam como as trilhas e vão no mesmo canal (`chunk.trails` — a
  // vegetação não nasce nelas); `chunk.roads` fica também à parte, para o
  // chão pintar a estrada em todo bioma.
  function addRoads(chunk) {
    chunk.roads = chunkRoads(chunk, sampler.roads)
    carveTrails(chunk, chunk.roads, recipe.roads)
    chunk.trails = withStreets(chunk.trails, chunk.roads)
  }

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
    addRoads(ground)
    ground.streets = chunkStreets(ground, { biomeList: recipe.biomeList })
    ground.trails = withStreets(ground.trails, ground.streets)
    return ground
  }

  // Um bloco de sólidos (o relevo, os sólidos e os arbustos dele).
  function buildBlock(blockX, blockZ) {
    const ground = blockGround(blockX, blockZ)
    ground.vegetationSeed = vegetationSeed
    ground.solids = placeChunkSolids(ground, {
      seed: vegetationSeed,
      biomeList: recipe.biomeList,
      terrain: recipe.terrain,
      params: recipe.solids,
      cities,
    })
    // Os arbustos, que o F vasculha (docs/features/055-itens-no-mundo.md),
    // no bloco inteiro como os sólidos (a view desenha o bloco) e depois
    // deles, fora das pegadas.
    ground.bushes = placeChunkBushes(ground, { biomeList: recipe.biomeList })
    return {
      key: chunkKey(blockX, blockZ),
      blockX,
      blockZ,
      ground,
      solids: ground.solids,
      chunkKeys: new Set(),
    }
  }

  // O bloco do chunk, sorteado na primeira vez.
  function blockOf(chunk) {
    const blockX = chunkCoordAt(chunk.minX + chunk.size / 2, blockSize())
    const blockZ = chunkCoordAt(chunk.minZ + chunk.size / 2, blockSize())
    const key = chunkKey(blockX, blockZ)
    if (!blocks.has(key)) blocks.set(key, buildBlock(blockX, blockZ))
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
    // A cidade da seed mais perto de `(x, z)` e a distância (m) até ela
    // (docs/features/058-ajuste-dos-biomas.md) — `null` sem cidades.
    nearestCity: (x, z) => sampler.cities?.nearestCity(x, z) ?? null,
    // Correnteza dos rios em `(x, z)` (docs/features/057-lagos-e-rios.md).
    flowAt: (x, z) => sampler.flowAt(x, z),

    sample: (x, z, weightsOut) => sampler.sample(x, z, weightsOut),
    recipe: () => recipe,

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
      addRoads(chunk)
      // As ruas das cidades no mesmo canal, depois de afundar as trilhas:
      // pintam o chão e afastam a vegetação, sem afundar.
      // `streets` fica também à parte: o que é só de trilha (os seixos) não
      // nasce na rua.
      chunk.streets = chunkStreets(chunk, { biomeList: recipe.biomeList })
      chunk.trails = withStreets(chunk.trails, chunk.streets)
      // A rua da cidade pinta com o calçamento do tema dela
      // (docs/features/056-bioma-cidade.md).
      chunk.streetLayer =
        cities?.themeNear(
          chunk.minX + chunk.size / 2,
          chunk.minZ + chunk.size / 2,
        )?.street ?? null
      const block = blockOf(chunk)
      block.chunkKeys.add(key)
      chunk.solidsBlock = block.key
      chunk.solids = solidsOfChunk(block.solids, chunk)
      chunk.bushes = block.ground.bushes.filter((bush) =>
        isInsideChunk(bush, chunk),
      )
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

    // As pegadas dos sólidos em volta de `(x, z)` (até `reach` m), com ou
    // sem chunk carregado: o bloco que não está carregado é sorteado só
    // para a consulta, sem guardar (o save, ao voltar para uma posição
    // longe — docs/features/058-ajuste-dos-biomas.md).
    footprintsAround(x, z, reach) {
      const found = []
      const minX = x - reach
      const maxX = x + reach
      const minZ = z - reach
      const maxZ = z + reach
      const fromX = chunkCoordAt(minX, blockSize())
      const fromZ = chunkCoordAt(minZ, blockSize())
      for (let bx = fromX; bx <= chunkCoordAt(maxX, blockSize()); bx++) {
        for (let bz = fromZ; bz <= chunkCoordAt(maxZ, blockSize()); bz++) {
          const block = blocks.get(chunkKey(bx, bz)) ?? buildBlock(bx, bz)
          for (const circle of block.solids.footprints) {
            if (touchesRect(circle, minX, maxX, minZ, maxZ)) found.push(circle)
          }
        }
      }
      return found
    },

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
      cities = worldCityIndex(newSeed, recipe, sampler)
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
