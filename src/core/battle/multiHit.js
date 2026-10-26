import { Position } from '../traits'

/**
 * Golpe de VÁRIOS acertos (o Fury Attack — docs/features/061-revisao-das-
 * skills.md). Na série ele acerta de 2 a 5 vezes seguidas; aqui (decisão do
 * usuário) o primeiro acerto é o golpe normal, no instante do acerto, e
 * sorteia quantos vêm. Os seguintes vão NO MESMO alvo, um a cada
 * `interval` s, sem sortear precisão de novo (como na série: só o primeiro
 * pode errar), cada um com o próprio dano, crítico, número, VFX, som e
 * sorteio do efeito secundário (`attackExtraHit.js`). Só no golpe de alvo
 * único.
 *
 * O golpe declara `multiHit: { counts, weights, interval }`: os números de
 * acertos possíveis e o peso de cada um no sorteio. O `interval` escala com
 * a velocidade como o resto do tempo do golpe (`attackCasting.js`).
 */

/**
 * Quantos acertos o golpe dá EM MÉDIA (os `counts` pesados pelos `weights`):
 * o que o custo e a IA multiplicam no poder. Sem `multiHit`, 1.
 */
export function resolveExpectedHits(multiHit) {
  if (!multiHit?.counts?.length) return 1
  const weights = multiHit.weights ?? multiHit.counts.map(() => 1)
  const total = weights.reduce((sum, weight) => sum + weight, 0)
  if (!(total > 0)) return 1
  return (
    multiHit.counts.reduce(
      (sum, count, i) => sum + count * (weights[i] ?? 0),
      0,
    ) / total
  )
}

/** Quantos acertos o golpe dá: um dos `counts`, pelo peso de cada um. */
export function rollHitCount(multiHit, rng) {
  const { counts, weights } = multiHit
  const total = weights.reduce((sum, weight) => sum + weight, 0)
  let roll = rng() * total
  for (let i = 0; i < counts.length; i++) {
    roll -= weights[i]
    if (roll < 0) return counts[i]
  }
  return counts[counts.length - 1]
}

/**
 * O primeiro acerto pegou `target` (`{ entity, contactPoint }`): sorteia
 * quantos acertos o golpe dá e, se mais de um, agenda os seguintes em
 * `action.multiHit`. Devolve o total.
 */
export function startMultiHit(action, attack, target, rng) {
  const count = rollHitCount(attack.multiHit, rng)
  if (count <= 1) return 1
  const pos = target.entity.get(Position)
  const contact = target.contactPoint ?? pos
  action.multiHit = {
    target: target.entity,
    // o contato acompanha o alvo se ele se mexer entre os acertos
    offset: {
      x: contact.x - pos.x,
      y: contact.y - pos.y,
      z: contact.z - pos.z,
    },
    count,
    done: 1,
  }
  return count
}

/**
 * Quantos acertos seguintes vencem entre `previousElapsed` e `elapsed`: o
 * acerto N (N ≥ 2) vem em `impactAt + (N - 1) × interval`.
 */
export function countDueExtraHits(
  previousElapsed,
  elapsed,
  impactAt,
  multiHitState,
  interval,
) {
  if (!multiHitState) return 0
  let due = 0
  for (let hit = multiHitState.done + 1; hit <= multiHitState.count; hit++) {
    const at = impactAt + (hit - 1) * interval
    if (at > elapsed) break
    if (at > previousElapsed) due++
  }
  return due
}

/** Quando sai o último acerto possível (o maior dos `counts`). */
export function resolveLastHitAt(attack, impactAt) {
  if (!attack.multiHit) return impactAt
  return (
    impactAt +
    (Math.max(...attack.multiHit.counts) - 1) * attack.multiHit.interval
  )
}
