import { afterEach, describe, expect, it } from 'vitest'
import { createWorld } from 'koota'
import {
  applySpeedPower,
  resolveCombatSpeed,
  resolveSpeedTierPower,
} from './speedPower'
import { StatStages } from '../traits'
import { getSkill } from '../data/skills'
import { getSpecies } from '../data/species'

const damage = getSkill('electro-ball').damage
const tiers = damage.speedPower
const sorted = [...tiers].sort((a, b) => a.ratio - b.ratio)
const pikachu = getSpecies('pikachu')

let world
afterEach(() => {
  world?.destroy()
  world = null
})

// Um lado do golpe: a espécie, IV no meio e o estágio de Velocidade dado.
function side(speedStage = 0) {
  world ??= createWorld()
  const entity = world.spawn(StatStages({ speedStage }))
  return {
    entity,
    species: pikachu,
    individualValues: { speed: 15 },
    level: pikachu.level,
  }
}

describe('speedPower — poder pela Velocidade (Electro Ball)', () => {
  it('cada degrau dá o poder dele; mais rápido, mais forte', () => {
    for (const tier of sorted) {
      expect(resolveSpeedTierPower(tiers, tier.ratio, damage.power)).toBe(
        tier.power,
      )
    }
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i].power).toBeGreaterThan(sorted[i - 1].power)
    }
  })

  it('entre dois degraus, vale o de baixo', () => {
    const [low, high] = sorted.slice(1, 3)
    const between = (low.ratio + high.ratio) / 2
    expect(resolveSpeedTierPower(tiers, between, damage.power)).toBe(low.power)
  })

  it('o estágio de Velocidade conta na Velocidade de combate', () => {
    expect(resolveCombatSpeed(side(2))).toBeGreaterThan(
      resolveCombatSpeed(side(0)),
    )
  })

  it('mesma Velocidade: o degrau de razão 1; bem mais rápido: um mais forte', () => {
    const even = applySpeedPower(damage, side(0), side(0)).power
    expect(even).toBe(resolveSpeedTierPower(tiers, 1, damage.power))
    const fast = applySpeedPower(damage, side(6), side(-6)).power
    expect(fast).toBeGreaterThan(even)
  })

  it('golpe sem degraus não muda', () => {
    const tackle = getSkill('tackle').damage
    expect(applySpeedPower(tackle, side(), side())).toBe(tackle)
  })
})
