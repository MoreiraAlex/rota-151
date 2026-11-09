import { GAME_CONFIG } from '../gameConfig'
import { WildCreature } from '../traits'

/**
 * Os valores da IA na luta que a dificuldade mexe, na ponta difícil: os de
 * hoje, lidos dos campos de origem. Os dois lados dividem tudo menos o ritmo
 * dos golpes: `side` `'wild'` → `WILD_BEHAVIOR.ATTACK_INTERVAL`, `'party'` →
 * `PARTY_BEHAVIOR.ATTACK_INTERVAL` (docs/features/063-revisao-da-ia-
 * selvagem.md, docs/features/064-revisao-da-ia-do-parceiro.md).
 */
export function resolveHardTuning(side = 'wild') {
  const { AI_MOVEMENT, AI_ATTACK, AI_ENERGY, WILD_BEHAVIOR, PARTY_BEHAVIOR } =
    GAME_CONFIG
  return {
    ATTACK_INTERVAL:
      side === 'party'
        ? PARTY_BEHAVIOR.ATTACK_INTERVAL
        : WILD_BEHAVIOR.ATTACK_INTERVAL,
    DODGE_CHANCE: AI_MOVEMENT.DODGE_CHANCE,
    DODGE_REACTION_TIME: AI_MOVEMENT.DODGE_REACTION_TIME,
    AIM_ERROR: 0,
    NEAR_BEST_FRACTION: AI_ATTACK.NEAR_BEST_FRACTION,
    DASH_CLOSE_DISTANCE: AI_MOVEMENT.DASH_CLOSE_DISTANCE,
    STRAFE_SPEED_FACTOR: AI_MOVEMENT.STRAFE_SPEED_FACTOR,
    REST_ENTER_FRACTION: AI_ENERGY.REST_ENTER_FRACTION,
  }
}

// Cada efeito entre a ponta fácil (`easy`, 0) e a difícil (`hard`, 1); o
// `level` fora de 0–1 fica limitado.
function interpolateTuning(hard, easy, level) {
  const t = Math.min(1, Math.max(0, level))
  const tuning = {}
  for (const key of Object.keys(hard)) {
    const from = easy[key] ?? hard[key]
    tuning[key] = from + (hard[key] - from) * t
  }
  return tuning
}

/** Os valores das selvagens no `level` (`WILD_DIFFICULTY`). */
export function resolveWildTuning(level = GAME_CONFIG.WILD_DIFFICULTY.LEVEL) {
  return interpolateTuning(
    resolveHardTuning('wild'),
    GAME_CONFIG.WILD_DIFFICULTY.EASY,
    level,
  )
}

/** Os valores do time no `level` (`PARTY_DIFFICULTY`). */
export function resolvePartyTuning(level = GAME_CONFIG.PARTY_DIFFICULTY.LEVEL) {
  return interpolateTuning(
    resolveHardTuning('party'),
    GAME_CONFIG.PARTY_DIFFICULTY.EASY,
    level,
  )
}

/**
 * Os valores da IA na luta para esta criatura, pelo lado: selvagem →
 * `resolveWildTuning`; qualquer outra (o time) → `resolvePartyTuning`.
 */
export function resolveAiTuning(entity) {
  return entity?.has?.(WildCreature)
    ? resolveWildTuning()
    : resolvePartyTuning()
}

/**
 * Direção da IA com o erro de mira: gira `direction` (horizontal) por um
 * ângulo sorteado em `±aimError` (rad). Sem erro, a própria direção.
 */
export function applyAimError(direction, aimError, rng) {
  if (!(aimError > 0)) return direction
  const angle = (rng() * 2 - 1) * aimError
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  return {
    x: direction.x * cos + direction.z * sin,
    y: direction.y ?? 0,
    z: -direction.x * sin + direction.z * cos,
  }
}
