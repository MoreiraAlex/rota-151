import { describe, expect, it } from 'vitest'
import { GAME_CONFIG } from '../gameConfig'
import { findPerceived, isPerceived } from './perception'

const { VIEW_DISTANCE, VIEW_HALF_ANGLE, NEAR_RADIUS } =
  GAME_CONFIG.WILD_BEHAVIOR.PERCEPTION
const ORIGIN = { x: 0, z: 0 }
// Virada pra +Z (yaw 0): a frente é (sin 0, cos 0).
const YAW = 0
const at = (angle, distance) => ({
  x: Math.sin(angle) * distance,
  z: Math.cos(angle) * distance,
})
// Entre o raio curto e o alcance da visão.
const MID = (NEAR_RADIUS + VIEW_DISTANCE) / 2

describe('isPerceived — cone de visão + raio curto', () => {
  it('à frente, dentro do cone e do alcance, vê', () => {
    expect(isPerceived(ORIGIN, YAW, at(0, MID))).toBe(true)
    expect(isPerceived(ORIGIN, YAW, at(VIEW_HALF_ANGLE * 0.9, MID))).toBe(true)
  })

  it('à frente mas além do alcance, não vê', () => {
    expect(isPerceived(ORIGIN, YAW, at(0, VIEW_DISTANCE + 1))).toBe(false)
  })

  it('fora do cone, só dentro do raio curto', () => {
    const side = VIEW_HALF_ANGLE + 0.3
    expect(isPerceived(ORIGIN, YAW, at(side, MID))).toBe(false)
    expect(isPerceived(ORIGIN, YAW, at(side, NEAR_RADIUS * 0.5))).toBe(true)
  })

  it('atrás e longe não vê; atrás e bem perto, sente', () => {
    expect(isPerceived(ORIGIN, YAW, at(Math.PI, MID))).toBe(false)
    expect(isPerceived(ORIGIN, YAW, at(Math.PI, NEAR_RADIUS * 0.5))).toBe(true)
  })

  it('o cone acompanha pra onde ela está virada', () => {
    const behind = at(Math.PI, MID)
    expect(isPerceived(ORIGIN, Math.PI, behind)).toBe(true)
  })
})

describe('findPerceived', () => {
  it('devolve o mais perto entre quem ela percebe; ninguém → null', () => {
    const far = { entity: 'longe', pos: at(0, MID) }
    const near = { entity: 'perto', pos: at(0, NEAR_RADIUS + 0.5) }
    const hidden = { entity: 'atrás', pos: at(Math.PI, MID * 0.9) }

    expect(findPerceived(ORIGIN, YAW, [far, near, hidden]).entity).toBe('perto')
    expect(findPerceived(ORIGIN, YAW, [hidden])).toBeNull()
  })
})
