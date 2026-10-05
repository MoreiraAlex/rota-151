/**
 * Fração (0–1) → porcentagem com duas casas, no formato brasileiro
 * ("12,34%") — progresso de treino e domínio de golpe
 * (docs/features/038-aprendizado-treino-e-dominio-de-golpes.md). Duas casas
 * porque o treino é de horas: cada repetição mexe pouco no número.
 */
export function formatProgressPercent(fraction) {
  const percent = Math.min(Math.max(fraction ?? 0, 0), 1) * 100
  return `${percent.toFixed(2).replace('.', ',')}%`
}
