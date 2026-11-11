import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { cloneTexture } from './textureCache'

// Docs/features/066-revisao-dos-biomas.md (desempenho).
describe('cloneTexture', () => {
  it('a cópia não marca a imagem compartilhada para subir de novo', () => {
    const texture = new THREE.Texture()
    texture.needsUpdate = true
    const imageVersion = texture.source.version

    const copy = cloneTexture(texture)

    expect(copy.source).toBe(texture.source)
    expect(texture.source.version).toBe(imageVersion)
  })

  it('a cópia fica pronta para ser montada e tem o recorte próprio', () => {
    const texture = new THREE.Texture()
    texture.needsUpdate = true

    const copy = cloneTexture(texture)
    copy.offset.set(0.5, 0.25)

    expect(copy.version).toBeGreaterThan(0)
    expect(texture.offset.x).toBe(0)
    expect(texture.offset.y).toBe(0)
  })
})
