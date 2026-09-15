import { GAME_CONFIG } from '../gameConfig'

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
 * Posição da câmera no mundo — o alvo (normalmente o jogador) + a altura de
 * mira + o deslocamento da órbita.
 */
export function computeCameraPosition(targetPosition, orbit) {
  const offset = computeOrbitOffset(orbit)
  const { TARGET_HEIGHT } = GAME_CONFIG.CAMERA

  return {
    x: targetPosition.x + offset.x,
    y: targetPosition.y + TARGET_HEIGHT + offset.y,
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
 */
export function computeLookAtPoint(targetPosition, orbit, aimBlend) {
  const { TARGET_HEIGHT, SHOULDER_OFFSET } = GAME_CONFIG.CAMERA
  const offset = SHOULDER_OFFSET * aimBlend
  const right = computeCameraRight(orbit.yaw)

  return {
    x: targetPosition.x + right.x * offset,
    y: targetPosition.y + TARGET_HEIGHT,
    z: targetPosition.z + right.z * offset,
  }
}

/**
 * Raio de mira: de onde a câmera está (`computeCameraPosition`, posição
 * instantânea, sem a suavização de `cameraFollowSystem` — não faz
 * diferença pro instante do disparo de uma ação) até onde ela de fato olha
 * com o desvio de ombro **completo** (`computeLookAtPoint` com
 * `aimBlend: 1`) — quem chama isto (`playerActionSystem`, ao disparar um
 * arremesso) só faz sentido enquanto `input.aiming` já está de verdade,
 * então a mira em si usa sempre o enquadramento final, não o que a câmera
 * pode estar exibindo no meio de uma transição suave ainda em andamento
 * (essa suavização é só visual, de `cameraFollowSystem` — não deve afetar
 * pra onde o objeto de fato vai).
 *
 * `targetPosition` é a posição do alvo (`Position` de quem a câmera segue,
 * normalmente o jogador) — a mesma câmera pode servir pra mirar a partir de
 * qualquer entidade-alvo, não só o jogador padrão.
 */
export function computeAimRay(targetPosition, orbit) {
  const origin = computeCameraPosition(targetPosition, orbit)
  const lookAt = computeLookAtPoint(targetPosition, orbit, 1)

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
