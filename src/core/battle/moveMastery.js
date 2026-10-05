import { GAME_CONFIG } from '../gameConfig'
import { MAX_MASTERY } from '../data/species/moves'

/**
 * Domínio de um golpe (docs/features/038-aprendizado-treino-e-dominio-de-
 * golpes.md), puro: quanto o domínio piora precisão, energia e recarga, e
 * quanto ele sobe a cada uso. Domínio no máximo = valores clássicos (fator
 * 1); abaixo, interpola em linha até o pior caso (`GAME_CONFIG.MOVES.MASTERY`).
 * Sem domínio informado (`undefined`/`null`: básico, selvagem, testes
 * antigos), é como dominado.
 */

function clampMastery(mastery) {
  if (mastery == null) return MAX_MASTERY
  return Math.min(Math.max(mastery, 0), MAX_MASTERY)
}

function lerpByMastery(worst, mastery) {
  const t = clampMastery(mastery) / MAX_MASTERY
  return worst + (1 - worst) * t
}

/** Fator (0–1) que multiplica a chance de acerto/de sair do golpe. */
export function resolveMasteryAccuracyFactor(mastery) {
  return lerpByMastery(GAME_CONFIG.MOVES.MASTERY.MIN_ACCURACY_FACTOR, mastery)
}

/** Multiplicador (≥ 1) do custo de energia. */
export function resolveMasteryCostFactor(mastery) {
  return lerpByMastery(GAME_CONFIG.MOVES.MASTERY.MAX_COST_FACTOR, mastery)
}

/** Multiplicador (≥ 1) da recarga. */
export function resolveMasteryCooldownFactor(mastery) {
  return lerpByMastery(GAME_CONFIG.MOVES.MASTERY.MAX_COOLDOWN_FACTOR, mastery)
}

/**
 * Sorteio de "sair" de um golpe que não erra (sem precisão, em si mesmo,
 * canalizado): `false` = falhou. Dominado nunca falha.
 */
export function rollMasterySuccess(mastery, rng) {
  const chance = resolveMasteryAccuracyFactor(mastery)
  if (chance >= 1) return true
  return rng() < chance
}

/**
 * Domínio depois de um uso em combate: ganho por uso (mais o bônus de
 * acerto), multiplicado pelo que falta até o máximo — com piso
 * (`MIN_GAIN_FRACTION`) pra chegar no teto —, limitado ao máximo.
 */
export function resolveMasteryAfterUse(mastery, hit) {
  const current = clampMastery(mastery)
  if (current >= MAX_MASTERY) return MAX_MASTERY

  const { GAIN_PER_USE, HIT_GAIN_BONUS, MIN_GAIN_FRACTION } =
    GAME_CONFIG.MOVES.MASTERY
  const base = GAIN_PER_USE + (hit ? HIT_GAIN_BONUS : 0)
  const remaining = (MAX_MASTERY - current) / MAX_MASTERY
  const gain = base * Math.max(remaining, MIN_GAIN_FRACTION)
  return Math.min(MAX_MASTERY, current + gain)
}
