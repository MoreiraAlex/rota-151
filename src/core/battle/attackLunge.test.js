import { describe, expect, it } from 'vitest'
import { GAME_CONFIG } from '../gameConfig'
import {
  resolveImpactAt,
  resolveLungeDistance,
  resolveLungeStep,
  resolveLungeTime,
} from './attackLunge'
import { isAttackLunging, resolveAttackHitTime } from './attackTelegraph'
import { resolveReachFor } from './aiAttackChoice'

const DT = GAME_CONFIG.LOOP.FIXED_TIMESTEP

describe('arrancada do golpe', () => {
  it('sem `lunge`, zero; com, a distância dele', () => {
    expect(resolveLungeDistance({})).toBe(0)
    expect(resolveLungeDistance({ lunge: { distance: 2 } })).toBe(2)
  })

  it('anda a distância planejada no tempo da arrancada, sem passar dela', () => {
    const lungeTime = 0.3
    const lunge = { distance: 2, travelled: 0 }
    let elapsed = 0
    while (elapsed < lungeTime * GAME_CONFIG.BATTLE.LUNGE_WINDOW) {
      lunge.travelled += resolveLungeStep(lunge, lungeTime, DT).step
      elapsed += DT
    }
    expect(lunge.travelled).toBeCloseTo(lunge.distance, 1)
    expect(lunge.travelled).toBeLessThanOrEqual(lunge.distance + 1e-9)
    expect(resolveLungeStep(lunge, lungeTime, DT).step).toBeCloseTo(0)
  })

  it('o acerto vem no fim da arrancada; sem ela, no effectAt', () => {
    const plain = { duration: 1, effectAt: 0.3 }
    const lunging = { ...plain, lunge: { distance: 2, duration: 0.2 } }
    expect(resolveImpactAt(plain)).toBe(plain.effectAt)
    expect(resolveLungeTime(plain)).toBe(0)
    expect(resolveImpactAt(lunging)).toBeCloseTo(
      lunging.effectAt + lunging.lunge.duration,
    )
  })

  it('a janela da arrancada vai do effectAt ao acerto, no tempo real da ação', () => {
    const attack = {
      duration: 1,
      effectAt: 0.3,
      lunge: { distance: 2, duration: 0.2 },
    }
    // a ação esticada pro dobro
    const action = { current: 'attack', animationSpeed: 0.5, elapsed: 0 }
    const hitAt = resolveAttackHitTime(action, attack)
    expect(hitAt).toBeCloseTo(2 * resolveImpactAt(attack))
    const at = (elapsed) => isAttackLunging({ ...action, elapsed }, attack)
    expect(at(2 * attack.effectAt - 0.01)).toBe(false)
    expect(at(2 * attack.effectAt + 0.01)).toBe(true)
    expect(at(hitAt + 0.01)).toBe(false)
    expect(
      isAttackLunging(
        { ...action, elapsed: 0.7 },
        { duration: 1, effectAt: 0.3 },
      ),
    ).toBe(false)
  })

  it('a IA conta a arrancada no alcance', () => {
    const trigger = {
      radius: 0.2,
      halfLength: 0,
      angle: 0,
      offset: { x: 0, z: 0 },
    }
    const attack = { range: 1.4 }
    const lunge = { ...attack, lunge: { distance: 2 } }
    expect(resolveReachFor(lunge, trigger, trigger)).toBeCloseTo(
      resolveReachFor(attack, trigger, trigger) + lunge.lunge.distance,
    )
  })
})
