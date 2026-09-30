import { evaluateCurve } from './curves'
import {
  quaternionFromAxisAngle,
  multiplyQuaternions,
  slerpQuaternions,
} from '../math'

const TWO_PI = Math.PI * 2
const AXES = ['x', 'y', 'z']

/**
 * Aplica um clipe de animação a um conjunto de ossos resolvidos (ver
 * resolveBones.js). Dois FORMATOS de clipe convivem, escolhidos por
 * `clip.type` — nunca misturados dentro do mesmo osso, um ou outro por
 * clipe inteiro:
 *
 * **Procedural** (`type` ausente, o formato original — curva por eixo, ver
 * curves.js):
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
 * **Keyframes** (`type: "keyframes"` — um clipe GRAVADO/exportado de outra
 * ferramenta, não escrito à mão; ver docs/backlog.md, item original, e
 * `resolveKeyframeCount`/`sampleKeyframeClip` abaixo):
 * ```json
 * {
 *   "name": "bot-throw1",
 *   "type": "keyframes",
 *   "fps": 30,
 *   "bones": {
 *     "hand": {
 *       "quaternion": [{ "x": 0, "y": 0, "z": 0, "w": 1 }, ...],
 *       "position": [{ "x": 0, "y": 1.2, "z": 0 }, ...]
 *     }
 *   }
 * }
 * ```
 * Cada osso pode gravar `quaternion`, `position` e/ou `scale` — um array de
 * valores BRUTOS (absolutos, não delta do descanso — o valor final do osso
 * naquele frame), um por frame, todos os arrays do clipe com o MESMO número
 * de frames (`resolveKeyframeCount` pega o maior encontrado). Osso ausente
 * do mapa resolvido, ou sem um dos três arrays, é ignorado — mesma regra
 * graciosa do procedural. Interpola entre os dois frames vizinhos pelo
 * tempo decorrido: slerp pra `quaternion` (`slerpQuaternions` — caminho
 * curto, igual ao crossfade abaixo), lerp pra `position`/`scale`. Cíclico
 * por construção (envolve de volta ao frame 0 após o último — sem
 * distinção de "oneShot" aqui: quem decide reiniciar o relógio ao entrar
 * num estado de ação é `animationSystem.js`, igual ao procedural).
 *
 * `fps` é opcional e só serve pra `resolveClipSpeed` calcular um `speed`
 * PADRÃO (frames/segundo ÷ total de frames = 1 volta no tempo real da
 * gravação) quando o clipe não declara `speed` — nunca lido aqui dentro.
 *
 * Os DOIS formatos compartilham o mesmo contrato de velocidade: `speed` é
 * sempre "quantos ciclos do clipe por segundo" (o resto do motor não sabe
 * nem precisa saber qual formato está tocando — `ActionState.animationSpeed`
 * = `1/duration` continua esticando o clipe INTEIRO, do começo ao fim,
 * pra caber exatamente na duração da ação, keyframes ou não).
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
 * `speed` padrão de um clipe quando ele não declara o próprio (mesmo
 * fallback que `animationSystem.js` já aplicava, `clip.speed || 1`) — só
 * um clipe de keyframes com `fps` ganha um padrão melhor que `1`: toca 1
 * volta no tempo real da gravação (`fps / totalDeFrames`), em vez de 1
 * ciclo por segundo cravado (que só faz sentido pra curva procedural, sem
 * duração "natural" nenhuma). Estados `oneShot` NUNCA chamam isto —
 * `ActionState.animationSpeed` manda sozinho, pros dois formatos (ver
 * docstring de `applyAnimationClip`).
 */
export function resolveClipSpeed(clip) {
  if (clip.speed) return clip.speed
  if (clip.type === 'keyframes' && clip.fps) {
    const frameCount = resolveKeyframeCount(clip)
    if (frameCount > 0) return clip.fps / frameCount
  }
  return 1
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
  writePose(blendPoses(fromPose, toPose, bones, alpha), bones)
}

/**
 * Mesmo crossfade de `applyBlendedAnimationClip`, mas o destino é a pose
 * que JÁ está nos ossos (escrita por outro motor neste frame — o
 * `THREE.AnimationMixer` das animações embutidas no `.glb`, ver
 * `view/animation/nativeAnimationPlayer.js`), não um clipe amostrado aqui.
 * É o que deixa a troca procedural ↔ embutida (e embutida ↔ embutida)
 * usar a MESMA fotografia de partida e a mesma curva de mistura.
 */
export function blendFromPose(fromPose, bones, alpha) {
  writePose(blendPoses(fromPose, capturePose(bones), bones, alpha), bones)
}

function blendPoses(fromPose, toPose, bones, alpha) {
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
  return blended
}

function sampleAnimationClip(clip, bones, t, speed) {
  if (clip.type === 'keyframes')
    return sampleKeyframeClip(clip, bones, t, speed)

  const freq = speed * TWO_PI
  const pose = restPose(bones)

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

/** Pose de descanso de todo osso do mapa — ponto de partida comum aos dois
 * formatos de clipe (ver docstring de `applyAnimationClip`). */
function restPose(bones) {
  const pose = {}
  for (const [boneName, entry] of Object.entries(bones)) {
    pose[boneName] = {
      quaternion: copyQuaternion(entry.restQuaternion),
      position: copyVector(entry.rest.position),
      scale: copyVector(entry.rest.scale),
    }
  }
  return pose
}

/**
 * Maior array de frames entre todos os ossos/propriedades do clipe — o
 * clipe inteiro compartilha uma única linha do tempo (frame N de um osso é
 * o MESMO instante que frame N de outro), então basta o maior. `0` sem
 * nenhum array (clipe vazio/malformado — `sampleKeyframeClip` devolve a
 * pose de descanso pura, mesmo fallback gracioso de sempre).
 */
function resolveKeyframeCount(clip) {
  let count = 0
  for (const track of Object.values(clip.bones ?? {})) {
    for (const property of ['quaternion', 'position', 'scale']) {
      count = Math.max(count, track[property]?.length ?? 0)
    }
  }
  return count
}

/**
 * `speed` é "ciclos do clipe por segundo" — 1 ciclo = uma volta pelo array
 * de frames inteiro (frame 0 → o último), MESMA unidade que `speed` já
 * tem no procedural (1 ciclo = 1 período da curva) — é o que faz
 * `ActionState.animationSpeed` (`1/duration`) esticar o clipe GRAVADO
 * inteiro pra caber em `duration` segundos, sem olhar pro `fps` de
 * gravação, exatamente como já faz pro procedural (ver docstring de
 * `applyAnimationClip`). Cíclico: `t * speed` além de 1 volta envolve de
 * volta pro frame 0 — sem tratamento especial de "clipe de ação": um golpe
 * one-shot já troca de AnimationState (crossfade) assim que a ação
 * termina, o mesmo raciocínio que o procedural já documenta (a curva
 * segue period, ninguém trava pra checar se "acabou").
 *
 * Interpola entre os dois frames vizinhos: slerp pra `quaternion` (via
 * `slerpQuaternions`, caminho curto), lerp pra `position`/`scale`. Osso ou
 * propriedade sem array no clipe fica na pose de descanso.
 */
function sampleKeyframeClip(clip, bones, t, speed) {
  const pose = restPose(bones)

  const frameCount = resolveKeyframeCount(clip)
  if (frameCount === 0) return pose

  const progress = t * speed
  const wrapped = progress - Math.floor(progress) // sempre em [0, 1)
  const framePosition = wrapped * frameCount
  const frameIndex = Math.floor(framePosition) % frameCount
  const nextIndex = (frameIndex + 1) % frameCount
  const alpha = framePosition - Math.floor(framePosition)

  for (const [boneName, track] of Object.entries(clip.bones)) {
    if (!pose[boneName]) continue

    const a = track.quaternion?.[frameIndex]
    if (a) {
      const b = track.quaternion[nextIndex]
      pose[boneName].quaternion = b ? slerpQuaternions(a, b, alpha) : a
    }

    for (const property of ['position', 'scale']) {
      const from = track[property]?.[frameIndex]
      if (!from) continue
      const to = track[property][nextIndex]
      pose[boneName][property] = to ? lerpVector(from, to, alpha) : from
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
