import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { buildItemModel } from './itemModelBuild'

// Uma "fruta": corpo (cubo de lado 2, centro na origem) e folhas bem acima,
// que puxam a caixa do modelo inteiro pra cima.
function fakeBerry() {
  const scene = new THREE.Group()
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(2, 2, 2),
    new THREE.MeshBasicMaterial(),
  )
  body.name = 'fruit_0'
  const leaves = new THREE.Mesh(
    new THREE.BoxGeometry(1, 2, 1),
    new THREE.MeshBasicMaterial(),
  )
  leaves.name = 'leaves'
  leaves.position.y = 3
  scene.add(body, leaves)
  return scene
}

const CONFIG = { size: 1, eatStages: ['fruit_0'] }

function worldCenterOf(model, name) {
  model.root.updateMatrixWorld(true)
  return new THREE.Box3()
    .setFromObject(model.root.getObjectByName(name))
    .getCenter(new THREE.Vector3())
}

describe('buildItemModel', () => {
  it('centra no corpo da fruta, não na caixa com as folhas', () => {
    const model = buildItemModel(fakeBerry(), CONFIG, 'center')

    const center = worldCenterOf(model, 'fruit_0')
    expect(center.x).toBeCloseTo(0)
    expect(center.y).toBeCloseTo(0)
    expect(center.z).toBeCloseTo(0)
  })

  it('girar o pivô não tira o corpo do lugar (gira no próprio eixo)', () => {
    const model = buildItemModel(fakeBerry(), CONFIG, 'bottom')
    const before = worldCenterOf(model, 'fruit_0')

    model.pivot.rotation.set(0.7, 1.2, -0.4)
    const after = worldCenterOf(model, 'fruit_0')

    expect(after.distanceTo(before)).toBeLessThan(1e-6)
  })

  it('no chão (`bottom`), a base do modelo fica na origem', () => {
    const model = buildItemModel(fakeBerry(), CONFIG, 'bottom')
    model.root.updateMatrixWorld(true)

    const box = new THREE.Box3().setFromObject(model.root)
    expect(box.min.y).toBeCloseTo(0)
  })

  it('redimensiona pra maior dimensão ser o `size`', () => {
    const model = buildItemModel(
      fakeBerry(),
      { ...CONFIG, size: 0.2 },
      'center',
    )
    model.root.updateMatrixWorld(true)

    const size = new THREE.Box3()
      .setFromObject(model.root)
      .getSize(new THREE.Vector3())
    expect(Math.max(size.x, size.y, size.z)).toBeCloseTo(0.2)
  })
})
