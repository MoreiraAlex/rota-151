import { GAME_CONFIG } from '../gameConfig'
import { castRay } from '../physics/raycast'

/**
 * Deslocamento da câmera em relação ao ponto que ela orbita, a partir de
 * `OrbitCamera` (`yaw`/`pitch`/`distance`) — a mesma fórmula usada tanto
 * pra posicionar a câmera 3D de verdade
 * (`view/systems/cameraFollowSystem.js`) quanto pra computar a mira sem
 * tocar a câmera Three (`computeAimRay`, abaixo — headless, roda dentro de
 * `playerActionSystem`). Fica em `core/` pra não duplicar/divergir a
 * fórmula entre as duas pontas.
 *
 * O vetor tem módulo igual a `orbit.distance` (`sin²+cos²=1` nos dois
 * ângulos).
 */
export function computeOrbitOffset(orbit) {
  const cosPitch = Math.cos(orbit.pitch)
  return {
    x: Math.sin(orbit.yaw) * cosPitch * orbit.distance,
    y: Math.sin(orbit.pitch) * orbit.distance,
    z: Math.cos(orbit.yaw) * cosPitch * orbit.distance,
  }
}

/**
 * Vetor "direita da câmera" no plano horizontal, a partir só do yaw (pitch
 * de propósito ignorado — sem isso o deslocamento de ombro, abaixo,
 * balançaria verticalmente conforme se olha pra cima/baixo, o que não faz
 * sentido pra um enquadramento sobre o ombro). Convenção: yaw=0 olha pra
 * -Z (ver `core/systems/movementSystem.js`), então direita é +X — bate com
 * `forward × up` pra um sistema destro Y-up. Exportado porque
 * `cameraFollowSystem.js` também usa (desvio de ombro aplicado na POSIÇÃO
 * da câmera enquanto travado, não em pra onde ela olha — ver docstring lá).
 */
export function computeCameraRight(yaw) {
  return { x: Math.cos(yaw), y: 0, z: -Math.sin(yaw) }
}

/**
 * Vetor "pra onde a câmera olha" (unitário, 3D completo — já com o
 * pitch), a partir só de `orbit.yaw`/`pitch`: o oposto do deslocamento
 * ALVO→CÂMERA (`computeOrbitOffset`, que tem módulo `orbit.distance` —
 * câmera fica atrás do alvo nessa direção, então olhar pra frente é o
 * inverso dela, normalizado). Usado pra câmera em PRIMEIRA pessoa
 * (`view/systems/cameraFollowSystem.js`, modo scanner — ver
 * docs/features/031-*.md): sem `orbit.distance`/desvio de ombro
 * nenhum, só "de onde estão os olhos, pra onde eles olham".
 */
export function computeOrbitForward(orbit) {
  const cosPitch = Math.cos(orbit.pitch)
  return {
    x: -Math.sin(orbit.yaw) * cosPitch,
    y: -Math.sin(orbit.pitch),
    z: -Math.cos(orbit.yaw) * cosPitch,
  }
}

/**
 * Posição da câmera no mundo — o alvo (normalmente o jogador) + a altura de
 * mira + o deslocamento da órbita.
 *
 * `targetHeight` (opcional, default `GAME_CONFIG.CAMERA.TARGET_HEIGHT`) —
 * pedido do usuário: "preciso que eu possa configurar o posicionamento da
 * câmera em relação ao modelo jogável, para cada espécie, pois em tese
 * vou poder controlar todas" (docs/features/026-preparo-do-treinador-boy.md).
 * Recebido como PARÂMETRO em vez de lido daqui dentro — quem chama
 * (`cameraFollowSystem.js`/`computeAimRay` abaixo) resolve o valor certo
 * pra espécie de quem está sendo seguido/mirado (`species.camera.
 * targetHeight`, com fallback pro default global): esta função em si é
 * geometria pura, não sabe (nem precisa saber) QUEM está sendo
 * posicionado — resolver a espécie certa depende de contexto que varia
 * por chamador (câmera segue o `CameraTarget` genérico; mira é sempre do
 * treinador), então fica fora daqui, um nível acima.
 */
export function computeCameraPosition(
  targetPosition,
  orbit,
  targetHeight = GAME_CONFIG.CAMERA.TARGET_HEIGHT,
) {
  const offset = computeOrbitOffset(orbit)

  return {
    x: targetPosition.x + offset.x,
    y: targetPosition.y + targetHeight + offset.y,
    z: targetPosition.z + offset.z,
  }
}

/**
 * Ponto que a câmera de fato olha (`camera.lookAt`, em
 * `cameraFollowSystem`) — o alvo, deslocado lateralmente
 * (`SHOULDER_OFFSET`, no plano horizontal, via `computeCameraRight`) na
 * proporção de `aimBlend` (0 a 1: 0 = olha direto pro alvo, sem desvio
 * nenhum — enquadramento centrado de sempre; 1 = desvio de ombro completo,
 * pra tirar o próprio personagem de cima do centro da tela, onde fica o
 * retículo). `aimBlend` é um valor JÁ suavizado por quem chama
 * (`cameraFollowSystem`, que interpola em direção a 0/1 conforme o botão
 * direito é segurado ou solto — ver docs/features/016-mira-e-arremesso.md)
 * — esta função em si é sempre instantânea/pura, não sabe nada de tempo.
 * Câmera continua orbitando o jogador de verdade (`computeCameraPosition`
 * não muda); só o ponto que ela mira é que sai do centro do corpo, "sobre
 * o ombro" — enquadramento padrão de jogo de ação em terceira pessoa ao
 * mirar.
 *
 * `targetHeight`/`shoulderOffset` (opcionais, default pros globais de
 * `GAME_CONFIG.CAMERA`) — mesmo raciocínio de `computeCameraPosition`
 * acima (docs/features/026-preparo-do-treinador-boy.md): recebidos como
 * parâmetro, resolvidos por espécie por quem chama.
 */
export function computeLookAtPoint(
  targetPosition,
  orbit,
  aimBlend,
  targetHeight = GAME_CONFIG.CAMERA.TARGET_HEIGHT,
  shoulderOffset = GAME_CONFIG.CAMERA.SHOULDER_OFFSET,
) {
  const offset = shoulderOffset * aimBlend
  const right = computeCameraRight(orbit.yaw)

  return {
    x: targetPosition.x + right.x * offset,
    y: targetPosition.y + targetHeight,
    z: targetPosition.z + right.z * offset,
  }
}

/**
 * Ajusta `uncollided` (posição desejada da câmera, sem colisão) pra logo
 * antes de qualquer coisa (parede/obstáculo/chão) no caminho entre
 * `pivot` e ela — em vez de atravessar. `COLLISION_MARGIN` é a folga (m)
 * mantida antes da superfície; `MIN_DISTANCE_AFTER_COLLISION` é o piso de
 * quão perto do pivô a câmera pode chegar. Sem física pronta ainda
 * (`castRay` devolve `null`) ou sem nada no caminho, devolve `uncollided`
 * sem alteração.
 *
 * Compartilhado por `cameraFollowSystem.js` (posição de RENDER da câmera
 * de verdade) e `computeAimRay` (abaixo — sem essa correção aqui, a mira
 * calculava a partir da posição IDEAL da câmera, que em pitches extremos
 * podia ficar dentro do chão/parede — bem diferente da posição que
 * `cameraFollowSystem.js` de fato usa pra renderizar depois de corrigida.
 * Bug real, relatado jogando: olhando bem pra cima/baixo, o arremesso
 * saía numa direção sem relação nenhuma com pra onde a câmera renderizada
 * estava de fato apontando).
 */
export function resolveCameraCollision(
  pivot,
  uncollided,
  excludeColliderHandle,
  { COLLISION_MARGIN, MIN_DISTANCE_AFTER_COLLISION },
) {
  const toDesired = {
    x: uncollided.x - pivot.x,
    y: uncollided.y - pivot.y,
    z: uncollided.z - pivot.z,
  }
  const desiredDistance = Math.hypot(toDesired.x, toDesired.y, toDesired.z)
  if (desiredDistance === 0) return uncollided

  const direction = {
    x: toDesired.x / desiredDistance,
    y: toDesired.y / desiredDistance,
    z: toDesired.z / desiredDistance,
  }

  const hit = castRay(pivot, direction, desiredDistance, {
    excludeColliderHandle,
  })
  if (!hit) return uncollided

  const distance = Math.max(
    MIN_DISTANCE_AFTER_COLLISION,
    hit.distance - COLLISION_MARGIN,
  )
  return {
    x: pivot.x + direction.x * distance,
    y: pivot.y + direction.y * distance,
    z: pivot.z + direction.z * distance,
  }
}

/**
 * Raio de mira: de onde a câmera está de VERDADE (`computeCameraPosition`,
 * já corrigida por colisão via `resolveCameraCollision` — mesma correção
 * que `cameraFollowSystem.js` aplica pra render, ver docstring dela pro
 * porquê; posição instantânea, sem a suavização de posição/lookAt de
 * `cameraFollowSystem` — não faz diferença pro instante do disparo de uma
 * ação) até onde ela de fato olha com o desvio de ombro **completo**
 * (`computeLookAtPoint` com `aimBlend: 1`) — quem chama isto
 * (`playerActionSystem`, ao disparar um arremesso; `partySummonSystem`,
 * ao disparar a esfera de invocar) só faz sentido enquanto a mira já vale
 * de verdade, então usa sempre o enquadramento final, não o que a câmera
 * pode estar exibindo no meio de uma transição suave ainda em andamento
 * (essa suavização de aimBlend é só visual, de `cameraFollowSystem` — não
 * deve afetar pra onde o objeto de fato vai).
 *
 * `targetPosition` é a posição do alvo (`Position` de quem a câmera segue,
 * normalmente o jogador) — a mesma câmera pode servir pra mirar a partir de
 * qualquer entidade-alvo, não só o jogador padrão. `excludeColliderHandle`
 * (opcional — a cápsula do próprio alvo) evita que a correção de colisão
 * da câmera se autoacerte contra o próprio corpo de quem ela segue, mesmo
 * raciocínio de `cameraFollowSystem.js`.
 *
 * `targetHeight`/`shoulderOffset` (opcionais, default pros globais de
 * `GAME_CONFIG.CAMERA`) — mesmo raciocínio de `computeCameraPosition`/
 * `computeLookAtPoint` acima (docs/features/026-preparo-do-treinador-boy.md):
 * repassados pros dois, resolvidos por espécie por quem chama
 * (`resolveAimDirection`/`resolveAimPoint`, `core/aim.js`).
 */
export function computeAimRay(
  targetPosition,
  orbit,
  excludeColliderHandle,
  targetHeight = GAME_CONFIG.CAMERA.TARGET_HEIGHT,
  shoulderOffset = GAME_CONFIG.CAMERA.SHOULDER_OFFSET,
) {
  const { COLLISION_MARGIN, MIN_DISTANCE_AFTER_COLLISION } = GAME_CONFIG.CAMERA
  const pivot = {
    x: targetPosition.x,
    y: targetPosition.y + targetHeight,
    z: targetPosition.z,
  }
  const uncollidedOrigin = computeCameraPosition(
    targetPosition,
    orbit,
    targetHeight,
  )
  const origin = resolveCameraCollision(
    pivot,
    uncollidedOrigin,
    excludeColliderHandle,
    { COLLISION_MARGIN, MIN_DISTANCE_AFTER_COLLISION },
  )
  const lookAt = computeLookAtPoint(
    targetPosition,
    orbit,
    1,
    targetHeight,
    shoulderOffset,
  )

  const toLookAt = {
    x: lookAt.x - origin.x,
    y: lookAt.y - origin.y,
    z: lookAt.z - origin.z,
  }
  const length = Math.hypot(toLookAt.x, toLookAt.y, toLookAt.z)

  return {
    origin,
    direction: {
      x: toLookAt.x / length,
      y: toLookAt.y / length,
      z: toLookAt.z / length,
    },
  }
}
