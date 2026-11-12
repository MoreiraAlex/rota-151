import { GAME_CONFIG } from '../gameConfig'
import { interiorCollidersOf, interiorOfBuilding } from '../data/interiors'
import { BUILDING_KIND, modelBoxOf } from '../town/townPlan'

/**
 * Onde ficam as portas dos prédios e as salas por dentro deles no mundo
 * (docs/features/068-interior-dos-predios.md). Puro: só contas.
 *
 * - A **porta** fica na frente do prédio (o +Z do modelo, onde a cidade
 *   vira a fachada para a rua — `yawFacing`, townPlan.js), no `doorX` da
 *   sala, na borda da caixa do modelo.
 * - A **sala** fica acima da porta, `INTERIOR.ALTITUDE` m sobre o chão
 *   dela, sem giro e na escala do prédio: o treinador não muda de chunk ao
 *   entrar, e quem está do lado de fora não o alcança.
 */

/**
 * O giro da câmera de frente para a sala (`OrbitCamera.yaw`): a sala não
 * gira e a frente aberta dela é o +Z, então a câmera fica do lado +Z
 * olhando para o −Z (a frente da câmera é `(−sin yaw, −cos yaw)`,
 * core/camera/orbitCamera.js).
 */
export const INTERIOR_FRONT_YAW = 0

/**
 * @typedef {object} Door
 * @property {string} interiorId a sala em que a porta dá
 * @property {number} x
 * @property {number} y o chão do prédio (a base dele)
 * @property {number} z
 * @property {number} yaw para onde a fachada olha (o giro do prédio)
 * @property {number} scale o tamanho do prédio (o da sala também)
 */

// `(localX, localZ)` girado `yaw` em volta de `(x, z)` — a mesma conta da
// pegada dos prédios (`rectFootprints`, townPlan.js).
function rotateAround(x, z, yaw, localX, localZ) {
  const cos = Math.cos(yaw)
  const sin = Math.sin(yaw)
  return {
    x: x + localX * cos + localZ * sin,
    z: z - localX * sin + localZ * cos,
  }
}

/**
 * A porta do prédio `building` (um `SolidPlacement` da cidade), ou `null`
 * se ele não tem sala por dentro.
 *
 * @returns {Door | null}
 */
export function doorOf(building) {
  if (building.kind !== BUILDING_KIND) return null
  const interior = interiorOfBuilding(building.model)
  if (!interior) return null
  const front = modelBoxOf(building.model)[3]
  const { x, z } = rotateAround(
    building.x,
    building.z,
    building.yaw,
    interior.doorX * building.scale,
    front * building.scale,
  )
  return {
    interiorId: interior.id,
    x,
    y: building.y,
    z,
    yaw: building.yaw,
    scale: building.scale,
  }
}

/**
 * A porta mais perto de `from` (no plano) a até `reach` m, entre os
 * prédios `buildings` — ou `null`.
 *
 * @returns {{ door: Door, distance: number } | null}
 */
export function nearestDoor(buildings, from, reach) {
  let best = null
  for (const building of buildings) {
    const door = doorOf(building)
    if (!door) continue
    const distance = Math.hypot(door.x - from.x, door.z - from.z)
    if (distance > reach || (best && distance >= best.distance)) continue
    best = { door, distance }
  }
  return best
}

/**
 * Onde o treinador para ao sair pela porta: `distance` m à frente dela,
 * virado para fora (`yaw`).
 */
export function outsideSpot(
  door,
  distance = GAME_CONFIG.INTERIOR.EXIT_DISTANCE,
) {
  return {
    x: door.x + Math.sin(door.yaw) * distance,
    z: door.z + Math.cos(door.yaw) * distance,
    yaw: door.yaw,
  }
}

/** Onde a sala da porta `door` fica no mundo (a origem do modelo dela). */
export function interiorOrigin(door) {
  return {
    x: door.x,
    y: door.y + GAME_CONFIG.INTERIOR.ALTITUDE,
    z: door.z,
  }
}

/**
 * O ponto `local` do modelo da sala (antes da escala; `y` opcional) no
 * mundo, com a sala em `place` (`{ x, y, z, scale }` — a origem e a
 * escala, a forma de `Indoors`). A sala não gira.
 */
export function interiorToWorld(place, local) {
  return {
    x: place.x + local.x * place.scale,
    y: place.y + (local.y ?? 0) * place.scale,
    z: place.z + local.z * place.scale,
  }
}

/**
 * O ponto de saída da sala `interior` no mundo (o meio do tapete da
 * entrada, na altura do piso), com a sala em `place`.
 */
export function interiorExitPoint(interior, place) {
  const { exit, floor } = interiorCollidersOf(interior)
  return interiorToWorld(place, { x: exit.x, y: floor.y, z: exit.z })
}

/**
 * Para onde a câmera olha dentro da sala `interior` (em `place`), com o
 * treinador em `position`: do meio do piso, a fração `follow` do caminho
 * até ele (no plano); a altura é a dele. Com `follow` 1, ele mesmo.
 */
export function interiorCameraFocus(interior, place, position, follow) {
  const { floor } = interiorCollidersOf(interior)
  const center = interiorToWorld(place, {
    x: (floor.minX + floor.maxX) / 2,
    z: (floor.minZ + floor.maxZ) / 2,
  })
  return {
    x: center.x + (position.x - center.x) * follow,
    y: position.y,
    z: center.z + (position.z - center.z) * follow,
  }
}
