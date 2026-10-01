import { accuracyMultiplier } from './statStages'

/** Precisão padrão de um golpe (%) — a convenção do Pokémon: 100. */
export const DEFAULT_ACCURACY = 100

/**
 * Precisão (%) de um golpe: `accuracy` da definição (`core/data/skills/`),
 * 100 se não declarada. `null` = nunca erra (o "—" do Pokémon, ex.: Swift).
 */
export function resolveMoveAccuracy(attack) {
  if (attack?.accuracy === null) return null
  return attack?.accuracy ?? DEFAULT_ACCURACY
}

/**
 * Chance (0-1) de o golpe acertar, a regra do Pokémon: precisão do golpe ×
 * multiplicador do estágio de PRECISÃO de quem ataca (`accuracyMultiplier`).
 * Só a precisão existe — não há estágio de evasão. Golpe sem precisão
 * (`accuracy: null`) é 1. Limitada a 0-1.
 */
export function resolveHitChance(attack, accuracyStage = 0) {
  const accuracy = resolveMoveAccuracy(attack)
  if (accuracy === null) return 1
  return Math.min(
    Math.max((accuracy / 100) * accuracyMultiplier(accuracyStage), 0),
    1,
  )
}

/**
 * Sorteia se o golpe acerta: `rng() < chance`. Com 100% × estágio 0 a chance é
 * 1 e `rng()` (sempre < 1) nunca erra — os golpes de hoje se comportam como
 * antes até alguém baixar a precisão do atacante (Smokescreen). `rng`: o
 * `gameplayRng` (`core/rng.js`, regra 3.5 de docs/rules).
 */
export function rollHit(attack, accuracyStage, rng) {
  return rng() < resolveHitChance(attack, accuracyStage)
}
