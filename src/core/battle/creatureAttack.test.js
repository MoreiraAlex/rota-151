import { describe, it, expect } from 'vitest'
import { getSkill } from '../data/skills'
import { resolveCreatureAttack } from './creatureAttack'

const SPECIES = {
  basicAttack: { id: 'test-basic', range: 1 },
  skills: {
    1: 'ember',
    2: { id: 'ember', overrides: { range: 9 } },
  },
}

describe('resolveCreatureAttack', () => {
  it('primary é o ataque básico próprio da espécie', () => {
    expect(resolveCreatureAttack(SPECIES, 'primary')).toBe(SPECIES.basicAttack)
  })

  it('secondaryN resolve a habilidade N de `skills` (compartilhada, com override por espécie)', () => {
    expect(resolveCreatureAttack(SPECIES, 'secondary1')).toEqual(
      getSkill('ember'),
    )
    expect(resolveCreatureAttack(SPECIES, 'secondary2').range).toBe(9)
  })

  it('slot vazio, espécie sem básico ou sem espécie → null', () => {
    expect(resolveCreatureAttack(SPECIES, 'secondary3')).toBeNull()
    expect(resolveCreatureAttack({}, 'primary')).toBeNull()
    expect(resolveCreatureAttack(null, 'primary')).toBeNull()
  })
})
