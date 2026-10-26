import { StatStages } from '../traits'

/**
 * Atributos que têm estágio: os 4 que a fórmula de dano usa, a PRECISÃO
 * (`accuracy`) de quem ataca e a EVASÃO (`evasion`) de quem é atacado, que não
 * entram no dano e sim no sorteio de acerto (`core/battle/accuracy.js`), e a
 * VELOCIDADE (`speed`), que no tempo real
 * muda o tempo dos golpes (`speedStageTimeFactor`). O passo de andar não é
 * atributo: fica com as condições (o modificador `movement`, ex.: a teia do
 * String Shot).
 */
export const STAT_STAGE_KEYS = [
  'attack',
  'defense',
  'sp_atk',
  'sp_def',
  'accuracy',
  'evasion',
  'speed',
]

/** Limite do estágio (-6 a +6), como no Pokémon. */
export const STAT_STAGE_LIMIT = 6

/**
 * Multiplicador do atributo por estágio, a fórmula do Pokémon: `(2 + n) / 2`
 * pra estágio positivo e `2 / (2 - n)` pra negativo — -1 → 2/3, -2 → 1/2,
 * -6 → 1/4; +1 → 3/2, +2 → 2, +6 → 4.
 */
export function stageMultiplier(stage) {
  return stage >= 0 ? (2 + stage) / 2 : 2 / (2 - stage)
}

/**
 * Multiplicador da PRECISÃO por estágio — a fórmula própria do Pokémon (mais
 * suave que a dos atributos): `(3 + n) / 3` pra estágio positivo e `3 / (3 - n)`
 * pra negativo — -1 → 3/4, -2 → 3/5, -6 → 1/3; +1 → 4/3, +6 → 3.
 */
export function accuracyMultiplier(stage) {
  return stage >= 0 ? (3 + stage) / 3 : 3 / (3 - stage)
}

/**
 * Quanto o tempo dos golpes (`duration`/`effectAt`) multiplica pelo estágio
 * de Velocidade: a mesma curva do `speed` no tempo do golpe
 * (`calculateAttackDurationFactor`, inversa da raiz), aplicada ao
 * multiplicador do estágio — fora da faixa do fator do `speed`, então vale
 * pra criatura de qualquer velocidade.
 */
export function speedStageTimeFactor(stage) {
  return 1 / Math.sqrt(stageMultiplier(stage))
}

/** Estágio de Velocidade de `entity` (0 sem o trait). */
export function readSpeedStage(entity) {
  return entity?.has?.(StatStages) ? entity.get(StatStages).speedStage : 0
}

export function clampStage(stage) {
  return Math.min(Math.max(stage, -STAT_STAGE_LIMIT), STAT_STAGE_LIMIT)
}

/** Estágios atuais de uma criatura: `{ attack, defense, sp_atk, sp_def, accuracy, evasion, speed }` (0 sem o trait). */
export function readStatStages(entity) {
  const stages = Object.fromEntries(STAT_STAGE_KEYS.map((key) => [key, 0]))
  if (!entity?.has?.(StatStages)) return stages

  const state = entity.get(StatStages)
  for (const key of STAT_STAGE_KEYS) stages[key] = state[`${key}Stage`]
  return stages
}

/**
 * Estágios ATIVOS (diferentes de 0) de uma criatura, na ordem de
 * `STAT_STAGE_KEYS`: `[{ stat, stage }]`. Vazio = nenhum atributo alterado —
 * é o que decide se o indicador de status da HUD aparece.
 */
export function listActiveStatStages(entity) {
  const stages = readStatStages(entity)
  return STAT_STAGE_KEYS.filter((stat) => stages[stat] !== 0).map((stat) => ({
    stat,
    stage: stages[stat],
  }))
}

/**
 * Aplica UM efeito de estágio (`{ type: 'statStage', stat, stages, duration }`,
 * ver `effects` em `core/data/skills/`) numa criatura: soma `stages` ao
 * estágio do `stat` (limitado a ±6) e RENOVA o tempo pra `duration`
 * segundos. Devolve `{ stat, delta, stage }` — `delta` é quanto o estágio
 * REALMENTE mudou (0 se já estava no limite) — ou `null` se o efeito não for
 * de estágio ou o `stat` não existir. O tempo é renovado mesmo no limite
 * (usar de novo segura o efeito); se o estágio volta a 0 não sobra tempo.
 */
export function applyStatStageEffect(entity, effect) {
  if (effect?.type !== 'statStage') return null
  const { stat, stages = 0, duration = 0 } = effect
  if (!STAT_STAGE_KEYS.includes(stat)) return null

  if (!entity.has(StatStages)) entity.add(StatStages)
  const state = entity.get(StatStages)
  const before = state[`${stat}Stage`]
  const stage = clampStage(before + stages)

  entity.set(StatStages, {
    [`${stat}Stage`]: stage,
    [`${stat}Time`]: stage === 0 ? 0 : duration,
  })
  return { stat, delta: stage - before, stage }
}
