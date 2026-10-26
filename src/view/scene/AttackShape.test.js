import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { GAME_CONFIG } from '@/core/gameConfig'
import { isInsideAttackCone } from '@/core/battle/attackGeometry'
import { verticalClearance } from '@/core/physics/capsule'
import { placeAttackShape } from './AttackShape'

const { GROUND_LIFT } = GAME_CONFIG.FEEDBACK.ATTACK_INDICATOR

// Mesmas peças que o componente expõe pelo ref — objetos do three de
// verdade, sem renderizar nada.
function makeShape() {
  return {
    root: new THREE.Group(),
    fill: new THREE.Mesh(new THREE.BufferGeometry()),
    edge: new THREE.LineLoop(new THREE.BufferGeometry()),
  }
}

const BODY = { capsuleRadius: 0.3, capsuleHalfHeight: 0.2, capsuleAxis: 'y' }
const BASE = {
  pos: { x: 0, y: 1, z: 0 },
  body: BODY,
  colliderHandle: -1,
  direction: { x: 0, y: 0, z: 1 },
  // sem borda: a forma começa no centro (a borda tem o teste dela)
  edge: 0,
}
const FEET_Y = BASE.pos.y - verticalClearance(BODY)

function edgePoints(shape) {
  const { geometry } = shape.edge
  const positions = geometry.getAttribute('position')
  return Array.from({ length: geometry.drawRange.count }, (_, i) => ({
    x: positions.getX(i),
    y: positions.getY(i),
    z: positions.getZ(i),
  }))
}

function fillPoints(shape) {
  const { geometry } = shape.fill
  const positions = geometry.getAttribute('position')
  const index = geometry.getIndex()
  const used = new Set(index.array.slice(0, geometry.drawRange.count))
  return [...used].map((i) => ({
    x: positions.getX(i),
    y: positions.getY(i),
    z: positions.getZ(i),
  }))
}

const extent = (points, axis) => ({
  min: Math.min(...points.map((point) => point[axis])),
  max: Math.max(...points.map((point) => point[axis])),
})

describe('placeAttackShape', () => {
  it('golpe normal: cápsula com largura 2*radius, a ponta de trás na borda e a da frente no alcance', () => {
    const shape = makeShape()
    const attack = { range: 3, radius: 0.5 }
    placeAttackShape(shape, { ...BASE, attack })

    const edge = edgePoints(shape)
    expect(extent(edge, 'x').max).toBeCloseTo(attack.radius)
    expect(extent(edge, 'x').min).toBeCloseTo(-attack.radius)
    expect(extent(edge, 'z').min).toBeCloseTo(BASE.edge)
    expect(extent(edge, 'z').max).toBeCloseTo(attack.range)
  })

  it('a forma começa na borda do trigger e vai o range dali — cápsula e cone, saia o VFX de onde sair', () => {
    const edge = 0.4
    const offset = { visual: { positionOffset: { x: 0, y: 0, z: 1 } } }
    for (const attack of [
      { range: 3, radius: 0.5, ...offset },
      { range: 3, radius: 1.5, area: 'cone', ...offset },
    ]) {
      const shape = makeShape()
      placeAttackShape(shape, { ...BASE, attack, edge })
      const points = edgePoints(shape)
      expect(extent(points, 'z').min).toBeCloseTo(edge)
      expect(extent(points, 'z').max).toBeCloseTo(edge + attack.range)
    }
  })

  for (const [label, attack] of [
    [
      'largo (ember)',
      { range: 3, radius: 1.5, execution: 'channel', area: 'cone' },
    ],
    [
      'estreito (razor-leaf)',
      { range: 4, radius: 0.4, execution: 'channel', area: 'cone' },
    ],
  ]) {
    it(`cone ${label}: contorno desenhado = borda da área de dano, ponta arredondada`, () => {
      const shape = makeShape()
      placeAttackShape(shape, { ...BASE, attack })

      const cone = { length: attack.range, ...attack }
      const origin = { x: 0, z: 0 }
      // a forma é convexa: a borda, encolhida em volta de um ponto de
      // dentro, entra; esticada, sai
      const inside = { x: 0, z: attack.range / 2 }
      const edge = edgePoints(shape)
      for (const point of edge) {
        const at = (factor) => ({
          x: inside.x + (point.x - inside.x) * factor,
          z: inside.z + (point.z - inside.z) * factor,
        })
        expect(isInsideAttackCone(origin, BASE.direction, cone, at(0.97))).toBe(
          true,
        )
        expect(isInsideAttackCone(origin, BASE.direction, cone, at(1.05))).toBe(
          false,
        )
      }
      expect(extent(edge, 'z').max).toBeCloseTo(attack.range) // ponta no alcance
      expect(edge.length).toBeGreaterThan(10) // arco, não um vértice reto
    })
  }

  it('preenchimento parcial cresce da origem; contorno continua inteiro', () => {
    const shape = makeShape()
    const attack = { range: 4, radius: 0.5 }
    const progress = 0.25
    placeAttackShape(shape, { ...BASE, attack, progress })

    // enche o comprimento inteiro, da ponta de trás (na borda) até a da frente
    expect(extent(fillPoints(shape), 'z').min).toBeCloseTo(BASE.edge)
    expect(extent(fillPoints(shape), 'z').max).toBeCloseTo(
      BASE.edge + attack.range * progress,
    )
    expect(extent(edgePoints(shape), 'z').max).toBeCloseTo(attack.range)
  })

  it('cápsula curta e larga (corpo a corpo) também começa vazia e enche proporcional', () => {
    const attack = { range: 1.4, radius: 0.5 }
    for (const progress of [0.1, 0.5]) {
      const shape = makeShape()
      placeAttackShape(shape, { ...BASE, attack, progress })
      expect(extent(fillPoints(shape), 'z').max).toBeCloseTo(
        BASE.edge + attack.range * progress,
      )
    }
  })

  it('aponta na direção do golpe', () => {
    const shape = makeShape()
    const attack = { range: 2, radius: 0.5 }
    placeAttackShape(shape, {
      ...BASE,
      direction: { x: 1, y: 0, z: 0 },
      attack,
    })
    const edge = edgePoints(shape)
    expect(extent(edge, 'x').max).toBeCloseTo(attack.range)
    expect(extent(edge, 'z').max).toBeCloseTo(attack.radius)
  })

  it('golpe em si mesmo: círculo nos pés', () => {
    const shape = makeShape()
    const attack = { range: 0, radius: 0.8, area: 'self' }
    placeAttackShape(shape, { ...BASE, attack })
    for (const point of edgePoints(shape)) {
      expect(Math.hypot(point.x, point.z)).toBeCloseTo(attack.radius)
    }
  })

  it('sem chão achado, fica na altura dos pés', () => {
    const shape = makeShape()
    placeAttackShape(shape, {
      ...BASE,
      attack: { range: 2, radius: 0.5 },
      groundAt: () => null,
    })
    for (const point of [...edgePoints(shape), ...fillPoints(shape)]) {
      expect(point.y).toBeCloseTo(FEET_Y + GROUND_LIFT)
    }
  })

  it('acompanha o relevo: cada vértice fica no chão embaixo dele', () => {
    // um morro no meio do caminho
    const groundAt = (x, z) => Math.max(0, 1 - Math.abs(z - 2))
    for (const attack of [
      { range: 4, radius: 0.5 },
      { range: 4, radius: 1, area: 'cone' },
    ]) {
      const shape = makeShape()
      placeAttackShape(shape, { ...BASE, attack, groundAt })
      const points = [...edgePoints(shape), ...fillPoints(shape)]
      for (const point of points) {
        expect(point.y).toBeCloseTo(groundAt(point.x, point.z) + GROUND_LIFT)
      }
      // há vértices no alto do morro (a malha é subdividida)
      expect(extent(points, 'y').max).toBeGreaterThan(0.8)
    }
  })
})
