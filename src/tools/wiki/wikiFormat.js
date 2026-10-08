import { GAME_CONFIG } from '@/core/gameConfig'

/**
 * Formatação de exibição da wiki (`/wiki`, docs/features/036-wiki-do-jogo.md)
 * — só texto pra jogador ler, nunca regra de jogo. Números em pt-BR.
 */

/**
 * Bônus de captura de uma condição de status (`CAPTURE.CONDITION_BONUS`,
 * docs/features/043-captura.md): o multiplicador da chance, ou `null` se ela
 * não ajuda. Cada condição descreve o próprio bônus — a página de captura só
 * fala de "condições" em geral.
 */
export function resolveConditionCaptureBonus(condition) {
  const bonus = GAME_CONFIG.CAPTURE.CONDITION_BONUS[condition]
  return bonus && bonus !== 1 ? bonus : null
}

const formatters = new Map()

function numberFormatter(digits) {
  if (!formatters.has(digits)) {
    formatters.set(
      digits,
      new Intl.NumberFormat('pt-BR', { maximumFractionDigits: digits }),
    )
  }
  return formatters.get(digits)
}

export function formatNumber(value, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  if (value === Infinity) return '∞'
  return numberFormatter(digits).format(value)
}

/** Fração 0-1 → porcentagem. */
export function formatPercent(fraction, digits = 1) {
  if (fraction === null || fraction === undefined) return '—'
  return `${formatNumber(fraction * 100, digits)}%`
}

export function formatSeconds(value, digits = 2) {
  return `${formatNumber(value, digits)} s`
}

export function formatMeters(value, digits = 2) {
  return `${formatNumber(value, digits)} m`
}

export function formatMultiplier(value, digits = 2) {
  return `×${formatNumber(value, digits)}`
}

/** Nome do tipo pelo retrato da versão (`data.types.list`). */
export function formatTypeName(data, type) {
  return data.types?.list.find((item) => item.id === type)?.name ?? type
}

/** "super efetivo", "pouco efetivo", "não afeta" ou "normal". */
export function formatEffectiveness(multiplier) {
  if (multiplier === 0) return 'não afeta'
  if (multiplier > 1) return 'super efetivo'
  if (multiplier < 1) return 'pouco efetivo'
  return 'normal'
}

/** `min`–`max`, ou um valor só quando os dois coincidem. */
export function formatRange(min, max, format = formatNumber) {
  if (min === max || format(min) === format(max)) return format(min)
  return `${format(min)} – ${format(max)}`
}

/** `'leech-seed'` → `'Leech Seed'`. */
export function formatName(id) {
  return String(id)
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

export const GROWTH_RATE_LABELS = {
  fast: 'Rápido',
  'medium-fast': 'Médio-rápido',
  'medium-slow': 'Médio-lento',
  slow: 'Lento',
  erratic: 'Errático',
  fluctuating: 'Flutuante',
}

export const STAT_LABELS = {
  hp: 'Vida',
  attack: 'Ataque',
  defense: 'Defesa',
  sp_atk: 'Ataque especial',
  sp_def: 'Defesa especial',
  speed: 'Velocidade',
  energy: 'Energia',
  accuracy: 'Precisão',
}

/** Nome do slot sem citar tecla — o controle ainda vai mudar (mobile, gamepad). */
export const SLOT_LABELS = {
  secondary1: 'Golpe 1',
  secondary2: 'Golpe 2',
  secondary3: 'Golpe 3',
}

export const CATEGORY_LABELS = {
  physical: 'Físico',
  special: 'Especial',
  status: 'Status',
}

export const AREA_LABELS = {
  self: 'Em si mesmo',
  cone: 'Cone',
  line: 'Feixe',
  capsule: 'Alvo único',
}

function formatStages(stages) {
  const sign = stages > 0 ? '+' : '−'
  return `${sign}${Math.abs(stages)}`
}

/** Texto de UM efeito de golpe, em linguagem de jogador. */
export function describeEffect(effect) {
  if (effect?.type === 'statStage') {
    return `${STAT_LABELS[effect.stat] ?? effect.stat} ${formatStages(effect.stages ?? 0)} por ${formatSeconds(effect.duration ?? 0, 1)}`
  }
  if (effect?.type === 'leechSeed') {
    return `Rouba ${formatPercent(effect.fraction ?? 0, 2)} da vida máxima do alvo a cada ${formatSeconds(effect.interval ?? 0, 1)}, por ${formatSeconds(effect.duration ?? 0, 1)}`
  }
  if (effect?.type === 'burn') {
    const capture = resolveConditionCaptureBonus('burn')
    const captureText = capture
      ? `; queimado, fica mais fácil de capturar (${formatMultiplier(capture)} na chance)`
      : ''
    return `${formatPercent(effect.chance ?? 1, 0)} de chance de queimar: tira ${formatPercent(effect.fraction ?? 0, 2)} da vida máxima a cada ${formatSeconds(effect.interval ?? 0, 1)}, por ${formatSeconds(effect.duration ?? 0, 1)}, e o ataque físico de quem queima cai pra ${formatPercent(effect.attackMultiplier ?? 1, 0)}${captureText}`
  }
  return 'Efeito especial'
}
