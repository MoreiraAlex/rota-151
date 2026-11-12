import INTERIOR_COLLIDERS from '../interiorColliders.json'

/**
 * As salas por dentro dos prédios (docs/features/068-interior-dos-
 * predios.md). Cada uma:
 *
 * - `name`: como o jogo chama o lugar; `enterText`/`exitText`, o aviso do
 *   F na porta e no tapete da entrada;
 * - `model`: o modelo da sala (`public/assets/interiors/lgpe/`, gerado por
 *   `scripts/lgpe/pack-lgpe.js` com `scripts/lgpe/interiors.json`) — a
 *   colisão dela tem o mesmo id (`interiorColliders.json`, de
 *   `scripts/lgpe/interior-colliders.js`);
 * - `building`: o prédio da cidade (o modelo do LGPE, `town.landmarks`)
 *   cuja porta leva para ela;
 * - `doorX`: onde fica a porta na frente do prédio (m, ao longo da
 *   largura, no modelo dele, antes da escala);
 * - `music`: a faixa que toca em loop lá dentro (`MUSIC_TRACKS`, com
 *   `loopStart`/`loopEnd`), no lugar da de exploração.
 *
 * A sala fica no tamanho do prédio de onde se entrou (a escala dele na
 * cidade): o treinador cabe nos dois do mesmo jeito.
 */
const INTERIORS = {
  pokecenter: {
    id: 'pokecenter',
    name: 'Pokécenter',
    enterText: 'Entrar no Pokécenter',
    exitText: 'Sair do Pokécenter',
    model: 'pokecenter-interior',
    building: 'pokecenter',
    doorX: 0,
    music: 'pokecenter',
  },
  'poke-mart': {
    id: 'poke-mart',
    name: 'Loja',
    enterText: 'Entrar na loja',
    exitText: 'Sair da loja',
    model: 'poke-mart-interior',
    building: 'poke-mart',
    doorX: 0,
    music: 'poke-mart',
  },
}

/** A sala de id `id` (ou `null`). */
export function getInterior(id) {
  return INTERIORS[id] ?? null
}

/** A sala em que a porta do prédio `model` (id do LGPE) dá (ou `null`). */
export function interiorOfBuilding(model) {
  return (
    Object.values(INTERIORS).find(({ building }) => building === model) ?? null
  )
}

/** Todas as salas. */
export function listInteriors() {
  return Object.values(INTERIORS)
}

/**
 * A colisão da sala (`interiorColliders.json`): o piso andável e a altura
 * dele, as paredes, os móveis (caixas `[minX, minY, minZ, maxX, maxY,
 * maxZ]`), os objetos soltos que vão nela (`props`: modelo e onde fica —
 * a máquina de cura) e o ponto de saída — no espaço do modelo, antes da
 * escala.
 */
export function interiorCollidersOf(interior) {
  const colliders = INTERIOR_COLLIDERS[interior.model]
  if (!colliders) throw new Error(`sala sem colisão: ${interior.model}`)
  return colliders
}
