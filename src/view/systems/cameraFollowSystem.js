import { GAME_CONFIG } from '@/core/gameConfig'
import { clamp } from '@/core/math'
import { getPlayerSpecies, getSpecies } from '@/core/data/species'
import {
  computeCameraPosition,
  computeCameraRight,
  computeLookAtPoint,
  computeOrbitForward,
  resolveCameraCollision,
} from '@/core/camera/orbitCamera'
import {
  Position,
  OrbitCamera,
  CameraTarget,
  Party,
  PhysicsBody,
  ScanMode,
  SummonedCreature,
} from '@/core/traits'

/**
 * Espécie de quem está sendo seguido/mirado/CONTROLADO agora — `entity`
 * é genérico (`CameraTarget`/`InputControlled`, movido entre treinador e
 * criatura por `controlSwitchSystem.js`, ver docs/features/018-troca-de-
 * controle-treinador-criatura.md), então resolve por presença de
 * `SummonedCreature` (só criatura tem) em vez de assumir sempre o
 * treinador — mesmo critério que `creatureAttackSystem.js` já usa pra
 * distinguir os dois. Só DUAS fontes
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
 * Desvio de ombro (`SHOULDER_OFFSET`) sempre ativo — desloca a POSIÇÃO da
 * câmera pro lado (`computeCameraRight`) e o enquadramento
 * (`computeLookAtPoint(..., 1, ...)`) na mesma proporção, mesmo
 * enquadramento "sobre o ombro" de terceira pessoa o tempo todo (não
 * depende de nenhum estado de input — mira/lock-on foi removida, ver
 * docs/features/029-*.md).
 *
 * Colisão da órbita (docs/backlog.md → "Câmera orbital com colisão"):
 * `resolveCameraCollision` (`core/camera/orbitCamera.js`, compartilhada —
 * ver docstring dela) ajusta a posição desejada da câmera (já com o
 * desvio de ombro somado, ver acima) antes de aplicar a suavização.
 * Exclui a própria cápsula do alvo (`PhysicsBody.colliderHandle`) — sem
 * isso, o raio (que nasce dentro/perto do próprio corpo) se autoacertaria
 * sempre. A MESMA correção também entra em `computeAimRay`
 * (`core/aim.js`'s `resolveAimPoint`) — sem isso, a mira do arremesso/da
 * esfera de invocar (docs/features/016/024) partia da posição IDEAL
 * (não-colidida) da câmera, que podia divergir bastante da posição
 * renderizada de verdade em pitches extremos (câmera "afundada" no chão/
 * parede) — bug real, relatado jogando.
 *
 * **Modo Scan (primeira pessoa)** — pedido do usuário: "para a
 * pokédex, quero que quando equipada, ao clicar com o botão direito a
 * câmera fique em primeira pessoa para eu poder escanear o pokémon
 * alvo" (ver docs/features/031-*.md, `ScanMode`/`scannerModeSystem.js`).
 * Só se aplica quando `target` É o treinador (`Party`, o único que tem
 * `ScanMode` de verdade útil — controlando uma criatura, a câmera volta
 * pra terceira pessoa normal mesmo que `ScanMode.active` tenha ficado
 * `true` de antes de trocar de controle). Sem órbita/desvio de ombro/
 * colisão de terceira pessoa — a câmera senta perto do "olho"
 * (`TARGET_HEIGHT` acima de `Position`, mesma altura já usada como
 * pivô da câmera normal) e olha na direção pura de `orbit.yaw`/`pitch`
 * (`computeOrbitForward`).
 *
 * **`GAME_CONFIG.CAMERA.SCAN`** (docs/features/033-*.md) — dois
 * parâmetros, ajustáveis sem mexer nesta função. Sem zoom (removido —
 * o usuário testou o comportamento com zoom e pediu de volta só o
 * essencial: "não gostei do comportamento do zoom, então quero remover
 * essa funcionalidade completamente... a câmera do Scan deve ter
 * apenas uma posição fixa definida pelo scanCameraOffsetForward").
 * - `CAMERA_OFFSET_FORWARD` — único posicionamento que este modo tem
 *   (pedido do usuário: "não quero uma solução baseada em esconder
 *   partes do model, a ideia é resolver isso pelo posicionamento da
 *   câmera") — desvio FIXO pra FRENTE (na direção `forward`,
 *   `computeOrbitForward`) do olho. Sem offset lateral/vertical — o
 *   pedido só menciona o eixo forward, e `TARGET_HEIGHT` já cobre a
 *   altura do olho; `computeCameraRight` não entra neste branch, só no
 *   de terceira pessoa abaixo.
 * - `PITCH_MIN/MAX` — clampa `orbit.pitch` de novo, só pra QUANTO ESTE
 *   MODO usa pra calcular a direção — `orbit.pitch` em si continua com
 *   o clamp global de sempre (`cameraControlSystem.js`), não é
 *   reescrito aqui; entrar/sair do modo Scan nunca causa salto no
 *   valor bruto, só na direção calculada a partir dele. Sem
 *   suavização nesse clamp em si — se algum dia este range divergir do
 *   de terceira pessoa (`MIN_PITCH`/`MAX_PITCH`, hoje com os mesmos
 *   números), entrar no modo com o pitch bruto fora deste range
 *   causaria um salto instantâneo na direção calculada no primeiro
 *   frame — comportamento preexistente, não uma regressão desta
 *   rodada.
 *
 * **Sem suavização de posição no modo Scan** (correção — pedido do
 * usuário: "a câmera em Scan deve responder de forma direta e suave ao
 * mouse, sem sensação de peso ou atraso"). Investigado antes de mexer:
 * não existe suavização duplicada nem sistema concorrente
 * (`syncTransformSystem.js`, que sincroniza o MODELO, escreve a
 * posição dele direto, sem lerp próprio; a única suavização de
 * ROTAÇÃO no projeto inteiro é a do CORPO do personagem,
 * `movementSystem.js`'s `Rotation.y`, sem relação nenhuma com a
 * câmera do Scan, que usa `orbit.yaw`/`pitch`). A direção (`lookAt`)
 * já era instantânea mesmo antes desta correção — só a POSIÇÃO passava
 * por um lerp (`SMOOTHING`, o mesmo usado em terceira pessoa, onde um
 * pequeno atraso posicional é convencional/imperceptível porque o
 * jogador olha pro modelo, não pra câmera). Em primeira pessoa a
 * câmera É o olho do jogador — qualquer atraso posicional ao virar a
 * cabeça é sentido como peso. Removida aqui (não aumentada — este
 * branch não lê mais `SMOOTHING`, só o de terceira pessoa abaixo
 * continua usando), câmera do Scan acompanha a posição 1:1 com o
 * input, todo frame.
 *
 * Fase: presentation (passo variável), depois do syncTransformSystem.
 * A câmera chega em context.camera (câmera default do R3F, via useThree).
 */
export function cameraFollowSystem(context) {
  const { world, delta, camera } = context
  if (!camera) return

  const target = world.queryFirst(CameraTarget, Position)
  const rig = world.queryFirst(OrbitCamera)
  if (!target || !rig) return

  const pos = target.get(Position)
  const orbit = rig.get(OrbitCamera)
  const {
    SMOOTHING, // só o branch de terceira pessoa (abaixo) lê isto — o modo Scan não suaviza posição
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

  const scanMode = target.has(Party) ? target.get(ScanMode) : null
  const scanning = !!scanMode?.active
  if (scanning) {
    const { CAMERA_OFFSET_FORWARD, PITCH_MIN, PITCH_MAX } =
      GAME_CONFIG.CAMERA.SCAN

    const pitch = clamp(orbit.pitch, PITCH_MIN, PITCH_MAX)
    const forward = computeOrbitForward({ yaw: orbit.yaw, pitch })

    // `CAMERA_OFFSET_FORWARD` empurra o olho pra FRENTE, fixo — única
    // posição que a câmera do Scan tem (ver docstring acima).
    const eye = {
      x: pos.x + forward.x * CAMERA_OFFSET_FORWARD,
      y: pos.y + TARGET_HEIGHT,
      z: pos.z + forward.z * CAMERA_OFFSET_FORWARD,
    }

    // Sem lerp aqui — ver docstring acima ("Sem suavização de posição
    // no modo Scan").
    camera.position.x = eye.x
    camera.position.y = eye.y
    camera.position.z = eye.z

    camera.lookAt(eye.x + forward.x, eye.y + forward.y, eye.z + forward.z)
    return
  }

  const pivot = { x: pos.x, y: pos.y + TARGET_HEIGHT, z: pos.z }
  let uncollided = computeCameraPosition(pos, orbit, TARGET_HEIGHT)

  if (SHOULDER_OFFSET) {
    const right = computeCameraRight(orbit.yaw)
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

  const lookAt = computeLookAtPoint(
    pos,
    orbit,
    1,
    TARGET_HEIGHT,
    SHOULDER_OFFSET,
  )

  const t = Math.min(1, SMOOTHING * delta)
  camera.position.x += (desired.x - camera.position.x) * t
  camera.position.y += (desired.y - camera.position.y) * t
  camera.position.z += (desired.z - camera.position.z) * t

  camera.lookAt(lookAt.x, lookAt.y, lookAt.z)
}
