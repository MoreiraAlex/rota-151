import { afterEach, describe, expect, it } from 'vitest'
import { createWorld } from 'koota'
import { LeechSeed, SeededBy } from '../traits'
import { plantarSemente, resolveLeechDrain } from './leechSeed'

const EFFECT = { type: 'leechSeed', fraction: 1 / 8, interval: 2, duration: 10 }

describe('plantarSemente', () => {
  let world
  afterEach(() => world?.destroy())

  function setup() {
    world = createWorld()
    return { a: world.spawn(), b: world.spawn(), target: world.spawn() }
  }

  it('planta: semente com o tempo e o ritmo do efeito, 1ª drenagem depois de um intervalo, ligada a quem plantou', () => {
    const { a, target } = setup()

    expect(plantarSemente(target, a, EFFECT)).toBe(true)

    expect(target.get(LeechSeed)).toEqual({
      timeLeft: 10,
      tickTimer: 2,
      fraction: 1 / 8,
      interval: 2,
    })
    expect(target.targetFor(SeededBy)).toBe(a)
  })

  it('plantar de novo renova o tempo, mantém o ritmo e passa a curar quem plantou agora', () => {
    const { a, b, target } = setup()
    plantarSemente(target, a, EFFECT)
    target.set(LeechSeed, { timeLeft: 3, tickTimer: 0.5 })

    plantarSemente(target, b, EFFECT)

    expect(target.get(LeechSeed)).toMatchObject({
      timeLeft: 10,
      tickTimer: 0.5,
    })
    expect(target.targetFor(SeededBy)).toBe(b)
  })

  it('efeito que não é de semente: não faz nada', () => {
    const { a, target } = setup()
    expect(plantarSemente(target, a, { type: 'statStage' })).toBe(false)
    expect(target.has(LeechSeed)).toBe(false)
  })
})

describe('resolveLeechDrain', () => {
  it('1/8 do HP máximo, arredondado pra baixo', () => {
    expect(resolveLeechDrain({ hp: 100, maxHp: 100 }, 1 / 8)).toBe(12)
  })

  it('nunca menos que 1, nunca mais que o HP que sobra', () => {
    expect(resolveLeechDrain({ hp: 5, maxHp: 5 }, 1 / 8)).toBe(1)
    expect(resolveLeechDrain({ hp: 3, maxHp: 100 }, 1 / 8)).toBe(3)
  })
})
