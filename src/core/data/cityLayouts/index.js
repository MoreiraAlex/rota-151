import { VIRIDIAN } from './viridian'

/**
 * As cidades montadas à mão a partir do layout de uma cidade do Let's Go
 * (docs/features/069-revisao-do-bioma-cidade.md): o chão sai de uma grade
 * de níveis (`core/town/cityLayout.js`), com os nossos platôs nos degraus
 * e a nossa montanha nos paredões — não do modelo do mapa, como Pallet.
 * Montadas no laboratório da cidade (`/tools/lab-cidade`).
 */
const CITY_LAYOUTS = {
  viridian: VIRIDIAN,
}

/** O layout de id `id` (ou `null`). */
export function getCityLayout(id) {
  return CITY_LAYOUTS[id] ?? null
}

/** Todos os layouts. */
export function listCityLayouts() {
  return Object.values(CITY_LAYOUTS)
}
