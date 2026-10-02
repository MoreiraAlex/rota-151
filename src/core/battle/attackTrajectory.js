import { castRay } from '../physics/raycast'
import { GAME_CONFIG } from '../gameConfig'
import { resolveGroundY } from './attackGeometry'

// Folga (m) da sonda de terreno — começa um pouco acima do maior degrau
// aceito, pra um degrau exatamente no limite ainda ser encontrado.
const GROUND_PROBE_MARGIN = 0.01

function castSegment(from, to, excludeColliderHandle, terrainOnly = false) {
  const delta = { x: to.x - from.x, y: to.y - from.y, z: to.z - from.z }
  const length = Math.hypot(delta.x, delta.y, delta.z)
  if (length < 1e-6) return null

  const hit = castRay(
    from,
    { x: delta.x / length, y: delta.y / length, z: delta.z / length },
    length,
    { excludeColliderHandle, terrainOnly },
  )
  return hit?.point ?? null
}

/**
 * Onde a trajetória do golpe termina — combate 2.5D: o golpe anda
 * `range` metros na HORIZONTAL (componente Y de `direction` é ignorado)
 * mantendo a MESMA altura acima do terreno que a origem tem. Amostra o
 * terreno a cada `ATTACK_PATH_SAMPLE_STEP`:
 *
 * - rampa/terreno suave: o golpe acompanha (não bate no próprio chão
 *   subindo uma rampa);
 * - desnível maior que `PATHFINDING.MAX_CLIMB_STEP` (subindo OU
 *   descendo — borda de terraço, penhasco): o golpe para antes dele,
 *   mesmo critério de "intransponível" do pathfinding;
 * - parede/obstáculo/corpo entre duas amostras: raycast entre elas, o
 *   golpe para no ponto de contato (um `range` grande não atravessa nada).
 *
 * Sem física carregada ou sem chão sob a origem: segue reto na horizontal,
 * parando no primeiro obstáculo (fallback gracioso, cobre testes headless).
 *
 * `terrainOnly`: só a geometria fixa do nível para a trajetória — corpo de
 * criatura no caminho NÃO. É o caso do ataque canalizado (o leque pega
 * todo mundo dentro dele, inclusive quem está atrás de outro).
 */
export function resolveAttackImpactPoint(
  origin,
  direction,
  range,
  excludeColliderHandle,
  { terrainOnly = false } = {},
) {
  const { ATTACK_PATH_SAMPLE_STEP, GROUND_PROBE_DISTANCE } = GAME_CONFIG.BATTLE
  const { MAX_CLIMB_STEP } = GAME_CONFIG.PATHFINDING
  const flatLength = Math.hypot(direction.x, direction.z)
  const dirX = direction.x / flatLength
  const dirZ = direction.z / flatLength

  const originGround = resolveGroundY(
    origin.x,
    origin.y,
    origin.z,
    GROUND_PROBE_DISTANCE,
  )
  if (originGround === null) {
    const flatEnd = {
      x: origin.x + dirX * range,
      y: origin.y,
      z: origin.z + dirZ * range,
    }
    return (
      castSegment(origin, flatEnd, excludeColliderHandle, terrainOnly) ??
      flatEnd
    )
  }

  const heightAboveGround = origin.y - originGround
  const probeHeight = MAX_CLIMB_STEP + GROUND_PROBE_MARGIN
  let previous = origin
  let previousGround = originGround
  let travelled = 0

  while (travelled < range) {
    travelled = Math.min(travelled + ATTACK_PATH_SAMPLE_STEP, range)
    const x = origin.x + dirX * travelled
    const z = origin.z + dirZ * travelled
    // Sonda de `previousGround + probeHeight` até `previousGround -
    // probeHeight`: terreno subindo além disso começa DENTRO do
    // obstáculo (volta o próprio início → desnível); descendo além disso
    // não acha nada (`null` → desnível).
    const ground = resolveGroundY(
      x,
      previousGround + probeHeight,
      z,
      2 * probeHeight,
    )
    if (ground === null || Math.abs(ground - previousGround) > MAX_CLIMB_STEP) {
      // Desnível entre esta amostra e a anterior: se for uma parede/
      // borda subindo, um raio reto acha a face exata; descendo, não há
      // nada na frente e o golpe para na última amostra antes da borda.
      // A folga cobre a face caindo exatamente em cima da amostra.
      const flatNext = {
        x: x + dirX * GROUND_PROBE_MARGIN,
        y: previous.y,
        z: z + dirZ * GROUND_PROBE_MARGIN,
      }
      return (
        castSegment(previous, flatNext, excludeColliderHandle, terrainOnly) ??
        previous
      )
    }

    const next = { x, y: ground + heightAboveGround, z }
    const hit = castSegment(previous, next, excludeColliderHandle, terrainOnly)
    if (hit) return hit

    previous = next
    previousGround = ground
  }

  return previous
}
