import { GAME_CONFIG } from '../gameConfig'
import { resolveCreatureAttack } from './creatureAttack'
import {
  CharacterController,
  Fainted,
  Party,
  Position,
  SummonedCreature,
  Threat,
  Vitals,
  WildBehavior,
  WildCreature,
} from '../traits'

/**
 * Quem ainda está na luta: entidade viva, com posição, fora do desmaio e
 * com HP (o treinador não desmaia — a 0 de HP só deixa de ser alvo).
 */
export function isActiveCombatant(entity) {
  if (entity == null || !entity.isAlive() || !entity.has(Position)) {
    return false
  }
  if (entity.has(Fainted)) return false
  const vitals = entity.get(Vitals)
  return !vitals || vitals.hp > 0
}

/** Se a entidade é do lado do jogador (treinador ou criatura do time). */
export function isPlayerSide(entity) {
  return entity.has(Party) || entity.has(SummonedCreature)
}

function horizontalDistance(a, b) {
  return Math.hypot(b.x - a.x, b.z - a.z)
}

/**
 * Todo combatente ativo do lado do jogador — treinador e criaturas do
 * time (controladas ou não) —, com posição, lido uma vez por tick.
 */
export function listPlayerSide(world) {
  const list = []
  for (const trait of [Party, SummonedCreature]) {
    world.query(trait, Position, CharacterController).forEach((entity) => {
      if (isActiveCombatant(entity)) {
        list.push({ entity, pos: entity.get(Position) })
      }
    })
  }
  return list
}

/**
 * O treinador só é alvo se for o ÚNICO do lado do jogador ao alcance da
 * selvagem (docs/features/034-ia-de-batalha.md, Parte 4): com alguma criatura
 * do time ativa a até `radius` de `pos` (o raio de perseguição/aggro da
 * selvagem agora), ele sai dos `candidates`. Sem raio, a lista volta igual.
 */
export function excludeCoveredTrainer(candidates, pos, radius) {
  if (radius == null) return candidates
  const covered = candidates.some(
    (candidate) =>
      !candidate.entity.has(Party) &&
      horizontalDistance(pos, candidate.pos) <= radius,
  )
  return covered
    ? candidates.filter((candidate) => !candidate.entity.has(Party))
    : candidates
}

/** O mais perto de `pos` (no plano) numa lista `{ entity, pos }`, ou `null`. */
export function findNearest(pos, candidates) {
  let best = null
  for (const candidate of candidates) {
    const distance = horizontalDistance(pos, candidate.pos)
    if (!best || distance < best.distance) {
      best = { entity: candidate.entity, pos: candidate.pos, distance }
    }
  }
  return best
}

/**
 * Peso de "terminar a luta" de um alvo (Parte 3 da docs/features/034-ia-de-
 * batalha.md): `AI_TARGET.FINISH_BONUS` com a vida em `FINISH_HP_FRACTION`
 * ou menos; senão 1. Vale pros dois lados (selvagem e criatura do time).
 */
export function resolveFinishWeight(entity) {
  const { FINISH_HP_FRACTION, FINISH_BONUS } = GAME_CONFIG.AI_TARGET
  const vitals = entity?.get(Vitals)
  if (!vitals || !(vitals.maxHp > 0)) return 1
  return vitals.hp / vitals.maxHp <= FINISH_HP_FRACTION ? FINISH_BONUS : 1
}

/**
 * O mais perto de `pos` contando a prioridade por vida
 * (`resolveFinishWeight`): a distância de quem está quase desmaiando é
 * dividida pelo peso. `{ entity, pos, distance }` (distância real) ou `null`.
 */
export function findNearestWeighted(pos, candidates) {
  let best = null
  let bestScore = Infinity
  for (const candidate of candidates) {
    const distance = horizontalDistance(pos, candidate.pos)
    const score = distance / resolveFinishWeight(candidate.entity)
    if (score < bestScore) {
      bestScore = score
      best = { entity: candidate.entity, pos: candidate.pos, distance }
    }
  }
  return best
}

/**
 * Alvo de uma selvagem entre `candidates` (`listPlayerSide`): quem mais
 * causou dano nela (topo do `Threat` que ainda está na luta) ou, sem
 * ameaça, quem está mais perto — nos dois casos com prioridade pra quem
 * está quase desmaiando (`resolveFinishWeight` multiplica a ameaça e divide
 * a distância). `{ entity, pos, distance }` ou `null`.
 */
export function resolveWildTarget(wild, pos, candidates) {
  const entries = wild.get(Threat)?.entries ?? []
  let top = null
  for (const entry of entries) {
    const candidate = candidates.find((c) => c.entity === entry.entity)
    if (!candidate) continue
    const score = entry.amount * resolveFinishWeight(candidate.entity)
    if (!top || score > top.score) top = { score, candidate }
  }
  if (top) {
    return {
      entity: top.candidate.entity,
      pos: top.candidate.pos,
      distance: horizontalDistance(pos, top.candidate.pos),
    }
  }
  return findNearestWeighted(pos, candidates)
}

/**
 * Selvagem que a criatura do time escolhe ao trocar de alvo: a com MENOS
 * vida (fração) entre `candidates` — terminar a luta —, empate pela mais
 * perto. `{ entity, pos, distance }` ou `null`.
 */
export function findWeakest(pos, candidates) {
  let best = null
  for (const candidate of candidates) {
    const vitals = candidate.entity.get(Vitals)
    const fraction = vitals?.maxHp > 0 ? vitals.hp / vitals.maxHp : 1
    const distance = horizontalDistance(pos, candidate.pos)
    if (
      !best ||
      fraction < best.fraction - 1e-9 ||
      (Math.abs(fraction - best.fraction) <= 1e-9 && distance < best.distance)
    ) {
      best = {
        entity: candidate.entity,
        pos: candidate.pos,
        distance,
        fraction,
      }
    }
  }
  return best && { entity: best.entity, pos: best.pos, distance: best.distance }
}

/**
 * Selvagens lutando com o grupo agora: perseguindo alguém do lado do
 * jogador (`WildBehavior.state === 'chase'`). A IA do time escolhe entre
 * elas quando o alvo dela sai da luta.
 */
export function listWildsFightingParty(world) {
  const list = []
  world.query(WildCreature, WildBehavior, Position).forEach((entity) => {
    const behavior = entity.get(WildBehavior)
    if (behavior.state !== 'chase') return
    if (!isActiveCombatant(entity)) return
    if (!behavior.target || !isActiveCombatant(behavior.target)) return
    list.push({ entity, pos: entity.get(Position) })
  })
  return list
}

/**
 * Até onde (m, centro a centro, no plano) o ataque básico da espécie
 * alcança um alvo com este corpo: a trajetória (`range`) + a grossura dela
 * (`radius`) + o raio do corpo do alvo — a mesma conta que a detecção de
 * acerto faz (`resolveAttackTarget`, `creatureAttackSystem.js`). `null`
 * se a espécie não tem ataque básico.
 */
export function resolveAttackReach(species, targetBody) {
  const attack = resolveCreatureAttack(species, 'primary')
  if (!attack) return null
  return attack.range + attack.radius + targetBody.capsuleRadius
}
