import * as THREE from 'three'
import { afterEach, describe, expect, it } from 'vitest'
import { GAME_CONFIG } from '@/core/gameConfig'
import { CHARACTER_STENCIL, markAsCharacter } from './characterStencil'
import { applyOverPlants, updateOverPlants } from './overPlants'

// O aviso de golpe por cima das plantas e os personagens no stencil (066).
const OVER = GAME_CONFIG.FEEDBACK.ATTACK_TELEGRAPH.OVER_PLANTS
const original = { ...OVER }
afterEach(() => Object.assign(OVER, original))

describe('personagens no stencil', () => {
  it('o personagem marca o bit dele onde aparece', () => {
    const material = markAsCharacter(new THREE.MeshToonMaterial())
    expect(material.stencilWrite).toBe(true)
    expect(material.stencilRef).toBe(CHARACTER_STENCIL)
    expect(material.stencilZPass).toBe(THREE.ReplaceStencilOp)
  })

  it('o aviso não desenha onde há personagem e não mexe no stencil', () => {
    const material = applyOverPlants(new THREE.MeshBasicMaterial())
    expect(material.stencilWrite).toBe(true)
    expect(material.stencilRef).toBe(CHARACTER_STENCIL)
    expect(material.stencilFunc).toBe(THREE.NotEqualStencilFunc)
    expect(material.stencilWriteMask).toBe(0)
  })
})

describe('aviso por cima das plantas', () => {
  it('a altura da camada vem do config e vale ao vivo', () => {
    const material = applyOverPlants(new THREE.MeshBasicMaterial())
    const uniforms = material.userData.overPlants
    expect(uniforms.uOverPlantsHeight.value).toBe(OVER.HEIGHT)
    OVER.HEIGHT = OVER.HEIGHT + 1
    updateOverPlants(material)
    expect(uniforms.uOverPlantsHeight.value).toBe(OVER.HEIGHT)
  })

  it('desligado, não puxa nada', () => {
    const material = applyOverPlants(new THREE.MeshBasicMaterial())
    OVER.ENABLED = false
    updateOverPlants(material)
    expect(material.userData.overPlants.uOverPlantsHeight.value).toBe(0)
  })

  it('o shader puxa só a profundidade, depois de projetar', () => {
    const material = applyOverPlants(new THREE.MeshBasicMaterial())
    const shader = {
      uniforms: {},
      vertexShader: 'void main() {\n#include <project_vertex>\n}',
    }
    material.onBeforeCompile(shader)
    expect(shader.vertexShader).toContain('#include <project_vertex>')
    expect(shader.vertexShader).toContain('gl_Position.z =')
    expect(shader.vertexShader).not.toMatch(/gl_Position\.(xy|x|y) =/)
    expect(shader.uniforms.uOverPlantsHeight).toBe(
      material.userData.overPlants.uOverPlantsHeight,
    )
  })
})
