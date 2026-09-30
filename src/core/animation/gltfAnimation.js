import { slerpQuaternions } from '../math'

const GLB_MAGIC = 0x46546c67 // "glTF", little-endian
const CHUNK_TYPE_JSON = 0x4e4f534a // "JSON"
const CHUNK_TYPE_BIN = 0x004e4942 // "BIN\0"

const COMPONENT_TYPE_COUNT = {
  5120: 1, // BYTE
  5121: 1, // UNSIGNED_BYTE
  5122: 2, // SHORT
  5123: 2, // UNSIGNED_SHORT
  5125: 4, // UNSIGNED_INT
  5126: 4, // FLOAT
}

const ACCESSOR_TYPE_COMPONENTS = {
  SCALAR: 1,
  VEC2: 2,
  VEC3: 3,
  VEC4: 4,
}

// glTF: só `translation`/`rotation`/`scale` viram osso animado no nosso
// clipe (`morph target weights` não tem equivalente no formato — ver
// `convertGltfAnimationToClip`).
const CHANNEL_PATH_TO_CLIP_PROPERTY = {
  translation: 'position',
  rotation: 'quaternion',
  scale: 'scale',
}

/**
 * Separa um `.glb` (binário) nos dois chunks que importam — `json` (o
 * documento glTF) e `bin` (o buffer embutido, `Buffer`/`Uint8Array`) — sem
 * depender de `THREE.GLTFLoader` (que espera um ambiente de browser —
 * `fetch`/`Blob`/etc., não disponível num script Node). Só entende a forma
 * mais comum (1 chunk JSON + no máximo 1 chunk BIN, buffer embutido — o
 * caso de todo `.glb` exportado por ferramenta comum, incluindo os deste
 * projeto); lança erro claro se o arquivo não bater com a assinatura
 * (`glTF`) — ferramenta de desenvolvimento rodada à mão, sobre um arquivo
 * que o próprio desenvolvedor escolheu, diferente do resto do motor
 * (nunca lança, sempre cai num fallback gracioso).
 */
export function parseGlb(buffer) {
  const view = new DataView(
    buffer.buffer ?? buffer,
    buffer.byteOffset ?? 0,
    buffer.byteLength,
  )
  if (view.getUint32(0, true) !== GLB_MAGIC) {
    throw new Error('não é um .glb válido (assinatura "glTF" ausente)')
  }

  let json = null
  let bin = null
  let offset = 12 // pula o header (magic + version + length, 4 bytes cada)
  while (offset < view.byteLength) {
    const chunkLength = view.getUint32(offset, true)
    const chunkType = view.getUint32(offset + 4, true)
    const chunkStart = offset + 8
    if (chunkType === CHUNK_TYPE_JSON) {
      const text = new TextDecoder().decode(
        new Uint8Array(view.buffer, view.byteOffset + chunkStart, chunkLength),
      )
      json = JSON.parse(text)
    } else if (chunkType === CHUNK_TYPE_BIN) {
      bin = new Uint8Array(
        view.buffer,
        view.byteOffset + chunkStart,
        chunkLength,
      )
    }
    offset = chunkStart + chunkLength
  }

  if (!json) throw new Error('.glb sem chunk JSON')
  return { json, bin }
}

/**
 * Lê um accessor glTF inteiro pra um array plano de números (sem
 * decompor em vetores ainda — quem chama sabe quantos componentes por
 * elemento, `ACCESSOR_TYPE_COMPONENTS[accessor.type]`). Cobre os
 * `componentType` que aparecem em accessor de animação/geometria comum
 * (FLOAT sempre; UNSIGNED_SHORT/UNSIGNED_BYTE normalizados, usados por
 * exportadores que comprimem os dados). Sem suporte a accessor `sparse`
 * (nenhum dos modelos deste projeto usa) nem `bufferView.byteStride`
 * (dado sempre compacto) — lança erro claro se aparecer, em vez de ler
 * silenciosamente errado.
 */
export function readAccessorFlat(json, bin, accessorIndex) {
  const accessor = json.accessors[accessorIndex]
  if (accessor.sparse) {
    throw new Error(`accessor ${accessorIndex} é sparse — não suportado`)
  }
  const bufferView = json.bufferViews[accessor.bufferView]
  if (bufferView.byteStride) {
    throw new Error(`accessor ${accessorIndex} tem byteStride — não suportado`)
  }

  const componentsPerElement = ACCESSOR_TYPE_COMPONENTS[accessor.type]
  const componentSize = COMPONENT_TYPE_COUNT[accessor.componentType]
  const byteOffset = (bufferView.byteOffset ?? 0) + (accessor.byteOffset ?? 0)
  const view = new DataView(bin.buffer, bin.byteOffset + byteOffset)

  const count = accessor.count * componentsPerElement
  const out = new Array(count)
  const normalize = accessor.normalized
  for (let i = 0; i < count; i++) {
    const at = i * componentSize
    let raw
    switch (accessor.componentType) {
      case 5126: // FLOAT
        raw = view.getFloat32(at, true)
        break
      case 5123: // UNSIGNED_SHORT
        raw = view.getUint16(at, true)
        if (normalize) raw /= 65535
        break
      case 5121: // UNSIGNED_BYTE
        raw = view.getUint8(at)
        if (normalize) raw /= 255
        break
      case 5125: // UNSIGNED_INT
        raw = view.getUint32(at, true)
        break
      default:
        throw new Error(
          `accessor ${accessorIndex}: componentType ${accessor.componentType} não suportado`,
        )
    }
    out[i] = raw
  }
  return out
}

function toVec3(flat, index) {
  return { x: flat[index * 3], y: flat[index * 3 + 1], z: flat[index * 3 + 2] }
}

function toQuaternion(flat, index) {
  return {
    x: flat[index * 4],
    y: flat[index * 4 + 1],
    z: flat[index * 4 + 2],
    w: flat[index * 4 + 3],
  }
}

function lerpVec3(a, b, alpha) {
  return {
    x: a.x + (b.x - a.x) * alpha,
    y: a.y + (b.y - a.y) * alpha,
    z: a.z + (b.z - a.z) * alpha,
  }
}

/**
 * Amostra UMA track (`times`/`values`, já os arrays crus de um
 * `sampler`) no instante `t` — clampado nas pontas (antes do 1º frame ou
 * depois do último, mantém o valor da borda, nunca extrapola). `values`
 * já vem CONVERTIDO em `{x,y,z}`/`{x,y,z,w}` por elemento (ver
 * `toVec3`/`toQuaternion`), então esta função não sabe nem precisa saber
 * se é posição ou rotação — só decide COMO interpolar:
 * - `'STEP'`: sem interpolar — o frame anterior (ou igual) a `t` vale até
 *   o próximo, mesma semântica do glTF.
 * - `'LINEAR'`, `values[i]` com `w` (quaternion): SLERP
 *   (`slerpQuaternions`, caminho curto) — o próprio glTF exige isso pra
 *   rotação "linear" (rotação não é um espaço vetorial, lerp componente a
 *   componente dá uma velocidade angular não-uniforme e pode nem ficar
 *   normalizado).
 * - `'LINEAR'`, o resto (posição/escala): lerp comum.
 *
 * `'CUBICSPLINE'` (tangentes por keyframe) não é suportado — nenhuma
 * animação deste projeto usa (`STEP`/`LINEAR` são os dois únicos tipos
 * exportados pela ferramenta de origem); lança erro claro em vez de ler
 * a tripla errada como se fosse um valor só.
 */
export function sampleTrackAt(times, values, interpolation, t) {
  if (interpolation === 'CUBICSPLINE') {
    throw new Error('interpolação CUBICSPLINE não suportada')
  }

  if (t <= times[0]) return values[0]
  const last = times.length - 1
  if (t >= times[last]) return values[last]

  let i = 0
  while (i < last && times[i + 1] < t) i++
  // `times[i] <= t < times[i + 1]` a partir daqui.

  if (interpolation === 'STEP') return values[i]

  const alpha = (t - times[i]) / (times[i + 1] - times[i])
  const a = values[i]
  const b = values[i + 1]
  return 'w' in a ? slerpQuaternions(a, b, alpha) : lerpVec3(a, b, alpha)
}

/** `{ index, name, duration }` de toda animação embutida no `.glb` — pra
 * listar antes de escolher qual converter (ver `scripts/extract-glb-
 * animation.mjs`). `duration` é o maior tempo de keyframe entre todos os
 * canais da animação (glTF não guarda duração explícita). */
export function listGltfAnimations({ json, bin }) {
  return json.animations.map((animation, index) => ({
    index,
    name: animation.name ?? `animation-${index}`,
    duration: resolveAnimationTimeRange(json, bin, animation).endTime,
    frames: resolveAnimationFrameCount(json, animation),
  }))
}

/**
 * Quantidade de keyframes da animação (o maior entre os canais — é a
 * mesma linha do tempo pra todos). É a unidade de `animationFrames` no
 * override de ataque (ver `core/data/attacks/_template/index.js`).
 */
function resolveAnimationFrameCount(json, animation) {
  let frames = 0
  for (const channel of animation.channels) {
    const sampler = animation.samplers[channel.sampler]
    frames = Math.max(frames, json.accessors[sampler.input].count)
  }
  return frames
}

function resolveAnimationTimeRange(json, bin, animation) {
  let startTime = Infinity
  let endTime = -Infinity
  for (const channel of animation.channels) {
    const sampler = animation.samplers[channel.sampler]
    const times = readAccessorFlat(json, bin, sampler.input)
    startTime = Math.min(startTime, times[0])
    endTime = Math.max(endTime, times[times.length - 1])
  }
  return { startTime, endTime }
}

/**
 * Converte UMA animação embutida num `.glb` (glTF `KeyframeTrack` por
 * canal, curva contínua — ver `sampleTrackAt`) pro formato de clipe de
 * keyframes do motor (`type: "keyframes"`, array de valores por frame,
 * ver `core/animation/applyAnimationClip.js`) — reamostra em
 * `fps` frames igualmente espaçados cobrindo o intervalo de tempo real
 * da animação (`resolveAnimationTimeRange` — os arquivos deste projeto
 * não começam necessariamente em t=0; o primeiro keyframe vira o frame 0
 * do clipe, não importa em que instante absoluto ele foi exportado).
 *
 * `animationRef` é o índice (number) ou o nome (string, `animation.name`)
 * da animação dentro de `json.animations`.
 *
 * Cada canal (`target.node` + `target.path`) vira um osso pelo NOME do
 * node (`json.nodes[node].name`) — o mesmo nome que `resolveBones.js` usa
 * como chave no rig carregado em jogo; canal de um node que não é osso do
 * skeleton (ex.: um node de malha/LOD) simplesmente não casa com nada em
 * `sampleKeyframeClip` no jogo, ignorado sem erro (mesma regra graciosa
 * de sempre). Canal `path: "weights"` (morph target) é pulado — sem
 * equivalente no formato.
 */
export function convertGltfAnimationToClip(
  { json, bin },
  animationRef,
  options = {},
) {
  const { fps = 30 } = options
  const animationIndex =
    typeof animationRef === 'number'
      ? animationRef
      : json.animations.findIndex((a) => a.name === animationRef)
  const animation = json.animations[animationIndex]
  if (!animation) {
    throw new Error(`animação "${animationRef}" não encontrada no .glb`)
  }

  const { startTime, endTime } = resolveAnimationTimeRange(json, bin, animation)
  const duration = endTime - startTime
  const frameCount = Math.max(2, Math.round(duration * fps) + 1)

  const bones = {}
  for (const channel of animation.channels) {
    const property = CHANNEL_PATH_TO_CLIP_PROPERTY[channel.target.path]
    if (!property) continue // "weights" (morph target) — sem equivalente

    const boneName = json.nodes[channel.target.node].name
    const sampler = animation.samplers[channel.sampler]
    const times = readAccessorFlat(json, bin, sampler.input)
    const rawValues = readAccessorFlat(json, bin, sampler.output)
    const toValue = property === 'quaternion' ? toQuaternion : toVec3
    const values = times.map((_, i) => toValue(rawValues, i))
    const interpolation = sampler.interpolation ?? 'LINEAR'

    const track = (bones[boneName] ??= {})
    track[property] = []
    for (let frame = 0; frame < frameCount; frame++) {
      const t = startTime + (frame / (frameCount - 1)) * duration
      track[property].push(sampleTrackAt(times, values, interpolation, t))
    }
  }

  return {
    name: animation.name ?? `animation-${animationIndex}`,
    type: 'keyframes',
    fps,
    bones,
  }
}
