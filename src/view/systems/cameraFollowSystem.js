import { GAME_CONFIG } from '@/core/gameConfig'
import {
  computeCameraPosition,
  computeCameraRight,
  computeLookAtPoint,
  resolveCameraCollision,
} from '@/core/camera/orbitCamera'
import {
  Position,
  OrbitCamera,
  CameraTarget,
  PhysicsBody,
  AimAnchor,
} from '@/core/traits'

/**
 * Posiciona a câmera Three a partir da órbita (OrbitCamera) em torno da
 * entidade CameraTarget, com suavização. Vive na view porque dirige a câmera.
 *
 * Lock-on estilo Zelda (Z-target/Ocarina of Time — ver
 * docs/features/016-mira-e-arremesso.md): com um `AimAnchor` travado (ver
 * `aimAnchorSystem.js`), o `yaw` E o `pitch` usados pra POSICIONAR a câmera
 * deixam de vir do mouse (`orbit.yaw`/`pitch`) e passam a ser calculados a
 * cada frame a partir do vetor 3D completo do alvo travado pro "olho" do
 * jogador (`pos` + `TARGET_HEIGHT`) — ou seja, a câmera se posiciona sempre
 * do lado OPOSTO ao alvo ao longo dessa mesma reta (não só no plano
 * horizontal), na distância `orbit.distance`. `cameraControlSystem.js`
 * para de aplicar deltas de mouse no `orbit.yaw`/`pitch` de verdade
 * enquanto mirando (fica congelado, pronto pra retomar o giro livre assim
 * que soltar). Chegou a se tentar câmera livre (mouse controlando sempre,
 * ponto de foco acompanhando — rodadas 14–15) — revertido a pedido do
 * usuário de volta pro lock-on, enquanto essa proposta é reformulada.
 *
 * Desvio de ombro (`SHOULDER_OFFSET`) enquanto travado: desloca só a
 * POSIÇÃO da câmera pro lado (`computeCameraRight`), nunca pra ONDE ela
 * olha — a câmera continua olhando direto pro `AimAnchor` (ver abaixo),
 * então o retículo (fixo no centro da tela, `tools/hud/Crosshair.jsx`)
 * sempre corresponde exatamente ao ponto travado, não importa o quanto a
 * câmera se deslocou pro lado — é assim que o arremesso
 * (`playerActionSystem.js`, mira direto no `AimAnchor`) sempre bate com o
 * que o retículo mostra. (Uma tentativa anterior deslocava pra ONDE a
 * câmera olhava em vez da posição — quebrava essa garantia: o retículo
 * passava a mostrar um ponto ao lado do alvo, não o alvo em si, e dava um
 * "coice" na câmera ao entrar na mira, já que o alvo do olhar pulava
 * instantaneamente ao ligar o desvio, sem suavização nenhuma. Deslocar só
 * a posição evita os dois problemas de uma vez: a suavização já existente
 * da posição da câmera, abaixo, também suaviza a entrada do desvio de
 * ombro, e olhar direto pro `AimAnchor` garante precisão sempre,
 * independente de onde a câmera esteja.)
 *
 * Colisão da órbita (docs/backlog.md → "Câmera orbital com colisão"):
 * `resolveCameraCollision` (`core/camera/orbitCamera.js`, compartilhada —
 * ver docstring dela) ajusta a posição desejada da câmera (já com o
 * desvio de ombro somado, se travado) antes de aplicar a suavização.
 * Exclui a própria cápsula do alvo (`PhysicsBody.colliderHandle`) — sem
 * isso, o raio (que nasce dentro/perto do próprio corpo) se autoacertaria
 * sempre. A MESMA correção agora também entra em `computeAimRay`
 * (`core/aim.js`'s `resolveAimPoint`) — sem isso, a mira do arremesso/da
 * esfera de invocar (docs/features/016/024) partia da posição IDEAL
 * (não-colidida) da câmera, que podia divergir bastante da posição
 * renderizada de verdade em pitches extremos (câmera "afundada" no chão/
 * parede) — bug real, relatado jogando.
 *
 * Transição suave do enquadramento de mira (`aimBlend`, restaurada — essa
 * suavização já existiu na rodada 4, foi perdida no meio das reformas de
 * lock-on e voltou a pedido do usuário): `camera.lookAt` seta a rotação
 * de forma absoluta, então trocar de "olhar pro jogador" pra "olhar pro
 * `AimAnchor`" instantaneamente dá um salto perceptível. `aimBlend` (0 a
 * 1) desliza em direção a 1 enquanto travado e 0 enquanto livre, num
 * `let` de módulo (estado de TELA, não de jogo — não precisa virar trait,
 * só existe uma câmera de verdade), com o mesmo formato de suavização já
 * usado pra posição (`AIM_BLEND_SMOOTHING`, próprio ritmo, separado de
 * `SMOOTHING`). O ponto que a câmera de fato mira é a interpolação entre
 * "olhar pro jogador" (`computeLookAtPoint(pos, orbit, 0)`) e "olhar pro
 * `AimAnchor`" travado — `anchor.x/y/z` continuam com o último ponto
 * mesmo depois de soltar (`active` vira falso, mas os campos não são
 * zerados — ver `aimAnchorSystem.js`), então a transição de SAÍDA também
 * fica suave, não só a de entrada. `computeAimRay`/`resolveAimPoint` (a
 * mira de verdade do arremesso) nunca leem esse `aimBlend` — a suavização
 * é só visual, não deve afetar pra onde o objeto realmente vai.
 *
 * Fase: presentation (passo variável), depois do syncTransformSystem.
 * A câmera chega em context.camera (câmera default do R3F, via useThree).
 */
// Estado de tela (não de jogo) — a suavização do enquadramento de mira
// precisa persistir de um frame pro outro, mas não é dado de simulação
// nem precisa ser consultável por outro system, então não vira trait (ver
// docstring acima).
let aimBlend = 0

export function cameraFollowSystem(context) {
  const { world, delta, camera } = context
  if (!camera) return

  const target = world.queryFirst(CameraTarget, Position)
  const rig = world.queryFirst(OrbitCamera)
  if (!target || !rig) return

  const pos = target.get(Position)
  const anchor = target.get(AimAnchor)
  const orbit = rig.get(OrbitCamera)
  const {
    SMOOTHING,
    AIM_BLEND_SMOOTHING,
    TARGET_HEIGHT,
    SHOULDER_OFFSET,
    COLLISION_MARGIN,
    MIN_DISTANCE_AFTER_COLLISION,
  } = GAME_CONFIG.CAMERA

  // Travado, yaw e pitch de posicionamento viram "do alvo pro olho do
  // jogador" em 3D — câmera sempre do lado oposto ao alvo ao longo dessa
  // reta, recalculado a cada frame conforme o jogador se move, radial ou
  // tangencialmente (ver docstring acima). Só `distance` continua do orbit
  // normal (scroll, congelado enquanto mirando por `cameraControlSystem.js`).
  let effectiveOrbit = orbit
  if (anchor?.active) {
    const eyeDx = pos.x - anchor.x
    const eyeDz = pos.z - anchor.z
    const eyeDy = pos.y + TARGET_HEIGHT - anchor.y
    const horizontalDist = Math.hypot(eyeDx, eyeDz)
    effectiveOrbit = {
      ...orbit,
      yaw: Math.atan2(eyeDx, eyeDz),
      pitch: Math.atan2(eyeDy, horizontalDist),
    }
  }

  const pivot = { x: pos.x, y: pos.y + TARGET_HEIGHT, z: pos.z }
  let uncollided = computeCameraPosition(pos, effectiveOrbit)

  if (anchor?.active && SHOULDER_OFFSET) {
    const right = computeCameraRight(effectiveOrbit.yaw)
    uncollided = {
      x: uncollided.x + right.x * SHOULDER_OFFSET,
      y: uncollided.y,
      z: uncollided.z + right.z * SHOULDER_OFFSET,
    }
  }

  const desired = resolveCameraCollision(
    pivot,
    uncollided,
    target.get(PhysicsBody)?.colliderHandle,
    { COLLISION_MARGIN, MIN_DISTANCE_AFTER_COLLISION },
  )

  const aimBlendTarget = anchor?.active ? 1 : 0
  aimBlend +=
    (aimBlendTarget - aimBlend) * Math.min(1, AIM_BLEND_SMOOTHING * delta)

  const freeLookAt = computeLookAtPoint(pos, orbit, 0)
  const lockedLookAt = anchor
    ? { x: anchor.x, y: anchor.y, z: anchor.z }
    : freeLookAt
  const lookAt = {
    x: freeLookAt.x + (lockedLookAt.x - freeLookAt.x) * aimBlend,
    y: freeLookAt.y + (lockedLookAt.y - freeLookAt.y) * aimBlend,
    z: freeLookAt.z + (lockedLookAt.z - freeLookAt.z) * aimBlend,
  }

  const t = Math.min(1, SMOOTHING * delta)
  camera.position.x += (desired.x - camera.position.x) * t
  camera.position.y += (desired.y - camera.position.y) * t
  camera.position.z += (desired.z - camera.position.z) * t

  camera.lookAt(lookAt.x, lookAt.y, lookAt.z)
}
