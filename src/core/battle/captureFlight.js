import { GAME_CONFIG } from '../gameConfig'
import { castRayWithNormal } from '../physics/raycast'
import {
  BeingCaptured,
  CharacterController,
  PhysicsBody,
  Position,
  WildCreature,
} from '../traits'

/**
 * O voo da Pokébola de captura (docs/features/043-captura.md): o que ela
 * acerta num trecho do caminho. Usado pelo voo de verdade
 * (`captureBallSystem.js`) e pela previsão da mira (`traceCaptureFlight`,
 * `captureAimSystem.js`) — os dois têm que concordar.
 */

/**
 * O selvagem (fora de bola) que o caminho da bola neste tick — de `pos`
 * andando `seg`, até `maxDistance` — encosta primeiro: distância do ponto
 * ao eixo da cápsula dele menor que o raio dela + `BALL_RADIUS`. A cápsula
 * em pé é um segmento vertical; deitada, uma esfera do comprimento dela.
 * Amostra o caminho em passos menores que o raio da bola. Sem física
 * carregada também funciona (só geometria).
 */
export function findWildHit(world, pos, seg, maxDistance) {
  const { BALL_RADIUS } = GAME_CONFIG.CAPTURE
  const segLength = Math.hypot(seg.x, seg.y, seg.z)
  if (segLength === 0) return null
  const limit = Math.min(1, maxDistance / segLength)
  const steps = Math.max(1, Math.ceil(segLength / BALL_RADIUS))

  const candidates = []
  world
    .query(WildCreature, Position, CharacterController)
    .readEach(([, center, body], wild) => {
      if (wild.has(BeingCaptured)) return
      const standing = (body.capsuleAxis ?? 'y') === 'y'
      candidates.push({
        wild,
        center,
        halfHeight: standing ? body.capsuleHalfHeight : 0,
        reach:
          (standing
            ? body.capsuleRadius
            : body.capsuleRadius + body.capsuleHalfHeight) + BALL_RADIUS,
      })
    })
  if (candidates.length === 0) return null

  for (let step = 0; step <= steps; step++) {
    const t = (step / steps) * limit
    const point = {
      x: pos.x + seg.x * t,
      y: pos.y + seg.y * t,
      z: pos.z + seg.z * t,
    }
    for (const candidate of candidates) {
      if (distanceToCapsule(point, candidate) <= candidate.reach) {
        return { wild: candidate.wild, point }
      }
    }
  }
  return null
}

function distanceToCapsule(point, { center, halfHeight }) {
  const dy = Math.max(
    0,
    point.y - (center.y + halfHeight),
    center.y - halfHeight - point.y,
  )
  return Math.hypot(point.x - center.x, dy, point.z - center.z)
}

export function findWildByCollider(world, colliderHandle) {
  if (colliderHandle == null) return null
  let found = null
  world.query(WildCreature, PhysicsBody).readEach(([, body], wild) => {
    if (found || wild.has(BeingCaptured)) return
    if (body.colliderHandle === colliderHandle) found = wild
  })
  return found
}

/**
 * Até onde a bola lançada de `origin` com `velocity` vai, com a mesma
 * integração do voo de verdade (gravidade `CAPTURE.GRAVITY`), em passos de
 * `step` segundos e até `CAPTURE.MAX_FLIGHT_TIME`:
 * `{ point, time, wild, landed }` — `wild` o selvagem que ela pega no
 * caminho (ou `null`); `landed` se bate em alguma coisa antes de acabar o
 * tempo de voo (senão `point` é onde ela estaria no fim).
 */
export function traceCaptureFlight(
  world,
  origin,
  velocity,
  { excludeColliderHandle, step = 1 / 60 } = {},
) {
  const { GRAVITY, MAX_FLIGHT_TIME } = GAME_CONFIG.CAPTURE
  const pos = { ...origin }
  const vel = { ...velocity }
  let time = 0

  while (time < MAX_FLIGHT_TIME) {
    vel.y += GRAVITY * step
    const seg = { x: vel.x * step, y: vel.y * step, z: vel.z * step }
    const segLength = Math.hypot(seg.x, seg.y, seg.z)
    if (segLength > 0) {
      const dir = {
        x: seg.x / segLength,
        y: seg.y / segLength,
        z: seg.z / segLength,
      }
      // Como o voo de verdade: encosta na superfície (`sweepBall`).
      const sweep = sweepBall(pos, dir, segLength, { excludeColliderHandle })
      const worldHit = sweep.hit
      const wildHit = findWildHit(world, pos, seg, sweep.travel)
      const rayWild = worldHit
        ? findWildByCollider(world, worldHit.colliderHandle)
        : null
      const wild = wildHit?.wild ?? rayWild
      if (wild || worldHit) {
        const point = wildHit?.point ?? {
          x: pos.x + dir.x * sweep.travel,
          y: pos.y + dir.y * sweep.travel,
          z: pos.z + dir.z * sweep.travel,
        }
        const along = Math.hypot(
          point.x - pos.x,
          point.y - pos.y,
          point.z - pos.z,
        )
        return {
          point: { ...point },
          time: time + (along / segLength) * step,
          wild,
          landed: true,
        }
      }
      pos.x += seg.x
      pos.y += seg.y
      pos.z += seg.z
    }
    time += step
  }
  return { point: pos, time, wild: null, landed: false }
}

// Menor cosseno considerado entre o caminho e a superfície: raspando quase
// paralelo, o recuo explodiria.
const MIN_APPROACH_COS = 0.05
// Até quantos raios além do trecho o raio procura uma superfície.
const SWEEP_REACH_RADII = 4

/**
 * A bola (esfera de raio `CAPTURE.BALL_RADIUS`, centro em `pos`) andando
 * `segLength` na direção `dir`: até onde ela vai antes de encostar em alguma
 * coisa. O raio sai do centro; no ponto de contato o centro fica a um raio
 * da SUPERFÍCIE (recuo de `raio ÷ cos` do ângulo de chegada, pela normal),
 * não a um raio ao longo do caminho — senão, descendo inclinada, ela
 * afundava no chão. Devolve `{ travel, hit }`: `hit` (com `normal` e
 * `colliderHandle`) só se ela encosta dentro do trecho.
 */
export function sweepBall(pos, dir, segLength, { excludeColliderHandle } = {}) {
  const { BALL_RADIUS } = GAME_CONFIG.CAPTURE
  const ray = castRayWithNormal(
    pos,
    dir,
    segLength + BALL_RADIUS * SWEEP_REACH_RADII,
    { excludeColliderHandle },
  )
  if (!ray) return { travel: segLength, hit: null }

  const normal = resolveSurfaceNormal(ray, dir)
  const approach = Math.max(
    MIN_APPROACH_COS,
    -(dir.x * normal.x + dir.y * normal.y + dir.z * normal.z),
  )
  const travel = Math.max(0, ray.distance - BALL_RADIUS / approach)
  if (travel > segLength) return { travel: segLength, hit: null }
  return { travel, hit: { ...ray, normal } }
}

/** Normal da superfície; raio que nasceu encostado (sem normal): contra ele. */
function resolveSurfaceNormal(ray, dir) {
  const { normal } = ray
  if (normal && Math.hypot(normal.x, normal.y, normal.z) > 0.5) return normal
  return { x: -dir.x, y: -dir.y, z: -dir.z }
}
