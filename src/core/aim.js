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
 * o retículo no centro da tela representa — ver `tools/hud/Crosshair.jsx`;
 * a posição da câmera em si já vem corrigida por colisão, mesma correção
 * que a câmera renderizada usa, ver docstring de `computeAimRay` —
 * sem isso, em pitches extremos a mira partia de um ponto bem diferente
 * do que a câmera de fato mostrava na tela), limitado a `aimRange`; sem
 * nada no caminho dentro desse alcance, mira no ponto mais distante mesmo
 * (em vez de "infinito"). `excludeColliderHandle` (a cápsula de quem está
 * mirando) evita que o raio acerte a própria entidade — ele passa bem na
 * frente do próprio corpo, já que a câmera olha mais ou menos pra lá, e
 * também é usado na PRÓPRIA correção de colisão da câmera, pelo mesmo
 * motivo. `aimRange` vem de `getPlayerSpecies().actions.throw` — só o
 * treinador arremessa/invoca de verdade (`playerActionSystem.js`/
 * `partySummonSystem.js`, os únicos chamadores; uma `SummonedCreature`
 * nunca chega a usar isto), então resolver pela espécie fixa do jogador é
 * seguro aqui, não pela entidade que chamou.
 *
 * Sem câmera no world (não deveria acontecer no jogo real, só teoricamente
 * em teste isolado), cai num ponto "à frente" arbitrário.
 */
/**
 * Direção de mira pura (vetor unitário 3D, já respeitando a inclinação/
 * pitch da câmera, não só o giro horizontal) — mesmo raio de
 * `computeAimRay` que `resolveAimPoint` usa, mas sem o raycast contra o
 * mundo nem `aimRange` (config exclusiva do arremesso do treinador,
 * `getPlayerSpecies().actions.throw` — não faz sentido pra quem chama
 * isto). Pensada pra qualquer ação que só precise SABER pra onde a câmera
 * aponta, sem resolver um ponto de impacto contra obstáculos — hoje usada
 * pelo ataque comum de criatura (`creatureAttackSystem.js`,
 * docs/features/025-ataque-comum-de-criatura.md: alcance curto, sem
 * raycast contra o mundo nesta feature), mas serve pra qualquer skill
 * futura com a mesma necessidade (qualquer entidade, não só o treinador —
 * ao contrário de `resolveAimPoint`).
 *
 * Sem câmera no world (só em teste isolado), cai numa direção "pra
 * frente" arbitrária (+Z), mesmo fallback de `resolveAimPoint`.
 *
 * `targetHeight` (opcional, default do global em `computeAimRay` — ver
 * docstring lá) — pedido do usuário: "preciso que eu possa configurar o
 * posicionamento da câmera em relação ao modelo jogável, para cada
 * espécie" (docs/features/026-preparo-do-treinador-boy.md). Diferente de
 * `resolveAimPoint` (sempre o treinador), quem chama esta função pode ser
 * QUALQUER entidade controlada (`resolveAttackDirection`,
 * `core/battle/attackAim.js`) — cada chamador resolve a altura certa pra
 * SUA própria espécie (`species.camera.targetHeight`) e passa aqui, já
 * que esta função em si não sabe quem é `originPos`. `shoulderOffset`
 * segue a mesma regra (`species.camera.shoulderOffset`) — a mira tem que
 * usar o MESMO enquadramento que a câmera renderiza pra essa espécie
 * (`cameraFollowSystem.js`), senão a direção sai deslocada do que se vê.
 */
export function resolveAimDirection(
  world,
  originPos,
  excludeColliderHandle,
  targetHeight,
  shoulderOffset,
) {
  const cameraRig = world.queryFirst(OrbitCamera)
  if (!cameraRig) return { x: 0, y: 0, z: 1 }

  const orbit = cameraRig.get(OrbitCamera)
  return computeAimRay(
    originPos,
    orbit,
    excludeColliderHandle,
    targetHeight,
    shoulderOffset,
  ).direction
}

export function resolveAimPoint(world, playerPos, excludeColliderHandle) {
  const cameraRig = world.queryFirst(OrbitCamera)
  const playerSpecies = getPlayerSpecies()
  const { aimRange } = playerSpecies.actions.throw
  if (!cameraRig) {
    return { x: playerPos.x, y: playerPos.y, z: playerPos.z + aimRange }
  }

  const orbit = cameraRig.get(OrbitCamera)
  // Mira é exclusiva do treinador (ver docstring acima) — resolve a
  // ALTURA/desvio de ombro pela espécie FIXA do jogador
  // (`playerSpecies.camera`, com fallback pro default global em
  // `computeAimRay` se ausente), não pela entidade controlada agora.
  const { origin, direction } = computeAimRay(
    playerPos,
    orbit,
    excludeColliderHandle,
    playerSpecies.camera?.targetHeight,
    playerSpecies.camera?.shoulderOffset,
  )

  const hit = castRay(origin, direction, aimRange, { excludeColliderHandle })
  return hit
    ? hit.point
    : {
        x: origin.x + direction.x * aimRange,
        y: origin.y + direction.y * aimRange,
        z: origin.z + direction.z * aimRange,
      }
}

/**
 * Aproxima a posição da MÃO a partir de `Position`/`Rotation.y` do
 * jogador — usada tanto pra origem de uma trajetória (`playerActionSystem`,
 * arremesso) quanto pro ponto onde o objeto de fato nasce/é lançado (na
 * liberação, `effectAt` — arremesso E, desde docs/features/024-esfera-de-
 * invocar.md, a `SummonBall` também). O motor headless não tem acesso ao
 * osso de verdade (isso vive na view, ver `view/systems/
 * heldItemViewSystem.js`, que só cuida do visual do item encaixado no
 * osso — não afeta física nem trajetória) — esta é uma aproximação
 * geométrica: à frente do corpo (`handForwardOffset`) e à direita dele
 * (`handSideOffset`, mesma convenção de forward/right de
 * `computeCameraRight`/`movementSystem.js`), numa altura fixa
 * (`handHeightOffset`) acima de `Position` (que fica na base/pés do
 * personagem).
 *
 * `config` é `getPlayerSpecies().actions.throw`/`.summon` (config
 * exclusiva do treinador, ver docs/features/018-troca-de-controle-
 * treinador-criatura.md) — recebido como parâmetro em vez de resolvido
 * aqui dentro pra não repetir o lookup a cada chamada, e pra deixar quem
 * chama escolher qual ação (cada uma tem seus próprios
 * `handForwardOffset`/`handSideOffset`/`handHeightOffset`, podem divergir
 * — ex.: segurar uma esfera pra invocar pode "parecer" diferente de
 * segurar um item pra arremessar).
 */
export function resolveHandOrigin(pos, rotY, config) {
  const { handForwardOffset, handSideOffset, handHeightOffset } = config
  const forwardX = Math.sin(rotY)
  const forwardZ = Math.cos(rotY)
  const rightX = Math.cos(rotY)
  const rightZ = -Math.sin(rotY)

  return {
    x: pos.x + forwardX * handForwardOffset + rightX * handSideOffset,
    y: pos.y + handHeightOffset,
    z: pos.z + forwardZ * handForwardOffset + rightZ * handSideOffset,
  }
}
