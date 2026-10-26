import { isInsideAttackCone } from './attackGeometry'

/**
 * Trigger de acerto (docs/features/061-revisao-das-skills.md): a forma NO
 * CHÃO que um golpe precisa TOCAR pra acertar — separada da cápsula da física
 * (a que colide e anda). É 2D: uma "pílula" (retângulo de pontas redondas;
 * com `halfLength` 0, um círculo) deitada no chão, que gira com o corpo. A
 * altura não entra: quem está fora do plano de combate (pulo, voo) é outra
 * regra (`isWithinCombatHeight`).
 *
 * Cada espécie configura a sua em `body.trigger`; campo que ela não declarar
 * cai no derivado da cápsula da física (em pé → círculo do raio dela;
 * deitada → pílula ao longo do eixo dela).
 *
 * E a ÁREA do golpe, com o `range` como distância MÁXIMA: a cápsula do golpe
 * normal termina com a ponta exatamente no fim da trajetória (o segmento
 * encurta o `radius`); o cone já termina na ponta da meia-lua
 * (`resolveRoundedCone`).
 *
 * `trigger`: `{ radius, halfLength, angle, offset: { x, z } }` — `radius` a
 * meia-largura (m), `halfLength` a metade do comprimento do meio reto (m),
 * `angle` (graus) o giro em relação à frente do corpo (0 = ao longo dela, 90
 * = atravessada), `offset` (m) do centro do corpo, no chão, no referencial do
 * corpo (+Z pra frente, +X pro lado).
 */

// Pontos do eixo do trigger testados contra o cone (pontas e meio).
const CONE_SAMPLES = 5

/**
 * Folga (m) de contato: a área que ENCOSTA no trigger acerta — sem ela, o
 * resto numérico faz "encostar exatamente" errar por um fio.
 */
export const CONTACT_EPSILON = 1e-4

const DEG_TO_RAD = Math.PI / 180

// Pílula derivada da cápsula da física: comprimento e giro pelo eixo dela.
const PHYSICS_ANGLE = { x: 90, z: 0 }

/** O trigger da espécie (`body`), com o que faltar vindo da física. */
export function resolveHitTrigger(body) {
  const trigger = body?.trigger
  const lying = body?.capsuleAxis === 'x' || body?.capsuleAxis === 'z'
  return {
    radius: trigger?.radius ?? body?.capsuleRadius ?? 0,
    halfLength:
      trigger?.halfLength ?? (lying ? (body?.capsuleHalfHeight ?? 0) : 0),
    angle: trigger?.angle ?? (lying ? PHYSICS_ANGLE[body.capsuleAxis] : 0),
    offset: {
      x: trigger?.offset?.x ?? 0,
      z: trigger?.offset?.z ?? 0,
    },
  }
}

// Vetor do referencial do corpo pro mundo (giro `yaw` em Y), no chão.
function rotateYaw(vector, yaw) {
  const cos = Math.cos(yaw)
  const sin = Math.sin(yaw)
  return {
    x: vector.x * cos + vector.z * sin,
    z: -vector.x * sin + vector.z * cos,
  }
}

/**
 * O trigger no chão, de quem está em `pos` virado pra `yaw`: o segmento
 * central `a → b` (a pílula é ele "engordado" por `radius`). Os pontos ficam
 * na altura de `pos` (a altura não conta no acerto).
 */
export function resolveTriggerSegment(pos, yaw, trigger) {
  const offset = rotateYaw(trigger.offset, yaw)
  const center = { x: pos.x + offset.x, y: pos.y, z: pos.z + offset.z }
  const angle = trigger.angle * DEG_TO_RAD
  const axis = rotateYaw({ x: Math.sin(angle), z: Math.cos(angle) }, yaw)
  const h = trigger.halfLength
  return {
    center,
    radius: trigger.radius,
    a: { x: center.x - axis.x * h, y: center.y, z: center.z - axis.z * h },
    b: { x: center.x + axis.x * h, y: center.y, z: center.z + axis.z * h },
  }
}

const BODY_CENTER = { x: 0, y: 0, z: 0 }
const BODY_FRONT = { x: 0, z: 1 }

/**
 * A BORDA do trigger de quem está virado pra `yaw`, na `direction` (no chão):
 * até onde (m) a pílula vai a partir do centro do corpo nessa direção — o
 * ponto dela mais distante. É dali que o `range` do golpe conta (o golpe de um
 * corpo grande chega mais longe no mundo, o vão na frente do corpo é o mesmo).
 */
export function resolveTriggerEdge(trigger, yaw, direction) {
  const length = Math.hypot(direction.x, direction.z)
  if (length < 1e-9) return trigger.radius
  const dx = direction.x / length
  const dz = direction.z / length
  const { a, b } = resolveTriggerSegment(BODY_CENTER, yaw, trigger)
  return Math.max(a.x * dx + a.z * dz, b.x * dx + b.z * dz) + trigger.radius
}

/**
 * A borda da FRENTE do trigger (`resolveTriggerEdge` ao longo do corpo) — a
 * da IA, que só lança virada pro alvo.
 */
export function resolveTriggerFrontEdge(trigger) {
  return resolveTriggerEdge(trigger, 0, BODY_FRONT)
}

/**
 * Fim do segmento da cápsula do golpe que vai de `origin` até `end` (o fim
 * da trajetória): `radius` antes de `end`, na horizontal — a ponta da
 * cápsula cai exatamente em `end`. Trajetória mais curta que o raio: o
 * segmento fica na origem.
 */
export function resolveCapsuleAreaEnd(origin, end, radius) {
  const dx = end.x - origin.x
  const dz = end.z - origin.z
  const length = Math.hypot(dx, dz)
  if (length <= radius) return { ...origin }
  const factor = (length - radius) / length
  return {
    x: origin.x + dx * factor,
    y: origin.y + (end.y - origin.y) * factor,
    z: origin.z + dz * factor,
  }
}

/**
 * O círculo do golpe (centro `center`, raio `radius`, no chão) toca o
 * trigger (`resolveTriggerSegment`)? A distância do centro até o eixo do
 * trigger, menos o raio dele, cabe no círculo (com a folga de contato).
 */
export function isTriggerInsideCircle(center, radius, segment) {
  const ax = segment.b.x - segment.a.x
  const az = segment.b.z - segment.a.z
  const lengthSq = ax * ax + az * az
  const t =
    lengthSq > 1e-12
      ? Math.min(
          Math.max(
            ((center.x - segment.a.x) * ax + (center.z - segment.a.z) * az) /
              lengthSq,
            0,
          ),
          1,
        )
      : 0
  const distance = Math.hypot(
    center.x - (segment.a.x + ax * t),
    center.z - (segment.a.z + az * t),
  )
  return distance <= radius + segment.radius + CONTACT_EPSILON
}

/** O cone do golpe (`isInsideAttackCone`) toca o trigger (`resolveTriggerSegment`)? */
export function isTriggerInsideCone(origin, direction, cone, segment) {
  for (let i = 0; i < CONE_SAMPLES; i++) {
    const t = i / (CONE_SAMPLES - 1)
    const point = {
      x: segment.a.x + (segment.b.x - segment.a.x) * t,
      z: segment.a.z + (segment.b.z - segment.a.z) * t,
    }
    const radius = segment.radius + CONTACT_EPSILON
    if (isInsideAttackCone(origin, direction, cone, point, radius)) {
      return true
    }
  }
  return false
}
