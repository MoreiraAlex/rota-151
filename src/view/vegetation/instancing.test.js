import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { buildLodKindMeshes, finishMesh } from './instancing'

// Um modelo de uma parte, com a versão de longe.
function makeModel() {
  const part = () => ({
    kind: 'solid',
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
