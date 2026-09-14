import { describe, it, expect } from 'vitest'
import {
  quaternionFromAxisAngle,
  multiplyQuaternions,
  slerpQuaternions,
} from './quaternion'

const IDENTITY = { x: 0, y: 0, z: 0, w: 1 }

function expectQuaternionCloseTo(actual, expected, precision = 5) {
  expect(actual.x).toBeCloseTo(expected.x, precision)
  expect(actual.y).toBeCloseTo(expected.y, precision)
  expect(actual.z).toBeCloseTo(expected.z, precision)
  expect(actual.w).toBeCloseTo(expected.w, precision)
}

describe('quaternionFromAxisAngle', () => {
  it('ângulo zero é a identidade', () => {
    expectQuaternionCloseTo(quaternionFromAxisAngle('x', 0), IDENTITY)
  })

  it('90° em Z gira um vetor +X pra +Y (regra da mão direita)', () => {
    const q = quaternionFromAxisAngle('z', Math.PI / 2)
    const rotated = rotateVector(q, { x: 1, y: 0, z: 0 })
    expect(rotated.x).toBeCloseTo(0)
    expect(rotated.y).toBeCloseTo(1)
    expect(rotated.z).toBeCloseTo(0)
  })

  it('só preenche o componente do eixo pedido', () => {
    const q = quaternionFromAxisAngle('y', 1.234)
    expect(q.x).toBe(0)
    expect(q.z).toBe(0)
  })
})

describe('multiplyQuaternions', () => {
  it('identidade é elemento neutro', () => {
    const q = quaternionFromAxisAngle('x', 0.7)
    expectQuaternionCloseTo(multiplyQuaternions(IDENTITY, q), q)
    expectQuaternionCloseTo(multiplyQuaternions(q, IDENTITY), q)
  })

  it('duas rotações de 90° no mesmo eixo somam 180°', () => {
    const q90 = quaternionFromAxisAngle('z', Math.PI / 2)
    const q180 = quaternionFromAxisAngle('z', Math.PI)
    expectQuaternionCloseTo(multiplyQuaternions(q90, q90), q180)
  })

  it('não é comutativo quando os eixos são diferentes', () => {
    const qx = quaternionFromAxisAngle('x', Math.PI / 2)
    const qy = quaternionFromAxisAngle('y', Math.PI / 2)
    const ab = multiplyQuaternions(qx, qy)
    const ba = multiplyQuaternions(qy, qx)
    expect(ab.z).not.toBeCloseTo(ba.z)
  })
})

describe('slerpQuaternions', () => {
  it('alpha 0 devolve o primeiro; alpha 1 devolve o segundo', () => {
    const a = quaternionFromAxisAngle('y', 0.3)
    const b = quaternionFromAxisAngle('y', 1.1)
    expectQuaternionCloseTo(slerpQuaternions(a, b, 0), a)
    expectQuaternionCloseTo(slerpQuaternions(a, b, 1), b)
  })

  it('alpha 0.5 fica exatamente na metade do ângulo, no mesmo eixo', () => {
    const a = quaternionFromAxisAngle('z', 0)
    const b = quaternionFromAxisAngle('z', Math.PI / 2)
    const mid = slerpQuaternions(a, b, 0.5)
    expectQuaternionCloseTo(mid, quaternionFromAxisAngle('z', Math.PI / 4))
  })

  it('corrige o sinal — q e -q são a mesma rotação, não dá volta de 360°', () => {
    const a = quaternionFromAxisAngle('z', Math.PI - 0.05)
    const b = negate(quaternionFromAxisAngle('z', -(Math.PI - 0.05)))
    // a e b representam quase a mesma rotação (perto de 180°); sem correção
    // de sinal, o slerp iria pelo caminho longo (quase 360°) em vez do curto.
    const mid = slerpQuaternions(a, b, 0.5)
    const angleFromA = angleBetween(a, mid)
    expect(angleFromA).toBeLessThan(0.1)
  })
})

function rotateVector(q, v) {
  // v' = q * (v,0) * q⁻¹, via multiplyQuaternions — só pra validar
  // quaternionFromAxisAngle com um caso físico conhecido.
  const vq = { x: v.x, y: v.y, z: v.z, w: 0 }
  const qInv = { x: -q.x, y: -q.y, z: -q.z, w: q.w }
  const result = multiplyQuaternions(multiplyQuaternions(q, vq), qInv)
  return { x: result.x, y: result.y, z: result.z }
}

function negate(q) {
  return { x: -q.x, y: -q.y, z: -q.z, w: -q.w }
}

function angleBetween(a, b) {
  const dot = Math.min(
    1,
    Math.abs(a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w),
  )
  return 2 * Math.acos(dot)
}
