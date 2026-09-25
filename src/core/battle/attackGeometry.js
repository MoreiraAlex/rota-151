import { GAME_CONFIG } from '../gameConfig'
import { verticalClearance } from '../physics/colliders'
import { castRay } from '../physics/raycast'

/**
 * Pontos espaciais de um ataque, separados por conceito — ver
 * docs/features/030-sistema-de-dano-de-ataques.md, "Etapa 0".
 *
 * Referência de tudo aqui: `Position` é o CENTRO da cápsula física (o
 * collider é criado sem offset em `createCharacterBody`,
 * `core/physics/colliders.js`; o `body.modelOffset` negativo de cada
 * espécie é o que desce o MODELO até o chão). Não é o pé.
 *
 * - posição da criatura / centro do corpo → `Position` direto
 * - chão sob a criatura → `resolveGroundPoint`
 * - onde o golpe começa → `resolveAttackOrigin`
 * - onde a área do golpe termina → `resolveAttackImpactPoint`
 *   (`creatureAttackSystem.js`, acompanha o terreno e para em parede/
 *   desnível)
 * - onde o golpe tocou o alvo → `resolveContactPoint`
 *
 * Combate 2.5D: alcance/raio são medidos no plano horizontal
 * (`closestPointsOnGroundPlane`); a altura só entra como "mesmo plano de
 * combate" (`resolveFootElevation` + `isWithinCombatHeight`), sempre
 * relativa ao terreno de cada um.
 */

export function resolveGroundPoint(pos, body) {
  return { x: pos.x, y: pos.y - verticalClearance(body), z: pos.z }
}

const DOWN = { x: 0, y: -1, z: 0 }

/**
 * Altura do terreno em `(x, z)`: raio pra baixo a partir de `fromY`, só
 * contra a geometria fixa do nível (`terrainOnly` — criaturas não contam
 * como chão). `null` sem física carregada ou sem chão até `maxDistance`.
 * Se `fromY` já estiver DENTRO de um obstáculo, devolve o próprio `fromY`
 * (raycast sólido) — quem chama lê isso como "o terreno sobe pelo menos
 * até aqui".
 */
export function resolveGroundY(x, fromY, z, maxDistance) {
  const hit = castRay({ x, y: fromY, z }, DOWN, maxDistance, {
    terrainOnly: true,
  })
  return hit ? hit.point.y : null
}

/**
 * Elevação dos pés acima do terreno logo abaixo da criatura — `0` no
 * chão, mesmo em rampa ou terraço (é relativa ao terreno daquele ponto,
 * nunca um Y absoluto). Sem chão ao alcance (ou sem física), conta como
 * no chão.
 */
export function resolveFootElevation(pos, body) {
  const groundY = resolveGroundY(
    pos.x,
    pos.y,
    pos.z,
    GAME_CONFIG.BATTLE.GROUND_PROBE_DISTANCE,
  )
  if (groundY === null) return 0
  return Math.max(0, pos.y - verticalClearance(body) - groundY)
}

/** Atacante e alvo no mesmo plano de combate (`MAX_COMBAT_HEIGHT_DIFF`). */
export function isWithinCombatHeight(elevationA, elevationB) {
  return (
    Math.abs(elevationA - elevationB) <=
    GAME_CONFIG.BATTLE.MAX_COMBAT_HEIGHT_DIFF
  )
}

/**
 * `originHeight` é `species.body.attackOriginHeight` (opcional, metros
 * acima do centro do corpo — ver `core/data/species/_template/index.js`).
 * Sem ele, o golpe sai do centro do corpo.
 */
export function resolveAttackOrigin(pos, originHeight = 0) {
  return { x: pos.x, y: pos.y + originHeight, z: pos.z }
}

// Eixo comprido da cápsula no espaço LOCAL do corpo — mesma convenção de
// `CAPSULE_TILT` (`core/physics/colliders.js`): 'y' em pé, 'x'/'z' deitada.
const CAPSULE_LOCAL_AXIS = {
  y: { x: 0, y: 1, z: 0 },
  x: { x: 1, y: 0, z: 0 },
  z: { x: 0, y: 0, z: 1 },
}

/**
 * Segmento central da cápsula no mundo (a cápsula é esse segmento
 * "engordado" por `capsuleRadius`). O corpo gira com `Rotation.y`
 * (`characterPhysicsSystem.js`, `setNextKinematicRotation`), então uma
 * cápsula deitada acompanha o yaw — por isso o eixo local é girado aqui.
 */
export function resolveCapsuleSegment(pos, yaw, body) {
  const local = CAPSULE_LOCAL_AXIS[body.capsuleAxis] ?? CAPSULE_LOCAL_AXIS.y
  const cos = Math.cos(yaw)
  const sin = Math.sin(yaw)
  const h = body.capsuleHalfHeight
  const axis = {
    x: local.x * cos + local.z * sin,
    y: local.y,
    z: -local.x * sin + local.z * cos,
  }

  return {
    a: { x: pos.x - axis.x * h, y: pos.y - axis.y * h, z: pos.z - axis.z * h },
    b: { x: pos.x + axis.x * h, y: pos.y + axis.y * h, z: pos.z + axis.z * h },
  }
}

const EPSILON = 1e-9

function sub(a, b) {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }
}

function dot(a, b) {
  return a.x * b.x + a.y * b.y + a.z * b.z
}

function pointAt(start, dir, t) {
  return {
    x: start.x + dir.x * t,
    y: start.y + dir.y * t,
    z: start.z + dir.z * t,
  }
}

function clamp01(value) {
  return Math.min(1, Math.max(0, value))
}

/**
 * Pontos mais próximos entre os segmentos `p1→q1` e `p2→q2` (Ericson,
 * "Real-Time Collision Detection", 5.1.9). `s`/`t` são as frações (0-1)
 * ao longo de cada segmento. Aceita segmentos degenerados (comprimento
 * zero) — um golpe encostado na parede, por exemplo.
 */
export function closestPointsBetweenSegments(p1, q1, p2, q2) {
  const d1 = sub(q1, p1)
  const d2 = sub(q2, p2)
  const r = sub(p1, p2)
  const a = dot(d1, d1)
  const e = dot(d2, d2)
  const f = dot(d2, r)

  let s
  let t

  if (a <= EPSILON && e <= EPSILON) {
    s = 0
    t = 0
  } else if (a <= EPSILON) {
    s = 0
    t = clamp01(f / e)
  } else {
    const c = dot(d1, r)
    if (e <= EPSILON) {
      t = 0
      s = clamp01(-c / a)
    } else {
      const b = dot(d1, d2)
      const denom = a * e - b * b
      s = denom > EPSILON ? clamp01((b * f - c * e) / denom) : 0
      t = (b * s + f) / e
      if (t < 0) {
        t = 0
        s = clamp01(-c / a)
      } else if (t > 1) {
        t = 1
        s = clamp01((b - c) / a)
      }
    }
  }

  const pointOnFirst = pointAt(p1, d1, s)
  const pointOnSecond = pointAt(p2, d2, t)
  const gap = sub(pointOnFirst, pointOnSecond)

  return {
    s,
    t,
    pointOnFirst,
    pointOnSecond,
    distance: Math.sqrt(dot(gap, gap)),
  }
}

function flatten(point) {
  return { x: point.x, y: 0, z: point.z }
}

/**
 * Mesma conta de `closestPointsBetweenSegments`, só no plano horizontal
 * (Y zerado) — o combate é 2.5D: dentro do mesmo plano de combate, só a
 * posição horizontal decide alcance/raio. Os pontos devolvidos têm `y: 0`.
 */
export function closestPointsOnGroundPlane(p1, q1, p2, q2) {
  return closestPointsBetweenSegments(
    flatten(p1),
    flatten(q1),
    flatten(p2),
    flatten(q2),
  )
}

/**
 * Ponto na SUPERFÍCIE da cápsula do alvo, na direção de `pathPoint` (o
 * ponto da trajetória do golpe mais próximo do alvo) — onde um VFX/
 * reação de acerto deve nascer. Se a trajetória atravessa o corpo
 * (`pathPoint` dentro da cápsula), o contato é o próprio `pathPoint`.
 */
export function resolveContactPoint(axisPoint, pathPoint, capsuleRadius) {
  const toPath = sub(pathPoint, axisPoint)
  const distance = Math.sqrt(dot(toPath, toPath))
  if (distance <= capsuleRadius) return { ...pathPoint }

  return pointAt(axisPoint, toPath, capsuleRadius / distance)
}
