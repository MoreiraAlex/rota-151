// Abaixo disso (m/s, no plano) conta como parado — sem linha.
const MOVING_MIN_SPEED = 0.05

/**
 * Pontos da polilinha de debug de UM personagem (`PathfindingDebugView.jsx`):
 * da posição dele até cada waypoint restante (`waypoints.slice(
 * waypointIndex)`) ou, sem waypoint sobrando (caminho reto, ou já passou
 * do último), direto até o destino que a navegação está usando
 * (`PathState.target`, gravado por quem navega). Parado ou sem destino:
 * `[]` — nada é desenhado, em vez de um caminho velho ou um alvo
 * adivinhado.
 *
 * O destino não tem altura própria (`{x, z}`): usa a do último ponto.
 */
export function resolvePathDebugPoints(pos, path, vel) {
  if (!path?.target) return []
  if (Math.hypot(vel.x, vel.z) < MOVING_MIN_SPEED) return []

  const remaining = path.waypoints.slice(path.waypointIndex)
  if (remaining.length > 0) return [pos, ...remaining]
  return [pos, { x: path.target.x, y: pos.y, z: path.target.z }]
}
