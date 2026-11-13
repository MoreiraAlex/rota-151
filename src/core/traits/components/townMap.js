import { trait } from 'koota'

/**
 * O treinador está no mapa de uma cidade copiada inteira do Let's Go
 * (docs/features/069-revisao-do-bioma-cidade.md — Pallet, a cidade
 * tutorial): em que mapa (`mapId`), onde ele está no mundo (a origem do
 * modelo, `x`/`y`/`z`, e a escala dele), de onde o treinador veio
 * (`from`: `{ x, y, z, yaw }`, para voltar) e o corpo da colisão do mapa
 * (`bodyHandle`).
 *
 * Ao ar livre (o céu, a luz e o clima continuam), mas o mundo procedural lá
 * embaixo some da tela e as selvagens de lá não o alcançam. Quem escreve:
 * `core/actions/townMap.js`.
 */
export const OnTownMap = trait(() => ({
  mapId: null,
  x: 0,
  y: 0,
  z: 0,
  scale: 1,
  from: null,
  bodyHandle: -1,
}))
