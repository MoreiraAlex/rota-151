import { TEST_LEVEL, rebuildTerrainDependentLevel } from '../data/testLevel'
import { GAME_CONFIG } from '../gameConfig'
import { clamp } from '../math'
import { resetLevelNavigation } from '../pathfinding'
import {
  createStaticLevel,
  destroyStaticLevel,
  teleportCharacterBody,
  verticalClearance,
} from '../physics/colliders'
import { isLevelBuilt, isPhysicsReady } from '../physics/physicsWorld'
import { CharacterController, PhysicsBody, Position } from '../traits'

// Folga (m) da borda ao trazer de volta quem ficou fora da área.
const BOUNDS_INSET = 2

/**
 * Refaz o relevo com a config atual (`GAME_CONFIG.TERRAIN`/`WORLD.SEED`) —
 * ajuste em tempo real pela ferramenta de debug
 * (`tools/debug/TerrainTuningPanel.jsx`, docs/features/045-terreno-de-um-
 * chunk.md). Refaz o nível (`rebuildTerrainDependentLevel`), os colliders
 * estáticos e a navegação, e põe todo personagem que ficou enterrado ou fora
 * da área de volta em cima do chão.
 */
export function regenerarTerreno(world) {
  rebuildTerrainDependentLevel()
  resetLevelNavigation()

  if (isPhysicsReady() && isLevelBuilt()) {
    destroyStaticLevel()
    createStaticLevel()
  }

  const { terrain, bounds } = TEST_LEVEL
  world
    .query(Position, CharacterController, PhysicsBody)
    .updateEach(([position, controller, body]) => {
      const x = clamp(
        position.x,
        bounds.minX + BOUNDS_INSET,
        bounds.maxX - BOUNDS_INSET,
      )
      const z = clamp(
        position.z,
        bounds.minZ + BOUNDS_INSET,
        bounds.maxZ - BOUNDS_INSET,
      )
      const standingY = terrain.heightAt(x, z) + verticalClearance(controller)
      const isOutside = x !== position.x || z !== position.z
      if (!isOutside && position.y >= standingY) return

      position.x = x
      position.y = standingY + GAME_CONFIG.TERRAIN.SPAWN_HEIGHT
      position.z = z
      teleportCharacterBody(body.bodyHandle, { ...position })
    })
}
