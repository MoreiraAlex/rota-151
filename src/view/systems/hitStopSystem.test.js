import { describe, it, expect, afterEach } from 'vitest'
import { GAME_CONFIG } from '@/core/gameConfig'
import { EVENT_TYPES } from '@/core/events'
import {
  clearHitStops,
  resolveHitStopScale,
} from '@/view/registry/hitStopRegistry'
import { hitStopSystem } from './hitStopSystem'

const { DURATION, CRIT_DURATION } = GAME_CONFIG.FEEDBACK.HIT_STOP
const ATTACKER = { id: 'attacker' }
const TARGET = { id: 'target' }

function resolved(extra) {
  return {
    type: EVENT_TYPES.ATTACK_RESOLVED,
    result: 'hit',
    attacker: ATTACKER,
    target: TARGET,
    critical: false,
    channel: false,
    ...extra,
  }
}

describe('hitStopSystem', () => {
  afterEach(() => clearHitStops())

  it('acerto congela atacante e alvo pela DURATION, depois solta', () => {
    hitStopSystem({ delta: 0, frameEvents: [resolved()] })
    expect(resolveHitStopScale(ATTACKER)).toBe(0)
    expect(resolveHitStopScale(TARGET)).toBe(0)

    hitStopSystem({ delta: DURATION + 0.001, frameEvents: [] })
    expect(resolveHitStopScale(ATTACKER)).toBe(1)
    expect(resolveHitStopScale(TARGET)).toBe(1)
  })

  it('crítico congela por mais tempo', () => {
    hitStopSystem({ delta: 0, frameEvents: [resolved({ critical: true })] })
    hitStopSystem({ delta: DURATION + 0.001, frameEvents: [] })
    expect(resolveHitStopScale(TARGET)).toBe(0)

    hitStopSystem({ delta: CRIT_DURATION, frameEvents: [] })
    expect(resolveHitStopScale(TARGET)).toBe(1)
  })

  it('erro e tick de canalizado não congelam', () => {
    hitStopSystem({
      delta: 0,
      frameEvents: [
        resolved({ result: 'miss', target: null }),
        resolved({ channel: true }),
      ],
    })
    expect(resolveHitStopScale(ATTACKER)).toBe(1)
    expect(resolveHitStopScale(TARGET)).toBe(1)
  })

  it('golpe de STATUS (Growl) não congela a animação de ninguém', () => {
    hitStopSystem({ delta: 0, frameEvents: [resolved({ status: true })] })

    expect(resolveHitStopScale(ATTACKER)).toBe(1)
    expect(resolveHitStopScale(TARGET)).toBe(1)
  })

  it('golpe que não afeta o tipo do alvo não congela', () => {
    hitStopSystem({
      delta: 0,
      frameEvents: [resolved({ effectiveness: 'immune' })],
    })

    expect(resolveHitStopScale(ATTACKER)).toBe(1)
    expect(resolveHitStopScale(TARGET)).toBe(1)
  })
})
