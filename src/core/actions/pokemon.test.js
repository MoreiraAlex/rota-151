import { afterEach, describe, expect, it } from 'vitest'
import { givePokemon, makeWorld, spawnTrainer } from '@/test/makeWorld'
import { getSpecies } from '../data/species'
import { createLevelState } from '../data/species/experience'
import { createMovesState } from '../data/species/moves'
import {
  CreatureLevel,
  CreatureMoves,
  OwnedBy,
  Pokemon,
  StoredVitals,
} from '../traits'
import {
  colocarNoTime,
  criarPokemon,
  findPartyPokemon,
  listInventoryPokemon,
  listOwnedPokemon,
  resolvePartySlot,
  tirarDoTime,
} from './pokemon'

// Registro de cada Pokémon e o time (docs/features/041-inventario-de-itens-
// e-pokemon.md). Espécies só como dado de teste — as regras não dependem de
// qual é.
const SPECIES_ID = 'charmander'
const OTHER_SPECIES_ID = 'bulbasaur'

const worlds = []
afterEach(() => {
  while (worlds.length) worlds.pop().destroy()
})

function setup() {
  const { world, player } = makeWorld()
  worlds.push(world)
  return { world, player }
}

describe('criarPokemon', () => {
  it('nasce no inventário, do treinador, com nível e kit da espécie e vida cheia', () => {
    const { world, player } = setup()
    const species = getSpecies(SPECIES_ID)

    const pokemon = criarPokemon(world, player, SPECIES_ID)

    expect(pokemon.get(Pokemon).speciesId).toBe(SPECIES_ID)
    expect(pokemon.targetFor(OwnedBy)).toBe(player)
    expect(pokemon.get(CreatureLevel)).toEqual(
      createLevelState(species, species.level),
    )
    expect(pokemon.get(CreatureMoves)).toEqual(createMovesState(species))
    expect(pokemon.get(StoredVitals).vitals).toBe(null)
    expect(resolvePartySlot(player, pokemon)).toBe(null)
    expect(listInventoryPokemon(world, player)).toContain(pokemon)
  })

  it('espécie desconhecida não cria nada', () => {
    const { world, player } = setup()
    expect(criarPokemon(world, player, 'nao-existe')).toBe(null)
    expect(listOwnedPokemon(world, player)).toEqual([])
  })
})

describe('time e inventário', () => {
  it('pôr no time tira do inventário; tirar devolve', () => {
    const { world, player } = setup()
    const pokemon = givePokemon(world, player, SPECIES_ID)

    expect(colocarNoTime(player, pokemon, 'slot2')).toBe(true)
    expect(findPartyPokemon(player, 'slot2')).toBe(pokemon)
    expect(listInventoryPokemon(world, player)).not.toContain(pokemon)

    expect(tirarDoTime(world, player, pokemon)).toBe(true)
    expect(findPartyPokemon(player, 'slot2')).toBe(null)
    expect(listInventoryPokemon(world, player)).toContain(pokemon)
  })

  it('o time pode ficar vazio', () => {
    const { world, player } = setup()
    const pokemon = givePokemon(world, player, SPECIES_ID, 'slot1')
    tirarDoTime(world, player, pokemon)
    for (const slot of ['slot1', 'slot2', 'slot3']) {
      expect(findPartyPokemon(player, slot)).toBe(null)
    }
  })

  it('arrastar um slot sobre outro troca os dois de lugar', () => {
    const { world, player } = setup()
    const a = givePokemon(world, player, SPECIES_ID, 'slot1')
    const b = givePokemon(world, player, OTHER_SPECIES_ID, 'slot2')

    colocarNoTime(player, a, 'slot2')

    expect(findPartyPokemon(player, 'slot1')).toBe(b)
    expect(findPartyPokemon(player, 'slot2')).toBe(a)
  })

  it('mover pra um slot vazio libera o de origem', () => {
    const { world, player } = setup()
    const pokemon = givePokemon(world, player, SPECIES_ID, 'slot1')

    colocarNoTime(player, pokemon, 'slot3')

    expect(findPartyPokemon(player, 'slot1')).toBe(null)
    expect(findPartyPokemon(player, 'slot3')).toBe(pokemon)
  })

  it('quem vem do inventário pro slot ocupado manda o ocupante pro inventário', () => {
    const { world, player } = setup()
    const occupant = givePokemon(world, player, SPECIES_ID, 'slot1')
    const incoming = givePokemon(world, player, OTHER_SPECIES_ID)

    colocarNoTime(player, incoming, 'slot1')

    expect(findPartyPokemon(player, 'slot1')).toBe(incoming)
    expect(resolvePartySlot(player, occupant)).toBe(null)
    expect(listInventoryPokemon(world, player)).toContain(occupant)
  })

  it('o mesmo Pokémon não fica em dois slots', () => {
    const { world, player } = setup()
    const pokemon = givePokemon(world, player, SPECIES_ID, 'slot1')
    colocarNoTime(player, pokemon, 'slot2')
    const slots = ['slot1', 'slot2', 'slot3'].filter(
      (slot) => findPartyPokemon(player, slot) === pokemon,
    )
    expect(slots).toEqual(['slot2'])
  })

  it('Pokémon de outro treinador não entra no time', () => {
    const { world, player } = setup()
    const other = spawnTrainer(world)
    const theirs = givePokemon(world, other, SPECIES_ID)

    expect(colocarNoTime(player, theirs, 'slot1')).toBe(false)
    expect(findPartyPokemon(player, 'slot1')).toBe(null)
    expect(listOwnedPokemon(world, player)).not.toContain(theirs)
  })

  it('sair e voltar pro time é o mesmo indivíduo (nível e golpes preservados)', () => {
    const { world, player } = setup()
    const pokemon = givePokemon(world, player, SPECIES_ID, 'slot1')
    const progress = { level: 7, xp: 1234 }
    pokemon.set(CreatureLevel, progress)

    tirarDoTime(world, player, pokemon)
    colocarNoTime(player, pokemon, 'slot1')

    expect(findPartyPokemon(player, 'slot1')).toBe(pokemon)
    expect(pokemon.get(CreatureLevel)).toEqual(progress)
  })
})
