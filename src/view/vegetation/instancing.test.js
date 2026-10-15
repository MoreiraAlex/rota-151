import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { buildLodKindMeshes, buildModelMeshes, finishMesh } from './instancing'

// Um modelo de uma parte, com a versão de longe.
function makeModel() {
  const part = () => ({
    kind: 'toon',
    geometry: new THREE.BoxGeometry(),
    material: new THREE.MeshBasicMaterial(),
  })
  return {
    name: 'model',
    parts: [part()],
    far: { name: 'far', parts: [part()] },
  }
}

const instances = Array.from({ length: 6 }, (_, index) => ({
  x: index * 10,
  y: 0,
  z: 0,
  yaw: 0,
  scale: 1,
  variant: 0,
}))
const limit = instances[2].x + 1
const isNear = (item) => item.x < limit
const nearCount = instances.filter(isNear).length

const xOf = (mesh, index) => {
  const matrix = new THREE.Matrix4()
  mesh.getMatrixAt(index, matrix)
  return new THREE.Vector3().setFromMatrixPosition(matrix).x
}

describe('buildLodKindMeshes', () => {
  it('divide as instâncias entre a malha de perto e a de longe', () => {
    const {
      meshes: [near, far],
      setNear,
    } = buildLodKindMeshes([makeModel()], instances)
    setNear(isNear)

    expect(near.count).toBe(nearCount)
    expect(far.count).toBe(instances.length - nearCount)
    expect(xOf(near, 0)).toBe(instances.find(isNear).x)
    expect(xOf(far, 0)).toBe(instances.find((item) => !isNear(item)).x)
  })

  it('não regrava as instâncias quando a divisão não muda', () => {
    const { meshes, setNear } = buildLodKindMeshes([makeModel()], instances)
    setNear(isNear)
    const versions = meshes.map((mesh) => mesh.instanceMatrix.version)

    setNear((item) => isNear(item))
    expect(meshes.map((mesh) => mesh.instanceMatrix.version)).toEqual(versions)

    setNear(() => true)
    meshes.forEach((mesh, index) =>
      expect(mesh.instanceMatrix.version).toBeGreaterThan(versions[index]),
    )
    expect(meshes[0].count).toBe(instances.length)
    expect(meshes[1].count).toBe(0)
  })
})

describe('finishMesh', () => {
  it('a malha fica parada na origem, sem recalcular a matriz a cada quadro', () => {
    const mesh = finishMesh(
      new THREE.InstancedMesh(
        new THREE.BoxGeometry(),
        new THREE.MeshBasicMaterial(),
        1,
      ),
    )
    expect(mesh.matrixAutoUpdate).toBe(false)
    expect(mesh.matrix.equals(new THREE.Matrix4())).toBe(true)
  })
})

describe('buildModelMeshes', () => {
  const recolorOf = (mesh) =>
    Array.from(mesh.geometry.getAttribute('aRecolor').array.slice(0, 4))
  const twoParts = {
    name: 'two',
    parts: ['roof', 'wall'].map((materialName) => ({
      kind: 'toon',
      geometry: new THREE.BoxGeometry(),
      material: new THREE.MeshBasicMaterial(),
      materialName,
    })),
  }
  const tint = [0.2, 0.4, 0.8, 0.5]
  // A tinta como fica no atributo (float32).
  const stored = Array.from(Float32Array.from(tint))

  it('sem recolorOf, a tinta da instância vai em todas as partes', () => {
    const meshes = buildModelMeshes(twoParts, [
      { ...instances[0], recolor: tint },
    ])
    for (const mesh of meshes) expect(recolorOf(mesh)).toEqual(stored)
  })

  it('com recolorOf, cada parte leva a própria tinta (ou nenhuma)', () => {
    const meshes = buildModelMeshes(twoParts, [instances[0]], {
      recolorOf: (part) => (part.materialName === 'roof' ? tint : undefined),
    })
    expect(recolorOf(meshes[0])).toEqual(stored)
    expect(recolorOf(meshes[1])).toEqual([0, 0, 0, 0])
  })
})
