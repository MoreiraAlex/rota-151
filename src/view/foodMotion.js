/**
 * Movimento da fruta sendo comida (docs/features/042-itens-da-beta.md) —
 * matemática pura, sem Three.js, usada pelo `eatingFoodViewSystem.js`.
 *
 * A cada MORDIDA a fruta achata (`squash` positivo) e volta numa mola pouco
 * amortecida: passa do ponto e estica um pouco (`squash` negativo) antes de
 * assentar — o "aperto" que dá vida à fruta parada. As mordidas vêm de um
 * relógio (`biteInterval`) e também quando o pedaço do modelo troca (a
 * fruta perdeu um pedaço de verdade).
 */

// Amortecimento da mola (fração do crítico): baixo pra balançar um pouco.
const DAMPING_RATIO = 0.35
// Maior passo (s) da integração da mola — um frame longo vira vários
// passos pequenos, senão a mola explode.
const MAX_SPRING_STEP = 1 / 120

/** Estado de movimento de uma fruta; `random` sorteia o giro dela no chão. */
export function createFoodMotion(interval, random = Math.random) {
  return {
    squash: 0,
    squashVelocity: 0,
    biteTimer: interval,
    stage: -1,
    yaw: random() * Math.PI * 2,
  }
}

/** Uma mordida: a fruta achata `amount` de uma vez. */
export function bite(motion, amount) {
  motion.squash = amount
  motion.squashVelocity = 0
}

/** Avança a mola `delta` segundos, com rigidez `stiffness`. */
export function stepSquash(motion, delta, stiffness) {
  const damping = 2 * DAMPING_RATIO * Math.sqrt(stiffness)
  const steps = Math.ceil(delta / MAX_SPRING_STEP)
  const dt = steps > 0 ? delta / steps : 0
  for (let i = 0; i < steps; i++) {
    const accel = -stiffness * motion.squash - damping * motion.squashVelocity
    motion.squashVelocity += accel * dt
    motion.squash += motion.squashVelocity * dt
  }
}

/**
 * Hora de morder? Sim quando o relógio zera (e ele recomeça) ou quando o
 * pedaço do modelo troca (`stage`, o índice visível — `-1` sem modelo). O
 * primeiro pedaço visto não conta (a fruta acabou de aparecer).
 */
export function shouldBite(motion, delta, interval, stage) {
  const stageChanged = motion.stage !== -1 && stage !== motion.stage
  motion.stage = stage
  motion.biteTimer -= delta
  if (motion.biteTimer > 0 && !stageChanged) return false
  motion.biteTimer = interval
  return true
}

/**
 * Escala da fruta pela mola: achatada fica mais baixa e mais larga, esticada
 * o contrário (volume mais ou menos constante). `[x, y, z]`.
 */
export function squashScale(squash) {
  const wide = 1 + squash * 0.5
  return [wide, 1 - squash, wide]
}
