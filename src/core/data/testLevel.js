import { GAME_CONFIG } from '../gameConfig'
import { deriveSeed } from '../rng'
import { createTerrainChunkSet } from '../terrain/terrainChunkSet'

/**
 * Nível de teste.
 *
 * Fonte única: os colliders (core/physics), a grade de pathfinding
 * (core/pathfinding.js) e os meshes (view/scene/GameScene) são gerados a
 * partir daqui, então o visível bate com o colidível/andável.
 *
 * - terrain: o relevo — os chunks carregados agora, gerados pela seed do
 *   mundo (`core/terrain/terrainChunkSet.js`, docs/features/046-sistema-
 *   de-chunks.md). O mundo não tem borda: quem carrega e descarrega é o
 *   `chunkStreamingSystem`. Um nível sem chunks (os dos testes) pode ter
 *   `bounds` ({ minX, maxX, minZ, maxZ }): a área fixa que a grade de
 *   pathfinding cobre.
 * - obstacles: `{ id, type: 'box' | 'ramp' | 'floor', position, size,
 *   rotation? }` — position é o centro.
 * - size: dimensões completas [largura(x), altura(y), profundidade(z)], em unidades.
 * - rotation (opcional): giro em um eixo — { axis: 'x' | 'y' | 'z', angle } (rad).
 *
 * Os objetos de treino fixos (tronco e pedra perto da origem, 038) saíram:
 * agora se treina nos bonecos dos campos de treino das cidades
 * (docs/features/067-campo-de-treino-e-avisos-de-nivel.md), que vêm com o
 * chunk.
 */

const terrainSeed = () => deriveSeed(GAME_CONFIG.WORLD.SEED, 'terrain')

// O que sai da altura do relevo (não depende de chunk carregado): hoje,
// nenhum obstáculo fixo.
function buildTerrainDependentLevel() {
  return { obstacles: [] }
}

const terrain = createTerrainChunkSet({ seed: terrainSeed() })
const initialLevel = buildTerrainDependentLevel()

export const TEST_LEVEL = {
  terrain,
  ...initialLevel,
}

// Ajuste do relevo em tempo real (debug — `regenerarTerreno`,
// core/actions/terrain.js): quem desenha o nível assina as mudanças.
let levelRevision = 0
const levelListeners = new Set()

/** Número que muda a cada vez que o relevo do nível é refeito. */
export function getLevelRevision() {
  return levelRevision
}

/** Avisa `listener` quando o relevo do nível é refeito; devolve o cancelar. */
export function subscribeLevelChanges(listener) {
  levelListeners.add(listener)
  return () => levelListeners.delete(listener)
}

/**
 * Refaz, com a config atual (`GAME_CONFIG.TERRAIN`/`BIOMES`/`WORLD.SEED` e
 * os biomas do registro), tudo do nível que sai do relevo: a receita do
 * terreno. Só
 * com nenhum chunk carregado (quem descarrega antes é `regenerarTerreno`).
 * Os selvagens já nascidos ficam (quem os sobe para a superfície é
 * `regenerarTerreno`). Só a ferramenta de debug chama isto.
 */
export function rebuildTerrainDependentLevel() {
  TEST_LEVEL.terrain.reconfigure(terrainSeed())
  Object.assign(TEST_LEVEL, buildTerrainDependentLevel())
  levelRevision += 1
  for (const listener of levelListeners) listener()
}
