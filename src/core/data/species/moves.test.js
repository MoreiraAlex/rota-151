import { describe, expect, it } from 'vitest'
import { listSkills } from '../skills'
import {
  MAX_MASTERY,
  MOVE_SLOTS,
  createMovesState,
  findEmptyMoveSlot,
  findMoveSlot,
  listLearnset,
  meetsMoveRequirements,
  resolveMoveStatus,
  resolveSpeciesMoveReference,
} from './moves'

const [first, second, third, fourth] = listSkills().map((skill) => skill.id)

const SPECIES = {
  skills: {
    1: first,
    2: { id: second, overrides: { range: 99 } },
  },
  moves: [
    { id: third, requires: { level: 10 } },
    { id: fourth, overrides: { radius: 7 } },
    { id: second },
    { id: 'nao-existe' },
  ],
}

describe('resolveSpeciesMoveReference', () => {
  it('mantém os overrides do kit e do learnset', () => {
    expect(resolveSpeciesMoveReference(SPECIES, second).overrides).toEqual({
      range: 99,
    })
    expect(resolveSpeciesMoveReference(SPECIES, fourth).overrides).toEqual({
      radius: 7,
    })
  })

  it('golpe fora da espécie cai na base; id desconhecido é null', () => {
    expect(resolveSpeciesMoveReference({}, first)).toEqual({
      id: first,
      overrides: null,
    })
    expect(resolveSpeciesMoveReference(SPECIES, 'nao-existe')).toBeNull()
  })
})

describe('listLearnset', () => {
  it('junta kit e learnset, sem repetir e só com golpes do registro', () => {
    const ids = listLearnset(SPECIES).map((entry) => entry.id)
    expect(ids).toEqual([first, second, third, fourth])
  })

  it('o kit não tem condição', () => {
    const kit = listLearnset(SPECIES).filter((entry) =>
      [first, second].includes(entry.id),
    )
    expect(kit.every((entry) => entry.requires === null)).toBe(true)
  })
})

describe('meetsMoveRequirements', () => {
  it('sem requires, cumpre', () => {
    expect(meetsMoveRequirements({ id: first })).toBe(true)
  })

  it('nível: cumpre a partir do exigido', () => {
    const entry = { id: third, requires: { level: 10 } }
    expect(meetsMoveRequirements(entry, { level: 9 })).toBe(false)
    expect(meetsMoveRequirements(entry, { level: 10 })).toBe(true)
  })

  it('condição que o jogo ainda não avalia nunca cumpre', () => {
    const entry = { id: third, requires: { item: 'qualquer' } }
    expect(meetsMoveRequirements(entry, { level: 50 })).toBe(false)
  })
})

describe('createMovesState', () => {
  it('kit nos slots, dominado, sem treino', () => {
    const state = createMovesState(SPECIES)
    expect(state.slots[1]).toEqual({ id: first, mastery: MAX_MASTERY })
    expect(state.slots[2]).toEqual({ id: second, mastery: MAX_MASTERY })
    expect(state.slots[3]).toBeNull()
    expect(state.training).toEqual({})
  })

  it('espécie sem kit tem os slots vazios', () => {
    const state = createMovesState({})
    expect(MOVE_SLOTS.every((slot) => state.slots[slot] === null)).toBe(true)
  })
})

describe('slots', () => {
  it('acha o slot do golpe e o primeiro vazio', () => {
    const state = createMovesState(SPECIES)
    expect(findMoveSlot(state, second)).toBe(2)
    expect(findMoveSlot(state, third)).toBeNull()
    expect(findEmptyMoveSlot(state)).toBe(3)
  })
})

describe('resolveMoveStatus', () => {
  const learnset = listLearnset(SPECIES)
  const entryOf = (id) => learnset.find((entry) => entry.id === id)

  it('segue o ciclo bloqueado → apto → pronto → aprendido → dominado', () => {
    const state = createMovesState(SPECIES)
    const entry = entryOf(third)

    expect(resolveMoveStatus(state, entry, { level: 1 })).toBe('locked')
    expect(resolveMoveStatus(state, entry, { level: 10 })).toBe('apt')

    state.training[third] = 1
    expect(resolveMoveStatus(state, entry, { level: 10 })).toBe('ready')

    state.slots[3] = { id: third, mastery: 0.5 }
    expect(resolveMoveStatus(state, entry, { level: 10 })).toBe('learned')

    state.slots[3].mastery = MAX_MASTERY
    expect(resolveMoveStatus(state, entry, { level: 10 })).toBe('mastered')
  })
})
