import { evaluateCurve } from './curves'
import {
  quaternionFromAxisAngle,
  multiplyQuaternions,
  slerpQuaternions,
} from '../math'

const TWO_PI = Math.PI * 2
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
 * suas próprias curvas por eixo. Osso, propriedade ou eixo do clipe sem
 * correspondente no mapa resolvido é ignorado, não lança erro.
 *
 * `position`/`scale`: `rest[eixo] + evaluateCurve(curva, t, freq)` — soma
 * escalar simples, nunca substitui a pose de descanso.
 *
 * `rotation` é diferente: cada eixo com curva vira uma rotação pura em torno
 * daquele eixo LOCAL, pós-multiplicada em cima do quaternion de descanso, na
 * ordem fixa x, y, z — `q = restQuaternion · Rx(dx) · Ry(dy) · Rz(dz)` (ver
 * `core/math/quaternion.js`). Somar escalar direto no componente de Euler
 * (como position/scale fazem) só reproduz essa composição quando o resto do
 * osso já está perto da identidade nos outros dois eixos — verdade pro Fox
 * (rig simples), falso pra rigs com pose de descanso torta, como Mixamo
 * (coxa a 180° em Z): nesses casos a soma de Euler vaza pra fora do eixo
 * local pretendido e a animação sai com sinal/eixo errado em partes do
 * corpo. Quaternion evita isso: cada eixo gira sempre no referencial local
 * do próprio osso, seja qual for o resto.
 *
 * Toda pose calculada (aqui e em `applyBlendedAnimationClip`) parte da pose
 * de descanso pra **todo** osso do mapa, não só os mencionados no clipe. Sem
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
    pose[boneName] = {
      quaternion: copyQuaternion(entry.bone.quaternion),
      position: copyVector(entry.bone.position),
      scale: copyVector(entry.bone.scale),
    }
  }
  return pose
}

/**
 * Interpola entre uma pose congelada (`fromPose`, ver `capturePose`) e o
 * clipe novo avaliado em `t`, por `alpha` (0 = ainda na pose congelada, 1 =
 * clipe novo puro). Não há dois clipes tocando ao mesmo tempo — só uma
 * fotografia estática e o clipe vivo, misturados. Rotação usa slerp (com
 * correção de sinal — ver `slerpQuaternions`), não lerp de Euler: um osso em
 * repouso a 180° pode ter sua pose "vizinha" representada tanto perto de
 * +π quanto de −π, e um lerp componente-a-componente giraria quase 360° pra
 * atravessar essa borda em vez do caminho curto.
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
    blended[boneName] = {
      quaternion: slerpQuaternions(from.quaternion, to.quaternion, alpha),
      position: lerpVector(from.position, to.position, alpha),
      scale: lerpVector(from.scale, to.scale, alpha),
    }
  }
  writePose(blended, bones)
}

function sampleAnimationClip(clip, bones, t, speed) {
  const freq = speed * TWO_PI
  const pose = {}

  for (const [boneName, entry] of Object.entries(bones)) {
    pose[boneName] = {
      quaternion: copyQuaternion(entry.restQuaternion),
      position: copyVector(entry.rest.position),
      scale: copyVector(entry.rest.scale),
    }
  }

  for (const [boneName, properties] of Object.entries(clip.bones)) {
    const entry = bones[boneName]
    if (!entry) continue

    if (properties.rotation) {
      pose[boneName].quaternion = composeRotation(
        entry.restQuaternion,
        properties.rotation,
        t,
        freq,
      )
    }

    for (const property of ['position', 'scale']) {
      const axes = properties[property]
      if (!axes) continue
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

/**
 * `q = restQuaternion · Rx(dx) · Ry(dy) · Rz(dz)`, pulando eixo sem curva —
 * cada delta pós-multiplicado no referencial local do osso, ordem fixa
 * x/y/z (ver docstring de `applyAnimationClip`).
 */
function composeRotation(restQuaternion, axesCurves, t, freq) {
  let q = restQuaternion
  for (const axis of AXES) {
    const curve = axesCurves[axis]
    if (!curve) continue
    const delta = evaluateCurve(curve, t, freq)
    q = multiplyQuaternions(q, quaternionFromAxisAngle(axis, delta))
  }
  return q
}

function copyQuaternion(source) {
  const { x, y, z, w } = source
  return { x, y, z, w }
}

function copyVector(source) {
  const { x, y, z } = source
  return { x, y, z }
}

function lerpVector(from, to, alpha) {
  return {
    x: from.x + (to.x - from.x) * alpha,
    y: from.y + (to.y - from.y) * alpha,
    z: from.z + (to.z - from.z) * alpha,
  }
}

function writePose(pose, bones) {
  for (const [boneName, entry] of Object.entries(bones)) {
    if (!entry) continue

    const values = pose[boneName]
    if (!values) continue

    if (entry.bone.quaternion && values.quaternion) {
      const q = values.quaternion
      entry.bone.quaternion.set(q.x, q.y, q.z, q.w)
    }

    for (const property of ['position', 'scale']) {
      const target = entry.bone[property]
      const value = values[property]
      if (!target || !value) continue

      target.x = value.x
      target.y = value.y
      target.z = value.z
    }
  }
}
