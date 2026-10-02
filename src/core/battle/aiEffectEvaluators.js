import { GAME_CONFIG } from '../gameConfig'
import { LeechSeed, StatStages } from '../traits'
import { STAT_STAGE_LIMIT, readStatStages } from './statStages'

/**
 * Quanto vale, pra IA, `effect` (`{ type: 'statStage', ... }`) cair em
 * `recipient` agora. `ally` = o efeito cai em quem usou (golpe em si mesmo,
 * `area: 'self'`); senão cai no inimigo.
 *
 * Só vale no sentido certo (subir o próprio estágio, baixar o do inimigo).
 * Cheio com o estágio em 0; cada estágio já acumulado no sentido do efeito
 * multiplica por `STAT_STAGE_DECAY` — acumula, mas a partir de certo ponto
 * bater vale mais. No limite (±6) vale 0, a não ser perto de expirar
 * (`EFFECT_REFRESH_TIME`): aí vale cheio de novo, porque usar renova o tempo.
 * Efeito de mais de um estágio vale por estágio que ainda cabe.
 */
export function evaluateStatStageEffect(effect, recipient, { ally }) {
  const { STAT_STAGE_VALUE, STAT_STAGE_DECAY, EFFECT_REFRESH_TIME } =
    GAME_CONFIG.AI_ATTACK
  const sign = Math.sign(effect.stages ?? 0)
  if (sign === 0 || sign > 0 !== ally) return 0

  const stage = readStatStages(recipient)[effect.stat]
  if (stage === undefined) return 0
  const accumulated = Math.max(0, stage * sign)
  const timeLeft = recipient.get(StatStages)?.[`${effect.stat}Time`] ?? 0
  const expiring = accumulated > 0 && timeLeft <= EFFECT_REFRESH_TIME

  if (expiring) return STAT_STAGE_VALUE * Math.abs(effect.stages)
  const room = STAT_STAGE_LIMIT - accumulated
  if (room <= 0) return 0
  return (
    STAT_STAGE_VALUE *
    Math.min(Math.abs(effect.stages), room) *
    STAT_STAGE_DECAY ** accumulated
  )
}

/**
 * Semente (`{ type: 'leechSeed', ... }`): vale cheio num inimigo sem semente;
 * 0 com uma ativa (plantar de novo só renovaria), voltando a valer perto de
 * secar (`EFFECT_REFRESH_TIME`). Nunca em quem usou.
 */
export function evaluateLeechSeedEffect(effect, recipient, { ally }) {
  const { LEECH_SEED_VALUE, EFFECT_REFRESH_TIME } = GAME_CONFIG.AI_ATTACK
  if (ally) return 0
  const seed = recipient.get(LeechSeed)
  if (seed && seed.timeLeft > EFFECT_REFRESH_TIME) return 0
  return LEECH_SEED_VALUE
}

/**
 * Um avaliador por TIPO de efeito (`effect.type`, ver `effects` em
 * `core/data/skills/_template`) — nunca por skill: toda habilidade feita de
 * efeitos que já existem é avaliada sem código novo. Tipo de efeito novo no
 * motor de batalha → avaliador novo aqui. Assinatura:
 * `(effect, recipient, { ally }) => número >= 0`.
 */
export const AI_EFFECT_EVALUATORS = {
  statStage: evaluateStatStageEffect,
  leechSeed: evaluateLeechSeedEffect,
}

/** Valor de um efeito pra IA; tipo sem avaliador vale 0. */
export function evaluateEffect(effect, recipient, options) {
  const evaluate = AI_EFFECT_EVALUATORS[effect?.type]
  return evaluate ? evaluate(effect, recipient, options) : 0
}
