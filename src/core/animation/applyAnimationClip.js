import { evaluateCurve } from './curves'

const TWO_PI = Math.PI * 2
const ANIMATABLE_PROPERTIES = ['rotation', 'position', 'scale']
const AXES = ['x', 'y', 'z']

/**
 * Aplica um clipe de animação (dado declarativo — ver curves.js pros tipos de
 * curva disponíveis) a um conjunto de ossos resolvidos (ver resolveBones.js).
 *
 * Formato do clipe:
 * ```json
 * {
 *   "name": "quadruped-walk",
 *   "bones": {
 *     "frontRight": {
 *       "rotation": { "z": { "type": "sine", "amplitude": 0.5 } },
 *       "position": { "y": { "type": "absSine", "amplitude": 0.05 } }
 *     }
 *   }
 * }
 * ```
 * Cada osso pode animar `rotation`, `position` e/ou `scale` — cada uma com
 * suas próprias curvas por eixo. `clip.bones` usa os mesmos nomes semânticos
 * do mapa de ossos do modelo (não o nome real do osso) — por isso o mesmo
 * clipe funciona em qualquer rig que tenha um mapa de ossos com essas chaves,
 * sem reescrever nada.
 *
 * Cada eixo vira `rest[propriedade][eixo] + evaluateCurve(curva, t, freq)` —
 * nunca substitui a pose de descanso (ver resolveBones.js). Osso, propriedade
 * ou eixo do clipe sem correspondente no mapa resolvido é ignorado, não
 * lança erro.
 *
 * Toda pose calculada (aqui e em `applyBlendedAnimationClip`) parte da pose de
 * descanso pra **todo** osso do mapa, não só os mencionados no clipe. Sem
 * isso, um osso animado pelo clipe anterior (ex.: a perna no "walk") e
 * ausente do clipe atual (ex.: o "idle", que não mexe em perna) ficaria
 * travado no último valor que o clipe anterior escreveu, em vez de voltar a
 * ficar parado — é a troca de clipe que precisa ser "completa", não cada
 * clipe individualmente.
 */
export function applyAnimationClip(clip, bones, t, speed = 1) {
  writePose(sampleAnimationClip(clip, bones, t, speed), bones)
}

/**
 * Fotografa a pose atual (o que está de fato nos ossos agora, não a pose de
 * descanso) — o ponto de partida de um crossfade: quando o estado de
 * animação muda, a pose exibida no frame da troca vira esse retrato estático,
 * e o clipe novo entra por cima dele (ver `applyBlendedAnimationClip`).
 */
export function capturePose(bones) {
  const pose = {}
  for (const [boneName, entry] of Object.entries(bones)) {
    pose[boneName] = copyBoneValues(entry.bone)
  }
  return pose
}

/**
 * Interpola entre uma pose congelada (`fromPose`, ver `capturePose`) e o
 * clipe novo avaliado em `t`, por `alpha` (0 = ainda na pose congelada, 1 =
 * clipe novo puro). Não há dois clipes tocando ao mesmo tempo — só uma
 * fotografia estática e o clipe vivo, misturados.
 */
export function applyBlendedAnimationClip(
  fromPose,
  clip,
  bones,
  t,
  alpha,
  speed = 1,
) {
  const toPose = sampleAnimationClip(clip, bones, t, speed)
  const blended = {}
  for (const boneName of Object.keys(bones)) {
    const from = fromPose[boneName]
    const to = toPose[boneName]
    if (!from || !to) continue
    blended[boneName] = lerpBoneValues(from, to, alpha)
  }
  writePose(blended, bones)
}

function sampleAnimationClip(clip, bones, t, speed) {
  const freq = speed * TWO_PI
  const pose = {}

  for (const [boneName, entry] of Object.entries(bones)) {
    pose[boneName] = copyBoneValues(entry.rest)
  }

  for (const [boneName, properties] of Object.entries(clip.bones)) {
    const entry = bones[boneName]
    if (!entry) continue

    for (const [property, axes] of Object.entries(properties)) {
      const rest = entry.rest[property]
      if (!rest) continue

      for (const [axis, curve] of Object.entries(axes)) {
        pose[boneName][property][axis] =
          rest[axis] + evaluateCurve(curve, t, freq)
      }
    }
  }

  return pose
}

function copyBoneValues(source) {
  const values = {}
  for (const property of ANIMATABLE_PROPERTIES) {
    const { x, y, z } = source[property]
    values[property] = { x, y, z }
  }
  return values
}

function lerpBoneValues(from, to, alpha) {
  const values = {}
  for (const property of ANIMATABLE_PROPERTIES) {
    values[property] = {}
    for (const axis of AXES) {
      values[property][axis] =
        from[property][axis] +
        (to[property][axis] - from[property][axis]) * alpha
    }
  }
  return values
}

function writePose(pose, bones) {
  for (const [boneName, entry] of Object.entries(bones)) {
    if (!entry) continue

    const values = pose[boneName]
    if (!values) continue

    for (const property of ANIMATABLE_PROPERTIES) {
      const target = entry.bone[property]
      const value = values[property]
      if (!target || !value) continue

      target.x = value.x
      target.y = value.y
      target.z = value.z
    }
  }
}
