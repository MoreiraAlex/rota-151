import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { addSeeThrough, withSeeThrough } from './seeThrough'

// Os materiais da cena que recebem o ver-através (toon do LGPE, Lambert e
// Standard dos outros objetos).
const LIBS = ['toon', 'lambert', 'standard']

describe('ver-através', () => {
  it.each(LIBS)('acha os pontos de encaixe no shader %s', (lib) => {
    const { vertexShader, fragmentShader } = THREE.ShaderLib[lib]
    const shader = { uniforms: {}, vertexShader, fragmentShader }
    addSeeThrough(shader)
    expect(shader.vertexShader).toContain('vSeeWorld = ')
    expect(shader.fragmentShader).toContain('seeThroughOpacity(vSeeWorld)')
    expect(shader.uniforms.uSeeEnabled).toBeDefined()
  })

  it('separa o programa no cache e não liga duas vezes', () => {
    const material = new THREE.MeshStandardMaterial()
    const plain = material.customProgramCacheKey()
    withSeeThrough(material)
    const key = material.customProgramCacheKey()
    expect(key).not.toBe(plain)
    withSeeThrough(material)
    expect(material.customProgramCacheKey()).toBe(key)

    const shader = {
      uniforms: {},
      vertexShader: THREE.ShaderLib.standard.vertexShader,
      fragmentShader: THREE.ShaderLib.standard.fragmentShader,
    }
    material.onBeforeCompile(shader)
    const hooks = shader.fragmentShader.split('seeThroughOpacity(vSeeWorld)')
    expect(hooks).toHaveLength(2)
  })
})
