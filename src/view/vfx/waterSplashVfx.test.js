import { describe, expect, it } from 'vitest'
import { buildWaterSplashEmitters } from './waterSplashVfx'
import { buildJumpDustEmitters } from './jumpDustVfx'

// docs/features/057-lagos-e-rios.md
describe('buildWaterSplashEmitters', () => {
  it('só gotas: nada da fumaça da poeira', () => {
    const [dust] = buildJumpDustEmitters()
    for (const emitter of buildWaterSplashEmitters()) {
      expect(emitter.texture).not.toBe(dust.texture)
      expect(emitter.texture).toBe('drop')
    }
  })

  it('mais nuvens de poeira, mais gotas; queda mais forte, gotas maiores', () => {
    const total = (options) =>
      buildWaterSplashEmitters(options).reduce((sum, e) => sum + e.burst, 0)
    expect(total({ count: 4 })).toBeGreaterThan(total({ count: 2 }))

    const sizeOf = (options) =>
      buildWaterSplashEmitters(options)[0].size(0, Array(9).fill(0.5))
    expect(sizeOf({ speed: 2.4, size: 0.6 })).toBeGreaterThan(
      sizeOf({ speed: 1.2, size: 0.35 }),
    )
  })
})
