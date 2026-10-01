import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { isInsideAttackCone } from '@/core/battle/attackGeometry'
import { placeAttackShape } from './AttackShape'

// Mesmas peças que o componente expõe pelo ref — objetos do three de
// verdade, sem renderizar nada.
function makeShape() {
  const keys = [
    'root',
    'fan',
    'fanFill',
    'fanEdge',
    'tube',
    'rectFill',
    'frontCapFill',
    'rectSides',
    'frontCapEdge',
    'backCapFill',
    'backCapEdge',
  ]
  return Object.fromEntries(keys.map((key) => [key, new THREE.Group()]))
}

const BODY = { capsuleRadius: 0.3, capsuleHalfHeight: 0.2, capsuleAxis: 'y' }
const SPECIES = { body: BODY }
const BASE = {
  pos: { x: 0, y: 1, z: 0 },
  body: BODY,
  colliderHandle: -1,
  species: SPECIES,
  direction: { x: 0, y: 0, z: 1 },
}

describe('placeAttackShape', () => {
  it('golpe normal: cápsula com largura 2*radius e o comprimento da trajetória', () => {
    const shape = makeShape()
    placeAttackShape(shape, { ...BASE, attack: { range: 3, radius: 0.5 } })

    expect(shape.tube.visible).toBe(true)
    expect(shape.fan.visible).toBe(false)
    expect(shape.rectSides.scale.toArray()).toEqual([0.5, 1, 3])
    expect(shape.frontCapEdge.position.z).toBeCloseTo(3)
    expect(shape.frontCapEdge.scale.x).toBeCloseTo(0.5)
    expect(shape.backCapEdge.scale.x).toBeCloseTo(0.5)
  })

  for (const [label, attack] of [
    ['largo (ember)', { range: 3, radius: 1.5, damageMode: 'channel' }],
    ['estreito (razor-leaf)', { range: 4, radius: 0.4, damageMode: 'channel' }],
  ]) {
    it(`canalizado ${label}: contorno desenhado = borda da área de dano, ponta arredondada`, () => {
      const shape = makeShape()
      placeAttackShape(shape, { ...BASE, attack })

      expect(shape.fan.visible).toBe(true)
      expect(shape.tube.visible).toBe(false)
      expect(shape.fan.scale.toArray()).toEqual([attack.range, 1, attack.range])

      const cone = { length: attack.range, ...attack }
      const origin = { x: 0, z: 0 }
      const positions = shape.fanEdge.geometry.getAttribute('position')
      let tip = 0
      for (let i = 1; i < positions.count; i++) {
        // Ponto do contorno em metros (geometria unitária × comprimento).
        const x = positions.getX(i) * attack.range
        const z = positions.getZ(i) * attack.range
        tip = Math.max(tip, z)
        const at = (factor) => ({ x: x * factor, z: z * factor })
        expect(isInsideAttackCone(origin, BASE.direction, cone, at(0.97))).toBe(
          true,
        )
        expect(isInsideAttackCone(origin, BASE.direction, cone, at(1.05))).toBe(
          false,
        )
      }
      expect(tip).toBeCloseTo(attack.range) // ponta no alcance
      expect(positions.count).toBeGreaterThan(10) // arco, não um vértice reto
    })
  }

  it('preenchimento parcial cresce da origem; contorno continua inteiro', () => {
    const shape = makeShape()
    placeAttackShape(shape, {
      ...BASE,
      attack: { range: 4, radius: 0.5 },
      progress: 0.25,
    })

    expect(shape.rectFill.scale.z).toBeCloseTo(1) // 25% de 4m
    expect(shape.frontCapFill.position.z).toBeCloseTo(1)
    expect(shape.rectSides.scale.z).toBeCloseTo(4)
  })

  it('aponta na direção do golpe', () => {
    const shape = makeShape()
    placeAttackShape(shape, {
      ...BASE,
      direction: { x: 1, y: 0, z: 0 },
      attack: { range: 2, radius: 0.5 },
    })
    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(
      shape.root.quaternion,
    )

    expect(forward.x).toBeCloseTo(1)
    expect(forward.z).toBeCloseTo(0)
  })
})
