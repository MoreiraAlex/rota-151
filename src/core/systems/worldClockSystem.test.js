import { afterEach, describe, expect, it } from 'vitest'
import { makeWorld } from '@/test/makeWorld'
import { GAME_CONFIG } from '../gameConfig'
import { WorldClock } from '../traits'
import { definirHorario, definirVelocidadeDoRelogio } from '../actions'
import { worldClockSystem } from './worldClockSystem'

// Relógio do mundo (docs/features/048-dia-noite-e-clima.md).
const { DAY_LENGTH, START_TIME } = GAME_CONFIG.DAY_CYCLE
const STEP = GAME_CONFIG.LOOP.FIXED_TIMESTEP

const worlds = []
afterEach(() => {
  while (worlds.length) worlds.pop().destroy()
})

function setup() {
  const { world } = makeWorld()
  worlds.push(world)
  return world
}

describe('worldClockSystem', () => {
  it('um mundo novo começa no horário inicial', () => {
    expect(setup().get(WorldClock).time).toBe(START_TIME)
  })

  it('anda proporcional ao delta e ao tamanho do dia', () => {
    const world = setup()
    for (let i = 0; i < 120; i++) worldClockSystem({ world, delta: STEP })
    expect(world.get(WorldClock).time).toBeCloseTo(
      START_TIME + (120 * STEP) / DAY_LENGTH,
    )
  })

  it('um dia inteiro de passos soma 1 (e não volta a zero)', () => {
    const world = setup()
    worldClockSystem({ world, delta: DAY_LENGTH })
    expect(world.get(WorldClock).time).toBeCloseTo(START_TIME + 1)
  })

  it('a velocidade multiplica; parado não anda', () => {
    const world = setup()
    definirVelocidadeDoRelogio(world, 3)
    worldClockSystem({ world, delta: DAY_LENGTH / 10 })
    expect(world.get(WorldClock).time).toBeCloseTo(START_TIME + 0.3)

    definirVelocidadeDoRelogio(world, 0)
    worldClockSystem({ world, delta: DAY_LENGTH })
    expect(world.get(WorldClock).time).toBeCloseTo(START_TIME + 0.3)
  })
})

describe('definirHorario', () => {
  it('põe o relógio no horário pedido', () => {
    const world = setup()
    definirHorario(world, 4.75)
    expect(world.get(WorldClock).time).toBe(4.75)
  })

  it('ignora horário inválido', () => {
    const world = setup()
    for (const bad of [-1, NaN, Infinity, 'x']) definirHorario(world, bad)
    expect(world.get(WorldClock).time).toBe(START_TIME)
  })
})
