import { describe, it, expect } from 'vitest'
import { listSpecies } from '../data/species'
import { closestPointsOnGroundPlane } from './attackGeometry'
import {
  isTriggerInsideCircle,
  isTriggerInsideCone,
  resolveCapsuleAreaEnd,
  resolveHitTrigger,
  resolveTriggerEdge,
  resolveTriggerFrontEdge,
  resolveTriggerSegment,
} from './hitTrigger'

const BODY = { capsuleRadius: 0.3, capsuleHalfHeight: 0.2, capsuleAxis: 'z' }
const ORIGIN = { x: 0, y: 0, z: 0 }
const FORWARD = { x: 0, y: 0, z: 1 }

describe('resolveHitTrigger', () => {
  it('sem trigger, cápsula deitada vira pílula ao longo do eixo dela', () => {
    expect(resolveHitTrigger(BODY)).toEqual({
      radius: BODY.capsuleRadius,
      halfLength: BODY.capsuleHalfHeight,
      angle: 0,
      offset: { x: 0, z: 0 },
    })
    const sideways = resolveHitTrigger({ ...BODY, capsuleAxis: 'x' })
    const along = resolveTriggerSegment(ORIGIN, 0, sideways)
    expect(Math.abs(along.b.x - along.a.x)).toBeCloseTo(
      2 * BODY.capsuleHalfHeight,
    )
  })

  it('sem trigger, cápsula em pé vira círculo', () => {
    const standing = resolveHitTrigger({ ...BODY, capsuleAxis: 'y' })
    expect(standing.halfLength).toBe(0)
    expect(standing.radius).toBe(BODY.capsuleRadius)
  })

  it('o que o trigger declara vence; o resto vem da física', () => {
    const trigger = resolveHitTrigger({ ...BODY, trigger: { radius: 0.5 } })
    expect(trigger.radius).toBe(0.5)
    expect(trigger.halfLength).toBe(BODY.capsuleHalfHeight)
  })

  it('toda espécie resolve um trigger com medidas', () => {
    for (const species of listSpecies()) {
      const trigger = resolveHitTrigger(species.body)
      expect(trigger.radius).toBeGreaterThan(0)
      expect(trigger.halfLength).toBeGreaterThanOrEqual(0)
    }
  })
})

describe('resolveTriggerSegment', () => {
  it('desloca e gira com o corpo, no chão', () => {
    const trigger = resolveHitTrigger({
      ...BODY,
      trigger: { offset: { x: 0, z: 1 } },
    })
    // virado pra +X (yaw 90°): o "pra frente" do corpo vai pra +X
    const segment = resolveTriggerSegment(ORIGIN, Math.PI / 2, trigger)
    expect(segment.center.x).toBeCloseTo(1)
    expect(segment.center.z).toBeCloseTo(0)
    expect(Math.abs(segment.b.x - segment.a.x)).toBeCloseTo(
      2 * trigger.halfLength,
    )
    expect(segment.a.y).toBe(segment.b.y)
  })

  it('o ângulo gira a pílula em relação à frente do corpo', () => {
    const trigger = resolveHitTrigger({ ...BODY, trigger: { angle: 90 } })
    const segment = resolveTriggerSegment(ORIGIN, 0, trigger)
    expect(Math.abs(segment.b.x - segment.a.x)).toBeCloseTo(
      2 * trigger.halfLength,
    )
    expect(segment.b.z - segment.a.z).toBeCloseTo(0)
  })
})

describe('resolveTriggerEdge — de onde o range conta', () => {
  const SIDE = { x: 1, y: 0, z: 0 }

  it('pílula ao longo do corpo: na frente vai até a ponta; de lado, o raio', () => {
    const trigger = resolveHitTrigger(BODY)
    expect(resolveTriggerEdge(trigger, 0, FORWARD)).toBeCloseTo(
      trigger.halfLength + trigger.radius,
    )
    expect(resolveTriggerEdge(trigger, 0, SIDE)).toBeCloseTo(trigger.radius)
  })

  it('gira com o corpo: virado pro lado, a borda desse lado é a da frente', () => {
    const trigger = resolveHitTrigger(BODY)
    expect(resolveTriggerEdge(trigger, Math.PI / 2, SIDE)).toBeCloseTo(
      resolveTriggerEdge(trigger, 0, FORWARD),
    )
  })

  it('o deslocamento do trigger pra frente afasta a borda da frente', () => {
    const offset = { x: 0, z: 0.5 }
    const centered = resolveHitTrigger(BODY)
    const ahead = resolveHitTrigger({ ...BODY, trigger: { offset } })
    expect(resolveTriggerFrontEdge(ahead)).toBeCloseTo(
      resolveTriggerFrontEdge(centered) + offset.z,
    )
    expect(resolveTriggerEdge(ahead, 0, { x: 0, z: -1 })).toBeCloseTo(
      resolveTriggerFrontEdge(centered) - offset.z,
    )
  })
})

describe('resolveCapsuleAreaEnd', () => {
  it('a ponta da cápsula cai no fim da trajetória', () => {
    const radius = 0.3
    const end = { x: 0, y: 0, z: 2 }
    const areaEnd = resolveCapsuleAreaEnd(ORIGIN, end, radius)
    expect(areaEnd.z + radius).toBeCloseTo(end.z)
  })

  it('trajetória mais curta que o raio: fica na origem', () => {
    expect(resolveCapsuleAreaEnd(ORIGIN, { x: 0, y: 0, z: 0.1 }, 0.3)).toEqual(
      ORIGIN,
    )
  })

  it('acerta o trigger que a ponta toca, não o de um centímetro além', () => {
    const radius = 0.3
    const range = 1.4
    const trigger = resolveHitTrigger(BODY)
    const areaEnd = resolveCapsuleAreaEnd(
      ORIGIN,
      { x: 0, y: 0, z: range },
      radius,
    )
    // alvo virado pro atacante, com a borda do trigger em `range + gap`
    const touches = (gap) => {
      const nearEdge = trigger.radius + trigger.halfLength
      const segment = resolveTriggerSegment(
        { x: 0, y: 0, z: range + gap + nearEdge },
        Math.PI,
        trigger,
      )
      const closest = closestPointsOnGroundPlane(
        ORIGIN,
        areaEnd,
        segment.a,
        segment.b,
      )
      return closest.distance <= radius + segment.radius + 1e-9
    }
    expect(touches(0)).toBe(true)
    expect(touches(0.01)).toBe(false)
  })
})

describe('isTriggerInsideCone', () => {
  const cone = { length: 2, range: 2, radius: 1 }
  const trigger = resolveHitTrigger(BODY)

  it('a ponta do cone (no range) toca o trigger que encosta nela', () => {
    const nearEdge = trigger.radius + trigger.halfLength
    const at = (z) => resolveTriggerSegment({ x: 0, y: 0, z }, Math.PI, trigger)
    expect(
      isTriggerInsideCone(ORIGIN, FORWARD, cone, at(cone.range + nearEdge)),
    ).toBe(true)
    expect(
      isTriggerInsideCone(
        ORIGIN,
        FORWARD,
        cone,
        at(cone.range + nearEdge + 0.01),
      ),
    ).toBe(false)
  })

  it('vale qualquer ponto do eixo, não só o centro', () => {
    // deitado de lado: o centro fora do cone, a ponta dentro
    const long = { ...trigger, halfLength: 1, angle: 90 }
    const segment = resolveTriggerSegment({ x: 1.6, y: 0, z: 1 }, 0, long)
    expect(isTriggerInsideCone(ORIGIN, FORWARD, cone, segment)).toBe(true)
  })
})

describe('isTriggerInsideCircle', () => {
  const trigger = resolveHitTrigger(BODY)
  const reach = 2

  it('toca quando a borda do trigger encosta no círculo, em qualquer direção', () => {
    for (const angle of [0, Math.PI / 2, Math.PI, 4]) {
      const at = (distance) =>
        resolveTriggerSegment(
          {
            x: Math.sin(angle) * distance,
            y: 0,
            z: Math.cos(angle) * distance,
          },
          // de lado pro centro: o eixo comprido não chega mais perto
          angle + Math.PI / 2,
          trigger,
        )
      expect(
        isTriggerInsideCircle(ORIGIN, reach, at(reach + trigger.radius)),
      ).toBe(true)
      expect(
        isTriggerInsideCircle(ORIGIN, reach, at(reach + trigger.radius + 0.01)),
      ).toBe(false)
    }
  })

  it('vale qualquer ponto do eixo: a ponta da pílula dentro basta', () => {
    const long = { ...trigger, halfLength: 1, angle: 0 }
    // centro fora, deitada apontando pro centro: a ponta de dentro alcança
    const segment = resolveTriggerSegment({ x: 0, y: 0, z: 3 }, 0, long)
    expect(isTriggerInsideCircle(ORIGIN, reach, segment)).toBe(true)
  })
})
