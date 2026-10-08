import * as THREE from 'three'
import { setEatStage } from './itemEatStages'
import { rigLikeSource } from './itemRig'

/**
 * Monta a instância do modelo de um item a partir da cena do `.glb` (ver
 * `view/scene/ItemModel.jsx`, docs/features/042-itens-da-beta.md): clona
 * (com materiais próprios), redimensiona pra `config.size` e centra no CORPO
 * do item — o nó `config.pivot`, ou o primeiro pedaço da fruta
 * (`eatStages[0]`), ou o modelo inteiro. `align: 'bottom'` levanta o pivô
 * pra base do modelo ficar na origem.
 *
 * Com `rigSource` (a cena do `.glb` de `config.clipsFrom`), monta antes o
 * esqueleto de nós da origem em volta das peças (`rigLikeSource`,
 * `itemRig.js`) pra tocar os clipes dela.
 *
 * Devolve `{ root, pivot, materials, stages, rigScale }`: `root` vai na
 * cena; `pivot` é onde girar/apertar (o centro do corpo); `stages`, os
 * pedaços da fruta; `rigScale`, a razão de tamanho pros clipes da origem
 * (1 sem ela).
 */
export function buildItemModel(scene, config, align, rigSource = null) {
  let clone = scene.clone(true)
  let rigScale = 1
  if (rigSource) {
    const rigged = rigLikeSource(clone, rigSource, config.rig)
    clone = rigged.object
    rigScale = rigged.scale
  }
  const materials = []
  clone.traverse((child) => {
    if (!child.isMesh) return
    child.material = child.material.clone()
    child.castShadow = true
    materials.push(child.material)
  })

  const box = new THREE.Box3().setFromObject(clone)
  const dimensions = box.getSize(new THREE.Vector3())
  const largest = Math.max(dimensions.x, dimensions.y, dimensions.z)
  const scale = largest > 0 && config.size ? config.size / largest : 1

  const stages = (config.eatStages ?? [])
    .map((name) => clone.getObjectByName(name))
    .filter(Boolean)
  const body =
    (config.pivot && clone.getObjectByName(config.pivot)) ?? stages[0] ?? null
  const center = (body ? new THREE.Box3().setFromObject(body) : box).getCenter(
    new THREE.Vector3(),
  )

  // root (origem pedida) > pivot (centro do corpo; gira/aperta aqui) >
  // inner (escala, e desloca o modelo pra o corpo cair no pivô).
  const inner = new THREE.Group()
  inner.add(clone)
  inner.scale.setScalar(scale)
  inner.position.set(-center.x * scale, -center.y * scale, -center.z * scale)
  const pivot = new THREE.Group()
  pivot.add(inner)
  if (align === 'bottom') pivot.position.y = (center.y - box.min.y) * scale
  const root = new THREE.Group()
  root.add(pivot)

  setEatStage(stages, 0)

  return { root, pivot, materials, stages, rigScale }
}
