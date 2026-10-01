import { describe, expect, it } from 'vitest'
import { createWorld } from 'koota'
import { GAME_CONFIG } from '../gameConfig'
import { ActionState } from '../traits'
import {
  iniciarAtordoamento,
  isHitStunned,
  resolveHitStunDuration,
} from './hitStun'

describe('resolveHitStunDuration', () => {
  it('padrão do config; a espécie pode sobrescrever (actions.hit.duration)', () => {
    expect(resolveHitStunDuration({})).toBe(
      GAME_CONFIG.BATTLE.HIT_STUN_DURATION,
    )
    expect(resolveHitStunDuration(null)).toBe(
      GAME_CONFIG.BATTLE.HIT_STUN_DURATION,
    )
    expect(
      resolveHitStunDuration({ actions: { hit: { duration: 1.2 } } }),
    ).toBe(1.2)
  })
})

describe('iniciarAtordoamento', () => {
  it('troca a ação pra "hit", do começo, com a animação esticada na duração', () => {
    const action = {
      current: 'attack',
      elapsed: 2,
      animationSpeed: 0.2,
      animationFrames: 30,
      animationKey: 'charge',
      pendingSlot: 'secondary1',
    }

    iniciarAtordoamento(action, { actions: { hit: { duration: 0.5 } } })

    expect(action).toEqual({
      current: 'hit',
      elapsed: 0,
      animationSpeed: 2,
      animationFrames: null,
      animationKey: null,
      pendingSlot: null,
    })
  })
})

describe('isHitStunned', () => {
  it('só com a ação "hit" em andamento', () => {
    const world = createWorld()
    const stunned = world.spawn(ActionState({ current: 'hit' }))
    const attacking = world.spawn(ActionState({ current: 'attack' }))
    const bare = world.spawn()

    expect(isHitStunned(stunned)).toBe(true)
    expect(isHitStunned(attacking)).toBe(false)
    expect(isHitStunned(bare)).toBe(false)
    world.destroy()
  })
})
