import { computeAimRay } from './camera/orbitCamera'
import { castRay } from './physics/raycast'
import { wrapAngle } from './math'
import { getPlayerSpecies } from './data/species'
import { OrbitCamera } from './traits'

/**
 * Yaw da direção que a câmera está de fato MOSTRANDO na tela (o que o
 * retículo aponta), no plano horizontal — não `orbit.yaw` cru.
 * `orbit.yaw` é o ângulo do vetor ALVO→CÂMERA (onde a câmera fica
 * posicionada, atrás do alvo — ver `computeOrbitOffset`), então olhar na
 * direção que a câmera de fato mostra é o OPOSTO disso (`+ π`) — usar
 * `orbit.yaw` direto aqui apontaria pra trás da câmera, não pra frente
 * dela (bug real: a criatura nascia atrás do campo de visão). Mesma
 * relação que já vale em `movementSystem.js`: mover "pra frente"
 * (`input.z = -1`) desloca em `(-sin(yaw), -cos(yaw))`, e girar pra essa
 * direção resultante dá `yaw + π`, não `yaw`.
 *
 * Compartilhado por qualquer ação que precise virar o jogador (ou
 * posicionar algo) na direção que a câmera mostra, não na direção que o
 * corpo já estava encarando (`Rotation.y`) — ver `partySummonSystem.js`
 * (invocar/recolher criatura, docs/features/017-locomocao-e-
 * recolhimento-de-criaturas.md). Sem câmera no world (só em teste
 * isolado), cai em `0`.
 */
export function resolveCameraYaw(world) {
  const cameraRig = world.queryFirst(OrbitCamera)
  if (!cameraRig) return 0
  return wrapAngle(cameraRig.get(OrbitCamera).yaw + Math.PI)
}

/**
 * Ponto de mira: raio a partir da câmera (`computeAimRay`, na direção que
 * o retículo no centro da tela representa — ver `tools/hud/Crosshair.jsx`),
 * limitado a `aimRange`; sem nada no caminho dentro desse alcance, mira no
 * ponto mais distante mesmo (em vez de "infinito"). `excludeColliderHandle`
 * (a cápsula de quem está mirando) evita que o raio acerte a própria
 * entidade — ele passa bem na frente do próprio corpo, já que a câmera
 * olha mais ou menos pra lá. `aimRange` vem de `getPlayerSpecies().
 * actions.throw` — mirar só existe pro treinador (`aimAnchorSystem.js`
 * bloqueia explicitamente pra qualquer `SummonedCreature`, mesmo
 * controlada — ver docs/features/018-troca-de-controle-treinador-
 * criatura.md), então resolver pela espécie fixa do jogador é seguro
 * aqui, não pela entidade que chamou.
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
  const { aimRange } = getPlayerSpecies().actions.throw
  if (!cameraRig) {
    return { x: playerPos.x, y: playerPos.y, z: playerPos.z + aimRange }
  }

  const orbit = cameraRig.get(OrbitCamera)
  const { origin, direction } = computeAimRay(playerPos, orbit)

  const hit = castRay(origin, direction, aimRange, { excludeColliderHandle })
  return hit
    ? hit.point
    : {
        x: origin.x + direction.x * aimRange,
        y: origin.y + direction.y * aimRange,
        z: origin.z + direction.z * aimRange,
      }
}
