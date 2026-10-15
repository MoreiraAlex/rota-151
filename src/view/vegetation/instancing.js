import * as THREE from 'three'
import { hash01 } from './vegetationScatter'

/**
 * Ajudantes das malhas instanciadas da vegetação (docs/features/049-
 * vegetacao-e-floresta.md). Cada malha tem a própria geometria, que aponta
 * para os MESMOS buffers do modelo (`shareGeometry` — a placa de vídeo
 * recebe cada modelo uma vez) e guarda só os atributos por instância —
 * quem monta chama `disposeVegetationMesh` ao tirar. Os materiais são
 * compartilhados e não saem daqui.
 */

const scratchMatrix = new THREE.Matrix4()
const scratchPosition = new THREE.Vector3()
const scratchQuaternion = new THREE.Quaternion()
const scratchScale = new THREE.Vector3()
const UP = new THREE.Vector3(0, 1, 0)

/** Matriz da instância `index`: posição, giro em Y e escala (número ou xyz). */
export function setInstance(mesh, index, x, y, z, yaw, scale) {
  scratchPosition.set(x, y, z)
  scratchQuaternion.setFromAxisAngle(UP, yaw)
  if (typeof scale === 'number') scratchScale.setScalar(scale)
  else scratchScale.copy(scale)
  mesh.setMatrixAt(
    index,
    scratchMatrix.compose(scratchPosition, scratchQuaternion, scratchScale),
  )
}

/** Fecha a malha: matrizes enviadas e limites (o corte pela câmera). */
export function finishMesh(mesh) {
  // A malha fica na origem (as instâncias já estão no mundo) e nunca
  // mexe: sem recalcular a matriz dela a cada quadro (são centenas).
  mesh.updateMatrix()
  mesh.matrixAutoUpdate = false
  mesh.instanceMatrix.needsUpdate = true
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  mesh.computeBoundingBox()
  mesh.computeBoundingSphere()
  return mesh
}

/**
 * Se a malha PODE fazer sombra (`userData.castsShadow`); quem monta liga e
 * desliga de verdade pela distância (`setShadowsEnabled`).
 */
export function allowShadow(mesh, isAllowed) {
  mesh.userData.castsShadow = isAllowed
  mesh.castShadow = isAllowed
}

/** Liga ou desliga a sombra da malha (só se ela pode fazer sombra). */
export function setShadowsEnabled(mesh, isEnabled) {
  mesh.castShadow = Boolean(mesh.userData.castsShadow) && isEnabled
}

/**
 * Geometria nova que aponta para os MESMOS buffers de `base` (índice,
 * posição, normal, UV): só o que for posto nela depois (os atributos por
 * instância) é dela.
 */
export function shareGeometry(base) {
  const geometry = new THREE.BufferGeometry()
  geometry.setIndex(base.index)
  for (const [name, attribute] of Object.entries(base.attributes)) {
    geometry.setAttribute(name, attribute)
  }
  base.computeBoundingBox()
  base.computeBoundingSphere()
  geometry.boundingBox = base.boundingBox.clone()
  geometry.boundingSphere = base.boundingSphere.clone()
  return geometry
}

/**
 * Libera uma geometria de `shareGeometry`. Um `dispose()` comum: os buffers
 * do modelo saem da placa de vídeo junto, e o three sobe de novo no
 * próximo quadro se outra malha ainda usa (um reenvio pequeno quando um
 * chunk sai). Tirar os buffers da geometria quebraria a malha que o React
 * remonta em desenvolvimento (StrictMode).
 */
export function releaseGeometry(geometry) {
  geometry.dispose()
}

/** Tira uma malha daqui: libera a geometria própria (não a do modelo). */
export function disposeVegetationMesh(mesh) {
  releaseGeometry(mesh.geometry)
  mesh.dispose()
}

/**
 * Tom de uma planta no lugar `(x, z)` (multiplica a cor do material): mais
 * clara ou mais escura e um pouco mais amarelada, até `variation` (0 =
 * todas iguais). Fixo pelo lugar — a mesma árvore tem sempre o mesmo tom.
 */
export function tintAt(x, z, variation, out = new THREE.Color()) {
  const cellX = Math.floor(x * 10)
  const cellZ = Math.floor(z * 10)
  const brightness = 1 + (hash01(cellX, cellZ, 71) - 0.5) * 2 * variation
  const warm = hash01(cellX, cellZ, 72) * variation
  return out.setRGB(
    brightness * (1 + warm * 0.4),
    brightness * (1 + warm * 0.15),
    brightness * (1 - warm * 0.3),
  )
}

const WHITE = new THREE.Color(1, 1, 1)
// Sombra por parte (os modelos do LGPE, lgpeModels.js): `toon` segue a
// qualidade (`castShadow`); `toon-low` (planta baixa e flor) nunca faz —
// pequenas, e a sombra desenha tudo de novo.
const SHADOW_BY_PART = {
  'toon-low': false,
}

/**
 * @typedef {object} ModelInstance
 * @property {number} x
 * @property {number} y
 * @property {number} z
 * @property {number} yaw
 * @property {number} scale
 * @property {number} variant - 0 a 1: qual dos modelos do tipo
 * @property {THREE.Color} [tint] - tom (cor por instância)
 * @property {number[]} [recolor] - tinta do bioma, `[r, g, b, força]`
 *   (biomeColor.js)
 */

/**
 * As malhas de um modelo (`useVegetationModels`) para uma lista de
 * instâncias: uma `InstancedMesh` por parte, com a geometria do modelo
 * (`shareGeometry`), a origem e o giro de cada uma (`aWind`, o vento e o
 * empurrão — quem decide se usa é o material), o tom (cor por instância)
 * e a tinta do bioma (`aRecolor`). `castShadow`: se a parte faz sombra (a qualidade); planta
 * baixa nunca faz. `recolorOf(part, item)`: a tinta de cada parte (sem ele,
 * a da instância em todas — a cor do ginásio pinta só algumas).
 *
 * @param {import('./useVegetationModels').VegetationModel} model
 * @param {ModelInstance[]} instances
 * @returns {THREE.InstancedMesh[]}
 */
export function buildModelMeshes(
  model,
  instances,
  { castShadow = true, recolorOf = (part, item) => item.recolor } = {},
) {
  return model.parts.map((part) => {
    const geometry = shareGeometry(part.geometry)
    const mesh = new THREE.InstancedMesh(
      geometry,
      part.material,
      instances.length,
    )
    const wind = new Float32Array(instances.length * 4)
    const recolor = new Float32Array(instances.length * 4)
    instances.forEach((item, index) => {
      const tint = recolorOf(part, item)
      if (tint) recolor.set(tint, index * 4)
      setInstance(mesh, index, item.x, item.y, item.z, item.yaw, item.scale)
      mesh.setColorAt(index, item.tint ?? WHITE)
      wind.set(
        [item.x, item.z, Math.cos(item.yaw), Math.sin(item.yaw)],
        index * 4,
      )
    })
    geometry.setAttribute('aWind', new THREE.InstancedBufferAttribute(wind, 4))
    geometry.setAttribute(
      'aRecolor',
      new THREE.InstancedBufferAttribute(recolor, 4),
    )
    allowShadow(mesh, SHADOW_BY_PART[part.kind] ?? castShadow)
    mesh.receiveShadow = true
    return finishMesh(mesh)
  })
}

/**
 * As malhas de várias instâncias de um tipo, cada uma no modelo que o
 * `variant` dela sorteia entre `models`.
 *
 * @returns {THREE.InstancedMesh[]}
 */
export function buildKindMeshes(models, instances, options) {
  return groupByModel(models, instances).flatMap((group, index) =>
    group.length === 0 ? [] : buildModelMeshes(models[index], group, options),
  )
}

// As instâncias de cada modelo (pelo `variant`), na ordem de `models`.
// Sem modelo (o escolhido no painel ainda carregando), nenhum grupo.
function groupByModel(models, instances) {
  const groups = models.map(() => [])
  if (groups.length === 0) return groups
  for (const item of instances) {
    const index = Math.min(
      models.length - 1,
      Math.floor(item.variant * models.length),
    )
    groups[index].push(item)
  }
  return groups
}

// Os dados por instância de uma malha, guardados na ordem original (para
// `compactInstances` escolher quais desenhar).
function snapshotInstances(mesh) {
  const attributes = [mesh.instanceMatrix, mesh.instanceColor]
  for (const attribute of Object.values(mesh.geometry.attributes)) {
    if (attribute.isInstancedBufferAttribute) attributes.push(attribute)
  }
  return attributes
    .filter(Boolean)
    .map((attribute) => ({ attribute, source: attribute.array.slice() }))
}

// Desenha só as instâncias `indices` (nos primeiros lugares, `count`).
function compactInstances(mesh, snapshot, indices) {
  for (const { attribute, source } of snapshot) {
    const size = attribute.itemSize
    indices.forEach((from, to) => {
      attribute.array.set(
        source.subarray(from * size, (from + 1) * size),
        to * size,
      )
    })
    attribute.needsUpdate = true
  }
  mesh.count = indices.length
}

/**
 * Como `buildKindMeshes`, com LOD por instância: cada modelo tem as malhas
 * de perto e as de longe (`model.far`, ex.: nenhuma no sub-bosque), e
 * `setNear(isNear)` divide as instâncias entre elas — sem remontar nada,
 * só regravando os dados por instância e o `count` de cada malha. Começa
 * tudo de longe. As de longe não fazem sombra.
 *
 * @returns {{ meshes: THREE.InstancedMesh[],
 *   setNear: (isNear: (item: ModelInstance) => boolean) => void }}
 */
export function buildLodKindMeshes(models, instances, options) {
  const sets = groupByModel(models, instances)
    .map((group, index) => {
      if (group.length === 0) return null
      const model = models[index]
      const near = buildModelMeshes(model, group, options)
      const far = buildModelMeshes(model.far ?? model, group, options)
      // De longe, sem sombra: a área de sombra do sol só cobre a volta da
      // câmera, e a malha do chunk inteiro entrava no mapa de sombra por
      // inteiro.
      for (const mesh of far) allowShadow(mesh, false)
      return {
        group,
        // Quais instâncias estavam perto na última divisão (`null` antes da
        // primeira).
        split: null,
        near: near.map((mesh) => ({ mesh, snapshot: snapshotInstances(mesh) })),
        far: far.map((mesh) => ({ mesh, snapshot: snapshotInstances(mesh) })),
      }
    })
    .filter(Boolean)

  function setNear(isNear) {
    for (const set of sets) {
      const { group, near, far } = set
      const split = group.map((item) => isNear(item))
      // Mesma divisão de antes: nada a regravar nem a reenviar para a placa
      // de vídeo (a maioria dos chunks, longe da câmera, nunca muda).
      const isSame =
        set.split !== null &&
        split.every((isItemNear, index) => isItemNear === set.split[index])
      if (isSame) continue
      set.split = split
      const nearIndices = []
      const farIndices = []
      split.forEach((isItemNear, index) =>
        (isItemNear ? nearIndices : farIndices).push(index),
      )
      for (const { mesh, snapshot } of near) {
        compactInstances(mesh, snapshot, nearIndices)
      }
      for (const { mesh, snapshot } of far) {
        compactInstances(mesh, snapshot, farIndices)
      }
    }
  }

  setNear(() => false)
  return {
    meshes: sets.flatMap(({ near, far }) =>
      [...near, ...far].map(({ mesh }) => mesh),
    ),
    setNear,
  }
}
