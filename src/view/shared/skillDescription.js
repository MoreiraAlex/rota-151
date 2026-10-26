import { resolveConditionEffect } from '@/core/data/conditions'

/**
 * Texto da descrição de um golpe (`description` da skill, no estilo das
 * habilidades do LoL), com os valores de verdade: `skill` já resolvido
 * (`resolveSkill` — com o grupo e o override da espécie), então o texto
 * acompanha o ajuste dos números.
 *
 * Marcadores: `{caminho}` ou `{caminho:formato}`. O caminho é lido no golpe
 * (`power` = `damage.power`, `range`, `accuracy`...) e nos efeitos
 * (`effects.0.duration`, `effects.0.tick.fraction` — o efeito de condição já
 * com os valores da condição). Formatos: `s` (segundos), `m` (metros), `%`
 * (fração → porcentagem), `abs` (sem sinal); sem formato, o número. Marcador
 * sem valor vira `?` (o teste pega).
 */
export function formatSkillDescription(skill) {
  const text = skill?.description
  if (!text) return ''
  const values = resolveDescriptionValues(skill)
  return text.replace(/\{([^}:]+)(?::([^}]+))?\}/g, (_, path, format) =>
    formatValue(readPath(values, path), format),
  )
}

function resolveDescriptionValues(skill) {
  return {
    ...skill,
    power: skill.damage?.power,
    effects: (skill.effects ?? []).map(
      (effect) => resolveConditionEffect(effect) ?? effect,
    ),
  }
}

function readPath(object, path) {
  return path.split('.').reduce((value, key) => value?.[key], object)
}

const numbers = new Map()

function formatNumber(value, digits) {
  if (!numbers.has(digits)) {
    numbers.set(
      digits,
      new Intl.NumberFormat('pt-BR', { maximumFractionDigits: digits }),
    )
  }
  return numbers.get(digits).format(value)
}

function formatValue(value, format) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '?'
  if (format === 's') return `${formatNumber(value, 1)} s`
  if (format === 'm') return `${formatNumber(value, 1)} m`
  if (format === '%') return `${formatNumber(value * 100, 2)}%`
  if (format === 'abs') return formatNumber(Math.abs(value), 2)
  return formatNumber(value, 2)
}
