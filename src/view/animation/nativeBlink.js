import * as THREE from 'three'

// Diferença máxima (por componente) pra considerar a pálpebra de um clipe
// "na mesma pose" do olho aberto do blink — ruído de exportação fica
// abaixo disso; olho fechado/semicerrado fica muito acima (~27° nas
// pálpebras do charmander).
const POSE_TOLERANCE = 0.005

// Clipe de blink original (cache do `useGLTF`) → cópia aditiva só com as
// tracks que se mexem. Compartilhada entre entidades da espécie.
const overlayBySource = new WeakMap()

/**
 * Piscar por animação (`species.nativeBlink`: `{ animation, minInterval,
 * maxInterval }`) — substitui o piscar por textura (`eyeStates`) nos rigs
 * que têm pálpebra de verdade.
 *
 * Toca como camada ADITIVA no mesmo mixer do corpo, só com as tracks que o
 * clipe de blink de fato move (as pálpebras) — soma o fechar/abrir por
 * cima do que o corpo estiver fazendo, sem trocar de estado. Mas só pisca
 * quando o clipe do corpo mantém essas pálpebras PARADAS na pose de olho
 * aberto (igual ao 1º frame do blink): clipes que fecham o olho (faint,
 * hit) ou mexem a pálpebra por conta própria (appeal) ficam sem piscar —
 * decidido pelos dados de cada clipe, não por lista de estados.
 *
 * O relógio é cosmético (intervalo sorteado com `random`), fora da
 * simulação.
 */
export function createNativeBlink(mixer, clipsByName, config, random) {
  const source = clipsByName.get(config?.animation)
  if (!source) return null

  const overlay = resolveOverlay(source)
  if (!overlay) return null

  const action = mixer.clipAction(overlay.clip)
  action.setLoop(THREE.LoopOnce, 1)

  const blink = {
    action,
    openPose: overlay.openPose,
    minInterval: config.minInterval,
    maxInterval: config.maxInterval,
    timer: 0,
    keepsEyesOpenByClip: new WeakMap(),
  }
  scheduleNext(blink, random)
  return blink
}

/**
 * Conta o intervalo e, vencido, pisca — se o clipe do corpo (`bodyClip`)
 * permitir. Não permitido: pula esta piscada (sem acumular pra depois).
 */
export function updateNativeBlink(blink, bodyClip, delta, random) {
  blink.timer -= delta
  if (blink.timer > 0) return

  scheduleNext(blink, random)
  if (!bodyClip || !keepsEyesOpen(blink, bodyClip)) return

  blink.action.reset()
  blink.action.play()
}

export function stopNativeBlink(blink) {
  blink.action.stop()
}

function scheduleNext(blink, random) {
  const span = blink.maxInterval - blink.minInterval
  blink.timer = blink.minInterval + random() * span
}

function resolveOverlay(source) {
  if (overlayBySource.has(source)) return overlayBySource.get(source)

  const moving = source.tracks.filter(isMoving)
  const overlay =
    moving.length === 0
      ? null
      : {
          openPose: new Map(
            moving.map((track) => [
              track.name,
              Array.from(track.values.slice(0, track.getValueSize())),
            ]),
          ),
          clip: THREE.AnimationUtils.makeClipAdditive(
            new THREE.AnimationClip(
              `${source.name}:overlay`,
              source.duration,
              // Cópia PROFUNDA — `makeClipAdditive` reescreve `values` no
              // lugar, e `track.clone()` reaproveita o mesmo array.
              moving.map(
                (track) =>
                  new track.constructor(
                    track.name,
                    track.times.slice(),
                    track.values.slice(),
                    track.getInterpolation(),
                  ),
              ),
            ),
          ),
        }
  overlayBySource.set(source, overlay)
  return overlay
}

function isMoving(track) {
  const stride = track.getValueSize()
  const { values } = track
  for (let i = stride; i < values.length; i++) {
    if (Math.abs(values[i] - values[i % stride]) > POSE_TOLERANCE) return true
  }
  return false
}

function keepsEyesOpen(blink, clip) {
  const cached = blink.keepsEyesOpenByClip.get(clip)
  if (cached !== undefined) return cached

  let result = true
  for (const [name, pose] of blink.openPose) {
    const track = clip.tracks.find((candidate) => candidate.name === name)
    if (track && !staysAtPose(track, pose)) {
      result = false
      break
    }
  }
  blink.keepsEyesOpenByClip.set(clip, result)
  return result
}

function staysAtPose(track, pose) {
  const stride = pose.length
  for (let offset = 0; offset < track.values.length; offset += stride) {
    // Quaternion: q e -q são a mesma rotação.
    const matches =
      matchesAt(track.values, offset, pose, 1) ||
      (stride === 4 && matchesAt(track.values, offset, pose, -1))
    if (!matches) return false
  }
  return true
}

function matchesAt(values, offset, pose, sign) {
  for (let i = 0; i < pose.length; i++) {
    if (Math.abs(values[offset + i] - sign * pose[i]) > POSE_TOLERANCE) {
      return false
    }
  }
  return true
}
