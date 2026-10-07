import { describe, expect, it } from 'vitest'
import { listSkills } from '../skills'
import { listSpecies } from '../species'
import {
  DEFAULT_TYPE,
  TYPES,
  TYPE_CHART,
  classifyEffectiveness,
  getType,
  isImmuneToStatusSkill,
  listTypes,
  resolveSkillType,
  resolveSpeciesTypes,
  resolveTypeEffectiveness,
  resolveTypeMultiplier,
} from '.'

// Um par (golpe, defensor) da tabela com o multiplicador pedido, ou `null`.
function findPair(predicate) {
  for (const [attack, row] of Object.entries(TYPE_CHART)) {
    for (const [defender, value] of Object.entries(row)) {
      if (predicate(value)) return [attack, defender, value]
    }
  }
  return null
}

describe('tabela de tipos', () => {
  it('todo tipo tem id igual à chave, nome e cor', () => {
    for (const [key, type] of Object.entries(TYPES)) {
      expect(type.id).toBe(key)
      expect(type.name).toBeTruthy()
      expect(type.color).toMatch(/^#[0-9a-f]{6}$/i)
    }
    expect(listTypes()).toHaveLength(Object.keys(TYPES).length)
    expect(getType(DEFAULT_TYPE)).not.toBeNull()
    expect(getType('inexistente')).toBeNull()
  })

  it('só referencia tipos que existem, com multiplicadores clássicos', () => {
    for (const [attack, row] of Object.entries(TYPE_CHART)) {
      expect(TYPES[attack]).toBeDefined()
      for (const [defender, value] of Object.entries(row)) {
        expect(TYPES[defender]).toBeDefined()
        expect([0, 0.5, 2]).toContain(value)
      }
    }
  })

  it('par ausente da tabela é neutro', () => {
    const attack = Object.keys(TYPES).find(
      (type) => Object.keys(TYPE_CHART[type] ?? {}).length < listTypes().length,
    )
    const defender = Object.keys(TYPES).find(
      (type) => !(type in (TYPE_CHART[attack] ?? {})),
    )
    expect(resolveTypeMultiplier(attack, defender)).toBe(1)
  })
})

describe('resolveTypeEffectiveness', () => {
  it('sem tipos no defensor é neutro', () => {
    expect(resolveTypeEffectiveness('fire', [])).toEqual({
      multiplier: 1,
      effectiveness: 'neutral',
    })
    expect(resolveTypeEffectiveness('fire', undefined).multiplier).toBe(1)
  })

  it('multiplica os dois tipos do defensor', () => {
    const [attack, defender, value] = findPair((v) => v === 2)
    const other = Object.keys(TYPES).find(
      (type) => type !== defender && type in TYPE_CHART[attack],
    )
    expect(resolveTypeEffectiveness(attack, [defender, other]).multiplier).toBe(
      value * TYPE_CHART[attack][other],
    )
  })

  it('classifica super, pouco, neutro e imune', () => {
    const [superAttack, superDefender] = findPair((v) => v > 1)
    const [weakAttack, weakDefender] = findPair((v) => v > 0 && v < 1)
    const [immuneAttack, immuneDefender] = findPair((v) => v === 0)
    expect(
      resolveTypeEffectiveness(superAttack, [superDefender]).effectiveness,
    ).toBe('super')
    expect(
      resolveTypeEffectiveness(weakAttack, [weakDefender]).effectiveness,
    ).toBe('weak')
    expect(
      resolveTypeEffectiveness(immuneAttack, [immuneDefender]).effectiveness,
    ).toBe('immune')
    expect(classifyEffectiveness(1)).toBe('neutral')
  })

  it('imunidade vence fraqueza no outro tipo', () => {
    const [attack, immuneDefender] = findPair((v) => v === 0)
    const weakTo = Object.keys(TYPE_CHART[attack]).find(
      (type) => TYPE_CHART[attack][type] === 2,
    )
    if (!weakTo) return
    expect(
      resolveTypeEffectiveness(attack, [immuneDefender, weakTo]).multiplier,
    ).toBe(0)
  })
})

describe('fallbacks', () => {
  it('golpe sem tipo é do tipo padrão; espécie sem tipo é neutra', () => {
    expect(resolveSkillType({})).toBe(DEFAULT_TYPE)
    expect(resolveSkillType(null)).toBe(DEFAULT_TYPE)
    expect(resolveSkillType({ type: 'fire' })).toBe('fire')
    expect(resolveSpeciesTypes({})).toEqual([])
    expect(resolveSpeciesTypes({ types: ['water'] })).toEqual(['water'])
  })
})

describe('isImmuneToStatusSkill', () => {
  it('só pega imunidade declarada na skill', () => {
    expect(isImmuneToStatusSkill({}, ['grass'])).toBe(false)
    expect(isImmuneToStatusSkill({ immuneTypes: ['grass'] }, ['grass'])).toBe(
      true,
    )
    expect(
      isImmuneToStatusSkill({ immuneTypes: ['grass'] }, ['water', 'grass']),
    ).toBe(true)
    expect(isImmuneToStatusSkill({ immuneTypes: ['grass'] }, ['fire'])).toBe(
      false,
    )
    expect(isImmuneToStatusSkill({ immuneTypes: ['grass'] }, [])).toBe(false)
  })
})

describe('conteúdo usa tipos válidos', () => {
  it('todo golpe do registro e todo básico têm tipo existente', () => {
    const attacks = [
      ...listSkills(),
      ...listSpecies()
        .map((species) => species.basicAttack)
        .filter(Boolean),
    ]
    for (const attack of attacks) {
      expect(TYPES[resolveSkillType(attack)], attack.id).toBeDefined()
      for (const type of attack.immuneTypes ?? []) {
        expect(TYPES[type], attack.id).toBeDefined()
      }
    }
  })

  it('espécie com tipos declara 1 ou 2, todos existentes', () => {
    for (const species of listSpecies()) {
      const types = resolveSpeciesTypes(species)
      if (types.length === 0) continue
      expect(types.length, species.id).toBeLessThanOrEqual(2)
      for (const type of types) expect(TYPES[type], species.id).toBeDefined()
    }
  })
})
