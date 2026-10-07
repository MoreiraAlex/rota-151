import { describe, it, expect } from 'vitest'
import { getSkill } from '../data/skills'
import {
  TRAINING_SLOT,
  resolveCreatureAttack,
  resolveEntityMoveSet,
} from './creatureAttack'
import { createWorld } from 'koota'
import { CreatureMoves, Training } from '../traits'

const SPECIES = {
  skills: {
    1: 'ember',
    2: { id: 'ember', overrides: { range: 9 } },
  },
}

describe('resolveCreatureAttack', () => {
  it('não existe ataque básico: o clique (primary) não resolve golpe', () => {
    expect(resolveCreatureAttack(SPECIES, 'primary')).toBeNull()
  })

  it('secondaryN resolve a habilidade N de `skills` (compartilhada, com override por espécie)', () => {
    expect(resolveCreatureAttack(SPECIES, 'secondary1')).toEqual(
      getSkill('ember'),
    )
    expect(resolveCreatureAttack(SPECIES, 'secondary2').range).toBe(9)
  })

  it('slot vazio, espécie sem golpes ou sem espécie → null', () => {
    expect(resolveCreatureAttack(SPECIES, 'secondary3')).toBeNull()
    expect(resolveCreatureAttack({}, 'secondary1')).toBeNull()
    expect(resolveCreatureAttack(null, 'secondary1')).toBeNull()
  })

  it('com moveSet, o golpe vem da criatura, com os overrides da espécie', () => {
    const moveSet = { 1: null, 2: { id: 'ember', mastery: 1 }, 3: null }
    expect(resolveCreatureAttack(SPECIES, 'secondary1', moveSet)).toBeNull()
    expect(resolveCreatureAttack(SPECIES, 'secondary2', moveSet).id).toBe(
      'ember',
    )
  })

  it('o slot de treino só existe no moveSet', () => {
    expect(resolveCreatureAttack(SPECIES, TRAINING_SLOT)).toBeNull()
    const moveSet = { [TRAINING_SLOT]: { id: 'ember', mastery: 0 } }
    expect(resolveCreatureAttack(SPECIES, TRAINING_SLOT, moveSet).id).toBe(
      'ember',
    )
  })
})

describe('resolveEntityMoveSet', () => {
  it('slots da criatura e, treinando, o golpe em treino sem domínio', () => {
    const world = createWorld()
    const slots = { 1: { id: 'ember', mastery: 0.5 }, 2: null, 3: null }
    const entity = world.spawn(
      CreatureMoves({ slots, training: {} }),
      Training({ moveId: 'growl' }),
    )
    const moveSet = resolveEntityMoveSet(entity, SPECIES)
    expect(moveSet[1]).toEqual(slots[1])
    expect(moveSet[TRAINING_SLOT]).toEqual({ id: 'growl', mastery: 0 })
  })

  it('sem CreatureMoves (selvagem), o kit da espécie, dominado', () => {
    const world = createWorld()
    const moveSet = resolveEntityMoveSet(world.spawn(), SPECIES)
    expect(moveSet[1]).toEqual({ id: 'ember', mastery: 1 })
    expect(moveSet[TRAINING_SLOT]).toBeUndefined()
  })
})
