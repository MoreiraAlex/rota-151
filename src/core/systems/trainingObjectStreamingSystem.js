import { TEST_LEVEL } from '../data/testLevel'
import {
  carregarBonecosDoChunk,
  descarregarBonecosDoChunk,
} from '../actions/training'
import { chunkKey } from '../terrain/terrainChunk'
import { TrainingObjectChunks } from '../traits'

/**
 * Os bonecos de treino seguem os chunks carregados (docs/features/067-campo-
 * de-treino-e-avisos-de-nivel.md): chunk que carregou ganha as entidades dos
 * bonecos dos campos de treino dele (`carregarBonecosDoChunk`); chunk que
 * descarregou perde as dele (e quem treinava num deles para). Só trabalha
 * quando o conjunto de chunks muda (`TrainingObjectChunks.revision`).
 *
 * Headless. Fase: simulation, depois do `chunkStreamingSystem` (que acabou
 * de carregar e descarregar) e antes do `trainingSystem`.
 */
export function trainingObjectStreamingSystem(context, level = TEST_LEVEL) {
  const { world } = context
  if (!world.has(TrainingObjectChunks)) return
  const { terrain } = level
  const state = world.get(TrainingObjectChunks)
  const revision = terrain.getRevision?.() ?? 0
  if (state.revision === revision) return
  state.revision = revision

  const chunks = terrain.loadedChunks()
  const current = new Set(
    chunks.map((chunk) => chunkKey(chunk.chunkX, chunk.chunkZ)),
  )
  for (const key of [...state.loaded]) {
    if (!current.has(key)) descarregarBonecosDoChunk(world, key)
  }
  for (const chunk of chunks) carregarBonecosDoChunk(world, chunk)
}
