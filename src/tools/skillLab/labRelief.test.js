import { describe, it, expect } from 'vitest'
import {
  RELIEF_KINDS,
  buildReliefGrid,
  buildReliefMesh,
  reliefHeightAt,
  resolveRelief,
} from './labRelief'

const SIZE = 20
const DISTANCE = 4
const RELIEFS = Object.keys(RELIEF_KINDS)
  .filter((kind) => kind !== 'none')
  .map((kind) =>
    resolveRelief({ kind, height: 1.5, center: 0.5, length: 2 }, DISTANCE),
  )

describe('reliefHeightAt', () => {
  it('sem relevo, o chão é plano', () => {
    const flat = resolveRelief({ kind: 'none' }, DISTANCE)
    for (const z of [-5, 0, 2, 9]) expect(reliefHeightAt(flat, z)).toBe(0)
  })

  it('fica no lugar pedido, entre atacante e alvo', () => {
    for (const relief of RELIEFS) {
      expect(relief.center).toBe(DISTANCE / 2)
    }
  })

  it('morro: sobe até a altura no centro e volta ao chão fora dele', () => {
    const hill = RELIEFS.find((relief) => relief.kind === 'hill')
    expect(reliefHeightAt(hill, hill.center)).toBeCloseTo(hill.height)
    expect(reliefHeightAt(hill, hill.center + hill.length)).toBe(0)
    expect(reliefHeightAt(hill, hill.center - hill.length)).toBe(0)
  })

  it('degrau e rampa: o lado do alvo fica na altura, o do atacante no chão', () => {
    for (const kind of ['step', 'ramp']) {
      const relief = RELIEFS.find((candidate) => candidate.kind === kind)
      expect(reliefHeightAt(relief, 0)).toBe(0)
      expect(reliefHeightAt(relief, DISTANCE)).toBe(relief.height)
    }
  })

  it('rampa sobe sem degrau no meio', () => {
    const ramp = RELIEFS.find((relief) => relief.kind === 'ramp')
    expect(reliefHeightAt(ramp, ramp.center)).toBeCloseTo(ramp.height / 2)
  })
})

describe('buildReliefMesh', () => {
  it('todo vértice está no perfil, e os triângulos olham pra cima', () => {
    for (const relief of RELIEFS) {
      const { vertices, indices } = buildReliefMesh(relief, SIZE)
      for (let i = 0; i < vertices.length; i += 3) {
        expect(vertices[i + 1]).toBeCloseTo(
          reliefHeightAt(relief, vertices[i + 2]),
        )
      }
      for (let i = 0; i < indices.length; i += 3) {
        const [a, b, c] = [indices[i], indices[i + 1], indices[i + 2]].map(
          (index) => vertices.slice(index * 3, index * 3 + 3),
        )
        const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]
        const ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]
        const normalY = ab[2] * ac[0] - ab[0] * ac[2]
        expect(normalY).toBeGreaterThanOrEqual(0)
      }
    }
  })

  it('cobre o chão inteiro', () => {
    const { vertices } = buildReliefMesh(RELIEFS[0], SIZE)
    const zs = []
    for (let i = 2; i < vertices.length; i += 3) zs.push(vertices[i])
    expect(Math.min(...zs)).toBeCloseTo(-SIZE / 2)
    expect(Math.max(...zs)).toBeCloseTo(SIZE / 2)
  })
})

describe('buildReliefGrid', () => {
  it('as linhas ficam em cima do relevo', () => {
    const lift = 0.01
    for (const relief of RELIEFS) {
      const points = buildReliefGrid(relief, SIZE, lift)
      for (let i = 0; i < points.length; i += 3) {
        expect(points[i + 1]).toBeCloseTo(
          reliefHeightAt(relief, points[i + 2]) + lift,
        )
      }
    }
  })
})
