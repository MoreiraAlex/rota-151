import { describe, expect, it } from 'vitest'
import { GAME_CONFIG } from '../gameConfig'
import { fitsEnergyReserve, resolveResting } from './aiEnergy'

const { REST_ENTER_FRACTION, REST_EXIT_FRACTION, SKILL_RESERVE_FRACTION } =
  GAME_CONFIG.AI_ENERGY
const vitalsAt = (fraction) => ({ stamina: fraction * 100, maxStamina: 100 })

describe('resolveResting — descanso com folga', () => {
  it('entra com a energia no limite de entrada ou abaixo', () => {
    expect(resolveResting(false, vitalsAt(REST_ENTER_FRACTION))).toBe(true)
    expect(resolveResting(false, vitalsAt(REST_ENTER_FRACTION + 0.01))).toBe(
      false,
    )
  })

  it('descansando, só sai ao voltar ao limite de saída', () => {
    const between = (REST_ENTER_FRACTION + REST_EXIT_FRACTION) / 2
    expect(resolveResting(true, vitalsAt(between))).toBe(true)
    expect(resolveResting(true, vitalsAt(REST_EXIT_FRACTION))).toBe(false)
  })
})

describe('fitsEnergyReserve', () => {
  const basic = { staminaCost: 0.25 }
  const skill = { staminaCost: 4 }

  it('o mais barato sempre cabe, mesmo sem reserva', () => {
    expect(fitsEnergyReserve(basic, vitalsAt(0.01), 0.25)).toBe(true)
  })

  it('habilidade só se sobrar a reserva depois de pagar', () => {
    const enough = {
      stamina: SKILL_RESERVE_FRACTION * 100 + 4,
      maxStamina: 100,
    }
    const short = { stamina: SKILL_RESERVE_FRACTION * 100 + 3, maxStamina: 100 }
    expect(fitsEnergyReserve(skill, enough, 0.25)).toBe(true)
    expect(fitsEnergyReserve(skill, short, 0.25)).toBe(false)
  })
})
