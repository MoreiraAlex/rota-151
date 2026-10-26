import { resolveCreatureStats } from '../data/species/stats'
import { readSpeedStage, stageMultiplier } from './statStages'

/**
 * Poder pela VELOCIDADE (o Electro Ball — docs/features/061-revisao-das-
 * skills.md): como na série, o poder vem da razão entre a Velocidade de quem
 * usa e a do alvo — quanto mais rápido que o alvo, mais forte.
 *
 * O golpe declara `damage.speedPower`: a lista `[{ ratio, power }]`, em
 * qualquer ordem; vale o degrau mais alto que a razão alcança; abaixo de
 * todos, o `power` do golpe. A Velocidade é o
 * atributo calculado (base, IV, EV e nível) vezes o estágio de Velocidade.
 * Sem o campo, nada muda.
 */

/** Velocidade de combate de um lado do golpe (`{ entity, species, individualValues, level }`). */
export function resolveCombatSpeed({
  entity,
  species,
  individualValues,
  level,
}) {
  const stats = resolveCreatureStats(species, individualValues, level)
  const speed = stats?.speed?.stat ?? 0
  return speed * stageMultiplier(readSpeedStage(entity))
}

/** O poder do degrau que a razão `ratio` alcança, ou `fallback`. */
export function resolveSpeedTierPower(tiers, ratio, fallback) {
  let best = null
  for (const tier of tiers) {
    if (ratio >= tier.ratio && (!best || tier.ratio > best.ratio)) best = tier
  }
  return best ? best.power : fallback
}

/**
 * A seção `damage` com o poder pela Velocidade de `attacker` contra `target`
 * (a mesma, sem `speedPower`).
 */
export function applySpeedPower(damage, attacker, target) {
  const tiers = damage?.speedPower
  if (!tiers?.length) return damage
  const targetSpeed = resolveCombatSpeed(target)
  const ratio =
    targetSpeed > 0 ? resolveCombatSpeed(attacker) / targetSpeed : Infinity
  return { ...damage, power: resolveSpeedTierPower(tiers, ratio, damage.power) }
}
