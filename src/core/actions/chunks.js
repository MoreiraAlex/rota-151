import { TEST_LEVEL } from '../data/testLevel'
import { chunkKey } from '../terrain/terrainChunk'
import {
  addLevelNavigationRegion,
  removeLevelNavigationRegion,
} from '../pathfinding'
import {
  addLevelChunkCollider,
  removeLevelChunkCollider,
} from '../physics/colliders'
import { isLevelBuilt, isPhysicsReady } from '../physics/physicsWorld'
import { ChunkFrozen, Velocity } from '../traits'

/**
 * Carregar e descarregar chunks do mundo (docs/features/046-sistema-de-
 * chunks.md). Um chunk carregado tem três partes, que nascem e morrem
 * juntas: os dados do relevo (`TEST_LEVEL.terrain`), a grade de navegação
 * e o colisor. A malha é da view (`TerrainView`), que assina o conjunto.
 */

const chunkBounds = (chunk) => ({
  minX: chunk.minX,
  maxX: chunk.minX + chunk.size,
  minZ: chunk.minZ,
  maxZ: chunk.minZ + chunk.size,
})

/** Carrega o chunk `(chunkX, chunkZ)`; já carregado, nada. */
export function carregarChunk(chunkX, chunkZ) {
  const { terrain } = TEST_LEVEL
  if (terrain.isLoaded(chunkX, chunkZ)) return

  const chunk = terrain.load(chunkX, chunkZ)
  addLevelNavigationRegion(chunkKey(chunkX, chunkZ), chunkBounds(chunk))
  // Física ainda não pronta: o colisor nasce com o resto do nível
  // (`createStaticLevel`, que cria o dos chunks já carregados).
  if (isPhysicsReady() && isLevelBuilt()) addLevelChunkCollider(chunk)
}

/** Descarrega o chunk `(chunkX, chunkZ)`, liberando grade e colisor. */
export function descarregarChunk(chunkX, chunkZ) {
  const chunk = TEST_LEVEL.terrain.unload(chunkX, chunkZ)
  if (!chunk) return

  removeLevelNavigationRegion(chunkKey(chunkX, chunkZ))
  removeLevelChunkCollider(chunkX, chunkZ)
}

/** Descarrega todos (relevo refeito, `regenerarTerreno`; testes). */
export function descarregarTodosOsChunks() {
  for (const { chunkX, chunkZ } of TEST_LEVEL.terrain.loadedChunks()) {
    descarregarChunk(chunkX, chunkZ)
  }
}

/**
 * Para o personagem cujo chunk não está carregado (`ChunkFrozen`): sem
 * velocidade, não cai nem anda até o chunk voltar.
 */
export function congelarPorChunk(entity) {
  entity.add(ChunkFrozen)
  if (entity.has(Velocity)) entity.set(Velocity, { x: 0, y: 0, z: 0 })
}

/** O chunk voltou: segue de onde estava. */
export function descongelarPorChunk(entity) {
  entity.remove(ChunkFrozen)
}

/**
 * Objeto solto num chunk que descarregou (comida, bola no chão, projétil):
 * sai do jogo de vez — a bola no chão leva o Pokémon junto, que já não ia
 * para o save (`pokemonSave.js`).
 */
export function removerObjetoSolto(entity) {
  entity.destroy()
}
