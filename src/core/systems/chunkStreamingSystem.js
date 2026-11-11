import { GAME_CONFIG } from '../gameConfig'
import { TEST_LEVEL } from '../data/testLevel'
import { carregarChunk, descarregarChunk } from '../actions/chunks'
import { planChunkStreaming } from '../terrain/chunkStreaming'
import { chunkCoordAt, chunkKey } from '../terrain/terrainChunk'
import { viewDistanceOf } from '../actions/graphicsSettings'
import { GraphicsSettings, InputControlled, Party, Position } from '../traits'

const keyOf = ({ chunkX, chunkZ }) => chunkKey(chunkX, chunkZ)

// A entrada do último plano de cada mundo (`planInput`): igual, o plano
// sairia igual e já foi aplicado — nada a fazer.
const lastPlanInput = new WeakMap()

// Tudo de que o plano depende: o chunk de cada centro, o que está carregado
// (a revisão do terreno muda a cada chunk que entra ou sai) e os raios.
function planInput(centers, terrain, settings) {
  const size = terrain.chunkSize()
  const centerChunks = centers.map(
    ({ x, z }) => `${chunkCoordAt(x, size)},${chunkCoordAt(z, size)}`,
  )
  return [terrain.getRevision(), size, ...settings, ...centerChunks].join('|')
}

/**
 * Carrega os chunks em volta do treinador e da criatura controlada e
 * descarrega os distantes (docs/features/046-sistema-de-chunks.md). As
 * regras (raios, ordem, folga) são de `planChunkStreaming`; aqui só aplica:
 *
 * - os chunks de até `NEAR_RADIUS` de um centro carregam na hora — o chão
 *   debaixo de quem anda (e o da primeira entrada) nunca espera;
 * - o resto, os mais perto primeiro, até `CHUNKS_PER_TICK` por tick (gerar
 *   um chunk custa alguns ms; vários de uma vez travariam o quadro);
 * - os que passaram do raio + `UNLOAD_MARGIN` de todos os centros
 *   descarregam.
 *
 * O raio é a distância de visão do menu "Gráficos" (`GraphicsSettings`;
 * com mais de um treinador, a maior), publicada em `terrain.setLoadRadius`
 * — a névoa e o spawn das selvagens medem por ela.
 *
 * Também publica o que falta carregar e o que só ficou pela folga
 * (`terrain.setStreamingStatus`, para o debug).
 *
 * Parado (nenhum centro trocou de chunk e o terreno não mudou desde o
 * último plano), não planeja de novo: o plano sairia igual e já foi
 * aplicado (docs/features/066-revisao-dos-biomas.md, desempenho).
 *
 * Headless. Fase: simulation, logo depois da troca de controle (centros
 * deste tick) e antes do `chunkFreezeSystem` e de qualquer movimento.
 */
export function chunkStreamingSystem(context) {
  const { world } = context
  const { terrain } = TEST_LEVEL
  const { UNLOAD_MARGIN, NEAR_RADIUS, CHUNKS_PER_TICK } = GAME_CONFIG.TERRAIN
  const loadRadius = chosenLoadRadius(world)
  terrain.setLoadRadius(loadRadius)

  const centers = [
    ...world.query(Position, Party).map((entity) => entity.get(Position)),
    ...world
      .query(Position, InputControlled)
      .map((entity) => entity.get(Position)),
  ]

  const input = planInput(centers, terrain, [
    loadRadius,
    UNLOAD_MARGIN,
    NEAR_RADIUS,
    CHUNKS_PER_TICK,
  ])
  if (lastPlanInput.get(world) === input) return
  lastPlanInput.set(world, input)

  const plan = planChunkStreaming({
    centers,
    loaded: terrain.loadedChunks(),
    chunkSize: terrain.chunkSize(),
    loadRadius,
    // Nunca menor que o de carregar: senão um chunk carregaria e
    // descarregaria no mesmo lugar, sem parar.
    unloadRadius: loadRadius + Math.max(UNLOAD_MARGIN, 0),
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

// A distância de visão escolhida (a maior entre os treinadores); sem
// nenhum, a padrão.
function chosenLoadRadius(world) {
  let radius = null
  world.query(GraphicsSettings).forEach((entity) => {
    const chosen = viewDistanceOf(entity.get(GraphicsSettings).viewDistance)
    if (radius === null || chosen > radius) radius = chosen
  })
  return radius ?? viewDistanceOf(GAME_CONFIG.GRAPHICS.VIEW_DISTANCE.DEFAULT)
}
