/**
 * Marolinhas dos passos no raso (docs/features/057-lagos-e-rios.md): um
 * rodízio fixo de anéis na superfície, que `footstepAudioSystem.js` acende
 * a cada passo na água e `FootRipplesView.jsx` desenha crescendo e
 * sumindo. Estado de tela (não é do jogo).
 */
export const FOOT_RIPPLE_COUNT = 32

const ripples = Array.from({ length: FOOT_RIPPLE_COUNT }, () => ({
  x: 0,
  y: 0,
  z: 0,
  age: Infinity,
  size: 1,
}))
let next = 0

/** Uma marolinha nova em `(x, y, z)` (`y` = a superfície). */
export function addFootRipple(x, y, z, size = 1) {
  const ripple = ripples[next]
  next = (next + 1) % FOOT_RIPPLE_COUNT
  ripple.x = x
  ripple.y = y
  ripple.z = z
  ripple.size = size
  ripple.age = 0
}

/** As marolinhas (o mesmo array; `age` infinita = apagada). */
export function getFootRipples() {
  return ripples
}
