import { afterEach, describe, expect, it } from 'vitest'
import { createWorld } from 'koota'
import { getSkill } from '../data/skills'
import { listSpecies } from '../data/species'
import { resolveSpeciesTypes } from '../data/types'
import { Burn, BurnedBy, WildCreature } from '../traits'
import { queimar, readBurnAttackMultiplier, resolveBurnDamage } from './burn'

// O efeito de verdade de um golpe que queima (sem fixar valores do conteúdo).
const BURN = getSkill('ember').effects.find((effect) => effect.type === 'burn')
const ALWAYS = () => 0
const NEVER = () => 0.999999

// Uma espécie de um tipo imune e uma que não é.
const immuneSpecies = listSpecies().find((species) =>
  resolveSpeciesTypes(species).some((type) => BURN.immuneTypes?.includes(type)),
)
const vulnerableSpecies = listSpecies().find(
  (species) =>
    species.kind === 'pokemon' &&
    !resolveSpeciesTypes(species).some((type) =>
      BURN.immuneTypes?.includes(type),
    ),
)

const worlds = []
afterEach(() => {
  while (worlds.length) worlds.pop().destroy()
})

function spawn(species) {
  const world = createWorld()
  worlds.push(world)
  const target = world.spawn(WildCreature({ speciesId: species.id }))
  const source = world.spawn()
  return { target, source }
}

describe('queimar', () => {
  it('efeito de outro tipo: null, nada muda', () => {
    const { target, source } = spawn(vulnerableSpecies)
    expect(queimar(target, source, { type: 'leechSeed' }, ALWAYS)).toBeNull()
    expect(target.has(Burn)).toBe(false)
  })

  it('sorteia a chance: acertou queima (com crédito pra quem queimou), errou não', () => {
    const { target, source } = spawn(vulnerableSpecies)
    expect(queimar(target, source, BURN, NEVER)).toBe(false)
    expect(target.has(Burn)).toBe(false)

    expect(queimar(target, source, BURN, ALWAYS)).toBe(true)
    expect(target.get(Burn).timeLeft).toBe(BURN.duration)
    expect(target.get(Burn).attackMultiplier).toBe(BURN.attackMultiplier)
    expect(target.targetFor(BurnedBy)).toBe(source)
  })

  it('tipo imune não queima', () => {
    if (!immuneSpecies) return
    const { target, source } = spawn(immuneSpecies)
    expect(queimar(target, source, BURN, ALWAYS)).toBe(false)
    expect(target.has(Burn)).toBe(false)
  })

  it('queimar de novo renova o tempo e mantém o ritmo do próximo dano', () => {
    const { target, source } = spawn(vulnerableSpecies)
    queimar(target, source, BURN, ALWAYS)
    target.set(Burn, { timeLeft: 1, tickTimer: 0.5 })
    queimar(target, source, BURN, ALWAYS)
    expect(target.get(Burn).timeLeft).toBe(BURN.duration)
    expect(target.get(Burn).tickTimer).toBe(0.5)
  })
})

describe('readBurnAttackMultiplier / resolveBurnDamage', () => {
  it('sem queimadura, 1; queimado, o do efeito', () => {
    const { target, source } = spawn(vulnerableSpecies)
    expect(readBurnAttackMultiplier(target)).toBe(1)
    queimar(target, source, BURN, ALWAYS)
    expect(readBurnAttackMultiplier(target)).toBe(BURN.attackMultiplier)
    expect(readBurnAttackMultiplier(null)).toBe(1)
  })

  it('fração do HP máximo, mínimo 1, nunca mais que o HP que sobra', () => {
    const maxHp = 1000
    expect(resolveBurnDamage({ hp: maxHp, maxHp }, BURN.fraction)).toBe(
      Math.floor(maxHp * BURN.fraction),
    )
    expect(resolveBurnDamage({ hp: 1, maxHp: 1 }, BURN.fraction)).toBe(1)
    expect(resolveBurnDamage({ hp: 1, maxHp }, BURN.fraction)).toBe(1)
  })
})
