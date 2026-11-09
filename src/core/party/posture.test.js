import { afterEach, describe, expect, it } from 'vitest'
import { givePokemon, makeWorld } from '@/test/makeWorld'
import { definirPostura } from '../actions/posture'
import { GAME_CONFIG } from '../gameConfig'
import { Pokemon, SummonedCreature, SummonedFrom } from '../traits'
import {
  POSTURES,
  defendsGroup,
  joinsOnHit,
  normalizePosture,
  resolveCreaturePosture,
  resolvePokemonPosture,
  seeksWilds,
} from './posture'

// Posturas (docs/features/064-revisao-da-ia-do-parceiro.md, Parte 2).
const { DEFAULT_POSTURE } = GAME_CONFIG.PARTY_BEHAVIOR

const worlds = []
afterEach(() => {
  while (worlds.length) worlds.pop().destroy()
})

function setup() {
  const { world, player } = makeWorld()
  worlds.push(world)
  return { world, pokemon: givePokemon(world, player, 'charmander', 'slot1') }
}

describe('regras das posturas', () => {
  it('a padrão é uma das posturas', () => {
    expect(POSTURES).toContain(DEFAULT_POSTURE)
  })

  it('valor desconhecido ou vazio vira a padrão', () => {
    expect(normalizePosture(null)).toBe(DEFAULT_POSTURE)
    expect(normalizePosture('furiosa')).toBe(DEFAULT_POSTURE)
    for (const posture of POSTURES) {
      expect(normalizePosture(posture)).toBe(posture)
    }
  })

  it('só a neutra ignora o golpe em outro do grupo', () => {
    for (const posture of POSTURES) {
      expect(joinsOnHit(posture, { self: true })).toBe(true)
      expect(joinsOnHit(posture, { self: false })).toBe(posture !== 'neutral')
    }
  })

  it('só a neutra não defende o grupo; só a agressiva procura briga', () => {
    expect(POSTURES.filter((posture) => !defendsGroup(posture))).toEqual([
      'neutral',
    ])
    expect(POSTURES.filter(seeksWilds)).toEqual(['aggressive'])
  })
})

describe('definirPostura', () => {
  it('o Pokémon novo nasce na padrão', () => {
    const { pokemon } = setup()
    expect(resolvePokemonPosture(pokemon)).toBe(DEFAULT_POSTURE)
  })

  it('troca no registro e a criatura em campo lê dali', () => {
    const { world, pokemon } = setup()
    const creature = world.spawn(SummonedCreature, SummonedFrom(pokemon))
    const other = POSTURES.find((posture) => posture !== DEFAULT_POSTURE)

    expect(definirPostura(pokemon, other)).toBe(true)

    expect(pokemon.get(Pokemon).posture).toBe(other)
    expect(resolveCreaturePosture(creature)).toBe(other)
  })

  it('postura desconhecida é ignorada', () => {
    const { pokemon } = setup()
    expect(definirPostura(pokemon, 'furiosa')).toBe(false)
    expect(resolvePokemonPosture(pokemon)).toBe(DEFAULT_POSTURE)
  })

  it('criatura sem registro fica na padrão', () => {
    const { world } = setup()
    expect(resolveCreaturePosture(world.spawn(SummonedCreature))).toBe(
      DEFAULT_POSTURE,
    )
  })
})
