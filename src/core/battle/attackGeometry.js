import { GAME_CONFIG } from '../gameConfig'
import { verticalClearance } from '../physics/colliders'
import { castRay } from '../physics/raycast'
import { resolveEffectStart } from './attackEffectPlacement'
import { isCircleAttack, isConeAttack } from './channelAttack'

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
 * - onde o golpe começa → `resolveAttackOrigin` (e quanto anda dali →
 *   `resolveAttackReach`)
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

/**
 * Alvo VOANDO (docs/features/060-ajustes-por-especie.md, Parte 2): no ar o
 * plano de combate não vale — vale a altura de verdade. A altura `y` (da
 * trajetória do golpe) cruza o corpo do alvo, de `pos.y` menos a folga
 * vertical da cápsula até mais ela, com a tolerância `reach` (o raio do
 * golpe)?
 */
export function isWithinFlyingTargetHeight(y, pos, body, reach) {
  const half = verticalClearance(body)
  const bottom = pos.y - half
  const top = pos.y + half
  const gap = y < bottom ? bottom - y : y > top ? y - top : 0
  return gap <= reach
}

/** Atacante e alvo no mesmo plano de combate (`MAX_COMBAT_HEIGHT_DIFF`). */
export function isWithinCombatHeight(elevationA, elevationB) {
  return (
    Math.abs(elevationA - elevationB) <=
    GAME_CONFIG.BATTLE.MAX_COMBAT_HEIGHT_DIFF
  )
}

/**
 * Onde o golpe começa: o centro do corpo deslocado pelo
 * `visual.positionOffset` do golpe (`resolveEffectStart` — no referencial
 * da trajetória: +Z golpe adentro, +Y pra cima, +X pro lado). É o MESMO
 * ponto pro dano, pros alvos, pro aviso no chão e pro VFX: cada golpe
 * define de onde sai (a mordida na boca, a rabada na cauda), e o que se vê
 * é o que acerta. Sem offset, o golpe sai do centro do corpo.
 */
export function resolveAttackOrigin(pos, direction, attack) {
  return resolveEffectStart(pos, direction, attack?.visual?.positionOffset)
}

/**
 * Quanto o golpe anda a partir da origem (`resolveAttackOrigin`). O `range`
 * conta da BORDA do corpo de quem ataca (`edge`: até onde o trigger dele vai
 * na direção do golpe, `resolveTriggerEdge` — docs/features/061-*), então
 * soma a borda e desconta o quanto a origem já andou golpe adentro
 * (`positionOffset.z`): mudar de onde o golpe sai não muda até onde ele chega.
 */
export function resolveAttackReach(attack, edge) {
  return Math.max(
    0,
    edge + attack.range - (attack.visual?.positionOffset?.z ?? 0),
  )
}

/**
 * Onde a ÁREA do golpe começa (docs/features/061-revisao-das-skills.md): a
 * forma encosta na borda do trigger de quem ataca (`edge`, a mesma de onde o
 * `range` conta), na direção do golpe, na altura da origem — pra todo golpe
 * igual, sem depender de onde o VFX sai (`positionOffset`). O cone abre DA
 * borda; a cápsula tem a ponta de trás nela, então o eixo começa um `radius`
 * adiante. Vai até o fim da trajetória (`end`); trajetória que parou antes
 * disso (parede encostada): a área fica no fim dela. O círculo não tem
 * direção: a área é o centro do corpo de quem ataca (na altura da origem).
 */
export function resolveAttackAreaStart(
  pos,
  direction,
  edge,
  origin,
  end,
  attack,
) {
  if (isCircleAttack(attack)) return { x: pos.x, y: origin.y, z: pos.z }
  const length = Math.hypot(direction.x, direction.z)
  if (length < 1e-9) return { ...origin }
  const dx = direction.x / length
  const dz = direction.z / length
  const start = edge + (isConeAttack(attack) ? 0 : attack.radius)
  const endAlong = (end.x - pos.x) * dx + (end.z - pos.z) * dz
  if (endAlong <= start) return { ...end }
  return { x: pos.x + dx * start, y: origin.y, z: pos.z + dz * start }
}

/**
 * Raio do CÍRCULO de um golpe `area: 'circle'`, contado do centro do corpo de
 * quem ataca: a borda do trigger dele (`edge`, de onde o `range` conta) +
 * o `range`.
 */
export function resolveCircleRadius(attack, edge) {
  return edge + attack.range
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

/**
 * Onde a trajetória `origin→end` ENTRA no trigger (segmento `a→b` de raio
 * `radius`), no plano do chão: a fração `s` (0-1) do primeiro ponto dela a
 * `radius` do eixo — a borda virada pra quem ataca. `null` se ela não
 * entra (só a área do golpe encosta, de lado); 0 se já começa dentro.
 * A distância até o eixo é convexa ao longo da linha, então basta bissecar
 * entre a origem e o ponto mais próximo (`closestS`).
 */
export function resolveTriggerEntry(origin, end, a, b, radius, closestS) {
  const distanceAt = (s) => {
    const point = pointAt(origin, sub(end, origin), s)
    return closestPointsOnGroundPlane(point, point, a, b).distance
  }
  if (distanceAt(0) <= radius) return 0
  if (distanceAt(closestS) > radius) return null
  let outside = 0
  let inside = closestS
  for (let i = 0; i < 24; i++) {
    const mid = (outside + inside) / 2
    if (distanceAt(mid) <= radius) inside = mid
    else outside = mid
  }
  return inside
}

/**
 * Forma do cone de um ataque canalizado, em "cone de sorvete": triângulo
 * saindo do ápice com a abertura do ataque (`radius / range` de cada lado)
 * e uma MEIA-LUA na ponta, com diâmetro igual à largura ali — a ponta fica
 * sempre arredondada, estreito ou largo (pedido do usuário). A meia-lua é
 * encaixada pra ponta mais distante cair EXATAMENTE em `length`: o centro
 * dela fica em `capCenter = length / (1 + slope)` e o raio é
 * `capRadius = slope * capCenter` (`slope = radius / range`).
 *
 * Mesma conta usada pelo desenho (`view/scene/AttackShape.jsx`).
 */
export function resolveRoundedCone({ length, range, radius }) {
  const slope = range > 0 ? radius / range : 0
  const capCenter = length / (1 + slope)
  return { slope, capCenter, capRadius: slope * capCenter }
}

/**
 * O cone do golpe (`isInsideAttackCone`) com o vértice em `start` (a borda do
 * trigger de quem ataca, `resolveAttackAreaStart`) e a ponta em `end` (o fim
 * da trajetória — mais perto se ela parou numa parede): a abertura é sempre a
 * do `range` inteiro.
 */
export function resolveAttackCone(attack, start, end) {
  return {
    length: Math.hypot(end.x - start.x, end.z - start.z),
    range: attack.range,
    radius: attack.radius,
  }
}

/**
 * O ponto (com folga `pointRadius`, ex.: raio da cápsula do alvo) está
 * dentro do cone de um ataque canalizado (`resolveRoundedCone`: triângulo
 * + meia-lua na ponta)? Ápice em `origin`, eixo na `direction`
 * horizontal. Conta só no plano do chão (altura é checada à parte,
 * `isWithinCombatHeight`).
 *
 * `length` pode ser menor que o `range` do ataque (a trajetória parou numa
 * parede) — a abertura continua a do ataque inteiro, só o cone fica mais
 * curto (e a meia-lua acompanha).
 */
export function isInsideAttackCone(
  origin,
  direction,
  cone,
  point,
  pointRadius = 0,
) {
  const dirLength = Math.hypot(direction.x, direction.z)
  if (dirLength < 1e-9 || !(cone.range > 0)) return false
  const dx = direction.x / dirLength
  const dz = direction.z / dirLength
  const { slope, capCenter, capRadius } = resolveRoundedCone(cone)

  const px = point.x - origin.x
  const pz = point.z - origin.z
  const along = px * dx + pz * dz
  const across = Math.abs(px * dz - pz * dx)

  // Meia-lua da ponta — só a metade da FRENTE do círculo (a de trás
  // vazaria pra fora das laterais do triângulo), com a folga do alvo.
  if (
    along >= capCenter &&
    Math.hypot(along - capCenter, across) <= capRadius + pointRadius
  ) {
    return true
  }
  // Triângulo, do ápice até o centro da meia-lua.
  if (along < -pointRadius || along > capCenter) return false
  return across <= slope * Math.max(0, along) + pointRadius
}
