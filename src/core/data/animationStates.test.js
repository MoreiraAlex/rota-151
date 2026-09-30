import { describe, it, expect } from 'vitest'
import { GAME_CONFIG } from '../gameConfig'
import {
  resolveAnimationState,
  resolveAnimationFallback,
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

describe('battleIdle e appeal', () => {
  it('parada no chão em combate → battleIdle, com fallback pra idle', () => {
    expect(
      resolveAnimationState({ speed: 0, grounded: true, inCombat: true }),
    ).toBe('battleIdle')
    expect(resolveAnimationFallback('battleIdle')).toBe('idle')
  })

  it('em combate, andar/correr/cair continua vencendo o battleIdle', () => {
    const ctx = { speed: WALK_MIN_SPEED + 0.1, grounded: true, inCombat: true }
    expect(resolveAnimationState(ctx)).toBe('walk')
    expect(
      resolveAnimationState({ speed: 0, grounded: false, inCombat: true }),
    ).toBe('fall')
  })

  it('ação "appeal" (ao ser invocada) é one-shot e vence a locomoção', () => {
    const ctx = { speed: RUN_MIN_SPEED + 1, grounded: true, action: 'appeal' }
    expect(resolveAnimationState(ctx)).toBe('appeal')
    expect(isOneShotAnimationState('appeal')).toBe(true)
  })

  it('estado sem fallback declarado não tem substituto', () => {
    expect(resolveAnimationFallback('walk')).toBeNull()
  })
})

describe('jump × fall', () => {
  it('no meio de um pulo de verdade → jump, mesmo nos ticks em que ainda está grounded', () => {
    expect(
      resolveAnimationState({ speed: 0, grounded: false, jumping: true }),
    ).toBe('jump')
    expect(
      resolveAnimationState({
        speed: RUN_MIN_SPEED + 1,
        grounded: true,
        jumping: true,
      }),
    ).toBe('jump')
  })

  it('no ar sem ter pulado (caiu de uma borda) → fall', () => {
    expect(
      resolveAnimationState({ speed: 0, grounded: false, jumping: false }),
    ).toBe('fall')
  })

  it('espécie sem animação de pulo cai no fall', () => {
    expect(resolveAnimationFallback('jump')).toBe('fall')
  })

  it('ação (ex.: dash) vence o pulo', () => {
    expect(
      resolveAnimationState({ grounded: false, jumping: true, action: 'dash' }),
    ).toBe('dash')
  })
})
