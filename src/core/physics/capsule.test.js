import { describe, expect, it } from 'vitest'
import { resolveBodyExtent, verticalClearance } from './capsule'

const capsule = (axis) => ({
  capsuleRadius: 0.3,
  capsuleHalfHeight: 0.5,
  capsuleAxis: axis,
})

describe('resolveBodyExtent — o tamanho do corpo pela cápsula', () => {
  it('em pé: comprido na altura, redondo no chão', () => {
    const body = capsule('y')
    const extent = resolveBodyExtent(body)
    expect(extent.width).toBeCloseTo(2 * body.capsuleRadius)
    expect(extent.length).toBeCloseTo(2 * body.capsuleRadius)
    expect(extent.height).toBeCloseTo(2 * verticalClearance(body))
  })

  it('deitada: comprida no eixo dela, baixa', () => {
    const long = (body) => 2 * (body.capsuleRadius + body.capsuleHalfHeight)
    const alongZ = capsule('z')
    expect(resolveBodyExtent(alongZ).length).toBeCloseTo(long(alongZ))
    expect(resolveBodyExtent(alongZ).width).toBeCloseTo(
      2 * alongZ.capsuleRadius,
    )
    const alongX = capsule('x')
    expect(resolveBodyExtent(alongX).width).toBeCloseTo(long(alongX))
    expect(resolveBodyExtent(alongX).height).toBeCloseTo(
      2 * alongX.capsuleRadius,
    )
  })
})
