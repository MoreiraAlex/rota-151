import { describe, it, expect } from 'vitest'
import { GAME_CONFIG } from '../gameConfig'
import { resolveAnimationState } from './animationStates'

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

  it('no ar, mesmo rápido → idle (sem clipe de queda ainda)', () => {
    expect(
      resolveAnimationState({ speed: RUN_MIN_SPEED + 10, grounded: false }),
    ).toBe('idle')
  })
})
