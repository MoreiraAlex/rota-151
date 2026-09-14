import { describe, it, expect } from 'vitest'
import { resolveActionSlots } from './actionSlots'

describe('resolveActionSlots', () => {
  it("'trainer' resolve os 4 rótulos (item em mãos + 3 slots de time)", () => {
    expect(resolveActionSlots('trainer')).toEqual({
      primary: 'useHeldItem',
      secondary1: 'partySlot1',
      secondary2: 'partySlot2',
      secondary3: 'partySlot3',
    })
  })

  it("'pokemon' ainda não resolve nada (sem conteúdo de golpe definido)", () => {
    expect(resolveActionSlots('pokemon')).toBeNull()
  })

  it('kind desconhecido resolve null', () => {
    expect(resolveActionSlots('nao-existe')).toBeNull()
  })
})
