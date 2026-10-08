import { GAME_CONFIG } from '../gameConfig'

/**
 * Chance de captura (docs/features/043-captura.md), no estilo Gen 3:
 *
 *   a = ((3 × hpMax − 2 × hp) × taxa × bola) ÷ (3 × hpMax) × condição × costas
 *
 * - `taxa`: `species.capture.rate` (escala 0-255 da série; maior = mais fácil),
 *   ou `CAPTURE.DEFAULT_RATE`;
 * - `bola`: `item.pokeball.captureMultiplier`;
 * - `condição`: `CAPTURE.CONDITION_BONUS` da condição que ele tem (a maior);
 * - `costas`: `CAPTURE.BACK_STRIKE_BONUS` no acerto pelas costas.
 *
 * Desmaiado conta como HP 0 (o fator de HP no máximo). Com `a` no teto
 * (`MAX_CAPTURE_VALUE`), captura direto; senão cada balançada passa com a
 * chance `(a ÷ teto)^(1/4)` — a forma contínua do `b = 65536 ÷ (255 ÷ a)^¼`
 * da série.
 */

/** Taxa de captura da espécie (0-255). */
export function resolveSpeciesCaptureRate(species) {
  return species?.capture?.rate ?? GAME_CONFIG.CAPTURE.DEFAULT_RATE
}

/** Multiplicador da bola (`item.pokeball.captureMultiplier`, ou 1). */
export function resolveBallMultiplier(item) {
  return item?.pokeball?.captureMultiplier ?? 1
}

/**
 * Bônus da condição: o maior entre as condições ativas (`conditions`, lista
 * de ids, ex.: `['burn']`); sem condição, 1.
 */
export function resolveConditionBonus(conditions = []) {
  const bonuses = GAME_CONFIG.CAPTURE.CONDITION_BONUS
  return conditions.reduce(
    (best, condition) => Math.max(best, bonuses[condition] ?? 1),
    1,
  )
}

/**
 * O valor `a` da fórmula. `hp` já vem 0 pra quem está desmaiado. Nunca
 * negativo; sem vida máxima, trata como HP 0.
 */
export function resolveCaptureValue({
  hp,
  maxHp,
  rate,
  ballMultiplier = 1,
  conditionBonus = 1,
  backStrikeBonus = 1,
}) {
  const safeMax = maxHp > 0 ? maxHp : 1
  const safeHp = maxHp > 0 ? Math.min(Math.max(hp, 0), maxHp) : 0
  const hpFactor = (3 * safeMax - 2 * safeHp) / (3 * safeMax)
  return Math.max(
    0,
    hpFactor * rate * ballMultiplier * conditionBonus * backStrikeBonus,
  )
}

/** Chance (0-1) de UMA balançada passar, a partir do valor `a`. */
export function resolveShakeChance(captureValue) {
  const max = GAME_CONFIG.CAPTURE.MAX_CAPTURE_VALUE
  if (captureValue >= max) return 1
  if (captureValue <= 0) return 0
  return Math.pow(captureValue / max, 0.25)
}

/** Sorteia uma balançada (`rng` de fora — regra 3.5): passou? */
export function rollShake(rng, chance) {
  if (chance >= 1) return true
  return rng() < chance
}

/** Chance (0-1) de capturar no fim de todas as balançadas. */
export function resolveCaptureChance(shakeChance, shakeCount) {
  return Math.pow(shakeChance, shakeCount)
}

/**
 * Acerto pelas costas: o selvagem não percebeu o treinador (`unaware`) e a
 * bola veio de trás — o ângulo entre a frente dele (`facingY`, `Rotation.y`)
 * e a direção de onde ela veio (de `ballVelocity` ao contrário, no plano)
 * passa de `CAPTURE.BACK_STRIKE_ANGLE`.
 */
export function isBackStrike({ unaware, facingY, ballVelocity }) {
  if (!unaware) return false
  const speed = Math.hypot(ballVelocity.x, ballVelocity.z)
  if (speed === 0) return false

  // De onde a bola veio = o contrário da velocidade dela.
  const fromX = -ballVelocity.x / speed
  const fromZ = -ballVelocity.z / speed
  const facingX = Math.sin(facingY)
  const facingZ = Math.cos(facingY)
  const cos = Math.min(1, Math.max(-1, fromX * facingX + fromZ * facingZ))
  const angle = (Math.acos(cos) * 180) / Math.PI
  return angle > GAME_CONFIG.CAPTURE.BACK_STRIKE_ANGLE
}
