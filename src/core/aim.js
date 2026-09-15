import { GAME_CONFIG } from './gameConfig'
import { computeAimRay } from './camera/orbitCamera'
import { castRay } from './physics/raycast'
import { OrbitCamera } from './traits'

/**
 * Ponto de mira: raio a partir da câmera (`computeAimRay`, na direção que
 * o retículo no centro da tela representa — ver `tools/hud/Crosshair.jsx`),
 * limitado a `AIM_RANGE`; sem nada no caminho dentro desse alcance, mira no
 * ponto mais distante mesmo (em vez de "infinito"). `excludeColliderHandle`
 * (a cápsula de quem está mirando) evita que o raio acerte a própria
 * entidade — ele passa bem na frente do próprio corpo, já que a câmera
 * olha mais ou menos pra lá.
 *
 * Compartilhado entre `playerActionSystem` (mira do arremesso) e
 * `aimAnchorSystem` (ponto de referência pra orbitar ao mirar — ver
 * docs/features/016-mira-e-arremesso.md) — os dois precisam exatamente do
 * mesmo ponto, então é uma função só, não duas contas que podem divergir.
 *
 * Sem câmera no world (não deveria acontecer no jogo real, só teoricamente
 * em teste isolado), cai num ponto "à frente" arbitrário.
 */
export function resolveAimPoint(world, playerPos, excludeColliderHandle) {
  const cameraRig = world.queryFirst(OrbitCamera)
  const { AIM_RANGE } = GAME_CONFIG.PLAYER_ACTIONS.throw
  if (!cameraRig) {
    return { x: playerPos.x, y: playerPos.y, z: playerPos.z + AIM_RANGE }
  }

  const orbit = cameraRig.get(OrbitCamera)
  const { origin, direction } = computeAimRay(playerPos, orbit)

  const hit = castRay(origin, direction, AIM_RANGE, { excludeColliderHandle })
  return hit
    ? hit.point
    : {
        x: origin.x + direction.x * AIM_RANGE,
        y: origin.y + direction.y * AIM_RANGE,
        z: origin.z + direction.z * AIM_RANGE,
      }
}
