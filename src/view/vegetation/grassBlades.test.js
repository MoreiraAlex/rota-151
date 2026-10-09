import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { bladePivotsOf } from './grassBlades'

// Uma folha em pé: um quadrado de `width` × `height` com o pé em `foot`,
// a normal no ângulo `turn` (no chão). Com `split`, os dois triângulos não
// dividem vértice (só a posição).
function blade({ foot, turn, width = 0.1, height = 1, split = false }) {
  const side = new THREE.Vector3(-Math.sin(turn), 0, Math.cos(turn))
  const corner = (along, up) =>
    foot
      .clone()
      .addScaledVector(side, along * width)
      .setY(foot.y + up * height)
  const quad = [
    corner(-0.5, 0),
    corner(0.5, 0),
    corner(0.5, 1),
    corner(-0.5, 1),
  ]
  const vertices = split
    ? [quad[0], quad[1], quad[2], quad[0].clone(), quad[2].clone(), quad[3]]
    : quad
  const triangles = split ? [0, 1, 2, 3, 4, 5] : [0, 1, 2, 0, 2, 3]
  return { vertices, triangles }
}

function tuftOf(blades) {
  const positions = []
  const indices = []
  for (const { vertices, triangles } of blades) {
    const offset = positions.length / 3
    for (const vertex of vertices) positions.push(vertex.x, vertex.y, vertex.z)
    indices.push(...triangles.map((i) => i + offset))
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3),
  )
  geometry.setIndex(indices)
  return geometry
}

const pivotOf = (attribute, vertex) => [
  attribute.getX(vertex),
  attribute.getY(vertex),
  attribute.getZ(vertex),
  attribute.getW(vertex),
]

// Diferença entre dois giros de folha (de dois lados: módulo π).
const turnGap = (a, b) => {
  const gap = Math.abs(a - b) % Math.PI
  return Math.min(gap, Math.PI - gap)
}

describe('bladePivotsOf', () => {
  const feet = [
    new THREE.Vector3(0.2, 0, -0.1),
    new THREE.Vector3(-0.3, 0.05, 0.4),
  ]
  const turns = [Math.PI / 5, (Math.PI * 3) / 4]
  const geometry = tuftOf([
    blade({ foot: feet[0], turn: turns[0] }),
    blade({ foot: feet[1], turn: turns[1], split: true }),
  ])
  const pivots = bladePivotsOf(geometry)
  const firstBlade = [0, 1, 2, 3]
  const secondBlade = [4, 5, 6, 7, 8, 9]

  it('todo vértice da mesma folha leva a mesma raiz e o mesmo giro', () => {
    for (const vertices of [firstBlade, secondBlade]) {
      const first = pivotOf(pivots, vertices[0])
      for (const vertex of vertices) {
        expect(pivotOf(pivots, vertex)).toEqual(first)
      }
    }
  })

  it('vértices no mesmo lugar (sem triângulo em comum) são da mesma folha', () => {
    expect(pivotOf(pivots, secondBlade[0])).toEqual(
      pivotOf(pivots, secondBlade.at(-1)),
    )
  })

  it('folhas separadas ficam com a própria raiz', () => {
    expect(pivotOf(pivots, firstBlade[0])).not.toEqual(
      pivotOf(pivots, secondBlade[0]),
    )
  })

  it('a raiz é o meio do pé da folha, no ponto mais baixo dela', () => {
    ;[firstBlade, secondBlade].forEach((vertices, i) => {
      const [x, y, z] = pivotOf(pivots, vertices[0])
      expect(x).toBeCloseTo(feet[i].x)
      expect(y).toBeCloseTo(feet[i].y)
      expect(z).toBeCloseTo(feet[i].z)
    })
  })

  it('o giro é o da normal da folha (de 0 a π)', () => {
    ;[firstBlade, secondBlade].forEach((vertices, i) => {
      const turn = pivotOf(pivots, vertices[0])[3]
      expect(turn).toBeGreaterThanOrEqual(0)
      expect(turn).toBeLessThan(Math.PI)
      expect(turnGap(turn, turns[i])).toBeLessThan(1e-5)
    })
  })
})
