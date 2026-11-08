import { afterEach, describe, expect, it } from 'vitest'
import { createWorld } from 'koota'
import { getSpecies } from '../data/species'
import { GAME_CONFIG } from '../gameConfig'
import {
  CharacterController,
  CryPulse,
  InputControlled,
  MovementStats,
  Party,
  PathState,
  Position,
  Rotation,
  Threat,
  Velocity,
  Vitals,
  WanderState,
  WildAwareness,
  WildBehavior,
  WildCreature,
} from '../traits'
import { wildAwarenessSystem } from './wildAwarenessSystem'

const SPECIES = getSpecies('charmander')
const DELTA = 1 / 60
const { AGGRO_RADIUS, PERCEPTION } = GAME_CONFIG.WILD_BEHAVIOR
const { ALERT_TIME, ANGRY_DURATION, NEAR_RADIUS, VIEW_DISTANCE } = PERCEPTION
// À frente dela (yaw 0 → +Z), visto pelo cone, fora do raio de aggro.
const SEEN_DISTANCE = Math.min(AGGRO_RADIUS + 1, VIEW_DISTANCE - 0.5)

const worlds = []
afterEach(() => {
  while (worlds.length) worlds.pop().destroy()
})

function setup({ temperament = 'hostile', playerAt } = {}) {
  const world = createWorld()
  worlds.push(world)
  const player = world.spawn(
    InputControlled,
    Party,
    Position(playerAt ?? { x: 0, y: 0, z: SEEN_DISTANCE }),
    CharacterController(SPECIES.body),
    Vitals,
  )
  const wild = world.spawn(
    WildCreature({ speciesId: 'charmander' }),
    WildBehavior({ temperament }),
    WildAwareness,
    Position({ x: 0, y: 0, z: 0 }),
    Rotation,
    Velocity({ x: 1, y: 0, z: 1 }),
    MovementStats(SPECIES.movement),
    PathState,
    WanderState,
  )
  const tick = (delta = DELTA) => wildAwarenessSystem({ world, delta })
  const runFor = (seconds) => {
    for (let t = 0; t < seconds; t += DELTA) tick()
  }
  return { world, player, wild, tick, runFor }
}

const awareness = (wild) => wild.get(WildAwareness)
const state = (wild) => wild.get(WildBehavior).state

describe('wildAwarenessSystem', () => {
  it('percebe quem chega à frente: exclamação, parada e virada pra ele', () => {
    const { wild, player, tick } = setup({
      playerAt: { x: NEAR_RADIUS * 0.5, y: 0, z: 0 },
    })

    tick()

    expect(awareness(wild)).toMatchObject({
      state: 'noticed',
      target: player,
      emote: 'alert',
    })
    expect(wild.get(Velocity)).toMatchObject({ x: 0, z: 0 })
    // Quem viu está em +X (yaw π/2): o corpo começa a girar pra lá.
    expect(wild.get(Rotation).y).toBeGreaterThan(0)
    expect(state(wild)).toBe('wander')
  })

  it('hostil: no fim do alerta parte pra cima, brava e com o grito', () => {
    const { wild, runFor } = setup()

    runFor(ALERT_TIME * 0.5)
    expect(state(wild)).toBe('wander')

    runFor(ALERT_TIME)
    expect(state(wild)).toBe('chase')
    expect(awareness(wild)).toMatchObject({ state: 'reacted', emote: 'angry' })
    expect(wild.has(CryPulse)).toBe(true)
  })

  it('o emote de brava some depois do tempo dele', () => {
    const { wild, runFor } = setup()
    runFor(ALERT_TIME + DELTA * 2)
    expect(awareness(wild).emote).toBe('angry')

    runFor(ANGRY_DURATION + DELTA * 2)

    expect(awareness(wild).emote).toBeNull()
  })

  it('pacífica que decide fugir sai do mapa com a gota de suor', () => {
    const WB = GAME_CONFIG.WILD_BEHAVIOR
    const saved = WB.DEFAULT_FLEE_CHANCE
    WB.DEFAULT_FLEE_CHANCE = 1
    try {
      const { wild, runFor } = setup({ temperament: 'peaceful' })
      runFor(ALERT_TIME + DELTA * 2)

      expect(state(wild)).toBe('leave')
      expect(awareness(wild)).toMatchObject({ state: 'reacted', emote: 'fear' })
      // Corre para longe de quem viu (em +Z).
      expect(wild.get(WildBehavior).leaveDirZ).toBeLessThan(0)
    } finally {
      WB.DEFAULT_FLEE_CHANCE = saved
    }
  })

  it('pacífica que decide ficar: a exclamação some e ela segue vagando', () => {
    const WB = GAME_CONFIG.WILD_BEHAVIOR
    const saved = WB.DEFAULT_FLEE_CHANCE
    WB.DEFAULT_FLEE_CHANCE = 0
    try {
      const { wild, runFor } = setup({ temperament: 'peaceful' })
      runFor(ALERT_TIME + DELTA * 2)

      expect(state(wild)).toBe('wander')
      expect(awareness(wild)).toMatchObject({ state: 'reacted', emote: null })
      expect(wild.get(Threat)).toBeUndefined()
    } finally {
      WB.DEFAULT_FLEE_CHANCE = saved
    }
  })

  it('quem ela via foi embora no meio do alerta: volta a não ter visto', () => {
    const { wild, player, tick } = setup()
    tick()
    player.set(Position, { x: 0, y: 0, z: VIEW_DISTANCE + 5 })

    tick()

    expect(awareness(wild)).toMatchObject({ state: 'unaware', emote: null })
    expect(state(wild)).toBe('wander')
  })
})
