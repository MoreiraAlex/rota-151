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

  it("'pokemon': o clique só confirma a mira (sem ataque básico) e secondary1-3 são os golpes (Q/E/R)", () => {
    expect(resolveActionSlots('pokemon')).toEqual({
      primary: 'confirmAim',
      secondary1: 'skill1',
      secondary2: 'skill2',
      secondary3: 'skill3',
    })
  })

  it('kind desconhecido resolve null', () => {
    expect(resolveActionSlots('nao-existe')).toBeNull()
  })
})
