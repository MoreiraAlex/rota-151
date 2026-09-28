import { resolveCreatureAttack } from '../data/attacks'
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
 * Alvo de uma selvagem entre `candidates` (`listPlayerSide`): quem mais
 * causou dano nela (topo do `Threat` que ainda está na luta) ou, sem
 * ameaça, quem está mais perto. `{ entity, pos, distance }` ou `null`.
 */
export function resolveWildTarget(wild, pos, candidates) {
  const entries = wild.get(Threat)?.entries ?? []
  let top = null
  for (const entry of entries) {
    const candidate = candidates.find((c) => c.entity === entry.entity)
    if (!candidate) continue
    if (!top || entry.amount > top.amount) top = { ...entry, candidate }
  }
  if (top) {
    return {
      entity: top.candidate.entity,
      pos: top.candidate.pos,
      distance: horizontalDistance(pos, top.candidate.pos),
    }
  }
  return findNearest(pos, candidates)
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
  const attack = resolveCreatureAttack(species?.attacks?.primary)
  if (!attack) return null
  return attack.range + attack.radius + targetBody.capsuleRadius
}
