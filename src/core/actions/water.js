import { TEST_LEVEL } from '../data/testLevel'
import { GAME_CONFIG } from '../gameConfig'
import { deepWaterEntry, waterDepthAt } from '../terrain/water'
import { Position, Rotation, WaterSplash } from '../traits'

/**
 * A água no nível do jogo (docs/features/057-lagos-e-rios.md): as consultas
 * de `core/terrain/water.js` com o relevo de `TEST_LEVEL`.
 */

/** Profundidade (m) da água em `(x, z)` do mundo; 0 ou menos = seco. */
export function levelWaterDepthAt(x, z) {
  return waterDepthAt(TEST_LEVEL.terrain.heightAt, x, z)
}

/** Respingo na superfície em `point` (`size` 1 = um objeto afundando). */
export function respingarAgua(world, point, size = 1) {
  return world.spawn(
    Position({ x: point.x, y: point.y, z: point.z }),
    Rotation, // exigido por syncTransformSystem
    WaterSplash({ size, duration: GAME_CONFIG.WATER.SPLASH_DURATION }),
  )
}

/**
 * Onde o trajeto de `from` a `from + step` mergulha na água funda antes de
 * bater em `hitPoint` (o raycast do mesmo trajeto; `null` = não bateu), ou
 * `null` se não mergulha antes.
 */
export function mergulhoNoTrajeto(from, step, hitPoint = null) {
  const entry = deepWaterEntry(from, step, levelWaterDepthAt)
  if (!entry || !hitPoint) return entry
  const toEntry = Math.hypot(
    entry.x - from.x,
    entry.y - from.y,
    entry.z - from.z,
  )
  const toHit = Math.hypot(
    hitPoint.x - from.x,
    hitPoint.y - from.y,
    hitPoint.z - from.z,
  )
  return toEntry <= toHit ? entry : null
}
