import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { GAME_CONFIG } from '@/core/gameConfig'
import {
  OutlineMaterial,
  ToonRimMaterial,
  applyToonLook,
  createOutline,
  isOutline,
  shouldOutline,
  toToonMaterial,
} from './toonMaterial'

const { RENDER } = GAME_CONFIG

function modelWithMeshes(materials) {
  const root = new THREE.Group()
  const meshes = materials.map((material, index) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), material)
    mesh.name = `mesh-${index}`
    root.add(mesh)
    return mesh
  })
  return { root, meshes }
}

describe('toToonMaterial', () => {
  it('material novo, com a aparência do original, sem mexer nele', () => {
    const map = new THREE.Texture()
    const source = new THREE.MeshStandardMaterial({
      name: 'corpo',
      map,
      color: '#ff0000',
    })
    const toon = toToonMaterial(source)

    expect(toon).not.toBe(source)
    expect(toon).toBeInstanceOf(THREE.MeshToonMaterial)
    expect(toon.map).toBe(map)
    expect(toon.color.getHex()).toBe(source.color.getHex())
    expect(toon.color).not.toBe(source.color)
    expect(toon.gradientMap).not.toBeNull()
    expect(toon.emissive).toBeDefined() // o hit flash acende por aqui
  })
})

describe('clone mantém o shader (hit flash e tint clonam o material)', () => {
  it('rim e contorno sobrevivem ao clone()', () => {
    const rim = new ToonRimMaterial().clone()
    expect(rim).toBeInstanceOf(ToonRimMaterial)
    expect(typeof rim.onBeforeCompile).toBe('function')
    expect(rim.customProgramCacheKey()).toBe(
      new ToonRimMaterial().customProgramCacheKey(),
    )

    const outline = new OutlineMaterial().clone()
    expect(outline).toBeInstanceOf(OutlineMaterial)
    expect(outline.side).toBe(THREE.BackSide)
    expect(outline.color.getHex()).toBe(
      new THREE.Color(RENDER.OUTLINE_COLOR).getHex(),
    )
  })
})

describe('contorno', () => {
  it('pula transparente e material listado em OUTLINE_SKIP', () => {
    const [skipName] = RENDER.OUTLINE_SKIP
    expect(shouldOutline({ material: new THREE.MeshBasicMaterial() })).toBe(
      true,
    )
    expect(
      shouldOutline({
        material: new THREE.MeshBasicMaterial({ transparent: true }),
      }),
    ).toBe(false)
    if (skipName) {
      expect(
        shouldOutline({
          material: new THREE.MeshBasicMaterial({ name: `x-${skipName}` }),
        }),
      ).toBe(false)
    }
  })

  it('nasce irmão do mesh, com a mesma geometria, marcado como contorno', () => {
    const { root, meshes } = modelWithMeshes([new THREE.MeshBasicMaterial()])
    const outline = createOutline(meshes[0])

    expect(outline.parent).toBe(root)
    expect(outline.geometry).toBe(meshes[0].geometry)
    expect(isOutline(outline)).toBe(true)
    expect(isOutline(meshes[0])).toBe(false)
  })
})

describe('applyToonLook', () => {
  it('aplica e o cleanup devolve tudo como estava (seguro pra rodar de novo)', () => {
    const originals = [
      new THREE.MeshStandardMaterial(),
      new THREE.MeshStandardMaterial({ transparent: true }),
    ]
    const { root, meshes } = modelWithMeshes(originals)

    const undo = applyToonLook(meshes)
    expect(meshes[0].material).toBeInstanceOf(THREE.MeshToonMaterial)
    // só o opaco ganha contorno
    expect(root.children.filter(isOutline)).toHaveLength(1)

    undo()
    expect(meshes.map((mesh) => mesh.material)).toEqual(originals)
    expect(root.children.filter(isOutline)).toHaveLength(0)

    // StrictMode: aplica de novo a partir do original, não do toon
    const undoAgain = applyToonLook(meshes)
    expect(root.children.filter(isOutline)).toHaveLength(1)
    undoAgain()
  })

  it('libera os toons que criou, mesmo se o mesh trocou de material depois', () => {
    const { meshes } = modelWithMeshes([new THREE.MeshStandardMaterial()])
    const undo = applyToonLook(meshes)
    const toon = meshes[0].material
    let disposed = false
    toon.addEventListener('dispose', () => {
      disposed = true
    })
    meshes[0].material = toon.clone() // ex.: o hit flash

    undo()
    expect(disposed).toBe(true)
  })
})
