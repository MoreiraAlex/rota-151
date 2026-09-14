/**
 * Registro de espécies. Cada pasta `<dexNumber>-<id>/` (ou, no caso do
 * treinador, sem número — ver `bot/`) É SUA — eu construo o mecanismo (este
 * arquivo, `getSpecies`/`listSpecies`), nunca escrevo uma entrada de espécie
 * de Pokémon. A entrada `fox/` é minha (modelo livre, Khronos Sample Assets)
 * — hoje serve de placeholder pra Pokémon/criatura selvagem (`kind:
 * 'pokemon'`), não pro jogador. `bot/` é o avatar de verdade do treinador
 * (`PLAYER_SPECIES_ID`), conteúdo seu.
 *
 * Pra adicionar uma criatura:
 * 1) copia `_template/` pra `<dexNumber>-<id>/` (ex.: `001-bulbasaur/`)
 * 2) preenche `index.js` e a pasta `clips/`
 * 3) importa aqui embaixo e adiciona uma linha no SPECIES_REGISTRY
 */
import { FOX } from './fox'
import { FOX_RED } from './fox-red'
import { FOX_GREEN } from './fox-green'
import { FOX_BLUE } from './fox-blue'
import { BOT } from './bot'

export const SPECIES_REGISTRY = {
  [FOX.id]: FOX,
  [FOX_RED.id]: FOX_RED,
  [FOX_GREEN.id]: FOX_GREEN,
  [FOX_BLUE.id]: FOX_BLUE,
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

/**
 * Tipo de entidade jogável que a espécie representa (`'trainer'` |
 * `'pokemon'`) — ver docs/features/011-slots-de-acao.md. Espécie sem `kind`
 * (ex.: `bot`, ainda não atualizado) cai em `'trainer'`: única leitura
 * possível hoje, já que não existe Pokémon jogável ainda.
 */
export function resolveSpeciesKind(species) {
  return species?.kind ?? 'trainer'
}
