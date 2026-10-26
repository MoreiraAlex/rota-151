import { GAME_CONFIG } from '../gameConfig'
import { getCondition, resolveConditionEffect } from '../data/conditions'
import { isAreaAttack, isSelfAttack } from './channelAttack'
import { resolveLevelCost } from './levelCost'
import { resolveExpectedHits } from './multiHit'

/**
 * Peso de cada tipo de efeito no preço do golpe — a mesma régua da nota da IA
 * (`AI_ATTACK.STAT_STAGE_VALUE` e o `ai.value` de cada condição,
 * `aiEffectEvaluators.js`),
 * no valor CHEIO (alvo sem o efeito). Tipo de efeito novo no motor de batalha
 * → peso novo aqui; tipo sem peso vale 0.
 */
const EFFECT_WEIGHTS = {
  statStage: (effect) =>
    GAME_CONFIG.AI_ATTACK.STAT_STAGE_VALUE * Math.abs(effect.stages ?? 0),
  condition: (effect) => {
    const condition = resolveConditionEffect(effect)
    return (condition?.ai?.value ?? 0) * (condition?.chance ?? 0)
  },
  // cheio: como se quem usa estivesse com todas as condições da lista
  removeConditions: (effect) =>
    (effect.conditions ?? []).reduce(
      (sum, id) => sum + (getCondition(id)?.ai?.value ?? 0),
      0,
    ),
}

export { resolveLevelCost }

/**
 * Peso do golpe — o "poder" da conta de custo e recarga
 * (docs/features/035-balanceamento-de-acoes-e-correcoes.md). Só define o PREÇO; o dano
 * não muda. `damage.power` (no canal, já o total; no golpe de vários
 * acertos, × a média de acertos, `resolveExpectedHits`) + o peso de cada
 * efeito (os do alvo e os que dá a quem usa, `selfEffects`),
 * × `CONE_BONUS` em área (cone ou círculo) e × `RANGED_BONUS` alcançando
 * `RANGED_MIN_RANGE` ou mais — o alcance com a arrancada (`lunge.distance`),
 * se tiver; golpe em si mesmo não conta alcance. O poder que muda com o alvo
 * (Electro Ball, Assurance) entra pelo `power` de referência: o preço é do
 * golpe, não de um alvo. Nunca olha o id da skill.
 */
export function resolveAttackWeight(attack) {
  const { RANGED_MIN_RANGE, RANGED_BONUS, CONE_BONUS } = GAME_CONFIG.ACTION_COST
  let weight =
    (attack?.damage?.power ?? 0) * resolveExpectedHits(attack?.multiHit)
  for (const effect of [
    ...(attack?.effects ?? []),
    ...(attack?.selfEffects ?? []),
  ]) {
    weight += EFFECT_WEIGHTS[effect.type]?.(effect) ?? 0
  }
  if (isAreaAttack(attack)) weight *= CONE_BONUS
  const reach = (attack?.range ?? 0) + (attack?.lunge?.distance ?? 0)
  if (!isSelfAttack(attack) && reach >= RANGED_MIN_RANGE) {
    weight *= RANGED_BONUS
  }
  return weight
}

/**
 * Tempo de TREINO do golpe, em horas (docs/features/038-aprendizado-treino-e-
 * dominio-de-golpes.md) — mesma régua do custo, o peso:
 * - `learn` — pra aprender: `peso ÷ 100 × LEARN_HOURS_PER_100_WEIGHT`, nunca
 *   menos que `MIN_LEARN_HOURS`; `trainingHours` escrito no golpe (ou no
 *   override da espécie) ganha da fórmula;
 * - `mastery` — pra ir de zero ao domínio máximo treinando:
 *   `learn × MASTERY_HOURS_MULTIPLIER`.
 */
export function resolveTrainingHours(attack) {
  const {
    LEARN_HOURS_PER_100_WEIGHT,
    MIN_LEARN_HOURS,
    MASTERY_HOURS_MULTIPLIER,
  } = GAME_CONFIG.MOVES.TRAINING
  const learn =
    attack?.trainingHours ??
    Math.max(
      MIN_LEARN_HOURS,
      (resolveAttackWeight(attack) / 100) * LEARN_HOURS_PER_100_WEIGHT,
    )
  return { learn, mastery: learn * MASTERY_HOURS_MULTIPLIER }
}

/**
 * Recarga: `peso × COOLDOWN_PER_WEIGHT × speedFactor` — sem nível (é tempo);
 * `speedFactor` é o mesmo da duração do golpe (`calculateAttackDurationFactor`:
 * < 1 pra quem é rápido).
 */
export function resolveAttackCooldown(weight, speedFactor = 1) {
  return weight * GAME_CONFIG.ACTION_COST.COOLDOWN_PER_WEIGHT * speedFactor
}

/**
 * O ataque com `staminaCost`/`cooldown` resolvidos: os escritos na definição
 * (skill ou override da espécie) ganham; os ausentes saem da fórmula.
 */
export function withActionCost(attack, { level, speedFactor = 1 }) {
  const weight = resolveAttackWeight(attack)
  return {
    ...attack,
    staminaCost: attack.staminaCost ?? resolveLevelCost(level, weight),
    cooldown: attack.cooldown ?? resolveAttackCooldown(weight, speedFactor),
  }
}
