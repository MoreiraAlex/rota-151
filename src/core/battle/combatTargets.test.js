import { afterEach, describe, expect, it } from 'vitest'
import { createWorld } from 'koota'
import { registrarAmeaca } from '../actions/wildBehavior'
import { GAME_CONFIG } from '../gameConfig'
import { Position, Vitals } from '../traits'
import {
  findWeakest,
  resolveFinishWeight,
  resolveWildTarget,
} from './combatTargets'

const { FINISH_HP_FRACTION, FINISH_BONUS } = GAME_CONFIG.AI_TARGET

const worlds = []
afterEach(() => {
  while (worlds.length) worlds.pop().destroy()
})

function setup() {
  const world = createWorld()
  worlds.push(world)
  const spawn = (x, hpFraction = 1) =>
    world.spawn(
      Position({ x, y: 0, z: 0 }),
      Vitals({ hp: hpFraction * 100, maxHp: 100 }),
    )
  const candidate = (entity) => ({ entity, pos: entity.get(Position) })
  return { world, spawn, candidate }
}

describe('resolveFinishWeight — alvo quase desmaiando', () => {
  it('bônus com a vida no limite ou abaixo; 1 acima ou sem vida', () => {
    const { world, spawn } = setup()
    expect(resolveFinishWeight(spawn(0, FINISH_HP_FRACTION))).toBe(FINISH_BONUS)
    expect(resolveFinishWeight(spawn(0, FINISH_HP_FRACTION + 0.01))).toBe(1)
    expect(resolveFinishWeight(world.spawn(Position))).toBe(1)
  })
})

describe('resolveWildTarget — prioridade por vida', () => {
  it('sem ameaça: o quase desmaiando ganha mesmo um pouco mais longe', () => {
    const { world, spawn, candidate } = setup()
    const wild = world.spawn(Position)
    const near = spawn(2)
    const weak = spawn(2 * FINISH_BONUS - 0.5, 0.1)
    const target = resolveWildTarget(wild, { x: 0, z: 0 }, [
      candidate(near),
      candidate(weak),
    ])
    expect(target.entity).toBe(weak)
  })

  it('com ameaça: a do quase desmaiando é multiplicada pelo bônus', () => {
    const { world, spawn, candidate } = setup()
    const wild = world.spawn(Position)
    const strong = spawn(1)
    const weak = spawn(5, 0.1)
    registrarAmeaca(wild, strong, 10)
    registrarAmeaca(wild, weak, 10 / FINISH_BONUS + 1)
    expect(
      resolveWildTarget(wild, { x: 0, z: 0 }, [
        candidate(strong),
        candidate(weak),
      ]).entity,
    ).toBe(weak)
  })
})

describe('findWeakest — troca de alvo da criatura do time', () => {
  it('a de menos vida; empate, a mais perto', () => {
    const { spawn, candidate } = setup()
    const near = spawn(1, 0.8)
    const weak = spawn(6, 0.3)
    const tie = spawn(3, 0.3)
    expect(
      findWeakest({ x: 0, z: 0 }, [near, weak, tie].map(candidate)).entity,
    ).toBe(tie)
    expect(findWeakest({ x: 0, z: 0 }, [])).toBeNull()
  })
})
