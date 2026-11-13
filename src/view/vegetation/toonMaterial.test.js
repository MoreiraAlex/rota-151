import { afterEach, describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { GAME_CONFIG } from '@/core/gameConfig'
import { applyToonLook, createToonMaterial, setNightGlow } from './toonMaterial'

// Some perto da câmera (docs/features/066-revisao-dos-biomas.md, item 1):
// a copa, as pedras e os prédios.
const BASE = {
  map: null,
  cutoff: 0.5,
  doubleSided: true,
  vertexColors: false,
  rimColor: null,
  rim: null,
  sway: 'tree',
  height: 4,
}

// Roda o `onBeforeCompile` num shader com os pedaços que ele troca.
function compiled(material) {
  const shader = {
    uniforms: {},
    vertexShader: [
      'void main() {',
      '#include <begin_vertex>',
      '#include <color_vertex>',
      '#include <uv_vertex>',
      '#include <project_vertex>',
      '#include <fog_vertex>',
      '}',
    ].join('\n'),
    fragmentShader: [
      'void main() {',
      '#include <clipping_planes_fragment>',
      '#include <gradientmap_pars_fragment>',
      '#include <map_fragment>',
      '#include <opaque_fragment>',
      '}',
    ].join('\n'),
  }
  material.onBeforeCompile(shader)
  return shader
}

const NEAR_HIDE = GAME_CONFIG.CAMERA.NEAR_HIDE
const original = structuredClone(NEAR_HIDE)
afterEach(() => Object.assign(NEAR_HIDE, structuredClone(original)))

describe('some perto da câmera (createToonMaterial)', () => {
  it('com a caixa, o material some perto da câmera e tem programa próprio', () => {
    const box = new THREE.Box3(
      new THREE.Vector3(-2, 1, -2),
      new THREE.Vector3(2, 5, 2),
    )
    const leaves = createToonMaterial({
      ...BASE,
      nearHide: { box, kind: 'CANOPY' },
    })
    const plain = createToonMaterial(BASE)

    expect('LGPE_NEAR_HIDE' in leaves.defines).toBe(true)
    expect('LGPE_NEAR_HIDE' in plain.defines).toBe(false)
    expect(leaves.customProgramCacheKey()).not.toBe(
      plain.customProgramCacheKey(),
    )

    const shader = compiled(leaves)
    expect(shader.uniforms.uNearBoxMin.value.equals(box.min)).toBe(true)
    expect(shader.uniforms.uNearBoxMax.value.equals(box.max)).toBe(true)
    // Some no vertex shader (sem pixel) e pontilha no começo do fragmento.
    expect(shader.vertexShader).toContain('lgpeNearKeep()')
    expect(shader.fragmentShader).toMatch(
      /clipping_planes_fragment>[\s\S]*vNearKeep[\s\S]*discard/,
    )
  })

  it('a caixa é copiada: mexer na original não muda o material', () => {
    const box = new THREE.Box3(new THREE.Vector3(), new THREE.Vector3(1, 1, 1))
    const shader = compiled(
      createToonMaterial({ ...BASE, nearHide: { box, kind: 'SOLID' } }),
    )
    box.max.set(9, 9, 9)
    expect(shader.uniforms.uNearBoxMax.value.x).not.toBe(9)
  })

  it('cada tipo leva a distância e a faixa dele; desligado, nunca some', () => {
    const box = new THREE.Box3(new THREE.Vector3(), new THREE.Vector3(1, 1, 1))
    const uniformsOf = (kind) => {
      const material = createToonMaterial({ ...BASE, nearHide: { box, kind } })
      return { material, uniforms: compiled(material).uniforms }
    }
    const canopy = uniformsOf('CANOPY')
    const solid = uniformsOf('SOLID')
    const materials = [canopy.material, solid.material]

    NEAR_HIDE.CANOPY.HIDE += 1
    applyToonLook(materials)
    for (const [kind, { uniforms }] of [
      ['CANOPY', canopy],
      ['SOLID', solid],
    ]) {
      expect(uniforms.uNearHide.value.x).toBe(NEAR_HIDE[kind].HIDE)
      expect(uniforms.uNearHide.value.y).toBe(NEAR_HIDE[kind].FADE)
    }

    NEAR_HIDE.ENABLED = false
    applyToonLook(materials)
    // A câmera nunca fica tão fundo dentro de uma caixa: inteiro sempre.
    for (const { uniforms } of [canopy, solid]) {
      expect(
        uniforms.uNearHide.value.x + uniforms.uNearHide.value.y,
      ).toBeLessThan(-1000)
    }
  })
})

// O chão misturado do mapa de uma cidade copiada (docs/features/069-
// revisao-do-bioma-cidade.md — Pallet): a camada de cima pelo canal
// vermelho do vértice.
describe('camada do chão misturado (createToonMaterial)', () => {
  const GROUND = { ...BASE, sway: null, cutoff: null }

  it('sem camada, sem a mistura', () => {
    const material = createToonMaterial(GROUND)
    expect(material.defines.LGPE_LAYER).toBeUndefined()
  })

  it('com a camada, mistura no UV escolhido e tem programa próprio', () => {
    const plain = createToonMaterial(GROUND)
    const layerMap = new THREE.Texture()
    const onUv0 = createToonMaterial({ ...GROUND, layerMap, layerUv: 0 })
    const onUv1 = createToonMaterial({ ...GROUND, layerMap, layerUv: 1 })
    expect(onUv0.defines.LGPE_LAYER).toBe('')
    expect(onUv0.defines.LGPE_LAYER_UV1).toBeUndefined()
    expect(onUv1.defines.LGPE_LAYER_UV1).toBe('')
    const keys = new Set(
      [plain, onUv0, onUv1].map((material) => material.customProgramCacheKey()),
    )
    expect(keys.size).toBe(3)
    const shader = compiled(onUv1)
    expect(shader.uniforms.uLayerMap.value).toBe(layerMap)
    expect(shader.fragmentShader).toContain('uLayerMap')
    expect(shader.vertexShader).toContain('vLayerWeight')
  })
})

// A luz dos postes à noite (docs/features/069-revisao-do-bioma-cidade.md):
// o vidro acende com a noite, na cor do config.
describe('luz dos postes (createToonMaterial)', () => {
  const GLASS = { ...BASE, sway: null, cutoff: null }
  const LAMP_GLOW = GAME_CONFIG.LGPE.LAMP_GLOW
  const originalGlow = { ...LAMP_GLOW }
  afterEach(() => {
    Object.assign(LAMP_GLOW, originalGlow)
    setNightGlow(0)
  })

  it('só o que acende tem a luz, num programa próprio', () => {
    const plain = createToonMaterial(GLASS)
    const glass = createToonMaterial({ ...GLASS, glow: true })
    expect(plain.defines.LGPE_GLOW).toBeUndefined()
    expect(glass.defines.LGPE_GLOW).toBe('')
    expect(glass.customProgramCacheKey()).not.toBe(
      plain.customProgramCacheKey(),
    )
    // Depois da luz da cena (e da tinta): a cor não depende dela.
    expect(compiled(glass).fragmentShader).toMatch(
      /uNightGlow[\s\S]*#include <opaque_fragment>/,
    )
  })

  it('a noite vai de 0 a 1 e a cor segue o config ao vivo', () => {
    const uniforms = compiled(
      createToonMaterial({ ...GLASS, glow: true }),
    ).uniforms
    setNightGlow(2)
    expect(uniforms.uNightGlow.value).toBe(1)
    setNightGlow(-1)
    expect(uniforms.uNightGlow.value).toBe(0)

    LAMP_GLOW.STRENGTH = originalGlow.STRENGTH * 2
    applyToonLook()
    const strong = uniforms.uGlowColor.value.clone()
    LAMP_GLOW.STRENGTH = originalGlow.STRENGTH
    applyToonLook()
    expect(strong.r).toBeCloseTo(uniforms.uGlowColor.value.r * 2)
  })
})
