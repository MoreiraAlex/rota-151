import { afterEach, describe, expect, it } from 'vitest'
import { createWorld } from 'koota'
import { fugirDoJogador } from '../actions/wildBehavior'
import { attackResolved, createEventQueue } from '../events'
import { GAME_CONFIG } from '../gameConfig'
import {
  PathState,
  Position,
  Threat,
  Vitals,
  WanderState,
  WildBehavior,
} from '../traits'
import { wildReactionSystem } from './wildReactionSystem'

const worlds = []
afterEach(() => {
  while (worlds.length) worlds.pop().destroy()
})

function spawnWild(world, temperament) {
  return world.spawn(
    WildBehavior({ temperament }),
    Position,
    PathState,
    WanderState,
  )
}

function hitEvent(target, attacker = 'jogador', damage = 5) {
  return attackResolved({
    attacker,
    target,
    attackId: 'tackle',
    slot: 'primary',
    origin: { x: 0, y: 0, z: 0 },
    impactPoint: { x: 0, y: 0, z: 1 },
    contactPoint: { x: 0, y: 0, z: 0.8 },
    damage,
  })
}

function react(events) {
  const queue = createEventQueue()
  queue.beginStep()
  for (const event of events) queue.emit(event)
  wildReactionSystem({ events: queue })
}

function setup() {
  const world = createWorld()
  worlds.push(world)
  return world
}

describe('wildReactionSystem', () => {
  it('hostil que apanha persegue, provocada', () => {
    const world = setup()
    const wild = spawnWild(world, 'hostile')

    react([hitEvent(wild)])

    expect(wild.get(WildBehavior)).toMatchObject({
      state: 'chase',
      provoked: true,
    })
  })

  it('pacífica que apanha revida (persegue provocada) ou foge — nunca continua vagando', () => {
    const world = setup()
    const wilds = Array.from({ length: 20 }, () => spawnWild(world, 'peaceful'))

    react(wilds.map(hitEvent))

    const states = wilds.map((wild) => wild.get(WildBehavior))
    for (const behavior of states) {
      expect(['chase', 'flee']).toContain(behavior.state)
      if (behavior.state === 'chase') expect(behavior.provoked).toBe(true)
    }
    // Sorteio: com 20 criaturas, as duas reações aparecem.
    expect(states.some((behavior) => behavior.state === 'chase')).toBe(true)
    expect(states.some((behavior) => behavior.state === 'flee')).toBe(true)
  })

  it('pacífica que já está fugindo e apanha de novo continua fugindo', () => {
    const world = setup()
    const wild = spawnWild(world, 'peaceful')
    fugirDoJogador(wild)

    react([hitEvent(wild)])

    expect(wild.get(WildBehavior).state).toBe('flee')
  })

  it('golpe que errou não provoca reação', () => {
    const world = setup()
    const wild = spawnWild(world, 'hostile')
    const miss = attackResolved({
      attacker: 'jogador',
      attackId: 'tackle',
      slot: 'primary',
      origin: { x: 0, y: 0, z: 0 },
      impactPoint: { x: 0, y: 0, z: 1 },
    })

    react([miss])

    expect(wild.get(WildBehavior).state).toBe('wander')
  })

  it('evento de passo anterior não é relido (só stepEvents do passo atual)', () => {
    const world = setup()
    const wild = spawnWild(world, 'hostile')
    const queue = createEventQueue()
    queue.beginStep()
    queue.emit(hitEvent(wild))
    queue.beginStep() // passo seguinte, sem eventos novos

    wildReactionSystem({ events: queue })

    expect(wild.get(WildBehavior).state).toBe('wander')
  })

  it('todo golpe soma o dano na ameaça de quem bateu (por atacante)', () => {
    const wild = spawnWild(setup(), 'hostile')

    react([hitEvent(wild, 'treinador', 5), hitEvent(wild, 'bulbasaur', 3)])
    react([hitEvent(wild, 'treinador', 4)])

    expect(wild.get(Threat).entries).toEqual([
      { entity: 'treinador', amount: 9 },
      { entity: 'bulbasaur', amount: 3 },
    ])
  })
})

describe('wildReactionSystem — decisões com critério', () => {
  const WB = GAME_CONFIG.WILD_BEHAVIOR

  it('abalada (fugiu com a vida baixa) que apanha continua fugindo — mesmo hostil', () => {
    const world = setup()
    const wild = spawnWild(world, 'hostile')
    wild.set(WildBehavior, { shaken: true })

    react([hitEvent(wild)])

    expect(wild.get(WildBehavior).state).toBe('flee')
  })

  it('pacífica: a chance de revidar sai da vida dela e do agressor', () => {
    const saved = { ...WB }
    // Coragem com peso enorme e sem limite: o sinal decide sozinho.
    Object.assign(WB, {
      COURAGE_HP_WEIGHT: 100,
      COURAGE_MIN_CHANCE: 0,
      COURAGE_MAX_CHANCE: 1,
    })
    try {
      const world = setup()
      const attacker = world.spawn(Vitals({ hp: 50, maxHp: 100 }))
      const healthy = spawnWild(world, 'peaceful')
      healthy.add(Vitals({ hp: 90, maxHp: 100 }))
      const hurt = spawnWild(world, 'peaceful')
      hurt.add(Vitals({ hp: 10, maxHp: 100 }))

      react([hitEvent(healthy, attacker, 1), hitEvent(hurt, attacker, 1)])

      expect(healthy.get(WildBehavior).state).toBe('chase')
      expect(hurt.get(WildBehavior).state).toBe('flee')
    } finally {
      Object.assign(WB, saved)
    }
  })
})
