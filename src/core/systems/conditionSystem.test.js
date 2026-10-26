import { afterEach, describe, expect, it } from 'vitest'
import { createWorld } from 'koota'
import { getCondition } from '../data/conditions'
import { createEventQueue, EVENT_TYPES } from '../events'
import { aplicarCondicao, readCondition } from '../actions/conditions'
import {
  AttackEffect,
  Conditions,
  Fainted,
  Position,
  Vitals,
  conditionSource,
} from '../traits'
import { conditionSystem } from './conditionSystem'

// Valores do teste, escritos no efeito por cima dos da condição.
const TICK = { fraction: 1 / 8, interval: 2 }
const DURATION = 10
const SEED = {
  type: 'condition',
  condition: 'leech-seed',
  duration: DURATION,
  tick: TICK,
}
const BURN = {
  type: 'condition',
  condition: 'burn',
  chance: 1,
  duration: DURATION,
  tick: TICK,
}
const STEP = 0.25 // exato em ponto flutuante
const SEED_VISUAL = getCondition('leech-seed').visual.tick

describe('conditionSystem', () => {
  let world
  const events = createEventQueue()
  afterEach(() => {
    world?.destroy()
    events.drain()
  })

  function setup({ sourceHp = 50, effect = SEED } = {}) {
    world = createWorld()
    const target = world.spawn(
      Position({ x: 3, y: 0, z: 4 }),
      Vitals({ hp: 80, maxHp: 80 }),
    )
    const source = world.spawn(
      Position({ x: 0, y: 0, z: 0 }),
      Vitals({ hp: sourceHp, maxHp: 100 }),
    )
    aplicarCondicao(target, source, effect, () => 0)
    return { target, source }
  }

  function run(seconds) {
    const emitted = []
    for (let t = 0; t < seconds; t += STEP) {
      conditionSystem({ world, delta: STEP, events })
      emitted.push(...events.drain())
    }
    return emitted.filter((e) => e.type === EVENT_TYPES.CONDITION_TICKED)
  }

  describe('tick que cura quem aplicou (semente)', () => {
    it('a cada intervalo drena a fração do HP máximo do alvo e cura quem plantou o mesmo valor', () => {
      const { target, source } = setup()

      expect(run(TICK.interval - STEP)).toHaveLength(0) // antes do 1º intervalo
      const [drain] = run(STEP)

      expect(drain).toMatchObject({
        target,
        source,
        condition: 'leech-seed',
        damage: 10,
        healed: 10,
      })
      expect(target.get(Vitals).hp).toBe(70)
      expect(source.get(Vitals).hp).toBe(60)
    })

    it('dura o tempo do efeito e a semente seca (com a relação junto)', () => {
      const { target } = setup()

      expect(run(DURATION + 2)).toHaveLength(DURATION / TICK.interval)
      expect(target.get(Vitals).hp).toBe(30)
      expect(target.has(Conditions)).toBe(false)
      expect(target.has(conditionSource('leech-seed')('*'))).toBe(false)
    })

    it('a cura não passa do máximo de quem plantou', () => {
      const { source } = setup({ sourceHp: 95 })
      const [drain] = run(TICK.interval)
      expect(drain.healed).toBe(5)
      expect(source.get(Vitals).hp).toBe(100)
    })

    it('quem plantou sumiu (recolhido): continua drenando, sem curar ninguém', () => {
      const { target, source } = setup()
      source.destroy()

      const [drain] = run(TICK.interval)

      expect(drain).toMatchObject({ source: null, damage: 10, healed: 0 })
      expect(target.get(Vitals).hp).toBe(70)
    })

    it('quem plantou desmaiado: drena, não cura', () => {
      const { source } = setup()
      source.add(Fainted)
      const [drain] = run(TICK.interval)
      expect(drain.healed).toBe(0)
      expect(source.get(Vitals).hp).toBe(50)
    })

    it('cada tick solta o visual da condição: do alvo até quem plantou; sem ele, o solo', () => {
      const { source } = setup()
      run(TICK.interval)
      const [effect] = world.query(AttackEffect)
      expect(effect.get(AttackEffect)).toMatchObject({
        effectGroup: SEED_VISUAL.group,
        length: 5, // (0,0) → (3,4)
      })
      expect(effect.get(Position)).toMatchObject({ x: 3, z: 4 })

      source.destroy()
      run(TICK.interval)
      const groups = world
        .query(AttackEffect)
        .map((e) => e.get(AttackEffect).effectGroup)
      expect(groups).toContain(SEED_VISUAL.soloGroup)
    })
  })

  describe('tick que some (queimadura)', () => {
    it('tira a fração do HP máximo, sem curar quem aplicou, e sem visual de tick', () => {
      const { target, source } = setup({ effect: BURN })
      const [tick] = run(TICK.interval)
      expect(tick).toMatchObject({
        target,
        source,
        condition: 'burn',
        damage: 10,
        healed: 0,
      })
      expect(source.get(Vitals).hp).toBe(50)
      expect(world.query(AttackEffect)).toHaveLength(0)
    })
  })

  it('condições somam: cada uma no seu ritmo, e a que acaba sai sozinha', () => {
    const { target, source } = setup()
    aplicarCondicao(
      target,
      source,
      { ...BURN, duration: DURATION / 2 },
      () => 0,
    )

    expect(run(TICK.interval)).toHaveLength(2)
    run(DURATION / 2)
    expect(readCondition(target, 'burn')).toBe(null)
    expect(target.has(conditionSource('burn')('*'))).toBe(false)
    expect(readCondition(target, 'leech-seed')).not.toBe(null)
  })

  it('alvo desmaiado perde todas na hora, sem tick', () => {
    const { target, source } = setup()
    aplicarCondicao(target, source, BURN, () => 0)
    target.add(Fainted)
    expect(run(TICK.interval)).toEqual([])
    expect(target.has(Conditions)).toBe(false)
  })
})
