import { GAME_CONFIG } from '@/core/gameConfig'
import { getPlayerSpecies, getSpecies } from '@/core/data/species'
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
  SummonedCreature,
} from '@/core/traits'

/**
 * Espécie de quem está sendo seguido/mirado/CONTROLADO agora — `entity`
 * é genérico (`CameraTarget`/`InputControlled`, movido entre treinador e
 * criatura por `controlSwitchSystem.js`, ver docs/features/018-troca-de-
 * controle-treinador-criatura.md), então resolve por presença de
 * `SummonedCreature` (só criatura tem) em vez de assumir sempre o
 * treinador — mesmo critério que `creatureAttackSystem.js`/
 * `aimAnchorSystem.js` já usam pra distinguir os dois. Só DUAS fontes
 * aqui (não três como `resolveEntitySpecies` em
 * `view/scene/NameplateView.jsx`) — `WildCreature` nunca é
 * `InputControlled`/`CameraTarget` (nunca pilotada), então não entra
 * nessa conta.
 *
 * Exportada — segundo consumidor (`tools/hud/StatusHud.jsx`,
 * docs/features/027-hud-de-status-e-habilidades.md, "2ª rodada") precisa da
 * MESMA resolução (a entidade CONTROLADA, não qualquer uma).
 */
export function resolveControlledSpecies(entity) {
  const creature = entity.get(SummonedCreature)
  return creature ? getSpecies(creature.speciesId) : getPlayerSpecies()
}

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
 * Desvio de ombro (`SHOULDER_OFFSET`) SEMPRE ativo, mirando ou não —
 * pedido explícito do usuário: "preciso que a config de shoulderOffset
 * esteja sempre ativa, não só quando mirar" (antes só aparecia com
 * `AimAnchor` travado). Desloca a POSIÇÃO da câmera pro lado
 * (`computeCameraRight`) incondicionalmente, e o enquadramento PADRÃO
 * (`framedLookAt`, abaixo — antes chamado `freeLookAt`, olhava direto
 * pro alvo sem desvio nenhum) também aplica o desvio completo agora
 * (`computeLookAtPoint(..., 1, ...)`, não mais `0`) — mesmo enquadramento
 * "sobre o ombro" de terceira pessoa o tempo todo, não só ao entrar na
 * mira.
 *
 * Enquanto TRAVADO (`AimAnchor` ativo), a câmera continua olhando direto
 * pro `AimAnchor` de verdade (ver `lockedLookAt`/`aimBlend` abaixo) — o
 * retículo (fixo no centro da tela, `tools/hud/Crosshair.jsx`) precisa
 * continuar correspondendo exatamente ao ponto travado, não importa o
 * quanto a câmera esteja deslocada pro lado — é assim que o arremesso
 * (`playerActionSystem.js`, mira direto no `AimAnchor`) sempre bate com o
 * que o retículo mostra. A transição entre os dois (enquadramento padrão
 * ↔ travado no `AimAnchor`) continua suave via `aimBlend`, só que agora
 * os dois extremos já têm o desvio de ombro embutido de formas diferentes
 * (um sempre desviado, o outro exatamente no alvo) em vez de "sem desvio
 * ↔ travado".
 *
 * Colisão da órbita (docs/backlog.md → "Câmera orbital com colisão"):
 * `resolveCameraCollision` (`core/camera/orbitCamera.js`, compartilhada —
 * ver docstring dela) ajusta a posição desejada da câmera (já com o
 * desvio de ombro sempre somado, ver acima) antes de aplicar a
 * suavização.
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
 * de forma absoluta, então trocar do enquadramento PADRÃO (`framedLookAt`
 * — já com desvio de ombro, ver acima) pra "olhar pro `AimAnchor`"
 * instantaneamente dá um salto perceptível. `aimBlend` (0 a 1) desliza em
 * direção a 1 enquanto travado e 0 enquanto livre, num `let` de módulo
 * (estado de TELA, não de jogo — não precisa virar trait, só existe uma
 * câmera de verdade), com o mesmo formato de suavização já usado pra
 * posição (`AIM_BLEND_SMOOTHING`, próprio ritmo, separado de
 * `SMOOTHING`). O ponto que a câmera de fato mira é a interpolação entre
 * o enquadramento padrão (`framedLookAt`, `computeLookAtPoint(pos, orbit,
 * 1, ...)`) e "olhar pro `AimAnchor`" travado — `anchor.x/y/z` continuam
 * com o último ponto mesmo depois de soltar (`active` vira falso, mas os
 * campos não são zerados — ver `aimAnchorSystem.js`), então a transição
 * de SAÍDA também fica suave, não só a de entrada.
 * `computeAimRay`/`resolveAimPoint` (a
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
    TARGET_HEIGHT: DEFAULT_TARGET_HEIGHT,
    SHOULDER_OFFSET: DEFAULT_SHOULDER_OFFSET,
    COLLISION_MARGIN,
    MIN_DISTANCE_AFTER_COLLISION,
  } = GAME_CONFIG.CAMERA

  // Posicionamento relativo ao MODELO de quem está sendo seguido agora —
  // ver `resolveControlledSpecies`/docstring do arquivo. `species` pode
  // ser `null` (id desconhecido/removido em runtime) — cai nos defaults
  // globais igual a uma espécie que nunca declarou `camera`, mesmo
  // fallback gracioso de sempre.
  const species = resolveControlledSpecies(target)
  const TARGET_HEIGHT = species?.camera?.targetHeight ?? DEFAULT_TARGET_HEIGHT
  const SHOULDER_OFFSET =
    species?.camera?.shoulderOffset ?? DEFAULT_SHOULDER_OFFSET

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
  let uncollided = computeCameraPosition(pos, effectiveOrbit, TARGET_HEIGHT)

  // Sempre ativo agora (não só travado — ver docstring acima).
  if (SHOULDER_OFFSET) {
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

  // aimBlend: 1 (desvio de ombro completo, não mais 0) — enquadramento
  // PADRÃO agora, mirando ou não (ver docstring acima).
  const framedLookAt = computeLookAtPoint(
    pos,
    orbit,
    1,
    TARGET_HEIGHT,
    SHOULDER_OFFSET,
  )
  const lockedLookAt = anchor
    ? { x: anchor.x, y: anchor.y, z: anchor.z }
    : framedLookAt
  const lookAt = {
    x: framedLookAt.x + (lockedLookAt.x - framedLookAt.x) * aimBlend,
    y: framedLookAt.y + (lockedLookAt.y - framedLookAt.y) * aimBlend,
    z: framedLookAt.z + (lockedLookAt.z - framedLookAt.z) * aimBlend,
  }

  const t = Math.min(1, SMOOTHING * delta)
  camera.position.x += (desired.x - camera.position.x) * t
  camera.position.y += (desired.y - camera.position.y) * t
  camera.position.z += (desired.z - camera.position.z) * t

  camera.lookAt(lookAt.x, lookAt.y, lookAt.z)
}
