import { beforeEach, describe, expect, it } from 'vitest'
import { makeWorld, ownedByPlayer } from '@/test/makeWorld'
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
  PartyFaint,
  PartyIndividualValues,
  PartyProgress,
  PartyVitals,
  SummonedCreature,
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
import { equiparCriatura } from './party'

const WILD_SPECIES_ID = 'squirtle'
const WILD_LEVEL = 5

let world
let player
let events

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
  const individualValues = player.get(PartyIndividualValues)[slot]
  const progress = player.get(PartyProgress)[slot]
  return world.spawn(
    SummonedCreature({ slot, speciesId }),
    ...ownedByPlayer(world),
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
  equiparCriatura(player, 'slot1', 'bulbasaur')
  equiparCriatura(player, 'slot2', 'charmander')
})

describe('equiparCriatura', () => {
  it('a criatura nova começa no nível inicial da espécie', () => {
    const species = getSpecies('bulbasaur')
    expect(player.get(PartyProgress).slot1).toEqual(
      createLevelState(species, species.level),
    )
  })
})

describe('registrarParticipante', () => {
  it('marca o slot da criatura do time que acertou a selvagem', () => {
    const wild = spawnWild()
    registrarParticipante(world, spawnSummoned('slot2'), wild)
    expect(wild.has(FoughtBy(player))).toBe(true)
    expect(wild.get(FoughtBy(player))).toMatchObject({
      slot1: false,
      slot2: true,
    })
  })

  it('selvagem batendo no time não conta', () => {
    const creature = spawnSummoned('slot1')
    registrarParticipante(world, spawnWild(), creature)
    expect(creature.has(FoughtBy(player))).toBe(false)
  })
})

describe('distribuirExperiencia', () => {
  it('um participante leva o XP inteiro e a relação é limpa', () => {
    const wild = spawnWild()
    registrarParticipante(world, spawnSummoned('slot1'), wild)
    const before = player.get(PartyProgress).slot1

    distribuirExperiencia(world, events, wild)

    expect(player.get(PartyProgress).slot1.xp).toBe(
      before.xp + expectedGain(before.level, 1),
    )
    expect(player.get(PartyProgress).slot2.xp).toBe(
      createLevelState(getSpecies('charmander'), getSpecies('charmander').level)
        .xp,
    )
    expect(wild.has(FoughtBy(player))).toBe(false)
  })

  it('dois participantes dividem o XP', () => {
    const wild = spawnWild()
    registrarParticipante(world, spawnSummoned('slot1'), wild)
    registrarParticipante(world, spawnSummoned('slot2'), wild)
    const before = player.get(PartyProgress)

    distribuirExperiencia(world, events, wild)

    for (const slot of ['slot1', 'slot2']) {
      expect(player.get(PartyProgress)[slot].xp).toBe(
        before[slot].xp + expectedGain(before[slot].level, 2),
      )
    }
  })

  it('desmaiada não ganha nada e não conta na divisão', () => {
    const wild = spawnWild()
    registrarParticipante(world, spawnSummoned('slot1'), wild)
    registrarParticipante(world, spawnSummoned('slot2'), wild)
    player.set(PartyFaint, { slot2: { timeLeft: 10 } })
    const before = player.get(PartyProgress)

    distribuirExperiencia(world, events, wild)

    expect(player.get(PartyProgress).slot2.xp).toBe(before.slot2.xp)
    expect(player.get(PartyProgress).slot1.xp).toBe(
      before.slot1.xp + expectedGain(before.slot1.level, 1),
    )
  })
})

describe('ganharExperiencia', () => {
  function xpToNextLevel(slot) {
    const species = getSpecies(getPartySpeciesId(slot))
    const progress = player.get(PartyProgress)[slot]
    return (
      experienceForLevel(resolveGrowthRate(species), progress.level + 1) -
      progress.xp
    )
  }

  it('sem chegar no próximo nível, só soma o XP', () => {
    const before = player.get(PartyProgress).slot1
    ganharExperiencia(
      world,
      events,
      player,
      'slot1',
      xpToNextLevel('slot1') - 1,
    )
    expect(player.get(PartyProgress).slot1.level).toBe(before.level)
    const types = events.drain().map((event) => event.type)
    expect(types).toEqual([EVENT_TYPES.EXPERIENCE_GAINED])
  })

  it('sobe de nível: a criatura em campo acompanha e a vida sobe a diferença', () => {
    const creature = spawnSummoned('slot1')
    const species = getSpecies('bulbasaur')
    const individualValues = player.get(PartyIndividualValues).slot1
    const fromLevel = player.get(PartyProgress).slot1.level
    creature.set(Vitals, { hp: 1 })

    ganharExperiencia(world, events, player, 'slot1', xpToNextLevel('slot1'))

    const level = player.get(PartyProgress).slot1.level
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
    expect(leveled).toMatchObject({ slot: 'slot1', fromLevel, level })
  })

  it('a vida guardada na bola também sobe a diferença', () => {
    const species = getSpecies('bulbasaur')
    const individualValues = player.get(PartyIndividualValues).slot1
    const fromLevel = player.get(PartyProgress).slot1.level
    const stored = vitalsFromSpecies(species, individualValues, fromLevel)
    player.set(PartyVitals, { slot1: { ...stored, hp: 1 } })

    ganharExperiencia(world, events, player, 'slot1', xpToNextLevel('slot1'))

    const level = player.get(PartyProgress).slot1.level
    const growth =
      resolveMaxHp(species, individualValues, level) -
      resolveMaxHp(species, individualValues, fromLevel)
    expect(player.get(PartyVitals).slot1.hp).toBe(1 + growth)
  })

  it('para no nível máximo', () => {
    ganharExperiencia(world, events, player, 'slot1', Number.MAX_SAFE_INTEGER)
    const { MAX_LEVEL } = GAME_CONFIG.EXPERIENCE
    const species = getSpecies('bulbasaur')
    expect(player.get(PartyProgress).slot1).toEqual({
      level: MAX_LEVEL,
      xp: experienceForLevel(resolveGrowthRate(species), MAX_LEVEL),
    })
  })
})
