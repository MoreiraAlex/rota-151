import { afterEach, describe, expect, it } from 'vitest'
import { givePokemon, makeWorld } from '@/test/makeWorld'
import { resolveInventoryCapacity } from '../actions/inventory'
import {
  findPartyPokemon,
  listOwnedPokemon,
  resolvePartySlot,
} from '../actions/pokemon'
import {
  BallOnGround,
  Burn,
  CreatureLevel,
  CreatureMoves,
  Fainted,
  IndividualValues,
  InventoryCell,
  Pokemon,
  StoredConditions,
  StoredFaint,
  StoredVitals,
  SummonedCreature,
  SummonedFrom,
  Vitals,
} from '../traits'
import { pokemonSaveSchema } from './saveFormat'
import { restorePokemon, serializePokemon } from './pokemonSave'

// Um Pokémon no save (docs/features/044-salvar-o-jogo.md). Espécies só como
// dado de teste.
const SPECIES_ID = 'charmander'
const OTHER_SPECIES_ID = 'bulbasaur'
const BURN = {
  timeLeft: 3,
  tickTimer: 1,
  fraction: 0.1,
  interval: 2,
  attackMultiplier: 0.5,
}

const worlds = []
afterEach(() => {
  while (worlds.length) worlds.pop().destroy()
})

function setup() {
  const { world, player } = makeWorld()
  worlds.push(world)
  return { world, player }
}

function summon(world, pokemon, { vitals, burn = null, fainted = null }) {
  return world.spawn(
    SummonedCreature({ speciesId: pokemon.get(Pokemon).speciesId }),
    SummonedFrom(pokemon),
    Vitals(vitals),
    ...(burn ? [Burn(burn)] : []),
    ...(fainted ? [Fainted(fainted)] : []),
  )
}

describe('serializePokemon', () => {
  it('no formato do schema, com o lugar no time', () => {
    const { world, player } = setup()
    const pokemon = givePokemon(world, player, SPECIES_ID, 'slot2')

    const saved = serializePokemon(world, player, pokemon)

    expect(pokemonSaveSchema.safeParse(saved).success).toBe(true)
    expect(saved.id).toBe(pokemon.get(Pokemon).uid)
    expect(saved.location).toEqual({ kind: 'party', slot: 'slot2' })
    expect(saved.storedVitals).toBe(null)
    expect(saved.faintTimeLeft).toBe(null)
    expect(saved.conditions).toBe(null)
  })

  it('no inventário, com a célula', () => {
    const { world, player } = setup()
    const pokemon = givePokemon(world, player, SPECIES_ID)

    expect(serializePokemon(world, player, pokemon).location).toEqual({
      kind: 'inventory',
      cell: pokemon.get(InventoryCell).index,
    })
  })

  it('a bola caída no chão não é salva', () => {
    const { world, player } = setup()
    const pokemon = givePokemon(world, player, SPECIES_ID)
    pokemon.add(BallOnGround)

    expect(serializePokemon(world, player, pokemon)).toBe(null)
  })

  it('em campo: salvo como recolhido (vida, queimadura e desmaio da criatura)', () => {
    const { world, player } = setup()
    const pokemon = givePokemon(world, player, SPECIES_ID, 'slot1')
    const vitals = { ...Vitals.schema, hp: 1 }
    summon(world, pokemon, {
      vitals,
      burn: BURN,
      fainted: { timeLeft: 7, elapsed: 0 },
    })

    const saved = serializePokemon(world, player, pokemon)

    expect(saved.storedVitals.hp).toBe(1)
    expect(saved.conditions).toEqual({ burn: BURN })
    expect(saved.faintTimeLeft).toBe(7)
    // Só lê: o registro continua sem nada guardado.
    expect(pokemon.has(StoredConditions)).toBe(false)
    expect(pokemon.has(StoredFaint)).toBe(false)
  })
})

describe('restorePokemon', () => {
  it('ida e volta: mesmo id, espécie, bola, nível, IV, golpes, vida, desmaio e queimadura', () => {
    const { world, player } = setup()
    const original = givePokemon(world, player, SPECIES_ID, 'slot3')
    original.set(Pokemon, { ...original.get(Pokemon), ballId: 'great-ball' })
    original.set(StoredVitals, { vitals: { ...Vitals.schema, hp: 2 } })
    original.add(StoredFaint({ timeLeft: 4 }))
    original.add(StoredConditions({ burn: { ...BURN } }))
    const saved = serializePokemon(world, player, original)

    const target = setup()
    const restored = restorePokemon(target.world, target.player, saved)

    expect(restored.get(Pokemon)).toEqual(original.get(Pokemon))
    expect(restored.get(IndividualValues)).toEqual(
      original.get(IndividualValues),
    )
    expect(restored.get(CreatureLevel)).toEqual(original.get(CreatureLevel))
    expect(restored.get(CreatureMoves)).toEqual(original.get(CreatureMoves))
    expect(restored.get(StoredVitals)).toEqual(original.get(StoredVitals))
    expect(restored.get(StoredFaint)).toEqual(original.get(StoredFaint))
    expect(restored.get(StoredConditions)).toEqual(
      original.get(StoredConditions),
    )
    expect(resolvePartySlot(target.player, restored)).toBe('slot3')
  })

  it('volta na célula salva do inventário', () => {
    const { world, player } = setup()
    const pokemon = givePokemon(world, player, SPECIES_ID)
    const saved = {
      ...serializePokemon(world, player, pokemon),
      location: { kind: 'inventory', cell: 5 },
    }

    const target = setup()
    const restored = restorePokemon(target.world, target.player, saved)

    expect(restored.get(InventoryCell).index).toBe(5)
  })

  it('slot salvo ocupado: vai pra outro slot livre', () => {
    const { world, player } = setup()
    const occupant = givePokemon(world, player, OTHER_SPECIES_ID, 'slot1')
    const pokemon = givePokemon(world, player, SPECIES_ID)
    const saved = {
      ...serializePokemon(world, player, pokemon),
      id: 'outro',
      location: { kind: 'party', slot: 'slot1' },
    }

    const restored = restorePokemon(world, player, saved)

    expect(findPartyPokemon(player, 'slot1')).toBe(occupant)
    expect(resolvePartySlot(player, restored)).not.toBe(null)
  })

  it('célula fora da grade: fica na primeira livre', () => {
    const { world, player } = setup()
    const pokemon = givePokemon(world, player, SPECIES_ID)
    const saved = {
      ...serializePokemon(world, player, pokemon),
      location: { kind: 'inventory', cell: resolveInventoryCapacity() },
    }

    const target = setup()
    const restored = restorePokemon(target.world, target.player, saved)

    expect(restored.get(InventoryCell).index).toBeLessThan(
      resolveInventoryCapacity(),
    )
  })

  it('espécie que não existe mais fica de fora', () => {
    const { world, player } = setup()
    const pokemon = givePokemon(world, player, SPECIES_ID)
    const saved = {
      ...serializePokemon(world, player, pokemon),
      speciesId: 'nao-existe',
    }

    const target = setup()
    expect(restorePokemon(target.world, target.player, saved)).toBe(null)
    expect(listOwnedPokemon(target.world, target.player)).toEqual([])
  })
})
