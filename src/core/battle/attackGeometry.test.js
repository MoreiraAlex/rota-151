import { afterEach, describe, expect, it } from 'vitest'
import { createCharacterBody } from '@/core/physics/colliders'
import { disposePhysics } from '@/core/physics/physicsWorld'
import { initTestTerrain, settleTerrain } from '@/test/physicsTerrain'
import {
  closestPointsBetweenSegments,
  closestPointsOnGroundPlane,
  isInsideAttackCone,
  resolveRoundedCone,
  isWithinCombatHeight,
  resolveAttackOrigin,
  resolveCapsuleSegment,
  resolveContactPoint,
  resolveFootElevation,
  resolveGroundPoint,
  resolveGroundY,
} from './attackGeometry'

const STANDING = {
  capsuleRadius: 0.3,
  capsuleHalfHeight: 0.15,
  capsuleAxis: 'y',
}
const LYING_Z = {
  capsuleRadius: 0.4,
  capsuleHalfHeight: 0.15,
  capsuleAxis: 'z',
}

describe('resolveGroundPoint', () => {
  it('cápsula em pé: chão fica radius + halfHeight abaixo do centro', () => {
    expect(resolveGroundPoint({ x: 1, y: 2, z: 3 }, STANDING).y).toBeCloseTo(
      2 - 0.45,
    )
  })

  it('cápsula deitada: só o radius conta na vertical', () => {
    expect(resolveGroundPoint({ x: 0, y: 1, z: 0 }, LYING_Z).y).toBeCloseTo(0.6)
  })
})

describe('resolveAttackOrigin', () => {
  it('sem altura configurada, sai do centro do corpo (Position)', () => {
    expect(resolveAttackOrigin({ x: 1, y: 2, z: 3 })).toEqual({
      x: 1,
      y: 2,
      z: 3,
    })
  })

  it('soma a altura configurada por espécie', () => {
    expect(resolveAttackOrigin({ x: 0, y: 1, z: 0 }, 0.25).y).toBeCloseTo(1.25)
  })
})

describe('resolveCapsuleSegment', () => {
  it('cápsula em pé fica vertical, independente do yaw', () => {
    const { a, b } = resolveCapsuleSegment({ x: 0, y: 1, z: 0 }, 1.2, STANDING)
    expect(a).toEqual({ x: 0, y: 0.85, z: 0 })
    expect(b.y).toBeCloseTo(1.15)
    expect(b.x).toBeCloseTo(0)
    expect(b.z).toBeCloseTo(0)
  })

  it('cápsula deitada em z acompanha o yaw (yaw 90° → eixo em x)', () => {
    const { b } = resolveCapsuleSegment(
      { x: 0, y: 1, z: 0 },
      Math.PI / 2,
      LYING_Z,
    )
    expect(b.x).toBeCloseTo(0.15)
    expect(b.y).toBeCloseTo(1)
    expect(b.z).toBeCloseTo(0)
  })
})

describe('closestPointsBetweenSegments', () => {
  it('segmentos que se cruzam têm distância zero', () => {
    const result = closestPointsBetweenSegments(
      { x: -1, y: 0, z: 0 },
      { x: 1, y: 0, z: 0 },
      { x: 0, y: -1, z: 0 },
      { x: 0, y: 1, z: 0 },
    )
    expect(result.distance).toBeCloseTo(0)
    expect(result.s).toBeCloseTo(0.5)
    expect(result.t).toBeCloseTo(0.5)
  })

  it('segmentos paralelos separados medem a distância entre eles', () => {
    const result = closestPointsBetweenSegments(
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 0, z: 2 },
      { x: 1, y: 0, z: 0 },
      { x: 1, y: 0, z: 2 },
    )
    expect(result.distance).toBeCloseTo(1)
  })

  it('ponto no meio do caminho (trajetória), não só na ponta', () => {
    // Trajetória de z=0 até z=4; alvo vertical em z=1, deslocado 0.2 em x.
    const result = closestPointsBetweenSegments(
      { x: 0, y: 1, z: 0 },
      { x: 0, y: 1, z: 4 },
      { x: 0.2, y: 0.85, z: 1 },
      { x: 0.2, y: 1.15, z: 1 },
    )
    expect(result.distance).toBeCloseTo(0.2)
    expect(result.s).toBeCloseTo(0.25)
  })

  it('aceita segmento degenerado (comprimento zero)', () => {
    const result = closestPointsBetweenSegments(
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 0, z: 0 },
      { x: 3, y: 0, z: 0 },
      { x: 3, y: 0, z: 0 },
    )
    expect(result.distance).toBeCloseTo(3)
  })
})

describe('resolveContactPoint', () => {
  it('fica na superfície da cápsula, na direção da trajetória', () => {
    const contact = resolveContactPoint(
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 0, z: 2 },
      0.5,
    )
    expect(contact).toEqual({ x: 0, y: 0, z: 0.5 })
  })

  it('trajetória atravessando o corpo: contato é o próprio ponto da trajetória', () => {
    const contact = resolveContactPoint(
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 0, z: 0.1 },
      0.5,
    )
    expect(contact).toEqual({ x: 0, y: 0, z: 0.1 })
  })
})

describe('closestPointsOnGroundPlane', () => {
  it('ignora a altura: segmentos em Y diferentes medem só a distância horizontal', () => {
    const result = closestPointsOnGroundPlane(
      { x: 0, y: 5, z: 0 },
      { x: 0, y: 5, z: 4 },
      { x: 0.3, y: -2, z: 2 },
      { x: 0.3, y: 0, z: 2 },
    )
    expect(result.distance).toBeCloseTo(0.3)
    expect(result.s).toBeCloseTo(0.5)
  })
})

describe('isWithinCombatHeight', () => {
  it('aceita diferença até MAX_COMBAT_HEIGHT_DIFF (1m), inclusive', () => {
    expect(isWithinCombatHeight(0, 0)).toBe(true)
    expect(isWithinCombatHeight(0, 1)).toBe(true)
    expect(isWithinCombatHeight(1.2, 0.3)).toBe(true)
  })

  it('recusa diferença acima da tolerância', () => {
    expect(isWithinCombatHeight(0, 1.01)).toBe(false)
    expect(isWithinCombatHeight(2, 0.5)).toBe(false)
  })
})

describe('resolveFootElevation / resolveGroundY', () => {
  afterEach(() => {
    disposePhysics()
  })

  it('sem física carregada, conta como no chão', () => {
    expect(resolveFootElevation({ x: 0, y: 7, z: 0 }, STANDING)).toBe(0)
    expect(resolveGroundY(0, 5, 0, 10)).toBeNull()
  })

  it('no chão: elevação 0 (pé = centro - radius - halfHeight)', async () => {
    await initTestTerrain()
    settleTerrain()

    expect(resolveFootElevation({ x: 0, y: 0.45, z: 0 }, STANDING)).toBeCloseTo(
      0,
    )
  })

  it('no ar: elevação é a altura do pé acima do terreno', async () => {
    await initTestTerrain()
    settleTerrain()

    expect(resolveFootElevation({ x: 0, y: 1.95, z: 0 }, STANDING)).toBeCloseTo(
      1.5,
    )
  })

  it('só enxerga o terreno — um corpo de personagem no caminho não conta como chão', async () => {
    await initTestTerrain()
    createCharacterBody({ x: 3, y: 1, z: 3 }, { radius: 0.5, halfHeight: 0.5 })
    settleTerrain()

    expect(resolveGroundY(3, 5, 3, 10)).toBeCloseTo(0)
  })
})

describe('isInsideAttackCone — cone de sorvete (triângulo + meia-lua na ponta)', () => {
  const ORIGIN = { x: 0, y: 0, z: 0 }
  const FORWARD = { x: 0, y: 0, z: 1 }
  // slope 0.5 → meia-lua com centro em z=2.667 e raio 1.333; ponta em z=4.
  const CONE = { length: 4, range: 4, radius: 2 }

  function inside(point, cone = CONE, pointRadius = 0, direction = FORWARD) {
    return isInsideAttackCone(ORIGIN, direction, cone, point, pointRadius)
  }

  it('resolveRoundedCone: ponta mais distante cai exatamente no comprimento', () => {
    const { capCenter, capRadius } = resolveRoundedCone(CONE)
    expect(capCenter + capRadius).toBeCloseTo(4)
    expect(capRadius).toBeCloseTo(0.5 * capCenter)
  })

  it('no eixo: dentro até a ponta (z=4); atrás ou além, fora', () => {
    expect(inside({ x: 0, z: 2 })).toBe(true)
    expect(inside({ x: 0, z: 3.95 })).toBe(true)
    expect(inside({ x: 0, z: 4.1 })).toBe(false)
    expect(inside({ x: 0, z: -1 })).toBe(false)
  })

  it('no triângulo, a largura cresce com a abertura do ataque', () => {
    // z=2 → meia-largura 1.
    expect(inside({ x: 0.9, z: 2 })).toBe(true)
    expect(inside({ x: 1.1, z: 2 })).toBe(false)
  })

  it('na meia-lua, a borda é redonda (não a reta do triângulo)', () => {
    // z=3.5: dentro do círculo da ponta só até ~1.04 de lado.
    expect(inside({ x: 1.0, z: 3.5 })).toBe(true)
    expect(inside({ x: 1.1, z: 3.5 })).toBe(false)
  })

  it('leque ESTREITO também tem a ponta arredondada (caso razor-leaf)', () => {
    const narrow = { length: 4, range: 4, radius: 0.4 }
    expect(inside({ x: 0, z: 3.98 }, narrow)).toBe(true)
    expect(inside({ x: 0.2, z: 3.7 }, narrow)).toBe(true)
    // "Canto" que um retângulo/triângulo de ponta reta teria: fora.
    expect(inside({ x: 0.3, z: 3.9 }, narrow)).toBe(false)
  })

  it('folga do alvo (raio da cápsula) conta nas bordas e na ponta', () => {
    expect(inside({ x: 1.3, z: 2 }, CONE, 0.4)).toBe(true)
    expect(inside({ x: 0, z: 4.3 }, CONE, 0.4)).toBe(true)
  })

  it('cone encurtado por parede mantém a abertura, e a meia-lua acompanha', () => {
    const short = { length: 2, range: 4, radius: 2 }
    expect(inside({ x: 0.5, z: 1.2 }, short)).toBe(true)
    expect(inside({ x: 0, z: 1.95 }, short)).toBe(true)
    expect(inside({ x: 0, z: 2.5 }, short)).toBe(false)
  })

  it('respeita a direção (girado 90° pra +X)', () => {
    const right = { x: 1, y: 0, z: 0 }
    expect(inside({ x: 2, z: 0.5 }, CONE, 0, right)).toBe(true)
    expect(inside({ x: 0, z: 2 }, CONE, 0, right)).toBe(false)
  })
})
