import { accuracyMultiplier } from './statStages'
import { isChannelAttack, isSelfAttack } from './channelAttack'
import { resolveMasteryAccuracyFactor, rollMasterySuccess } from './moveMastery'

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
 * (`accuracy: null`) é 1. Limitada a 0-1. O domínio do golpe
 * (`attack.mastery`, docs/features/038-aprendizado-treino-e-dominio-de-
 * golpes.md) multiplica junto — dominado (ou sem domínio) não muda nada.
 */
export function resolveHitChance(attack, accuracyStage = 0) {
  const accuracy = resolveMoveAccuracy(attack)
  if (accuracy === null) return 1
  const chance =
    (accuracy / 100) *
    accuracyMultiplier(accuracyStage) *
    resolveMasteryAccuracyFactor(attack?.mastery)
  return Math.min(Math.max(chance, 0), 1)
}

/**
 * Golpe que NÃO passa pelo sorteio de precisão: sem precisão (`accuracy:
 * null`), em si mesmo (`area: 'self'`) ou canalizado. Com domínio baixo, esses
 * podem FALHAR (`rollAttackFails`) em vez de errar.
 */
export function isNeverMissAttack(attack) {
  return (
    resolveMoveAccuracy(attack) === null ||
    isSelfAttack(attack) ||
    isChannelAttack(attack)
  )
}

/**
 * O golpe que não erra FALHOU por falta de domínio? Só vale pra
 * `isNeverMissAttack`; dominado nunca falha.
 */
export function rollAttackFails(attack, rng) {
  if (!isNeverMissAttack(attack)) return false
  return !rollMasterySuccess(attack?.mastery, rng)
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
