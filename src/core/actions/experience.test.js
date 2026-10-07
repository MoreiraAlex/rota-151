import { beforeEach, describe, expect, it } from 'vitest'
import { givePartyPokemon, makeWorld, ownedByPlayer } from '@/test/makeWorld'
import { getSpecies } from '../data/species'
import {
  calculateExperienceGain,
  createLevelState,
  experienceForLevel,
  resolveBaseXp,
  resolveGrowthRate,
} from '../data/species/experience'
import { EVENT_TYPES, createEventQueue } from '../events'
import { GAME_CONFIG } from '../gameConfig'
import {
  CreatureLevel,
  FoughtBy,
  IndividualValues,
  StoredFaint,
  StoredVitals,
  SummonedCreature,
  SummonedFrom,
  Vitals,
  WildCreature,
  resolveMaxHp,
  vitalsFromSpecies,
} from '../traits'
import {
  distribuirExperiencia,
  ganharExperiencia,
  registrarParticipante,
} from './experience'

const WILD_SPECIES_ID = 'squirtle'
const WILD_LEVEL = 5

let world
let player
let events
// Registro de cada slot do time (`givePartyPokemon`).
let party

/** Nível/XP do registro do Pokémon do `slot`. */
const progressOf = (slot) => party[slot].get(CreatureLevel)

function spawnWild(level = WILD_LEVEL) {
  const species = getSpecies(WILD_SPECIES_ID)
  return world.spawn(
    WildCreature({ speciesId: WILD_SPECIES_ID }),
    CreatureLevel(createLevelState(species, level)),
    vitalsFromSpecies(species),
  )
}

function spawnSummoned(slot) {
  const speciesId = getPartySpeciesId(slot)
  const species = getSpecies(speciesId)
  const individualValues = party[slot].get(IndividualValues)
  const progress = progressOf(slot)
  return world.spawn(
    SummonedCreature({ slot, speciesId }),
    ...ownedByPlayer(world),
    SummonedFrom(party[slot]),
    IndividualValues(individualValues),
    CreatureLevel(progress),
    vitalsFromSpecies(species, individualValues, progress.level),
  )
}

function getPartySpeciesId(slot) {
  return { slot1: 'bulbasaur', slot2: 'charmander' }[slot]
}

function expectedGain(winnerLevel, participants) {
  return calculateExperienceGain({
    baseXp: resolveBaseXp(getSpecies(WILD_SPECIES_ID)),
    defeatedLevel: WILD_LEVEL,
    winnerLevel,
    participants,
  })
}

beforeEach(() => {
  ;({ world, player } = makeWorld())
  events = createEventQueue()
  party = givePartyPokemon(world, player, {
    slot1: 'bulbasaur',
    slot2: 'charmander',
  })
})

describe('criarPokemon', () => {
  it('o Pokémon novo começa no nível inicial da espécie', () => {
    const species = getSpecies('bulbasaur')
    expect(progressOf('slot1')).toEqual(
      createLevelState(species, species.level),
    )
  })
})

describe('registrarParticipante', () => {
  it('marca o registro do Pokémon do time que acertou a selvagem', () => {
    const wild = spawnWild()
    registrarParticipante(world, spawnSummoned('slot2'), wild)
    expect(wild.has(FoughtBy(party.slot2))).toBe(true)
    expect(wild.has(FoughtBy(party.slot1))).toBe(false)
  })

  it('selvagem batendo no time não conta', () => {
    const creature = spawnSummoned('slot1')
    registrarParticipante(world, spawnWild(), creature)
    expect(creature.targetsFor(FoughtBy)).toEqual([])
  })
})

describe('distribuirExperiencia', () => {
  it('um participante leva o XP inteiro e a relação é limpa', () => {
    const wild = spawnWild()
    registrarParticipante(world, spawnSummoned('slot1'), wild)
    const before = { ...progressOf('slot1') }

    distribuirExperiencia(world, events, wild)

    expect(progressOf('slot1').xp).toBe(
      before.xp + expectedGain(before.level, 1),
    )
    expect(progressOf('slot2').xp).toBe(
      createLevelState(getSpecies('charmander'), getSpecies('charmander').level)
        .xp,
    )
    expect(wild.targetsFor(FoughtBy)).toEqual([])
  })

  it('dois participantes dividem o XP', () => {
    const wild = spawnWild()
    registrarParticipante(world, spawnSummoned('slot1'), wild)
    registrarParticipante(world, spawnSummoned('slot2'), wild)
    const before = {
      slot1: { ...progressOf('slot1') },
      slot2: { ...progressOf('slot2') },
    }

    distribuirExperiencia(world, events, wild)

    for (const slot of ['slot1', 'slot2']) {
      expect(progressOf(slot).xp).toBe(
        before[slot].xp + expectedGain(before[slot].level, 2),
      )
    }
  })

  it('desmaiada não ganha nada e não conta na divisão', () => {
    const wild = spawnWild()
    registrarParticipante(world, spawnSummoned('slot1'), wild)
    registrarParticipante(world, spawnSummoned('slot2'), wild)
    party.slot2.add(StoredFaint({ timeLeft: 10 }))
    const before = {
      slot1: { ...progressOf('slot1') },
      slot2: { ...progressOf('slot2') },
    }

    distribuirExperiencia(world, events, wild)

    expect(progressOf('slot2').xp).toBe(before.slot2.xp)
    expect(progressOf('slot1').xp).toBe(
      before.slot1.xp + expectedGain(before.slot1.level, 1),
    )
  })
})

describe('ganharExperiencia', () => {
  function xpToNextLevel(slot) {
    const species = getSpecies(getPartySpeciesId(slot))
    const progress = progressOf(slot)
    return (
      experienceForLevel(resolveGrowthRate(species), progress.level + 1) -
      progress.xp
    )
  }

  it('sem chegar no próximo nível, só soma o XP', () => {
    const before = { ...progressOf('slot1') }
    ganharExperiencia(world, events, party.slot1, xpToNextLevel('slot1') - 1)
    expect(progressOf('slot1').level).toBe(before.level)
    const types = events.drain().map((event) => event.type)
    expect(types).toEqual([EVENT_TYPES.EXPERIENCE_GAINED])
  })

  it('sobe de nível: a criatura em campo acompanha e a vida sobe a diferença', () => {
    const creature = spawnSummoned('slot1')
    const species = getSpecies('bulbasaur')
    const individualValues = party.slot1.get(IndividualValues)
    const fromLevel = progressOf('slot1').level
    creature.set(Vitals, { hp: 1 })

    ganharExperiencia(world, events, party.slot1, xpToNextLevel('slot1'))

    const level = progressOf('slot1').level
    expect(level).toBe(fromLevel + 1)
    expect(creature.get(CreatureLevel).level).toBe(level)
    const growth =
      resolveMaxHp(species, individualValues, level) -
      resolveMaxHp(species, individualValues, fromLevel)
    expect(creature.get(Vitals).maxHp).toBe(
      resolveMaxHp(species, individualValues, level),
    )
    expect(creature.get(Vitals).hp).toBe(1 + growth)

    const leveled = events
      .drain()
      .find((event) => event.type === EVENT_TYPES.LEVELED_UP)
    expect(leveled).toMatchObject({ pokemon: party.slot1, fromLevel, level })
  })

  it('a vida guardada fora de campo também sobe a diferença', () => {
    const species = getSpecies('bulbasaur')
    const individualValues = party.slot1.get(IndividualValues)
    const fromLevel = progressOf('slot1').level
    const stored = vitalsFromSpecies(species, individualValues, fromLevel)
    party.slot1.set(StoredVitals, { vitals: { ...stored, hp: 1 } })

    ganharExperiencia(world, events, party.slot1, xpToNextLevel('slot1'))

    const level = progressOf('slot1').level
    const growth =
      resolveMaxHp(species, individualValues, level) -
      resolveMaxHp(species, individualValues, fromLevel)
    expect(party.slot1.get(StoredVitals).vitals.hp).toBe(1 + growth)
  })

  it('para no nível máximo', () => {
    ganharExperiencia(world, events, party.slot1, Number.MAX_SAFE_INTEGER)
    const { MAX_LEVEL } = GAME_CONFIG.EXPERIENCE
    const species = getSpecies('bulbasaur')
    expect(progressOf('slot1')).toEqual({
      level: MAX_LEVEL,
      xp: experienceForLevel(resolveGrowthRate(species), MAX_LEVEL),
    })
  })
})
