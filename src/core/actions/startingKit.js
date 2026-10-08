import { listSpecies, resolveSpeciesKind } from '../data/species'
import { HeldItem } from '../traits'
import { adicionarItem } from './inventory'
import { colocarNoTime, criarPokemon } from './pokemon'

// Kit de TESTE (docs/features/042-itens-da-beta.md): a Pokédex e todos os
// itens da beta. O kit de verdade é definido na 061.
const STARTING_ITEMS = {
  pokedex: 1,
  'poke-ball': 10,
  'great-ball': 5,
  'ultra-ball': 3,
  potion: 5,
  'super-potion': 3,
  'hyper-potion': 2,
  'razz-berry': 5,
  'nanab-berry': 3,
  'pinap-berry': 2,
}

// Começa com este item na mão.
const STARTING_HELD_ITEM = 'pokedex'

// Quem começa no time, por slot. Os outros Pokémon iniciais (um de cada
// espécie `kind: 'pokemon'`) começam no inventário.
const STARTER_PARTY = {
  slot1: 'bulbasaur',
  slot2: 'charmander',
  slot3: 'squirtle',
}

/**
 * Kit inicial do treinador, pra quem ainda não tem save: os itens de
 * `STARTING_ITEMS` (um na mão) e um Pokémon de cada espécie
 * `kind: 'pokemon'` (IV sorteado, nível inicial da espécie), com os de
 * `STARTER_PARTY` já no time.
 */
export function darKitInicial(world, trainer) {
  trainer.set(HeldItem, { itemId: STARTING_HELD_ITEM })
  for (const [itemId, amount] of Object.entries(STARTING_ITEMS)) {
    adicionarItem(world, trainer, itemId, amount)
  }
  const pokemonSpecies = listSpecies().filter(
    (species) => resolveSpeciesKind(species) === 'pokemon',
  )
  const created = new Map()
  for (const species of pokemonSpecies) {
    created.set(species.id, criarPokemon(world, trainer, species.id))
  }
  for (const [slot, speciesId] of Object.entries(STARTER_PARTY)) {
    const pokemon = created.get(speciesId)
    if (pokemon) colocarNoTime(trainer, pokemon, slot)
  }
}
