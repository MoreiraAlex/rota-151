import { getCondition, resolveConditionEffect } from '@/core/data/conditions'

/**
 * Formatação de exibição da wiki (`/wiki`, docs/features/036-wiki-do-jogo.md)
 * — só texto pra jogador ler, nunca regra de jogo. Números em pt-BR.
 */

/**
 * Bônus de captura de uma condição (`captureBonus`, docs/features/
 * 043-captura.md): o multiplicador da chance, ou `null` se ela não ajuda. Cada condição descreve o próprio bônus — a página de captura só
 * fala de "condições" em geral.
 */
export function resolveConditionCaptureBonus(condition) {
  const bonus = getCondition(condition)?.captureBonus
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
  evasion: 'Evasão',
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
  circle: 'Em volta',
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
  const condition = resolveConditionEffect(effect)
  if (condition) return describeCondition(condition)
  return 'Efeito especial'
}

/**
 * O texto de uma condição, pelos comportamentos dela (tick, atordoar,
 * modificador, captura) — sem nada por id.
 */
export function describeCondition(condition) {
  const { tick, duration, chance } = condition
  if (condition.interrupt) {
    const text =
      'Interrompe na hora o que o alvo estava fazendo: ele fica atordoado por um instante'
    return chance < 1
      ? `${formatPercent(chance, 0)} de chance de ${condition.verb}: ${text.charAt(0).toLowerCase()}${text.slice(1)}`
      : text
  }
  const parts = []
  if (tick?.interval > 0) {
    const verb = tick.to === 'source' ? 'Rouba' : 'Tira'
    const whose = tick.to === 'source' ? ' do alvo' : ''
    parts.push(
      `${verb} ${formatPercent(tick.fraction ?? 0, 2)} da vida máxima${whose} a cada ${formatSeconds(tick.interval, 1)}, por ${formatSeconds(duration ?? 0, 1)}`,
    )
  } else {
    parts.push(`Dura ${formatSeconds(duration ?? 0, 1)}`)
  }
  const attack = condition.modifiers?.attack
  if (attack !== undefined && attack !== 1) {
    parts.push(
      `e o ataque físico de quem está ${condition.label.toLowerCase()} ${attack < 1 ? 'cai' : 'sobe'} pra ${formatPercent(attack, 0)}`,
    )
  }
  const critical = condition.modifiers?.critical
  if (critical !== undefined && critical !== 1) {
    parts.push(
      `e a chance de golpe crítico de quem está ${condition.label.toLowerCase()} fica ${formatMultiplier(critical)}`,
    )
  }
  const who = `quem está ${condition.label.toLowerCase()}`
  const movement = condition.modifiers?.movement
  if (condition.stun) {
    // atordoado: o passo zerado já está dentro
    parts.push(`e ${who} fica parado, sem andar nem atacar`)
  } else if (movement === 0) {
    parts.push(`e ${who} não sai do lugar, mas ainda pode atacar`)
  } else if (movement !== undefined && movement !== 1) {
    parts.push(`e ${who} anda a ${formatPercent(movement, 0)} do passo normal`)
  }
  let text = parts.join(', ')
  const capture = resolveConditionCaptureBonus(condition.id)
  if (capture) {
    text += `; ${condition.label.toLowerCase()}, fica mais fácil de capturar (${formatMultiplier(capture)} na chance)`
  }
  if (chance < 1) {
    text = `${formatPercent(chance, 0)} de chance de ${condition.verb}: ${text.charAt(0).toLowerCase()}${text.slice(1)}`
  }
  return text
}

/**
 * As mecânicas especiais de um golpe (vários acertos, poder que muda,
 * arrancada), em linguagem de jogador — uma frase por mecânica.
 */
export function describeSkillMechanics(attack) {
  const lines = []
  const multiHit = attack?.multiHit
  if (multiHit?.counts?.length) {
    const min = Math.min(...multiHit.counts)
    const max = Math.max(...multiHit.counts)
    lines.push(
      `Acerta de ${min} a ${max} vezes seguidas no mesmo alvo (o número é sorteado). Só o primeiro acerto pode errar; cada um tem o próprio dano e pode ser crítico.`,
    )
  }
  const speedPower = attack?.damage?.speedPower
  if (speedPower?.length) {
    const tiers = [...speedPower].sort((a, b) => a.ratio - b.ratio)
    const text = tiers
      .map((tier) =>
        tier.ratio > 0
          ? `${formatNumber(tier.ratio, 1)}× a Velocidade do alvo ou mais: poder ${tier.power}`
          : `mais lento que o alvo: poder ${tier.power}`,
      )
      .join('; ')
    lines.push(
      `O poder depende da Velocidade de quem usa comparada à do alvo — ${text}.`,
    )
  }
  const boost = attack?.damage?.recentDamageBoost
  if (boost) {
    lines.push(
      `Contra quem levou dano nos últimos ${formatSeconds(boost.window, 1)}, o poder fica ${formatMultiplier(boost.multiplier)}.`,
    )
  }
  const self = attack?.selfEffects ?? []
  if (self.length) {
    const parts = self.map((effect) =>
      effect.type === 'removeConditions'
        ? `se solta de: ${(effect.conditions ?? [])
            .map((id) => getCondition(id)?.label ?? id)
            .join(', ')}`
        : describeEffect(effect),
    )
    lines.push(`Em quem usa, quando acerta alguém: ${parts.join('; ')}.`)
  }
  if (attack?.lunge?.distance > 0) {
    lines.push(
      `Avança até ${formatNumber(attack.lunge.distance, 1)} m na direção do golpe antes de acertar, parando ao encostar no alvo.`,
    )
  }
  return lines
}
