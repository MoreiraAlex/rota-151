import { GAME_CONFIG } from '../gameConfig'
import { WildCreature } from '../traits'

/**
 * Os valores da IA na luta que a dificuldade das selvagens mexe
 * (`GAME_CONFIG.WILD_DIFFICULTY`, docs/features/063-revisao-da-ia-selvagem.md),
 * na ponta difícil: os de hoje, lidos dos campos de origem — os mesmos que a
 * IA do time usa.
 */
export function resolveHardTuning() {
  const { AI_MOVEMENT, AI_ATTACK, AI_ENERGY, WILD_BEHAVIOR } = GAME_CONFIG
  return {
    ATTACK_INTERVAL: WILD_BEHAVIOR.ATTACK_INTERVAL,
    DODGE_CHANCE: AI_MOVEMENT.DODGE_CHANCE,
    DODGE_REACTION_TIME: AI_MOVEMENT.DODGE_REACTION_TIME,
    AIM_ERROR: 0,
    NEAR_BEST_FRACTION: AI_ATTACK.NEAR_BEST_FRACTION,
    DASH_CLOSE_DISTANCE: AI_MOVEMENT.DASH_CLOSE_DISTANCE,
    STRAFE_SPEED_FACTOR: AI_MOVEMENT.STRAFE_SPEED_FACTOR,
    REST_ENTER_FRACTION: AI_ENERGY.REST_ENTER_FRACTION,
  }
}

/**
 * Os valores das selvagens no `level` de dificuldade (0 = `EASY`, 1 = a
 * ponta difícil; fora disso, limitado), interpolando cada efeito.
 */
export function resolveWildTuning(level = GAME_CONFIG.WILD_DIFFICULTY.LEVEL) {
  const t = Math.min(1, Math.max(0, level))
  const hard = resolveHardTuning()
  const easy = GAME_CONFIG.WILD_DIFFICULTY.EASY
  const tuning = {}
  for (const key of Object.keys(hard)) {
    const from = easy[key] ?? hard[key]
    tuning[key] = from + (hard[key] - from) * t
  }
  return tuning
}

/**
 * Os valores da IA na luta para esta criatura: selvagem → pela dificuldade
 * (`resolveWildTuning`); qualquer outra (o time) → os de hoje.
 */
export function resolveAiTuning(entity) {
  return entity?.has?.(WildCreature) ? resolveWildTuning() : resolveHardTuning()
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
