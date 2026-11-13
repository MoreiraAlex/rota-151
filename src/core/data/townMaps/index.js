import TOWN_MAP_COLLIDERS from '../townMapColliders.json'

/**
 * As cidades copiadas inteiras do Let's Go (docs/features/069-revisao-do-
 * bioma-cidade.md), montadas do mapa do jogo original: Pallet, a cidade
 * tutorial, um lugar à parte ao ar livre. (Viridian, a cidade inicial, é
 * montada à mão no mundo procedural: `core/data/cityLayouts/`.) Cada uma:
 *
 * - `name`: como o jogo chama o lugar;
 * - `model`: o modelo do mapa (`public/assets/town-maps/lgpe/`, gerado por
 *   `scripts/lgpe/pack-lgpe.js` com `scripts/lgpe/town-maps.json`) — a
 *   colisão dele tem o mesmo id (`townMapColliders.json`, de
 *   `scripts/lgpe/town-map-colliders.js`): o chão (grade de alturas, grama
 *   e água), as caixas e a chegada.
 */
const TOWN_MAPS = {
  pallet: {
    id: 'pallet',
    name: 'Pallet',
    model: 'pallet-town',
  },
}

/** O mapa de id `id` (ou `null`). */
export function getTownMap(id) {
  return TOWN_MAPS[id] ?? null
}

/** Todos os mapas. */
export function listTownMaps() {
  return Object.values(TOWN_MAPS)
}

/** A colisão do mapa `townMap` (no espaço do modelo, antes da escala). */
export function townMapCollidersOf(townMap) {
  const colliders = TOWN_MAP_COLLIDERS[townMap.model]
  if (!colliders) throw new Error(`mapa sem colisão: ${townMap.model}`)
  return colliders
}
