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

  it("'pokemon' resolve primary como ataque comum e secondary1-3 como papéis genéricos de skill (Q/E/R, conteúdo real vem de species.attacks.<slot>)", () => {
    expect(resolveActionSlots('pokemon')).toEqual({
      primary: 'attack',
      secondary1: 'skill1',
      secondary2: 'skill2',
      secondary3: 'skill3',
    })
  })

  it('kind desconhecido resolve null', () => {
    expect(resolveActionSlots('nao-existe')).toBeNull()
  })
})
