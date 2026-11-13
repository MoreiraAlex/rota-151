import { isInsideTownMap } from './townMapPlacement'

/**
 * O mapa de cidade em que o treinador está agora (docs/features/069-
 * revisao-do-bioma-cidade.md — Pallet), para as consultas do nível que só
 * recebem um ponto (a água e o chão de `core/actions/water.js` e
 * `core/actions/groundSurface.js`): dentro dele, valem a água e o chão do
 * mapa, não os do relevo lá embaixo. Quem escreve: `core/actions/
 * townMap.js` (ao chegar, ao sair e ao carregar o jogo).
 *
 * @typedef {{ colliders: object, place: { x: number, y: number, z: number,
 *   scale: number } }} ActiveTownMap
 */

/** @type {ActiveTownMap | null} */
let active = null

/** Marca o mapa de agora (`null`: fora de todos). */
export function setActiveTownMap(value) {
  active = value
}

/** O mapa de agora (ou `null`). */
export function getActiveTownMap() {
  return active
}

/** O mapa de agora, se `(x, z)` cai dentro dele (ou `null`). */
export function activeTownMapAt(x, z) {
  if (!active) return null
  return isInsideTownMap(active.colliders, active.place, x, z) ? active : null
}
