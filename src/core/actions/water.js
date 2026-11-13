import { TEST_LEVEL } from '../data/testLevel'
import { GAME_CONFIG } from '../gameConfig'
import { deepWaterEntry, waterDepthAt } from '../terrain/water'
import { fixedTownWaterDepthAt } from '../town/fixedTown'
import { fountainAt, fountainsOfChunk } from '../town/fountains'
import { activeTownMapAt } from '../townMap/activeTownMap'
import {
  townMapWaterDepthAt,
  townMapWaterSurface,
} from '../townMap/townMapPlacement'
import { Position, Rotation, WaterSplash } from '../traits'

/**
 * A água no nível do jogo (docs/features/057-lagos-e-rios.md): as consultas
 * de `core/terrain/water.js` com o relevo de `TEST_LEVEL` — e a água rasa
 * das fontes das praças (docs/features/069-revisao-do-bioma-cidade.md,
 * `core/town/fountains.js`), para quem anda nela ter os passos, a
 * marolinha e o atraso da beirada dos rios.
 *
 * No mapa de uma cidade copiada (Pallet, mesma feature,
 * `core/townMap/activeTownMap.js`), vale a água dele — o mar — e não a do
 * relevo lá embaixo. Na cidade fixa no mundo (Viridian, a montada à mão,
 * `core/town/fixedTown.js`), o lago dela conta como os lagos do mundo (a
 * mesma regra: profundidade é a superfície menos o chão).
 */

// A cidade fixa no mundo (ou `null`).
const levelFixedTown = () => TEST_LEVEL.terrain.fixedTown?.() ?? null

/**
 * Profundidade (m) da água do relevo (lagos e rios, e o lago da cidade
 * montada à mão) em `(x, z)` — ou a do mar do mapa de cidade em que o
 * treinador está.
 */
export function levelTerrainWaterDepthAt(x, z) {
  const townMap = activeTownMapAt(x, z)
  if (townMap) {
    return townMapWaterDepthAt(townMap.colliders, townMap.place, x, z)
  }
  const { heightAt } = TEST_LEVEL.terrain
  const ground = heightAt(x, z)
  return Math.max(
    waterDepthAt(() => ground, x, z),
    fixedTownWaterDepthAt(levelFixedTown(), x, z, ground),
  )
}

// A fonte cuja água cobre `(x, z)`, nos chunks carregados: o do ponto e
// os vizinhos até `TOWN.FOUNTAIN_REACH` m (a fonte é do chunk do meio dela
// e pode passar da divisa).
function levelFountainAt(x, z) {
  const { terrain } = TEST_LEVEL
  const reach = GAME_CONFIG.TOWN.FOUNTAIN_REACH
  const seen = new Set()
  for (const [dx, dz] of [
    [0, 0],
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ]) {
    const chunk = terrain.loadedChunkAt?.(x + dx * reach, z + dz * reach)
    if (!chunk || seen.has(chunk)) continue
    seen.add(chunk)
    const fountain = fountainAt(fountainsOfChunk(chunk), x, z)
    if (fountain) return fountain
  }
  return null
}

/**
 * Profundidade (m) da água em `(x, z)` do mundo — a do relevo ou a de uma
 * fonte (a dela é a dos dados, rasa: ninguém é barrado), a mais funda; 0
 * ou menos = seco.
 */
export function levelWaterDepthAt(x, z) {
  const depth = levelTerrainWaterDepthAt(x, z)
  if (activeTownMapAt(x, z)) return depth
  const fountain = levelFountainAt(x, z)
  return fountain ? Math.max(depth, fountain.water.depth) : depth
}

/**
 * A altura (m) da superfície da água em `(x, z)`: a do mar do mapa de
 * cidade, dentro dele; a da fonte, dentro de uma; a do lago da cidade
 * montada à mão, dentro dele; senão o nível dos lagos e rios
 * (`TERRAIN.WATER_LEVEL`).
 */
export function levelWaterSurfaceAt(x, z) {
  const townMap = activeTownMapAt(x, z)
  if (townMap) {
    return (
      townMapWaterSurface(townMap.colliders, townMap.place) ??
      GAME_CONFIG.TERRAIN.WATER_LEVEL
    )
  }
  const fountain = levelFountainAt(x, z)
  if (fountain) return fountain.surface
  const town = levelFixedTown()
  const ground = TEST_LEVEL.terrain.heightAt(x, z)
  if (fixedTownWaterDepthAt(town, x, z, ground) > 0) return town.lake.surface
  return GAME_CONFIG.TERRAIN.WATER_LEVEL
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
