import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { makeWorld, givePartyPokemon } from '@/test/makeWorld'
import { spawnWild } from '@/test/spawnWild'
import { createEventQueue, EVENT_TYPES } from '@/core/events'
import { GAME_CONFIG } from '@/core/gameConfig'
import { listItems } from '@/core/data/items'
import { getSpecies } from '@/core/data/species'
import {
  calculateExperienceGain,
  resolveBaseXp,
} from '@/core/data/species/experience'
import { desmaiar } from './faint'
import { queimar } from './burn'
import { findPartyPokemon, resolvePokemonBallId } from './pokemon'
import {
  BallOnGround,
  BeingCaptured,
  Burn,
  CaptureBall,
  CaptureTarget,
  CreatureLevel,
  CreatureMoves,
  Fainted,
  FoughtBy,
  IndividualValues,
  InventoryCell,
  OwnedBy,
  Pokemon,
  Position,
  Rotation,
  StoredConditions,
  StoredFaint,
  StoredVitals,
  Velocity,
  Vitals,
  WildBehavior,
} from '@/core/traits'
import {
  capturarSelvagem,
  comecarCaptura,
  isBeingCaptured,
  resolveWildShakeChance,
  selvagemEscapou,
} from './capture'

const BALLS = listItems().filter((item) => item.category === 'pokeball')
const BALL_ID = BALLS[0].id
const BURN_EFFECT = {
  type: 'burn',
  chance: 1,
  fraction: 0.05,
  interval: 1,
  duration: 10,
}

let world
let player
let events
const worlds = []

beforeEach(() => {
  ;({ world, player } = makeWorld())
  worlds.push(world)
  events = createEventQueue()
})
afterEach(() => {
  while (worlds.length) worlds.pop().destroy()
})

function spawnBall(at = { x: 0, y: 1, z: 5 }) {
  return world.spawn(
    Position(at),
    Rotation,
    Velocity,
    CaptureBall({ itemId: BALL_ID }),
    OwnedBy(player),
  )
}

function startCapture(wild, velocity = { x: 0, y: -1, z: -5 }) {
  const ball = spawnBall()
  comecarCaptura(world, events, ball, wild, velocity)
  return ball
}

function emitted(type) {
  return events.drain().filter((event) => event.type === type)
}

describe('comecarCaptura', () => {
  it('o selvagem entra na bola: fica marcado, para de agir e a bola passa a absorver', () => {
    const wild = spawnWild(world)
    wild.set(Velocity, { x: 2, z: 2 })
    const ball = startCapture(wild)

    expect(isBeingCaptured(wild)).toBe(true)
    expect(ball.targetFor(CaptureTarget)).toBe(wild)
    expect(ball.get(CaptureBall).state).toBe('absorbing')
    expect(wild.get(Velocity).x).toBe(0)
    expect(emitted(EVENT_TYPES.CAPTURE_STARTED)).toHaveLength(1)
  })

  it('selvagem já dentro de outra bola não entra de novo', () => {
    const wild = spawnWild(world)
    startCapture(wild)
    const second = spawnBall()

    expect(
      comecarCaptura(world, events, second, wild, { x: 0, y: 0, z: 1 }),
    ).toBe(false)
    expect(second.get(CaptureBall).state).toBe('flying')
  })

  it('pelas costas num selvagem vagando: a chance é maior e marca a bola', () => {
    const front = spawnWild(world)
    const back = spawnWild(world)
    // Os dois olham pra +Z; a bola vindo de -Z (andando pra +Z) é pelas costas.
    const fromFront = startCapture(front, { x: 0, y: -1, z: -5 })
    const fromBack = startCapture(back, { x: 0, y: -1, z: 5 })

    expect(fromBack.get(CaptureBall).backStrike).toBe(true)
    expect(fromFront.get(CaptureBall).backStrike).toBe(false)
    expect(fromBack.get(CaptureBall).shakeChance).toBeGreaterThanOrEqual(
      fromFront.get(CaptureBall).shakeChance,
    )
  })

  it('desmaiado conta como HP 0; queimado tem bônus; bola melhor tem chance maior', () => {
    const healthy = spawnWild(world)
    const fainted = spawnWild(world)
    fainted.set(Vitals, { hp: 0 })
    fainted.add(Fainted)
    const burned = spawnWild(world)
    queimar(burned, null, BURN_EFFECT, () => 0)

    const [weakest] = BALLS
    const best = BALLS.reduce((a, b) =>
      (b.pokeball.captureMultiplier ?? 1) > (a.pokeball.captureMultiplier ?? 1)
        ? b
        : a,
    )
    expect(resolveWildShakeChance(fainted, weakest, false)).toBeGreaterThan(
      resolveWildShakeChance(healthy, weakest, false),
    )
    expect(resolveWildShakeChance(burned, weakest, false)).toBeGreaterThan(
      resolveWildShakeChance(healthy, weakest, false),
    )
    if (best !== weakest) {
      expect(resolveWildShakeChance(healthy, best, false)).toBeGreaterThan(
        resolveWildShakeChance(healthy, weakest, false),
      )
    }
  })
})

describe('capturarSelvagem', () => {
  it('o registro nasce igual ao selvagem: espécie, nível, XP, IV, golpes, vida e a bola usada', () => {
    const wild = spawnWild(world, { level: 7 })
    wild.set(Vitals, { hp: 5 })
    const before = {
      level: { ...wild.get(CreatureLevel) },
      ivs: { ...wild.get(IndividualValues) },
      moves: JSON.parse(JSON.stringify(wild.get(CreatureMoves))),
      vitals: { ...wild.get(Vitals) },
    }
    const ball = startCapture(wild)

    const pokemon = capturarSelvagem(world, events, ball)

    expect(pokemon.get(Pokemon).speciesId).toBe('charmander')
    expect(pokemon.get(CreatureLevel)).toEqual(before.level)
    expect(pokemon.get(IndividualValues)).toEqual(before.ivs)
    expect(JSON.parse(JSON.stringify(pokemon.get(CreatureMoves)))).toEqual(
      before.moves,
    )
    expect(pokemon.get(StoredVitals).vitals.hp).toBe(before.vitals.hp)
    expect(resolvePokemonBallId(pokemon)).toBe(BALL_ID)
    expect(pokemon.targetFor(OwnedBy)).toBe(player)
    expect(wild.isAlive()).toBe(false)
  })

  it('vai pro primeiro slot vazio do time', () => {
    const party = givePartyPokemon(world, player, { slot1: 'bulbasaur' })
    const ball = startCapture(spawnWild(world))

    const pokemon = capturarSelvagem(world, events, ball)

    expect(findPartyPokemon(player, 'slot1')).toBe(party.slot1)
    expect(findPartyPokemon(player, 'slot2')).toBe(pokemon)
    expect(pokemon.has(InventoryCell)).toBe(false)
    expect(emitted(EVENT_TYPES.POKEMON_CAPTURED)[0].destination).toBe('party')
  })

  it('com o time cheio, vai pro inventário', () => {
    givePartyPokemon(world, player, {
      slot1: 'bulbasaur',
      slot2: 'charmander',
      slot3: 'squirtle',
    })
    const pokemon = capturarSelvagem(
      world,
      events,
      startCapture(spawnWild(world)),
    )

    expect(pokemon.has(InventoryCell)).toBe(true)
    expect(emitted(EVENT_TYPES.POKEMON_CAPTURED)[0].destination).toBe(
      'inventory',
    )
  })

  it('com o time e o inventário cheios, a bola fica no chão', () => {
    givePartyPokemon(world, player, {
      slot1: 'bulbasaur',
      slot2: 'charmander',
      slot3: 'squirtle',
    })
    const previous = GAME_CONFIG.INVENTORY.ROWS
    GAME_CONFIG.INVENTORY.ROWS = 0
    try {
      const ball = startCapture(spawnWild(world))
      const ballPos = { ...ball.get(Position) }
      const pokemon = capturarSelvagem(world, events, ball)

      expect(pokemon.has(InventoryCell)).toBe(false)
      expect(pokemon.get(BallOnGround)).toEqual(ballPos)
      expect(emitted(EVENT_TYPES.POKEMON_CAPTURED)[0].destination).toBe(
        'ground',
      )
    } finally {
      GAME_CONFIG.INVENTORY.ROWS = previous
    }
  })

  it('queimado: a queimadura vai junto pro registro', () => {
    const wild = spawnWild(world)
    queimar(wild, null, BURN_EFFECT, () => 0)
    const pokemon = capturarSelvagem(world, events, startCapture(wild))

    expect(pokemon.get(StoredConditions).burn.timeLeft).toBe(
      BURN_EFFECT.duration,
    )
  })

  it('desmaiado: entra desmaiado na bola', () => {
    const wild = spawnWild(world)
    wild.set(Vitals, { hp: 0 })
    desmaiar(world, wild)
    const pokemon = capturarSelvagem(world, events, startCapture(wild))

    expect(pokemon.has(StoredFaint)).toBe(true)
  })

  it('quem lutou ganha a fração do XP de derrotar; sem participantes, ninguém ganha', () => {
    const party = givePartyPokemon(world, player, { slot1: 'bulbasaur' })
    const wild = spawnWild(world, { level: 6 })
    wild.add(FoughtBy(party.slot1))
    const xpBefore = party.slot1.get(CreatureLevel).xp

    capturarSelvagem(world, events, startCapture(wild))

    const full = calculateExperienceGain({
      baseXp: resolveBaseXp(getSpecies('charmander')),
      defeatedLevel: 6,
      winnerLevel: party.slot1.get(CreatureLevel).level,
      participants: 1,
    })
    const gained = party.slot1.get(CreatureLevel).xp - xpBefore
    expect(gained).toBe(Math.floor(full * GAME_CONFIG.CAPTURE.XP_FRACTION))

    const lonely = spawnWild(world)
    events.drain()
    capturarSelvagem(world, events, startCapture(lonely))
    expect(emitted(EVENT_TYPES.EXPERIENCE_GAINED)).toHaveLength(0)
  })
})

describe('selvagemEscapou', () => {
  it('volta pra cena no ponto da bola, sem a marca', () => {
    const wild = spawnWild(world)
    const ball = startCapture(wild)
    ball.set(Position, { x: 3, y: 0, z: 4 })

    selvagemEscapou(world, events, ball, () => 0.99)

    expect(isBeingCaptured(wild)).toBe(false)
    expect(ball.has(CaptureTarget('*'))).toBe(false)
    expect(wild.get(Position).x).toBe(3)
    expect(wild.get(Position).z).toBe(4)
    expect(emitted(EVENT_TYPES.CAPTURE_ESCAPED)).toHaveLength(1)
  })

  it('desmaiado acorda com a fração de vida do escape', () => {
    const wild = spawnWild(world)
    wild.set(Vitals, { hp: 0 })
    desmaiar(world, wild)
    const ball = startCapture(wild)

    selvagemEscapou(world, events, ball, () => 0.99)

    const { hp, maxHp } = wild.get(Vitals)
    expect(wild.has(Fainted)).toBe(false)
    expect(hp).toBe(
      Math.max(
        1,
        Math.ceil(maxHp * GAME_CONFIG.CAPTURE.ESCAPE_WAKE_HP_FRACTION),
      ),
    )
  })

  it('briga ou foge pela chance do temperamento', () => {
    for (const temperament of ['hostile', 'peaceful']) {
      const chance = GAME_CONFIG.CAPTURE.ESCAPE_FIGHT_CHANCE[temperament]
      const fighter = spawnWild(world, { temperament })
      const fled = spawnWild(world, { temperament })

      expect(
        selvagemEscapou(
          world,
          events,
          startCapture(fighter),
          () => chance - 0.001,
        ),
      ).toBe('fight')
      expect(fighter.get(WildBehavior).state).toBe('chase')
      expect(
        selvagemEscapou(world, events, startCapture(fled), () => chance),
      ).toBe('flee')
      expect(fled.get(WildBehavior).state).toBe('flee')
    }
  })

  it('o selvagem queimado continua queimado depois do escape', () => {
    const wild = spawnWild(world)
    queimar(wild, null, BURN_EFFECT, () => 0)
    selvagemEscapou(world, events, startCapture(wild), () => 0.99)
    expect(wild.has(Burn)).toBe(true)
    expect(wild.has(BeingCaptured)).toBe(false)
  })
})
