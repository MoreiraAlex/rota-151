import { GAME_CONFIG } from '../gameConfig'
import { TEST_LEVEL } from '../data/testLevel'
import { carregarChunk, descarregarChunk } from '../actions/chunks'
import { planChunkStreaming } from '../terrain/chunkStreaming'
import { chunkKey } from '../terrain/terrainChunk'
import { InputControlled, Party, Position } from '../traits'

const keyOf = ({ chunkX, chunkZ }) => chunkKey(chunkX, chunkZ)

/**
 * Carrega os chunks em volta do treinador e da criatura controlada e
 * descarrega os distantes (docs/features/046-sistema-de-chunks.md). As
 * regras (raios, ordem, folga) são de `planChunkStreaming`; aqui só aplica:
 *
 * - os chunks de até `NEAR_RADIUS` de um centro carregam na hora — o chão
 *   debaixo de quem anda (e o da primeira entrada) nunca espera;
 * - o resto, os mais perto primeiro, até `CHUNKS_PER_TICK` por tick (gerar
 *   um chunk custa alguns ms; vários de uma vez travariam o quadro);
 * - os que passaram de `UNLOAD_RADIUS` de todos os centros descarregam.
 *
 * Também publica o que falta carregar e o que só ficou pela folga
 * (`terrain.setStreamingStatus`, para o debug).
 *
 * Headless. Fase: simulation, logo depois da troca de controle (centros
 * deste tick) e antes do `chunkFreezeSystem` e de qualquer movimento.
 */
export function chunkStreamingSystem(context) {
  const { world } = context
  const { terrain } = TEST_LEVEL
  const { LOAD_RADIUS, UNLOAD_RADIUS, NEAR_RADIUS, CHUNKS_PER_TICK } =
    GAME_CONFIG.TERRAIN

  const centers = [
    ...world.query(Position, Party).map((entity) => entity.get(Position)),
    ...world
      .query(Position, InputControlled)
      .map((entity) => entity.get(Position)),
  ]

  const plan = planChunkStreaming({
    centers,
    loaded: terrain.loadedChunks(),
    chunkSize: terrain.chunkSize(),
    loadRadius: LOAD_RADIUS,
    // Nunca menor que o de carregar: senão um chunk carregaria e
    // descarregaria no mesmo lugar, sem parar.
    unloadRadius: Math.max(UNLOAD_RADIUS, LOAD_RADIUS),
    nearRadius: NEAR_RADIUS,
  })

  for (const { chunkX, chunkZ } of plan.toUnload) {
    descarregarChunk(chunkX, chunkZ)
  }
  for (const { chunkX, chunkZ } of plan.toLoadNow) {
    carregarChunk(chunkX, chunkZ)
  }
  const nowLater = plan.toLoadLater.slice(0, CHUNKS_PER_TICK)
  for (const { chunkX, chunkZ } of nowLater) {
    carregarChunk(chunkX, chunkZ)
  }

  terrain.setStreamingStatus({
    pending: plan.toLoadLater.slice(CHUNKS_PER_TICK).map(keyOf),
    kept: plan.kept.map(keyOf),
  })
}
