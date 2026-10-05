import { beforeEach, describe, expect, it } from 'vitest'
import { makeWorld } from '@/test/makeWorld'
import { GAME_CONFIG } from '../gameConfig'
import { InputControlled, MoveLearnRequest, PartyActionMenu } from '../traits'
import { fecharMenuDeAcoes } from '../actions/partyActionMenu'
import { partyActionMenuInputSystem } from './partyActionMenuInputSystem'

const DELTA = 1 / 60
// Ticks pra passar do tempo de segurar (derivado da config).
const HOLD_TICKS =
  Math.ceil(GAME_CONFIG.MOVES.ACTION_MENU_HOLD_TIME / DELTA) + 1

let world
let player

function tick(input) {
  const context = { world, delta: DELTA, input: { ...input } }
  partyActionMenuInputSystem(context)
  return context.input
}

beforeEach(() => {
  ;({ world, player } = makeWorld())
})

describe('partyActionMenuInputSystem', () => {
  it('apertar não invoca na hora; o toque sai ao soltar', () => {
    const pressed = tick({ secondary1: true, secondary1Held: true })
    expect(pressed.secondary1).toBe(false)

    const released = tick({})
    expect(released.secondary1).toBe(true)
    expect(player.get(PartyActionMenu).slot).toBeNull()
  })

  it('apertar e soltar entre dois ticks ainda é um toque', () => {
    expect(tick({ secondary2: true }).secondary2).toBe(true)
  })

  it('segurar abre o menu do slot daquela tecla, e soltar não invoca', () => {
    tick({ secondary3: true, secondary3Held: true })
    for (let i = 0; i < HOLD_TICKS; i++) tick({ secondary3Held: true })

    const menu = player.get(PartyActionMenu)
    expect(menu.slot).toBe('slot3')
    expect(menu.requests).toBe(1)

    fecharMenuDeAcoes(player)
    expect(tick({}).secondary3).toBe(false)
  })

  it('menu aberto bloqueia as ações', () => {
    player.set(PartyActionMenu, { slot: 'slot1' })
    const input = tick({ primary: true, secondary2: true, jump: true })
    expect(input.primary).toBe(false)
    expect(input.secondary2).toBe(false)
    expect(input.jump).toBe(false)
  })

  it('"esquecer qual golpe?" pendente também bloqueia', () => {
    player.set(MoveLearnRequest, { slot: 'slot1', moveId: 'ember' })
    expect(tick({ primary: true }).primary).toBe(false)
  })

  it('pilotando uma criatura, Q/E/R passam direto (são golpes)', () => {
    player.remove(InputControlled)
    const input = tick({ secondary1: true, secondary1Held: true })
    expect(input.secondary1).toBe(true)
  })
})
