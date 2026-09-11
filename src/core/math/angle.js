const TWO_PI = Math.PI * 2

/**
 * Normaliza um ângulo (radianos) para o intervalo (-π, π].
 */
export function wrapAngle(angle) {
  let a = angle % TWO_PI
  if (a > Math.PI) a -= TWO_PI
  if (a < -Math.PI) a += TWO_PI
  return a
}

/**
 * Interpola de `current` para `target` (ângulos em radianos) pelo caminho mais
 * curto. `t` é o fator de interpolação, fixado em [0, 1].
 */
export function lerpAngle(current, target, t) {
  const delta = wrapAngle(target - current)
  return current + delta * Math.min(1, Math.max(0, t))
}
