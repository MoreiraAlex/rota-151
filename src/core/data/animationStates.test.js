import { describe, it, expect } from 'vitest'
import { GAME_CONFIG } from '../gameConfig'
import {
  resolveAnimationState,
  isOneShotAnimationState,
} from './animationStates'

const { WALK_MIN_SPEED, RUN_MIN_SPEED } = GAME_CONFIG.ANIMATION

describe('resolveAnimationState', () => {
  it('velocidade zero e no chão → idle', () => {
    expect(resolveAnimationState({ speed: 0, grounded: true })).toBe('idle')
  })

  it('abaixo de WALK_MIN_SPEED → idle', () => {
    expect(
      resolveAnimationState({ speed: WALK_MIN_SPEED - 0.01, grounded: true }),
    ).toBe('idle')
  })

  it('entre WALK_MIN_SPEED e RUN_MIN_SPEED → walk', () => {
    expect(
      resolveAnimationState({ speed: WALK_MIN_SPEED + 0.01, grounded: true }),
    ).toBe('walk')
  })

  it('acima de RUN_MIN_SPEED → run', () => {
    expect(
      resolveAnimationState({ speed: RUN_MIN_SPEED + 0.01, grounded: true }),
    ).toBe('run')
  })

  it('no ar → fall, não importa a velocidade horizontal', () => {
    expect(resolveAnimationState({ speed: 0, grounded: false })).toBe('fall')
    expect(
      resolveAnimationState({ speed: RUN_MIN_SPEED + 10, grounded: false }),
    ).toBe('fall')
  })

  it('action "dash"/"throw" vencem "fall" mesmo no ar', () => {
    expect(
      resolveAnimationState({ speed: 0, grounded: false, action: 'dash' }),
    ).toBe('dash')
    expect(
      resolveAnimationState({ speed: 0, grounded: false, action: 'throw' }),
    ).toBe('throw')
  })

  it('action "dash" vence a locomoção, mesmo parado e no ar', () => {
    expect(
      resolveAnimationState({ speed: 0, grounded: false, action: 'dash' }),
    ).toBe('dash')
  })

  it('action "dash" vence mesmo com velocidade de corrida e no chão', () => {
    expect(
      resolveAnimationState({
        speed: RUN_MIN_SPEED + 1,
        grounded: true,
        action: 'dash',
      }),
    ).toBe('dash')
  })

  it('action "throw" vence a locomoção, mesmo parado e no ar', () => {
    expect(
      resolveAnimationState({ speed: 0, grounded: false, action: 'throw' }),
    ).toBe('throw')
  })

  it('action "throw" vence mesmo com velocidade de corrida e no chão', () => {
    expect(
      resolveAnimationState({
        speed: RUN_MIN_SPEED + 1,
        grounded: true,
        action: 'throw',
      }),
    ).toBe('throw')
  })

  it('action "summon" (invocar criatura) reusa o id/clipe "throw" — pedido explícito, sem clipe próprio', () => {
    expect(
      resolveAnimationState({ speed: 0, grounded: false, action: 'summon' }),
    ).toBe('throw')
  })

  it('action "recall" (recolher criatura) tem id próprio — clipe ainda não existe, mas o mecanismo já resolve', () => {
    expect(
      resolveAnimationState({ speed: 0, grounded: false, action: 'recall' }),
    ).toBe('recall')
  })
})

describe('isOneShotAnimationState', () => {
  it('dash, throw (inclui summon) e recall são one-shot — o relógio reinicia ao entrar nesses estados', () => {
    expect(isOneShotAnimationState('dash')).toBe(true)
    expect(isOneShotAnimationState('throw')).toBe(true)
    expect(isOneShotAnimationState('recall')).toBe(true)
  })

  it('idle/walk/run/fall não são one-shot — cíclicos, sem "fase certa" de início', () => {
    expect(isOneShotAnimationState('idle')).toBe(false)
    expect(isOneShotAnimationState('walk')).toBe(false)
    expect(isOneShotAnimationState('run')).toBe(false)
    expect(isOneShotAnimationState('fall')).toBe(false)
  })

  it('id desconhecido não é one-shot', () => {
    expect(isOneShotAnimationState('nao-existe')).toBe(false)
  })
})
