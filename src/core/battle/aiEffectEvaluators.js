import { GAME_CONFIG } from '../gameConfig'
import { StatStages, resolveCreatureSpeciesId } from '../traits'
import { readCondition } from '../actions/conditions'
import { getCondition, resolveConditionEffect } from '../data/conditions'
import { getSpecies } from '../data/species'
import { resolveSpeciesTypes } from '../data/types'
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
 * Condição (`{ type: 'condition', condition, chance, ... }`): o `ai.value`
 * da condição × `chance` em quem ela serve sem ela — num inimigo, ou, se a
 * condição for boa (`beneficial`, ex.: Focado), em quem usa/aliado; 0 com
 * uma ativa (aplicar de novo só renovaria), voltando a valer perto de acabar
 * (`EFFECT_REFRESH_TIME`). 0 em quem é de um tipo imune (`immuneTypes`) e no
 * lado errado.
 */
export function evaluateConditionEffect(effect, recipient, { ally }) {
  const { EFFECT_REFRESH_TIME } = GAME_CONFIG.AI_ATTACK
  const condition = resolveConditionEffect(effect)
  if (!condition || ally !== Boolean(condition.beneficial)) return 0
  const types = resolveSpeciesTypes(
    getSpecies(resolveCreatureSpeciesId(recipient)),
  )
  if (types.some((type) => condition.immuneTypes?.includes(type))) return 0
  const active = readCondition(recipient, condition.id)
  if (active && active.timeLeft > EFFECT_REFRESH_TIME) return 0
  return (condition.ai?.value ?? 0) * condition.chance
}

/**
 * Soltar de condições (`{ type: 'removeConditions', conditions }`, ex.: o
 * Rapid Spin saindo do Wrap): em quem usa, o `ai.value` de cada condição da
 * lista que ele TEM agora (e que não é boa pra ele); no inimigo, 0.
 */
export function evaluateRemoveConditionsEffect(effect, recipient, { ally }) {
  if (!ally) return 0
  let value = 0
  for (const id of effect.conditions ?? []) {
    const condition = getCondition(id)
    if (!condition || condition.beneficial) continue
    if (readCondition(recipient, id)) value += condition.ai?.value ?? 0
  }
  return value
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
  condition: evaluateConditionEffect,
  removeConditions: evaluateRemoveConditionsEffect,
}

/** Valor de um efeito pra IA; tipo sem avaliador vale 0. */
export function evaluateEffect(effect, recipient, options) {
  const evaluate = AI_EFFECT_EVALUATORS[effect?.type]
  return evaluate ? evaluate(effect, recipient, options) : 0
}
