import { afterEach, describe, expect, it } from 'vitest'
import { createWorld } from 'koota'
import { createEventQueue, EVENT_TYPES } from '../events'
import { plantarSemente } from '../actions/leechSeed'
import {
  AttackEffect,
  Fainted,
  LeechSeed,
  Position,
  SeededBy,
  Vitals,
} from '../traits'
import { leechSeedSystem } from './leechSeedSystem'

const EFFECT = { type: 'leechSeed', fraction: 1 / 8, interval: 2, duration: 10 }
const STEP = 0.25 // exato em ponto flutuante

describe('leechSeedSystem', () => {
  let world
  const events = createEventQueue()
  afterEach(() => {
    world?.destroy()
    events.drain()
  })

  function setup({ sourceHp = 50 } = {}) {
    world = createWorld()
    const target = world.spawn(
      Position({ x: 3, y: 0, z: 4 }),
      Vitals({ hp: 80, maxHp: 80 }),
    )
    const source = world.spawn(
      Position({ x: 0, y: 0, z: 0 }),
      Vitals({ hp: sourceHp, maxHp: 100 }),
    )
    plantarSemente(target, source, EFFECT)
    return { target, source }
  }

  function run(seconds) {
    const emitted = []
    for (let t = 0; t < seconds; t += STEP) {
      leechSeedSystem({ world, delta: STEP, events })
      emitted.push(...events.drain())
    }
    return emitted.filter((e) => e.type === EVENT_TYPES.LEECH_SEED_DRAINED)
  }

  it('a cada 2 s drena 1/8 do HP máximo do alvo e cura quem plantou o mesmo valor', () => {
    const { target, source } = setup()

    expect(run(1.75)).toHaveLength(0) // antes do 1º intervalo, nada
    const [drain] = run(0.25)

    expect(drain).toMatchObject({ target, source, damage: 10, healed: 10 })
    expect(target.get(Vitals).hp).toBe(70)
    expect(source.get(Vitals).hp).toBe(60)
  })

  it('dura o tempo do efeito (10 s = 5 drenagens) e a semente seca', () => {
    const { target } = setup()

    expect(run(12)).toHaveLength(5)
    expect(target.get(Vitals).hp).toBe(30)
    expect(target.has(LeechSeed)).toBe(false)
    expect(target.has(SeededBy('*'))).toBe(false)
  })

  it('a cura não passa do máximo de quem plantou', () => {
    const { source } = setup({ sourceHp: 95 })
    const [drain] = run(2)
    expect(drain.healed).toBe(5)
    expect(source.get(Vitals).hp).toBe(100)
  })

  it('quem plantou sumiu (recolhido): continua drenando, sem curar ninguém', () => {
    const { target, source } = setup()
    source.destroy()

    const [drain] = run(2)

    expect(drain).toMatchObject({ source: null, damage: 10, healed: 0 })
    expect(target.get(Vitals).hp).toBe(70)
  })

  it('quem plantou desmaiado: drena, não cura', () => {
    const { source } = setup()
    source.add(Fainted)
    const [drain] = run(2)
    expect(drain.healed).toBe(0)
    expect(source.get(Vitals).hp).toBe(50)
  })

  it('cada drenagem solta o visual: "leech-drain" do alvo até quem plantou; sem ele, "leech-drain-solo"', () => {
    const { source } = setup()
    run(2)
    const [effect] = world.query(AttackEffect)
    expect(effect.get(AttackEffect)).toMatchObject({
      effectGroup: 'leech-drain',
      length: 5, // (0,0) → (3,4)
    })
    expect(effect.get(Position)).toMatchObject({ x: 3, z: 4 })

    source.destroy()
    run(2)
    const groups = world
      .query(AttackEffect)
      .map((e) => e.get(AttackEffect).effectGroup)
    expect(groups).toContain('leech-drain-solo')
  })

  it('alvo desmaiado ou zerado perde a semente na hora', () => {
    const { target } = setup()
    target.add(Fainted)
    run(0.25)
    expect(target.has(LeechSeed)).toBe(false)
  })
})
