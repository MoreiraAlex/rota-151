import { GAME_CONFIG } from '../gameConfig'
import { gameplayRng } from '../rng'
import {
  AttackCooldowns,
  IndividualValues,
  Position,
  Rotation,
  Vitals,
  resolveEntityLevel,
} from '../traits'
import { ATTACK_SLOTS, resolveAttackForEntity } from './attackCasting'
import { readSpeedStage } from './statStages'
import { resolveLungeDistance } from './attackLunge'
import { resolveEntityMoveSet } from './creatureAttack'
import { resolveMasteryAccuracyFactor } from './moveMastery'
import {
  isTriggerInsideCircle,
  isTriggerInsideCone,
  resolveTriggerFrontEdge,
} from './hitTrigger'
import { resolveCircleRadius } from './attackGeometry'
import { evaluateEffect } from './aiEffectEvaluators'
import { fitsEnergyReserve } from './aiEnergy'
import { isAreaAttack, isCircleAttack, isSelfAttack } from './channelAttack'
import { resolveStab } from './calculateDamage'
import { resolveExpectedHits } from './multiHit'
import { applySpeedPower } from './speedPower'
import {
  applyPowerMultiplier,
  resolveRecentDamageMultiplier,
} from './recentDamageBoost'
import {
  resolveCombatantSpecies,
  resolveEntityHitTrigger,
  resolveEntityTriggerSegment,
} from './attackTargets'
import {
  isImmuneToStatusSkill,
  resolveSkillType,
  resolveSpeciesTypes,
  resolveTypeEffectiveness,
} from '../data/types'

function horizontalDistance(a, b) {
  return Math.hypot(b.x - a.x, b.z - a.z)
}

/**
 * Até onde (m, centro a centro, no plano) `attack` alcança um alvo com este
 * trigger (`hitTrigger.js`): a borda da frente do trigger de quem ataca
 * (de onde o `range` conta — ela lança virada pro alvo) + o `range` (a
 * distância máxima da área do golpe) + a arrancada, se o golpe tiver
 * (`resolveLungeDistance`) + o raio do trigger do alvo — a mesma
 * conta da detecção de acerto, sem o deslocamento/comprimento do trigger do
 * alvo (fica um pouco aquém, do lado seguro). Golpe em si mesmo: `Infinity`
 * (não precisa chegar perto de ninguém).
 */
export function resolveReachFor(attack, attackerTrigger, targetTrigger) {
  if (isSelfAttack(attack)) return Infinity
  return (
    resolveTriggerFrontEdge(attackerTrigger) +
    attack.range +
    resolveLungeDistance(attack) +
    (targetTrigger?.radius ?? 0)
  )
}

/**
 * Quem o golpe atingiria, mirado no alvo agora: em si mesmo → quem usou; em
 * cone → todo inimigo dentro do cone virado pro alvo; em círculo → todo
 * inimigo dentro do círculo em volta dela (o alvo conta sempre); senão → só
 * o alvo.
 */
function resolveRecipients(attack, situation) {
  const { attacker, attackerPos, attackerTrigger, target, targetPos, enemies } =
    situation
  if (isSelfAttack(attack)) return [attacker]
  if (!isAreaAttack(attack)) return [target]
  if (isCircleAttack(attack)) {
    const radius = resolveCircleRadius(
      attack,
      resolveTriggerFrontEdge(attackerTrigger),
    )
    const recipients = [target]
    for (const enemy of enemies) {
      if (enemy.entity === target) continue
      const segment = resolveEntityTriggerSegment(
        enemy.entity,
        enemy.pos,
        enemy.entity.get(Rotation),
      )
      if (isTriggerInsideCircle(attackerPos, radius, segment)) {
        recipients.push(enemy.entity)
      }
    }
    return recipients
  }

  const direction = {
    x: targetPos.x - attackerPos.x,
    z: targetPos.z - attackerPos.z,
  }
  // o cone abre da borda da frente (`resolveAttackAreaStart`), o `range` todo
  const length = Math.hypot(direction.x, direction.z) || 1
  const edge = resolveTriggerFrontEdge(attackerTrigger)
  const apex = {
    x: attackerPos.x + (direction.x / length) * edge,
    z: attackerPos.z + (direction.z / length) * edge,
  }
  const cone = {
    length: attack.range,
    range: attack.range,
    radius: attack.radius,
  }
  const recipients = [target]
  for (const enemy of enemies) {
    if (enemy.entity === target) continue
    if (
      isTriggerInsideCone(
        apex,
        direction,
        cone,
        resolveEntityTriggerSegment(
          enemy.entity,
          enemy.pos,
          enemy.entity.get(Rotation),
        ),
      )
    ) {
      recipients.push(enemy.entity)
    }
  }
  return recipients
}

/**
 * Quanto o TIPO pesa no golpe contra `recipient` (docs/features/039-tipos-e-combate-classico.md): golpe de dano → STAB × efetividade contra os tipos dele
 * (imune = 0); golpe de status → 0 se ele for de um tipo em `immuneTypes`,
 * senão 1.
 */
function resolveTypeFactor(attack, attackerTypes, recipient) {
  const recipientTypes = resolveSpeciesTypes(resolveCombatantSpecies(recipient))
  if (!attack.damage) {
    return isImmuneToStatusSkill(attack, recipientTypes) ? 0 : 1
  }
  const type = resolveSkillType(attack)
  return (
    resolveStab(type, attackerTypes) *
    resolveTypeEffectiveness(type, recipientTypes).multiplier
  )
}

// Um lado do golpe como o dano o enxerga (espécie, IV e nível).
function combatSide(entity) {
  const species = resolveCombatantSpecies(entity)
  return {
    entity,
    species,
    individualValues: entity?.has?.(IndividualValues)
      ? entity.get(IndividualValues)
      : null,
    level: resolveEntityLevel(entity, species),
  }
}

/**
 * O poder que o golpe teria em `recipient` agora, como o dano calcula: pela
 * Velocidade de cada um (Electro Ball), × o bônus contra quem apanhou há
 * pouco (Assurance) e × a média de acertos (Fury Attack). Sem dano, 0.
 */
export function resolveAiPower(attack, attacker, recipient) {
  if (!attack.damage) return 0
  const bySpeed = attack.damage.speedPower
    ? applySpeedPower(
        attack.damage,
        combatSide(attacker),
        combatSide(recipient),
      )
    : attack.damage
  const vitals = recipient?.has?.(Vitals) ? recipient.get(Vitals) : null
  const damage = applyPowerMultiplier(
    bySpeed,
    resolveRecentDamageMultiplier(attack.damage, vitals),
  )
  return (damage.power ?? 0) * resolveExpectedHits(attack.multiHit)
}

/**
 * Nota de um golpe pra IA, só pelos CAMPOS da definição (nunca pelo id):
 * o poder em cada inimigo atingido (`resolveAiPower` — com a Velocidade, o
 * bônus de quem apanhou há pouco e a média de acertos) + o valor de cada `effects[]` em cada
 * atingido (`evaluateEffect`, um avaliador por tipo de efeito), × bônus se já
 * alcança o alvo (`IN_REACH_BONUS`), × `ai.weight` (ajuste fino opcional da
 * skill). O tipo multiplica o valor em cada atingido (`resolveTypeFactor`:
 * STAB × efetividade; golpe que não pega vale 0 nele). O que o golpe dá a
 * quem usa (`selfEffects`, ex.: o Rapid Spin) soma uma vez, avaliado em quem
 * usa, quando o golpe pega alguém. Golpe em si mesmo com inimigo perto (`SELF_CAST_SAFE_DISTANCE`) vale
 * 0 — a carga seria interrompida por dano. Golpe com domínio baixo
 * (docs/features/038-*) vale menos, na proporção da chance de sair
 * (`resolveMasteryAccuracyFactor`).
 *
 * `situation`: `{ attacker, attackerPos, attackerTrigger, target, targetPos,
 * targetTrigger, enemies: [{ entity, pos }] }`.
 */
export function scoreAiAttack(attack, situation) {
  const { IN_REACH_BONUS, SELF_CAST_SAFE_DISTANCE } = GAME_CONFIG.AI_ATTACK
  const { attackerPos, attackerTrigger, targetPos, targetTrigger, enemies } =
    situation
  const self = isSelfAttack(attack)

  if (
    self &&
    enemies.some(
      (enemy) =>
        horizontalDistance(attackerPos, enemy.pos) <= SELF_CAST_SAFE_DISTANCE,
    )
  ) {
    return 0
  }

  const recipients = resolveRecipients(attack, situation)
  const attackerTypes = resolveSpeciesTypes(
    resolveCombatantSpecies(situation.attacker),
  )
  let score = 0
  for (const recipient of recipients) {
    const typeFactor = self
      ? 1
      : resolveTypeFactor(attack, attackerTypes, recipient)
    let value = self ? 0 : resolveAiPower(attack, situation.attacker, recipient)
    for (const effect of attack.effects ?? []) {
      value += evaluateEffect(effect, recipient, { ally: self })
    }
    score += value * typeFactor
  }
  // o que dá a quem usa: só vale se ele pegar alguém (o efeito é no acerto)
  if (!self && score > 0 && situation.attacker) {
    for (const effect of attack.selfEffects ?? []) {
      score += evaluateEffect(effect, situation.attacker, { ally: true })
    }
  }
  if (score <= 0) return 0

  const distance = horizontalDistance(attackerPos, targetPos)
  if (distance <= resolveReachFor(attack, attackerTrigger, targetTrigger))
    score *= IN_REACH_BONUS
  return (
    score *
    (attack.ai?.weight ?? 1) *
    resolveMasteryAccuracyFactor(attack.mastery)
  )
}

/**
 * Sorteia um entre `candidates` (`[{ score, ... }]`, notas > 0): só os com
 * nota de pelo menos `NEAR_BEST_FRACTION` da melhor, com chance proporcional
 * à nota. `null` sem candidato.
 */
export function pickAiAttack(candidates, rng = gameplayRng) {
  const { NEAR_BEST_FRACTION } = GAME_CONFIG.AI_ATTACK
  const valid = candidates.filter((candidate) => candidate.score > 0)
  if (valid.length === 0) return null

  const best = Math.max(...valid.map((candidate) => candidate.score))
  const pool = valid.filter(
    (candidate) => candidate.score >= best * NEAR_BEST_FRACTION,
  )
  const total = pool.reduce((sum, candidate) => sum + candidate.score, 0)
  let roll = rng() * total
  for (const candidate of pool) {
    roll -= candidate.score
    if (roll < 0) return candidate
  }
  return pool[pool.length - 1]
}

/** O golpe do `slot` pronto pra lançar agora (stamina, cooldown), ou `null`. */
function resolveReadyAttack(entity, species, slot) {
  const attack = resolveAttackForEntity(
    species,
    slot,
    entity.get(IndividualValues),
    resolveEntityLevel(entity, species),
    resolveEntityMoveSet(entity, species),
    readSpeedStage(entity),
  )
  if (!attack) return null
  if (entity.get(Vitals).stamina < attack.staminaCost) return null
  if ((entity.get(AttackCooldowns)?.[slot] ?? 0) > 0) return null
  return attack
}

/**
 * Plano de golpe da IA (selvagem ou criatura do time fora do controle) contra
 * `target`: `{ slot, attack, reach }` ou `null` (nada pronto agora).
 *
 * Só entra golpe pronto (stamina, cooldown) e que cabe na reserva de energia
 * (`fitsEnergyReserve` — habilidade não esvazia a energia; o mais barato
 * sempre cabe). Mantém `plannedSlot` enquanto ele continuar valendo — sem
 * sortear de novo a cada tick, a criatura não fica mudando de ideia (e de
 * distância) no meio do caminho. Senão, dá nota a cada um (`scoreAiAttack`) e
 * sorteia (`pickAiAttack`). `reach` diz até onde ela precisa chegar pra lançar.
 *
 * `enemies`: `[{ entity, pos }]` — os inimigos dela que contam pra área
 * (inimigo extra no cone) e pro golpe em si mesmo (inimigo perto).
 */
export function planAiAttack(
  entity,
  species,
  target,
  enemies,
  plannedSlot = null,
  rng = gameplayRng,
) {
  const attackerTrigger = resolveEntityHitTrigger(entity)
  const targetTrigger = resolveEntityHitTrigger(target)
  const vitals = entity.get(Vitals)

  const ready = []
  for (const { slot } of ATTACK_SLOTS) {
    const attack = resolveReadyAttack(entity, species, slot)
    if (attack) ready.push({ slot, attack })
  }
  const cheapestCost = Math.min(
    ...ready.map(({ attack }) => attack.staminaCost),
  )
  const affordable = ready.filter(({ attack }) =>
    fitsEnergyReserve(attack, vitals, cheapestCost),
  )

  const planned = affordable.find(({ slot }) => slot === plannedSlot)
  if (planned) {
    return {
      ...planned,
      reach: resolveReachFor(planned.attack, attackerTrigger, targetTrigger),
    }
  }

  const situation = {
    attacker: entity,
    attackerPos: entity.get(Position),
    attackerTrigger,
    target,
    targetPos: target.get(Position),
    targetTrigger,
    enemies,
  }
  const candidates = affordable.map(({ slot, attack }) => ({
    slot,
    attack,
    score: scoreAiAttack(attack, situation),
  }))
  const picked = pickAiAttack(candidates, rng)
  if (!picked) return null
  return {
    slot: picked.slot,
    attack: picked.attack,
    reach: resolveReachFor(picked.attack, attackerTrigger, targetTrigger),
  }
}
