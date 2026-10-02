/**
 * Formatação de exibição da wiki (`/wiki`, docs/features/036-wiki-do-jogo.md)
 * — só texto pra jogador ler, nunca regra de jogo. Números em pt-BR.
 */

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
  primary: 'Ataque básico',
  secondary1: 'Habilidade 1',
  secondary2: 'Habilidade 2',
  secondary3: 'Habilidade 3',
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
  return 'Efeito especial'
}
