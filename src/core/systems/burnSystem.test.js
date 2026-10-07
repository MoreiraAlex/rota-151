import { afterEach, describe, expect, it } from 'vitest'
import { createWorld } from 'koota'
import { createEventQueue, EVENT_TYPES } from '../events'
import { queimar } from '../actions/burn'
import { Burn, BurnedBy, Fainted, Vitals } from '../traits'
import { burnSystem } from './burnSystem'

const EFFECT = {
  type: 'burn',
  chance: 1,
  fraction: 1 / 8,
  interval: 2,
  duration: 10,
  attackMultiplier: 0.5,
}
const STEP = 0.25 // exato em ponto flutuante

describe('burnSystem', () => {
  let world
  const events = createEventQueue()
  afterEach(() => {
    world?.destroy()
    events.drain()
  })

  function setup() {
    world = createWorld()
    const target = world.spawn(Vitals({ hp: 80, maxHp: 80 }))
    const source = world.spawn()
    queimar(target, source, EFFECT, () => 0)
    return { target, source }
  }

  function run(seconds) {
    for (let t = 0; t < seconds; t += STEP) {
      events.beginStep()
      burnSystem({ world, delta: STEP, events })
    }
  }

  const burns = () =>
    events.drain().filter((event) => event.type === EVENT_TYPES.BURN_DAMAGED)

  it('tira a fração do HP máximo a cada intervalo, com o aviso', () => {
    const { target, source } = setup()
    run(EFFECT.interval - STEP)
    expect(target.get(Vitals).hp).toBe(80)
    run(STEP)
    expect(target.get(Vitals).hp).toBe(80 - 80 * EFFECT.fraction)
    const [event] = burns()
    expect(event.target).toBe(target)
    expect(event.source).toBe(source)
  })

  it('apaga no fim do tempo (e a relação junto)', () => {
    const { target } = setup()
    run(EFFECT.duration)
    expect(target.has(Burn)).toBe(false)
    expect(target.targetFor(BurnedBy)).toBeUndefined()
  })

  it('desmaiou: apaga na hora, sem dano', () => {
    const { target } = setup()
    target.add(Fainted)
    run(EFFECT.interval)
    expect(target.has(Burn)).toBe(false)
    expect(burns()).toEqual([])
  })
})
