/**
 * Registro de espécies. Cada pasta `<dexNumber>-<id>/` (ou, no caso do
 * jogador, sem número — ver `fox/`) É SUA — eu construo o mecanismo (este
 * arquivo, `getSpecies`/`listSpecies`), nunca escrevo uma entrada de espécie
 * de Pokémon. A entrada `fox/` é minha (é o placeholder do jogador, modelo
 * livre) — as próximas (Pokémon de verdade) você adiciona.
 *
 * Pra adicionar uma criatura:
 * 1) copia `_template/` pra `<dexNumber>-<id>/` (ex.: `001-bulbasaur/`)
 * 2) preenche `index.js` e a pasta `clips/`
 * 3) importa aqui embaixo e adiciona uma linha no SPECIES_REGISTRY
 */
import { FOX } from './fox'
import { BOT } from './bot'

export const SPECIES_REGISTRY = {
  [FOX.id]: FOX,
  [BOT.id]: BOT,
}

/**
 * Id da espécie usada como jogador. Único lugar que define isso — troque
 * aqui pra testar outro modelo como jogador; `world.js` (corpo físico +
 * movimento) e `PlayerView.jsx` (modelo + animação) leem daqui, então nunca
 * ficam apontando pra espécies diferentes um do outro.
 */
export const PLAYER_SPECIES_ID = 'bot'

export function getSpecies(id, registry = SPECIES_REGISTRY) {
  return registry[id] ?? null
}

export function listSpecies(registry = SPECIES_REGISTRY) {
  return Object.values(registry)
}
