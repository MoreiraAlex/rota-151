import { describe, expect, it } from 'vitest'
import { GAME_CONFIG } from '@/core/gameConfig'
import { verticalClearance } from '@/core/physics/capsule'
import {
  formatBodySnippet,
  resolveCapsuleCenterHeight,
  resolveCapsuleSize,
  resolveGroundedOffsetY,
} from './bodyLabMath'

const STANDING = {
  capsuleRadius: 0.3,
  capsuleHalfHeight: 0.2,
  capsuleAxis: 'y',
  modelOffset: [0, -0.5, 0],
}
const LYING = { ...STANDING, capsuleAxis: 'z' }

describe('laboratório de corpo', () => {
  it('o centro da cápsula fica onde o jogo põe: o quanto ela desce + a folga do controller', () => {
    for (const body of [STANDING, LYING]) {
      expect(resolveCapsuleCenterHeight(body)).toBeCloseTo(
        verticalClearance(body) +
          GAME_CONFIG.PHYSICS.CHARACTER.CONTROLLER_OFFSET,
      )
    }
  })

  it('em pé a altura é o comprimento; deitada, o diâmetro', () => {
    const standing = resolveCapsuleSize(STANDING)
    expect(standing.height).toBeCloseTo(standing.length)
    expect(resolveCapsuleSize(LYING).height).toBeCloseTo(
      2 * LYING.capsuleRadius,
    )
  })

  it('encostar no chão desconta a distância do pé do modelo ao chão', () => {
    const bottom = 0.07
    const offsetY = resolveGroundedOffsetY(STANDING.modelOffset, bottom)
    expect(STANDING.modelOffset[1] - offsetY).toBeCloseTo(bottom)
  })

  it('o trecho tem o scale e o body com os valores atuais', () => {
    const snippet = formatBodySnippet(LYING, 1.2)
    expect(snippet).toContain('scale: 1.2,')
    expect(snippet).toContain(`capsuleRadius: ${LYING.capsuleRadius},`)
    expect(snippet).toContain("capsuleAxis: 'z',")
    expect(snippet).toContain('modelOffset: [0, -0.5, 0],')
  })

  it('o trecho mantém o flightHeight de quem tem voo rasante', () => {
    const flying = { ...STANDING, flightHeight: 0.2 }
    expect(formatBodySnippet(flying, 1)).toContain(
      `flightHeight: ${flying.flightHeight},`,
    )
    expect(formatBodySnippet(STANDING, 1)).not.toContain('flightHeight')
  })
})
