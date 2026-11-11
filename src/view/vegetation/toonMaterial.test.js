import { afterEach, describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { GAME_CONFIG } from '@/core/gameConfig'
import { applyToonLook, createToonMaterial } from './toonMaterial'

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
