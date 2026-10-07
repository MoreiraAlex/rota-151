import { afterEach, describe, expect, it } from 'vitest'
import { givePartyPokemon, makeWorld, spawnTrainer } from '@/test/makeWorld'
import { getSpecies } from '../data/species'
import { createLevelState } from '../data/species/experience'
import { attackResolved, createEventQueue } from '../events'
import { listWildsFightingParty } from '../battle/combatTargets'
import {
  ActionState,
  CameraTarget,
  CharacterController,
  CreatureLevel,
  FoughtBy,
  IndividualValues,
  InputControlled,
  MovementStats,
  OwnedBy,
  PartyBehavior,
  SummonedFrom,
  PathState,
  PhysicsBody,
  Position,
  Rotation,
  SummonedCreature,
  Velocity,
  WildBehavior,
  WildCreature,
  vitalsFromSpecies,
} from '../traits'
import { creatureFollowSystem } from '../systems/creatureFollowSystem'
import { partyReactionSystem } from '../systems/partyReactionSystem'
import { partySummonSystem } from '../systems/partySummonSystem'
import { distribuirExperiencia, registrarParticipante } from './experience'
import { desmaiar } from './faint'
import {
  findOwnedCreature,
  isSameTeam,
  resolveGroupLeader,
  resolveLocalTrainer,
  resolveOwner,
} from './owner'
import { findPartyPokemon, tirarDoTime } from './pokemon'

// Dois treinadores no mesmo world (docs/features/040-dono-da-criatura.md):
// `trainer` é o do jogador desta máquina (`makeWorld`), `other` um segundo,
// sem input.
const SPECIES_ID = 'charmander'
const SPECIES = getSpecies(SPECIES_ID)
// Longe dos obstáculos do nível de teste.
const at = (dx, dz) => ({ x: 30 + dx, y: 1, z: 30 + dz })

const worlds = []
afterEach(() => {
  while (worlds.length) worlds.pop().destroy()
})

function setup() {
  const { world, player: trainer } = makeWorld({ playerPosition: at(0, -20) })
  worlds.push(world)
  const other = spawnTrainer(world, { position: at(0, 20) })
  for (const owner of [trainer, other]) {
    givePartyPokemon(world, owner, { slot1: SPECIES_ID })
  }
  return { world, trainer, other }
}

/** Criatura do time do `owner` em campo, como o `summonBallSystem` cria. */
function spawnOwned(world, owner, slot, position = at(0, 0)) {
  const pokemon = findPartyPokemon(owner, slot)
  const progress = pokemon.get(CreatureLevel)
  return world.spawn(
    SummonedCreature({ slot, speciesId: SPECIES_ID }),
    OwnedBy(owner),
    SummonedFrom(pokemon),
    Position(position),
    Rotation,
    Velocity,
    MovementStats(SPECIES.movement),
    CharacterController(SPECIES.body),
    PhysicsBody,
    PathState,
    ActionState,
    PartyBehavior,
    IndividualValues,
    CreatureLevel(progress),
    vitalsFromSpecies(SPECIES, null, progress.level),
  )
}

function spawnWild(world, position = at(5, 0)) {
  return world.spawn(
    WildCreature({ speciesId: SPECIES_ID }),
    WildBehavior({ temperament: 'hostile' }),
    Position(position),
    CreatureLevel(createLevelState(SPECIES, SPECIES.level)),
    vitalsFromSpecies(SPECIES),
  )
}

/** Passa o controle do `trainer` pra `creature` (como o `controlSwitchSystem`). */
function pilot(trainer, creature) {
  trainer.remove(InputControlled, CameraTarget)
  creature.add(InputControlled, CameraTarget)
}

describe('de quem é', () => {
  it('o treinador é dono de si, a criatura é do dono dela, a selvagem de ninguém', () => {
    const { world, trainer, other } = setup()
    const mine = spawnOwned(world, trainer, 'slot1')
    const theirs = spawnOwned(world, other, 'slot1')

    expect(resolveOwner(trainer)).toBe(trainer)
    expect(resolveOwner(mine)).toBe(trainer)
    expect(resolveOwner(theirs)).toBe(other)
    expect(resolveOwner(spawnWild(world))).toBeNull()
    expect(isSameTeam(mine, trainer)).toBe(true)
    expect(isSameTeam(mine, theirs)).toBe(false)
  })

  it('o mesmo slot de dois treinadores são duas criaturas diferentes', () => {
    const { world, trainer, other } = setup()
    const mine = spawnOwned(world, trainer, 'slot1')
    const theirs = spawnOwned(world, other, 'slot1')

    expect(findOwnedCreature(world, trainer, 'slot1')).toBe(mine)
    expect(findOwnedCreature(world, other, 'slot1')).toBe(theirs)
  })

  it('o líder do grupo é quem o treinador pilota; sem pilotar, ele mesmo', () => {
    const { world, trainer, other } = setup()
    const mine = spawnOwned(world, trainer, 'slot1')
    pilot(trainer, mine)

    expect(resolveGroupLeader(world, trainer)).toBe(mine)
    expect(resolveGroupLeader(world, other)).toBe(other)
    expect(resolveLocalTrainer(world)).toBe(trainer)
  })
})

describe('dois treinadores no mesmo mundo', () => {
  it('o XP vai pro dono da criatura que lutou', () => {
    const { world, trainer, other } = setup()
    const wild = spawnWild(world)
    registrarParticipante(world, spawnOwned(world, other, 'slot1'), wild)

    const mine = findPartyPokemon(trainer, 'slot1')
    const theirs = findPartyPokemon(other, 'slot1')
    expect(wild.has(FoughtBy(theirs))).toBe(true)
    expect(wild.has(FoughtBy(mine))).toBe(false)

    const mineBefore = mine.get(CreatureLevel).xp
    const theirsBefore = theirs.get(CreatureLevel).xp
    distribuirExperiencia(world, createEventQueue(), wild)
    expect(theirs.get(CreatureLevel).xp).toBeGreaterThan(theirsBefore)
    expect(mine.get(CreatureLevel).xp).toBe(mineBefore)
  })

  it('a criatura pilotada que desmaia devolve o controle pro PRÓPRIO dono', () => {
    const { world, trainer, other } = setup()
    trainer.remove(InputControlled, CameraTarget)
    const theirs = spawnOwned(world, other, 'slot1')
    theirs.add(InputControlled, CameraTarget)

    desmaiar(world, theirs)

    expect(other.has(InputControlled)).toBe(true)
    expect(trainer.has(InputControlled)).toBe(false)
  })

  it('desequipar recolhe só a criatura daquele treinador', () => {
    const { world, trainer, other } = setup()
    spawnOwned(world, trainer, 'slot1')
    spawnOwned(world, other, 'slot1')
    tirarDoTime(world, other, findPartyPokemon(other, 'slot1'))

    partySummonSystem({ world, delta: 1 / 60, input: {} })

    expect(other.get(ActionState).current).toBe('recall')
    expect(trainer.get(ActionState).current).toBeNull()
  })

  it('só o time de quem apanhou entra na luta', () => {
    const { world, trainer, other } = setup()
    const mine = spawnOwned(world, trainer, 'slot1', at(-2, 0))
    const theirs = spawnOwned(world, other, 'slot1', at(2, 0))
    const wild = spawnWild(world)

    const queue = createEventQueue()
    queue.beginStep()
    queue.emit(
      attackResolved({
        attacker: wild,
        target: other,
        attackId: 'tackle',
        slot: 'secondary1',
        origin: { x: 0, y: 0, z: 0 },
        impactPoint: { x: 0, y: 0, z: 1 },
        damage: 1,
      }),
    )
    partyReactionSystem({ world, events: queue })

    expect(theirs.get(PartyBehavior).state).toBe('fight')
    expect(mine.get(PartyBehavior).state).toBe('follow')
  })

  it('a selvagem brigando com um treinador só conta na luta do grupo dele', () => {
    const { world, trainer, other } = setup()
    const wild = spawnWild(world)
    wild.set(WildBehavior, { state: 'chase', target: other })

    const listed = (owner) =>
      listWildsFightingParty(world, owner).map(({ entity }) => entity)
    expect(listed(other)).toContain(wild)
    expect(listed(trainer)).not.toContain(wild)
  })

  it('cada criatura segue o próprio treinador', () => {
    const { world, other } = setup()
    // Entre os dois treinadores, mais perto do outro.
    const theirs = spawnOwned(world, other, 'slot1', at(0, 10))

    creatureFollowSystem({ world, delta: 1 / 60 })

    // `other` está em +z dela; o treinador local, em -z.
    expect(theirs.get(Velocity).z).toBeGreaterThan(0)
  })
})
