import { TEST_LEVEL, rebuildTerrainDependentLevel } from '../data/testLevel'
import { GAME_CONFIG } from '../gameConfig'
import { resetLevelNavigation } from '../pathfinding'
import {
  createStaticLevel,
  destroyStaticLevel,
  teleportCharacterBody,
  verticalClearance,
} from '../physics/colliders'
import { isLevelBuilt, isPhysicsReady } from '../physics/physicsWorld'
import { CharacterController, PhysicsBody, Position } from '../traits'
import { descarregarTodosOsChunks } from './chunks'

/**
 * Refaz o relevo com a config atual (`GAME_CONFIG.TERRAIN`/`WORLD.SEED`) —
 * ajuste em tempo real pela ferramenta de debug
 * (`tools/debug/TerrainTuningPanel.jsx`, docs/features/045-terreno-de-um-
 * chunk.md). Descarrega todos os chunks (o `chunkStreamingSystem` carrega
 * de novo, já com a receita nova, no próximo tick), refaz o nível
 * (`rebuildTerrainDependentLevel`), os colliders estáticos e a navegação, e
 * põe todo personagem que ficou enterrado em cima do chão.
 */
export function regenerarTerreno(world) {
  descarregarTodosOsChunks()
  rebuildTerrainDependentLevel()
  resetLevelNavigation()

  if (isPhysicsReady() && isLevelBuilt()) {
    destroyStaticLevel()
    createStaticLevel()
  }

  const { terrain } = TEST_LEVEL
  world
    .query(Position, CharacterController, PhysicsBody)
    .updateEach(([position, controller, body]) => {
      const standingY =
        terrain.heightAt(position.x, position.z) + verticalClearance(controller)
      if (position.y >= standingY) return

      position.y = standingY + GAME_CONFIG.TERRAIN.SPAWN_HEIGHT
      teleportCharacterBody(body.bodyHandle, { ...position })
    })
}
