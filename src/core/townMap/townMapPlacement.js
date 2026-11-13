import { getBiome } from '../data/biomes'
import { GAME_CONFIG } from '../gameConfig'

/**
 * Onde fica uma cidade copiada inteira do Let's Go no mundo e o que há em
 * cada ponto dela (docs/features/069-revisao-do-bioma-cidade.md — Pallet).
 * Puro: só contas sobre a colisão do mapa (`townMapCollidersOf`, no espaço
 * do modelo) e o lugar dele (`place`: `{ x, y, z, scale }`, a origem do
 * modelo no mundo e o tamanho — a forma de `OnTownMap`). O mapa não gira.
 */

/**
 * O tamanho do mapa: o do `TOWN_MAP.SCALE` ou, sem ele, o dos prédios da
 * cidade procedural (`town.scale` do bioma cidade) — as salas saem no
 * tamanho do prédio de onde se entra, e o treinador cabe nas duas.
 */
export function townMapScale(
  config = GAME_CONFIG.TOWN_MAP,
  city = getBiome('city'),
) {
  return config.SCALE ?? city?.town?.scale ?? 1
}

/**
 * O lugar do mapa saindo de `from` (`{ x, z }`) com o relevo em
 * `groundY` ali: no mesmo XZ (os chunks em volta continuam os de lá), com
 * o chão `TOWN_MAP.ALTITUDE` m acima do relevo.
 */
export function townMapPlace(
  from,
  groundY,
  scale = townMapScale(),
  altitude = GAME_CONFIG.TOWN_MAP.ALTITUDE,
) {
  return { x: from.x, y: groundY + altitude, z: from.z, scale }
}

/** O ponto `local` do modelo (antes da escala; `y` opcional) no mundo. */
export function townMapToWorld(place, local) {
  return {
    x: place.x + local.x * place.scale,
    y: place.y + (local.y ?? 0) * place.scale,
    z: place.z + local.z * place.scale,
  }
}

// O ponto `(x, z)` do mundo no espaço do modelo.
const toLocal = (place, x, z) => ({
  x: (x - place.x) / place.scale,
  z: (z - place.z) / place.scale,
})

/** Se `(x, z)` do mundo cai dentro da caixa do mapa (no plano). */
export function isInsideTownMap(colliders, place, x, z) {
  const local = toLocal(place, x, z)
  const [minX, , minZ, maxX, , maxZ] = colliders.box
  return (
    local.x >= minX && local.x <= maxX && local.z >= minZ && local.z <= maxZ
  )
}

// A posição de `(x, z)` local na grade do chão: a coluna e a linha (com a
// fração entre elas), presas dentro dela.
function gridSpot(ground, local) {
  const clamp = (value, max) => Math.min(Math.max(value, 0), max)
  const fx = clamp((local.x - ground.minX) / ground.step, ground.nx - 1)
  const fz = clamp((local.z - ground.minZ) / ground.step, ground.nz - 1)
  return { fx, fz }
}

// O índice do ponto `(ix, iz)` da grade (por coluna, como o heightfield).
const gridIndex = (ground, ix, iz) => iz + ix * ground.nz

// O ponto da grade mais perto de `(x, z)` do mundo.
function nearestIndex(colliders, place, x, z) {
  const { ground } = colliders
  const { fx, fz } = gridSpot(ground, toLocal(place, x, z))
  return gridIndex(ground, Math.round(fx), Math.round(fz))
}

/** A altura (m, no mundo) do chão do mapa em `(x, z)` do mundo. */
export function townMapGroundAt(colliders, place, x, z) {
  const { ground } = colliders
  const { fx, fz } = gridSpot(ground, toLocal(place, x, z))
  const ix = Math.min(Math.floor(fx), ground.nx - 2)
  const iz = Math.min(Math.floor(fz), ground.nz - 2)
  const tx = fx - ix
  const tz = fz - iz
  const at = (dx, dz) => ground.heights[gridIndex(ground, ix + dx, iz + dz)]
  const near = at(0, 0) * (1 - tx) + at(1, 0) * tx
  const far = at(0, 1) * (1 - tx) + at(1, 1) * tx
  return place.y + (near * (1 - tz) + far * tz) * place.scale
}

/** A altura (m, no mundo) da superfície da água do mapa (`null`: sem água). */
export function townMapWaterSurface(colliders, place) {
  if (!colliders.water) return null
  return place.y + colliders.water.surface * place.scale
}

/**
 * Profundidade (m) da água do mapa em `(x, z)` do mundo: a superfície menos
 * o chão onde o mar cobre; 0 ou menos = seco.
 */
export function townMapWaterDepthAt(colliders, place, x, z) {
  const surface = townMapWaterSurface(colliders, place)
  if (surface == null) return 0
  if (colliders.water.cells[nearestIndex(colliders, place, x, z)] !== '1') {
    return 0
  }
  return surface - townMapGroundAt(colliders, place, x, z)
}

/** O chão em `(x, z)` do mundo para o som do passo: grama ou não. */
export function townMapSurfaceAt(colliders, place, x, z) {
  const index = nearestIndex(colliders, place, x, z)
  return colliders.ground.grass[index] === '1' ? 'grass' : 'ground'
}

/**
 * Onde o treinador chega no mapa (à frente da porta da casa do jogador, no
 * chão), virado para fora (`yaw`, o giro do corpo).
 */
export function townMapArrival(colliders, place) {
  const { arrival } = colliders
  return { ...townMapToWorld(place, arrival), yaw: arrival.yaw }
}
