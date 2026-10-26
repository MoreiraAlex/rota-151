import { resolveRoundedCone } from '@/core/battle/attackGeometry'

/**
 * Formas do aviso e do indicador de golpe (`AttackShape.jsx`) no plano do
 * chão, SUBDIVIDIDAS pra poderem dobrar no relevo (docs/features/061-
 * revisao-das-skills.md): cada vértice depois desce até o chão.
 *
 * Tudo no espaço LOCAL do golpe, só X e Z: origem do golpe em (0, 0), +Z pra
 * frente, X pro lado. Cada forma devolve:
 * - `fill`: `{ points, indices }` — `points` em pares `[x, z, x, z, ...]`,
 *   triângulos em `indices` (a área preenchida, que cresce com `progress`);
 * - `edge`: pares `[x, z, ...]` do contorno inteiro, em ordem (um laço).
 *
 * `step` (m): distância máxima entre dois anéis/fileiras — quanto menor,
 * melhor a forma acompanha o relevo (e mais pontos pra descer até o chão).
 */

const ARC_SEGMENTS = 16
// Fileiras de cada tampa da cápsula e colunas de lado a lado.
const CAP_ROWS = 4
const CAPSULE_COLUMNS = 4

const ringCount = (length, step) => Math.max(1, Math.ceil(length / step))

/**
 * Preenchimento "polar": o centro mais `rings` anéis, cada um o contorno
 * `outline` encolhido até o centro (fração `scale × k / rings`). Serve pra
 * forma estrelada em volta do centro (o cone a partir do ápice, o círculo a
 * partir do meio). `closed`: o contorno fecha (o círculo) ou não (o arco do
 * cone).
 */
function polarFill(outline, rings, scale, closed) {
  const perRing = outline.length / 2
  const points = [0, 0]
  for (let ring = 1; ring <= rings; ring++) {
    const factor = (scale * ring) / rings
    for (let i = 0; i < outline.length; i += 2) {
      points.push(outline[i] * factor, outline[i + 1] * factor)
    }
  }
  const indices = []
  const at = (ring, i) => 1 + (ring - 1) * perRing + i
  const segments = closed ? perRing : perRing - 1
  for (let i = 0; i < segments; i++) {
    const next = (i + 1) % perRing
    indices.push(0, at(1, i), at(1, next))
    for (let ring = 1; ring < rings; ring++) {
      const a = at(ring, i)
      const b = at(ring, next)
      const c = at(ring + 1, i)
      const d = at(ring + 1, next)
      indices.push(a, c, b, b, c, d)
    }
  }
  return { points, indices }
}

/**
 * Cone com ponta arredondada (`resolveRoundedCone`, a MESMA conta do dano):
 * ápice na origem, comprimento `length`, abertura `slope` (`radius / range`
 * do golpe inteiro). O preenchimento vai até `progress` do comprimento.
 */
export function coneShape({ slope, length, progress = 1, step }) {
  const { capCenter, capRadius } = resolveRoundedCone({
    length,
    range: 1,
    radius: slope,
  })
  // Meia-lua da ponta, da lateral esquerda (-x) pela frente até a direita.
  const arc = []
  for (let i = 0; i <= ARC_SEGMENTS; i++) {
    const angle = Math.PI - (i / ARC_SEGMENTS) * Math.PI
    arc.push(
      capRadius * Math.cos(angle),
      capCenter + capRadius * Math.sin(angle),
    )
  }
  const rings = ringCount(length, step)
  const fill = polarFill(
    arc,
    ringCount(length * progress, step),
    progress,
    false,
  )

  // Contorno: ápice, lateral esquerda subdividida, arco, lateral direita.
  const edge = [0, 0]
  const last = arc.length - 2
  for (let ring = 1; ring < rings; ring++) {
    edge.push((arc[0] * ring) / rings, (arc[1] * ring) / rings)
  }
  edge.push(...arc)
  for (let ring = rings - 1; ring >= 1; ring--) {
    edge.push((arc[last] * ring) / rings, (arc[last + 1] * ring) / rings)
  }
  return { fill, edge }
}

// Fileiras (z) de uma cápsula de comprimento `length`: tampa de trás, meio,
// tampa da frente — e a meia-largura em cada uma.
function capsuleRows(radius, length, step) {
  const rows = []
  for (let i = 0; i <= CAP_ROWS; i++) {
    const angle = (Math.PI / 2) * (1 - i / CAP_ROWS)
    rows.push({ z: -radius * Math.sin(angle), half: radius * Math.cos(angle) })
  }
  const middle = ringCount(length, step)
  for (let i = 1; i <= middle; i++) {
    rows.push({ z: (length * i) / middle, half: radius })
  }
  for (let i = 1; i <= CAP_ROWS; i++) {
    const angle = (Math.PI / 2) * (i / CAP_ROWS)
    rows.push({
      z: length + radius * Math.sin(angle),
      half: radius * Math.cos(angle),
    })
  }
  return rows
}

// Meia-largura da cápsula (eixo de 0 a `length`, tampas de raio `radius`) em `z`.
function capsuleHalfAt(radius, length, z) {
  const beyond = z < 0 ? -z : z > length ? z - length : 0
  return Math.sqrt(Math.max(0, radius * radius - beyond * beyond))
}

/**
 * Cápsula do golpe normal: largura `2 × radius`, da origem até `length`, com
 * as tampas redondas. O preenchimento vai até `progress` do comprimento
 * INTEIRO — da ponta de trás até a da frente, tampas incluídas: com `progress`
 * 0 não aparece nada (encher só o eixo deixava as duas tampas cheias desde o
 * começo, e numa cápsula curta e larga o aviso já nascia quase todo cheio).
 */
export function capsuleShape({ radius, length, progress = 1, step }) {
  const allRows = capsuleRows(radius, length, step)
  const cut = -radius + (length + 2 * radius) * progress
  const filledRows = allRows.filter((row) => row.z < cut)
  filledRows.push({ z: cut, half: capsuleHalfAt(radius, length, cut) })
  const points = []
  for (const { z, half } of filledRows) {
    for (let column = 0; column <= CAPSULE_COLUMNS; column++) {
      points.push(-half + (2 * half * column) / CAPSULE_COLUMNS, z)
    }
  }
  const indices = []
  const perRow = CAPSULE_COLUMNS + 1
  for (let row = 0; row < filledRows.length - 1; row++) {
    for (let column = 0; column < CAPSULE_COLUMNS; column++) {
      const a = row * perRow + column
      const b = a + 1
      const c = a + perRow
      const d = c + 1
      indices.push(a, c, b, b, c, d)
    }
  }

  const edge = []
  for (const { z, half } of allRows) edge.push(half, z)
  for (let i = allRows.length - 1; i >= 0; i--) {
    edge.push(-allRows[i].half, allRows[i].z)
  }
  return { fill: { points, indices }, edge }
}

/** Círculo nos pés (golpe em si mesmo): preenchimento até `progress` do raio. */
export function discShape({ radius, progress = 1, step }) {
  const circle = []
  for (let i = 0; i < ARC_SEGMENTS * 2; i++) {
    const angle = (i / (ARC_SEGMENTS * 2)) * Math.PI * 2
    circle.push(radius * Math.cos(angle), radius * Math.sin(angle))
  }
  const fill = polarFill(
    circle,
    ringCount(radius * progress, step),
    progress,
    true,
  )
  return { fill, edge: circle }
}
