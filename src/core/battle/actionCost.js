import { GAME_CONFIG } from '../gameConfig'
import { isConeAttack, isSelfAttack } from './channelAttack'
import { resolveLevelCost } from './levelCost'

/**
 * Peso de cada tipo de efeito no preço do golpe — a mesma régua da nota da IA
 * (`AI_ATTACK.STAT_STAGE_VALUE`/`LEECH_SEED_VALUE`, `aiEffectEvaluators.js`),
 * no valor CHEIO (alvo sem o efeito). Tipo de efeito novo no motor de batalha
 * → peso novo aqui; tipo sem peso vale 0.
 */
const EFFECT_WEIGHTS = {
  statStage: (effect) =>
    GAME_CONFIG.AI_ATTACK.STAT_STAGE_VALUE * Math.abs(effect.stages ?? 0),
  leechSeed: () => GAME_CONFIG.AI_ATTACK.LEECH_SEED_VALUE,
}

export { resolveLevelCost }

/**
 * Peso do golpe — o "poder" da conta de custo e recarga
 * (docs/features/035-balanceamento-de-acoes-e-correcoes.md). Só define o PREÇO; o dano
 * não muda. `damage.power` (no canal, já o total) + o peso de cada efeito,
 * × `CONE_BONUS` em cone e × `RANGED_BONUS` alcançando `RANGED_MIN_RANGE` ou
 * mais (golpe em si mesmo não conta alcance). Nunca olha o id da skill.
 */
export function resolveAttackWeight(attack) {
  const { RANGED_MIN_RANGE, RANGED_BONUS, CONE_BONUS } = GAME_CONFIG.ACTION_COST
  let weight = attack?.damage?.power ?? 0
  for (const effect of attack?.effects ?? []) {
    weight += EFFECT_WEIGHTS[effect.type]?.(effect) ?? 0
  }
  if (isConeAttack(attack)) weight *= CONE_BONUS
  if (!isSelfAttack(attack) && (attack?.range ?? 0) >= RANGED_MIN_RANGE) {
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
 * `speedFactor` é o mesmo do básico (`calculateAttackDurationFactor`: < 1
 * pra quem é rápido).
 */
export function resolveAttackCooldown(weight, speedFactor = 1) {
  return weight * GAME_CONFIG.ACTION_COST.COOLDOWN_PER_WEIGHT * speedFactor
}

/**
 * O ataque com `staminaCost`/`cooldown` resolvidos: os escritos na definição
 * (skill ou override da espécie) ganham; os ausentes saem da fórmula. O
 * básico (`primary`) não tem recarga — o ritmo dele vem da duração.
 */
export function withActionCost(attack, { slot, level, speedFactor = 1 }) {
  const weight = resolveAttackWeight(attack)
  const formulaCooldown =
    slot === 'primary' ? 0 : resolveAttackCooldown(weight, speedFactor)
  return {
    ...attack,
    staminaCost: attack.staminaCost ?? resolveLevelCost(level, weight),
    cooldown: attack.cooldown ?? formulaCooldown,
  }
}
