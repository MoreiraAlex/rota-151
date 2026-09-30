import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  parseGlb,
  readAccessorFlat,
  sampleTrackAt,
  listGltfAnimations,
  convertGltfAnimationToClip,
} from './gltfAnimation'
import { applyAnimationClip } from './applyAnimationClip'
import { quaternionFromAxisAngle } from '@/core/math'

const IDENTITY = { x: 0, y: 0, z: 0, w: 1 }
const HALF_TURN_Z = quaternionFromAxisAngle('z', Math.PI)

/**
 * Monta um `{ json, bin }` sintético mínimo: 1 osso ("arm"), 2 keyframes,
 * NÃO começando em t=0 (0.5s → 1.5s — mesmo padrão real encontrado nos
 * `.glb` deste projeto, todo mundo começa em 1 frame a 60fps = 0.0167s,
 * nunca em 0 exato) — `translation` em LINEAR (0,0,0 → 2,0,0),
 * `rotation` em STEP (identidade → meia-volta em Z).
 *
 * Layout do buffer (64 bytes): [0..8) times (2 floats, compartilhado
 * pelos dois samplers) · [8..32) valores de translation (2×VEC3) ·
 * [32..64) valores de rotation (2×VEC4).
 */
function buildFixture() {
  const bin = new Uint8Array(64)
  const view = new DataView(bin.buffer)
  const floats = [
    0.5,
    1.5, // times
    0,
    0,
    0,
    2,
    0,
    0, // translation: (0,0,0) → (2,0,0)
    0,
    0,
    0,
    1,
    HALF_TURN_Z.x,
    HALF_TURN_Z.y,
    HALF_TURN_Z.z,
    HALF_TURN_Z.w, // rotation: identidade → meia-volta em Z
  ]
  floats.forEach((value, i) => view.setFloat32(i * 4, value, true))

  const json = {
    asset: { version: '2.0' },
    nodes: [{ name: 'root' }, { name: 'arm' }],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        count: 2,
        type: 'SCALAR',
        min: [0.5],
        max: [1.5],
      },
      { bufferView: 1, componentType: 5126, count: 2, type: 'VEC3' },
      { bufferView: 2, componentType: 5126, count: 2, type: 'VEC4' },
    ],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: 8 },
      { buffer: 0, byteOffset: 8, byteLength: 24 },
      { buffer: 0, byteOffset: 32, byteLength: 32 },
    ],
    buffers: [{ byteLength: 64 }],
    animations: [
      {
        name: 'test-anim',
        samplers: [
          { input: 0, output: 1, interpolation: 'LINEAR' },
          { input: 0, output: 2, interpolation: 'STEP' },
        ],
        channels: [
          { sampler: 0, target: { node: 1, path: 'translation' } },
          { sampler: 1, target: { node: 1, path: 'rotation' } },
        ],
      },
    ],
  }

  return { json, bin }
}

describe('parseGlb', () => {
  it('separa um .glb de verdade nos chunks JSON e BIN', () => {
    const { json: fixtureJson, bin: fixtureBin } = buildFixture()
    const jsonText = JSON.stringify(fixtureJson)
    // Cada chunk alinhado a 4 bytes (padding com espaço/zero) — regra do
    // formato .glb; o buffer de teste já nasce múltiplo de 4 nos dois casos.
    const jsonBytes = new TextEncoder().encode(jsonText)
    const totalLength = 12 + 8 + jsonBytes.length + 8 + fixtureBin.length
    const glb = new Uint8Array(totalLength)
    const view = new DataView(glb.buffer)
    view.setUint32(0, 0x46546c67, true) // magic "glTF"
    view.setUint32(4, 2, true) // version
    view.setUint32(8, totalLength, true)
    view.setUint32(12, jsonBytes.length, true)
    view.setUint32(16, 0x4e4f534a, true) // "JSON"
    glb.set(jsonBytes, 20)
    const binChunkStart = 20 + jsonBytes.length
    view.setUint32(binChunkStart, fixtureBin.length, true)
    view.setUint32(binChunkStart + 4, 0x004e4942, true) // "BIN\0"
    glb.set(fixtureBin, binChunkStart + 8)

    const { json, bin } = parseGlb(glb)
    expect(json.animations[0].name).toBe('test-anim')
    expect(bin.length).toBe(64)
  })

  it('lança erro claro num buffer sem a assinatura "glTF"', () => {
    expect(() => parseGlb(new Uint8Array(20))).toThrow(/glTF/)
  })
})

describe('readAccessorFlat', () => {
  it('lê um accessor FLOAT/VEC3 de volta como array plano', () => {
    const { json, bin } = buildFixture()
    expect(readAccessorFlat(json, bin, 1)).toEqual([0, 0, 0, 2, 0, 0])
  })
})

describe('sampleTrackAt', () => {
  const times = [0.5, 1.5]
  const values = [
    { x: 0, y: 0, z: 0 },
    { x: 2, y: 0, z: 0 },
  ]

  it('LINEAR: interpola entre os dois keyframes, proporcional ao tempo (não só na metade)', () => {
    expect(sampleTrackAt(times, values, 'LINEAR', 1.0)).toEqual({
      x: 1,
      y: 0,
      z: 0,
    })
    // t=0.75 fica a 1/4 do caminho entre 0.5s e 1.5s (alpha=0.25), não na
    // metade — pega uma alpha errada cravada (ex.: sempre 0.5).
    expect(sampleTrackAt(times, values, 'LINEAR', 0.75)).toEqual({
      x: 0.5,
      y: 0,
      z: 0,
    })
  })

  it('STEP: mantém o keyframe anterior até alcançar o próximo', () => {
    const quatValues = [IDENTITY, HALF_TURN_Z]
    expect(sampleTrackAt(times, quatValues, 'STEP', 1.49)).toEqual(IDENTITY)
    expect(sampleTrackAt(times, quatValues, 'STEP', 1.5)).toEqual(HALF_TURN_Z)
  })

  it('antes do 1º / depois do último keyframe: clampa nas pontas', () => {
    expect(sampleTrackAt(times, values, 'LINEAR', 0)).toEqual(values[0])
    expect(sampleTrackAt(times, values, 'LINEAR', 99)).toEqual(values[1])
  })

  it('rotação em LINEAR faz slerp, não lerp componente a componente', () => {
    const quatValues = [IDENTITY, HALF_TURN_Z]
    const mid = sampleTrackAt(times, quatValues, 'LINEAR', 1.0)
    // Meio caminho (slerp) de identidade a 180° em Z é 90° em Z — lerp
    // ingênuo de {0,0,0,1}→{0,0,1,0} daria {0,0,0.5,0.5}, não normalizado.
    const expected = quaternionFromAxisAngle('z', Math.PI / 2)
    expect(mid.x).toBeCloseTo(expected.x)
    expect(mid.z).toBeCloseTo(expected.z)
    expect(mid.w).toBeCloseTo(expected.w)
    expect(Math.hypot(mid.x, mid.y, mid.z, mid.w)).toBeCloseTo(1)
  })

  it('CUBICSPLINE não é suportado — lança erro claro em vez de ler tangentes como valor', () => {
    expect(() => sampleTrackAt(times, values, 'CUBICSPLINE', 1.0)).toThrow(
      /CUBICSPLINE/,
    )
  })
})

describe('listGltfAnimations', () => {
  it('lista nome e duração (maior tempo de keyframe entre os canais)', () => {
    const fixture = buildFixture()
    expect(listGltfAnimations(fixture)).toEqual([
      { index: 0, name: 'test-anim', duration: 1.5, frames: 2 },
    ])
  })
})

describe('convertGltfAnimationToClip — de ponta a ponta, com o sampler de verdade do motor', () => {
  it('o clipe convertido, tocado por applyAnimationClip, reproduz os valores gravados', () => {
    const fixture = buildFixture()
    const clip = convertGltfAnimationToClip(fixture, 'test-anim', { fps: 4 })

    expect(clip.type).toBe('keyframes')
    // duração 1.0s (1.5 - 0.5) a 4fps → 5 frames (0, 0.25, 0.5, 0.75, 1s).
    expect(clip.bones.arm.position).toHaveLength(5)

    const bones = { arm: makeEntry() }
    // `speed=1`: 1 ciclo = 1s de tempo do CLIPE (não do arquivo original —
    // o clipe convertido tem timeline própria, começando em 0, não em
    // 0.5s como no .glb). t=0.4 cai exatamente no frame 2 (t_glb=1.0s).
    applyAnimationClip(clip, bones, 0.4, 1)
    expect(bones.arm.bone.position).toMatchObject({ x: 1, y: 0, z: 0 })
    // STEP: em t_glb=1.0s ainda não chegou no 2º keyframe (1.5s) — segue identidade.
    expect(bones.arm.bone.quaternion).toMatchObject(IDENTITY)

    // t=0 (frame 0, começo do clipe) = o 1º keyframe gravado.
    applyAnimationClip(clip, bones, 0, 1)
    expect(bones.arm.bone.position).toMatchObject({ x: 0, y: 0, z: 0 })

    // t=0.8 (frame 4 de 5, ÚLTIMO frame do clipe, sem contaminar com o
    // wrap — framePosition cai exatamente em 4.0, alpha=0) = o último
    // keyframe gravado.
    applyAnimationClip(clip, bones, 0.8, 1)
    expect(bones.arm.bone.position).toMatchObject({ x: 2, y: 0, z: 0 })
    expect(bones.arm.bone.quaternion.z).toBeCloseTo(HALF_TURN_Z.z)
    expect(bones.arm.bone.quaternion.w).toBeCloseTo(HALF_TURN_Z.w)

    // t=1 (1 ciclo inteiro decorrido) envolve de volta pro frame 0 — o
    // clipe convertido é cíclico igual a qualquer outro (ver docstring de
    // `sampleKeyframeClip`, `applyAnimationClip.js`), não para no fim.
    applyAnimationClip(clip, bones, 1, 1)
    expect(bones.arm.bone.position).toMatchObject({ x: 0, y: 0, z: 0 })
  })

  it('aceita o índice numérico da animação, não só o nome', () => {
    const fixture = buildFixture()
    expect(convertGltfAnimationToClip(fixture, 0).name).toBe('test-anim')
  })

  it('animação inexistente lança erro claro', () => {
    const fixture = buildFixture()
    expect(() => convertGltfAnimationToClip(fixture, 'não-existe')).toThrow(
      /não encontrada/,
    )
  })
})

function makeEntry() {
  return {
    bone: {
      quaternion: {
        ...IDENTITY,
        set(x, y, z, w) {
          this.x = x
          this.y = y
          this.z = z
          this.w = w
        },
      },
      position: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
    },
    rest: {
      position: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
    },
    restQuaternion: { ...IDENTITY },
  }
}

// ---------------------------------------------------------------------------
// Arquivo de verdade (`public/assets/models/`, versionado no git — mesma
// convenção de usar um asset real já usada em `applyAnimationClip.test.js`,
// `fox-walk.json`): só um teste de fumaça, sem valor numérico esperado (não
// dá pra conferir à mão a curva de um rig de verdade) — prova que o
// parser/conversor não quebra contra dados reais e exportados por outra
// ferramenta, incluindo o `STEP`/`LINEAR` misturado que este arquivo usa.
describe('convertGltfAnimationToClip — arquivo real (001-bulbasaur.glb)', () => {
  const modelPath = fileURLToPath(
    new URL('../../../public/assets/models/001-bulbasaur.glb', import.meta.url),
  )

  it('lista as animações embutidas e converte o walk sem lançar erro', () => {
    const fixture = parseGlb(readFileSync(modelPath))
    const animations = listGltfAnimations(fixture)

    expect(animations.length).toBeGreaterThan(0)
    const walk = animations.find((a) => a.name === 'walk')
    expect(walk).toBeDefined()
    expect(walk.frames).toBeGreaterThan(1)

    const clip = convertGltfAnimationToClip(fixture, walk.name, { fps: 30 })
    expect(clip.type).toBe('keyframes')
    // Osso de verdade do rig (perna) — se o mapeamento node→nome quebrar,
    // este bone não apareceria no clipe.
    expect(clip.bones.left_leg_01).toBeDefined()

    // Frames variam de verdade (não é uma conversão degenerada, tudo igual).
    const ys = clip.bones.left_leg_01.quaternion.map((q) => q.y)
    expect(new Set(ys.map((y) => y.toFixed(4))).size).toBeGreaterThan(1)
  })
})
