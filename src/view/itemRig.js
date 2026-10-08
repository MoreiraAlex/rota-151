import * as THREE from 'three'

const DEG = Math.PI / 180

/**
 * Reaproveita as animações de um item em outro de peças iguais
 * (docs/features/043-captura.md): as Pokébolas são todas "tampa + base",
 * mas só a Poké Bola tem o esqueleto de nós que os clipes mexem
 * (`poke-ball > rock > body > [bottom, hinge > [button, top]]`). Este módulo
 * monta esse MESMO esqueleto em volta das peças do item (`target`), na
 * escala dele, pra os clipes da origem (`item.model.clipsFrom`) tocarem
 * nele.
 *
 * - `rigLikeSource(target, sourceScene, { rotation })` — `rotation` (graus)
 *   endireita o modelo antes (a origem é Y pra cima, a tampa abrindo pra
 *   trás, -Z). Cada nó de grupo da origem vira um grupo novo com o mesmo
 *   nome, a mesma rotação e a posição multiplicada pela razão de tamanho
 *   (`scale` = raio do item ÷ raio da origem); cada peça (malha) da origem
 *   com o MESMO nome no item é pendurada no grupo correspondente, sem sair do
 *   lugar. Devolve `{ object, scale }`.
 * - `scalePositionTracks(clip, scale)` — as trilhas de posição dos clipes da
 *   origem estão na unidade dela: multiplica pela mesma razão.
 */
export function rigLikeSource(target, sourceScene, { rotation } = {}) {
  const container = new THREE.Group()
  const turned = new THREE.Group()
  turned.rotation.set(
    (rotation?.x ?? 0) * DEG,
    (rotation?.y ?? 0) * DEG,
    (rotation?.z ?? 0) * DEG,
  )
  turned.add(target)
  container.add(turned)
  container.updateMatrixWorld(true)

  const targetBox = new THREE.Box3().setFromObject(container)
  const targetCenter = targetBox.getCenter(new THREE.Vector3())
  sourceScene.updateMatrixWorld(true)
  const sourceBox = new THREE.Box3().setFromObject(sourceScene)
  const sourceCenter = sourceBox.getCenter(new THREE.Vector3())
  const sourceRadius = largestHalf(sourceBox)
  const scale = sourceRadius > 0 ? largestHalf(targetBox) / sourceRadius : 1

  const targetNodes = new Map()
  target.traverse((node) => {
    if (node !== target && node.name) targetNodes.set(node.name, node)
  })

  // A origem da cena da origem cai no mesmo ponto relativo ao centro.
  const rigRoot = new THREE.Group()
  rigRoot.position.copy(targetCenter).addScaledVector(sourceCenter, -scale)
  container.add(rigRoot)

  const parts = []
  const copy = (source, parent) => {
    const part = targetNodes.get(source.name)
    if (part?.isMesh) {
      parts.push({ parent, part })
      return
    }
    const node = new THREE.Group()
    node.name = source.name
    node.position.copy(source.position).multiplyScalar(scale)
    node.quaternion.copy(source.quaternion)
    node.scale.copy(source.scale)
    parent.add(node)
    for (const child of source.children) copy(child, node)
  }
  for (const child of sourceScene.children) copy(child, rigRoot)

  container.updateMatrixWorld(true)
  // `attach` mantém a peça onde ela está no mundo.
  for (const { parent, part } of parts) parent.attach(part)
  return { object: container, scale }
}

/** Multiplica as trilhas de posição do clipe por `scale`. Mexe no clipe. */
export function scalePositionTracks(clip, scale) {
  if (scale === 1) return clip
  for (const track of clip.tracks) {
    if (!track.name.endsWith('.position')) continue
    track.values = track.values.map((value) => value * scale)
  }
  return clip
}

function largestHalf(box) {
  const size = box.getSize(new THREE.Vector3())
  return Math.max(size.x, size.y, size.z) / 2
}
