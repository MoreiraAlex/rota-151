import { describe, it, expect } from 'vitest'
import { GAME_CONFIG } from '../gameConfig'
import {
  resolveAnimationState,
  resolveAnimationFallback,
  resolveRunMinSpeed,
  isOneShotAnimationState,
} from './animationStates'

const { WALK_MIN_SPEED } = GAME_CONFIG.ANIMATION
// velocidades de uma criatura de teste: o limiar de correr sai delas
const MOVEMENT = { walkSpeed: 2, runSpeed: 6 }
const RUN_MIN_SPEED = resolveRunMinSpeed(MOVEMENT)

describe('resolveAnimationState', () => {
  it('esperando no treino, parada no chão → rest (sem rest, a idle)', () => {
    const ctx = { speed: 0, grounded: true, trainingWait: true }
    expect(resolveAnimationState(ctx)).toBe('rest')
    expect(resolveAnimationFallback('rest')).toBe('idle')
  })

  it('o golpe de treino vence a espera', () => {
    expect(
      resolveAnimationState({
        speed: 0,
        grounded: true,
        trainingWait: true,
        action: 'attack',
      }),
    ).toBe('attack')
  })

  it('comendo → eat, cíclico (sem eat, a idle)', () => {
    const ctx = { speed: 0, grounded: true, inCombat: true, action: 'eat' }
    expect(resolveAnimationState(ctx)).toBe('eat')
    expect(resolveAnimationFallback('eat')).toBe('idle')
    expect(isOneShotAnimationState('eat')).toBe(false)
  })

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
      resolveAnimationState({
        speed: WALK_MIN_SPEED + 0.01,
        runMinSpeed: RUN_MIN_SPEED,
        grounded: true,
      }),
    ).toBe('walk')
  })

  it('acima de RUN_MIN_SPEED → run', () => {
    expect(
      resolveAnimationState({
        speed: RUN_MIN_SPEED + 0.01,
        runMinSpeed: RUN_MIN_SPEED,
        grounded: true,
      }),
    ).toBe('run')
  })

  it('o limiar de correr fica entre o walkSpeed e o runSpeed da criatura', () => {
    const runMinSpeed = resolveRunMinSpeed(MOVEMENT)
    expect(runMinSpeed).toBeGreaterThan(MOVEMENT.walkSpeed)
    expect(runMinSpeed).toBeLessThan(MOVEMENT.runSpeed)
    const at = (speed) =>
      resolveAnimationState({ speed, runMinSpeed, grounded: true })
    expect(at(MOVEMENT.walkSpeed)).toBe('walk')
    expect(at(MOVEMENT.runSpeed)).toBe('run')
  })

  it('sem limiar (criatura sem velocidades), não corre', () => {
    expect(
      resolveAnimationState({ speed: RUN_MIN_SPEED + 10, grounded: true }),
    ).toBe('walk')
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

  it('ação "hit" (atordoada, golpe interrompido) é one-shot e vence a locomoção e o combate', () => {
    const ctx = {
      speed: RUN_MIN_SPEED + 1,
      grounded: true,
      inCombat: true,
      action: 'hit',
    }
    expect(resolveAnimationState(ctx)).toBe('hit')
    expect(isOneShotAnimationState('hit')).toBe(true)
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

describe('resolveAnimationState — voo livre (060)', () => {
  const FLIGHT = { walkSpeed: 4, runSpeed: 9 }
  const FLY_FAST_MIN = resolveRunMinSpeed(FLIGHT)
  const flying = (speed) => ({
    speed,
    runMinSpeed: FLY_FAST_MIN,
    grounded: false,
    flying: true,
  })

  it('parado no ar paira; voando, fly; rápido, flyFast', () => {
    expect(resolveAnimationState(flying(0))).toBe('flyIdle')
    expect(resolveAnimationState(flying(FLY_FAST_MIN - 0.1))).toBe('fly')
    expect(resolveAnimationState(flying(FLY_FAST_MIN + 0.1))).toBe('flyFast')
  })

  it('no ar voando não é queda', () => {
    expect(resolveAnimationState(flying(0))).not.toBe('fall')
  })

  it('sem animação de voo, toca a de andar/correr', () => {
    expect(resolveAnimationFallback('flyIdle')).toBe('walk')
    expect(resolveAnimationFallback('fly')).toBe('walk')
    expect(resolveAnimationFallback('flyFast')).toBe('run')
  })

  it('dash voando → flyDash (sem ela, a do dash); no chão continua dash', () => {
    expect(resolveAnimationState({ ...flying(0), action: 'dash' })).toBe(
      'flyDash',
    )
    expect(resolveAnimationFallback('flyDash')).toBe('dash')
    expect(isOneShotAnimationState('flyDash')).toBe(true)
    expect(
      resolveAnimationState({ speed: 0, grounded: true, action: 'dash' }),
    ).toBe('dash')
  })

  it('desmaiada no ar cai no faint, antes do voo', () => {
    expect(resolveAnimationState({ ...flying(0), fainted: true })).toBe('faint')
  })
})
