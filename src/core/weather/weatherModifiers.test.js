import { describe, expect, it } from 'vitest'
import {
  resolveWeatherDefenseMultiplier,
  resolveWeatherMoveMultiplier,
} from './weatherModifiers'

// Modificadores do clima no dano (docs/features/048-dia-noite-e-clima.md).
// Config de teste: só a regra importa.
const PARAMS = {
  MOVE_TYPE_MULTIPLIER: { rain: { water: 2, fire: 0.5 } },
  DEFENSE_MULTIPLIER: { snow: { ice: { defense: 3 }, rock: { sp_def: 2 } } },
}

describe('resolveWeatherMoveMultiplier', () => {
  it('lê o multiplicador do tipo do golpe no clima', () => {
    expect(resolveWeatherMoveMultiplier('rain', 'water', PARAMS)).toBe(2)
    expect(resolveWeatherMoveMultiplier('rain', 'fire', PARAMS)).toBe(0.5)
  })

  it('neutro fora do clima, para outro tipo ou sem clima', () => {
    expect(resolveWeatherMoveMultiplier('clear', 'water', PARAMS)).toBe(1)
    expect(resolveWeatherMoveMultiplier('rain', 'grass', PARAMS)).toBe(1)
    expect(resolveWeatherMoveMultiplier(undefined, 'water', PARAMS)).toBe(1)
  })
})

describe('resolveWeatherDefenseMultiplier', () => {
  it('sobe só o atributo do tipo do defensor no clima', () => {
    expect(
      resolveWeatherDefenseMultiplier('snow', ['ice'], 'defense', PARAMS),
    ).toBe(3)
    expect(
      resolveWeatherDefenseMultiplier('snow', ['ice'], 'sp_def', PARAMS),
    ).toBe(1)
  })

  it('com dois tipos afetados, multiplica os dois', () => {
    expect(
      resolveWeatherDefenseMultiplier(
        'snow',
        ['ice', 'rock'],
        'sp_def',
        PARAMS,
      ),
    ).toBe(2)
  })

  it('neutro fora do clima ou sem tipo', () => {
    expect(
      resolveWeatherDefenseMultiplier('rain', ['ice'], 'defense', PARAMS),
    ).toBe(1)
    expect(resolveWeatherDefenseMultiplier('snow', [], 'defense', PARAMS)).toBe(
      1,
    )
  })
})
