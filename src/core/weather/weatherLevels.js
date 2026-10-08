import { WEATHER_TYPES } from './weatherMap'

/**
 * Força de cada tipo de clima indo na direção do sorteado
 * (docs/features/048-dia-noite-e-clima.md): a do `target` sobe até
 * `targetIntensity` (o limpo, até 1) e a dos outros desce até 0, cada uma
 * andando no máximo `delta / transition` por passo. Devolve as forças novas
 * (`{ clear, rain, storm, snow }`) e o `type` de maior força.
 */
export function stepWeatherLevels(
  levels,
  target,
  targetIntensity,
  delta,
  transition,
) {
  const maxStep = transition > 0 ? delta / transition : Infinity
  const next = {}
  let type = target
  let strongest = -1
  for (const kind of WEATHER_TYPES) {
    const goal = kind !== target ? 0 : kind === 'clear' ? 1 : targetIntensity
    const current = levels[kind] ?? 0
    const change = Math.max(-maxStep, Math.min(maxStep, goal - current))
    next[kind] = current + change
    if (next[kind] > strongest) {
      strongest = next[kind]
      type = kind
    }
  }
  return { ...next, type }
}
