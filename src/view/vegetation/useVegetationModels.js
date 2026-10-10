import { useEffect, useMemo } from 'react'
import { useGLTF, useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { GAME_CONFIG } from '@/core/gameConfig'
import { createCanopyMaterials } from './canopyMaterial'
import { bladePivotsOf } from './grassBlades'
import { createGrassMaterial } from './grassMaterial'
import { releaseGeometry, shareGeometry } from './instancing'
import {
  createBarkMaterial,
  createFoliageMaterial,
  createMossyRockMaterial,
} from './propMaterials'
import {
  BARK_TEXTURE_PATH,
  GRASS_BLADES_PATH,
  PART_COLORS,
  PART_KINDS,
  SHARED_TEXTURES,
  VEGETATION_MODELS,
  megakitPath,
} from './vegetationAssets'

/**
 * Modelos e materiais da vegetação (docs/features/049-vegetacao-e-
 * floresta.md), prontos para as malhas instanciadas: carrega os `.glb` e
 * as texturas (o drei guarda no cache e suspende até chegarem), monta as
 * partes de cada modelo com o material do tipo delas (`PART_KINDS`) e os
 * libera ao desmontar. O que é do cache do drei (geometrias e texturas dos
 * `.glb`) não é liberado aqui.
 *
 * @typedef {object} ModelPart
 * @property {'canopy' | 'foliage' | 'bark' | 'rock' | 'pebble' | 'solid'} kind
 * @property {THREE.BufferGeometry} geometry
 * @property {THREE.Material} material
 * @property {THREE.Material} [depth] - sombra recortada (copa)
 * @property {THREE.Vector3} [center] - centro da copa no modelo
 *
 * @typedef {{ name: string, parts: ModelPart[], far?: VegetationModel }} VegetationModel
 */

export const MODEL_NAMES = [...new Set(Object.values(VEGETATION_MODELS).flat())]
export const MODEL_PATHS = MODEL_NAMES.map(megakitPath)

const firstMesh = (scene) => {
  let found = null
  scene.traverse((object) => {
    if (!found && object.isMesh) found = object
  })
  return found
}

const meshesOf = (scene) => {
  const meshes = []
  scene.traverse((object) => {
    if (object.isMesh) meshes.push(object)
  })
  return meshes
}

function boundsOf(geometry) {
  geometry.computeBoundingBox()
  const box = geometry.boundingBox
  return { baseY: box.min.y, height: box.max.y - box.min.y, box }
}

// Fração das folhas que fica dentro do raio da copa (`canopyRadiusOf`): as
// poucas mais afastadas (um galho comprido) não esticam o volume.
const CANOPY_RADIUS_QUANTILE = 0.9

/**
 * Raio do volume da copa em volta de `center`: a distância até onde fica a
 * maior parte das folhas (o miolo escuro e a borda clara medem por ele).
 */
function canopyRadiusOf(geometry, center) {
  const position = geometry.attributes.position
  const distances = Float32Array.from({ length: position.count }, (_, i) =>
    Math.hypot(
      position.getX(i) - center.x,
      position.getY(i) - center.y,
      position.getZ(i) - center.z,
    ),
  ).sort()
  const index = Math.floor((distances.length - 1) * CANOPY_RADIUS_QUANTILE)
  return distances[index] || 1
}

// Libera ao desmontar o que `build` criou (`disposables`).
function useOwned(build, deps) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const value = useMemo(build, deps)
  useEffect(
    () => () => {
      for (const item of value.disposables) item.dispose()
    },
    [value],
  )
  return value
}

/**
 * O material do `.glb` (PBR, `MeshStandardMaterial`) como Lambert: a mesma
 * textura, recorte, lados e cor, mas bem mais barato por pixel — medido, o
 * custo por pixel era mais da metade do quadro na floresta (folhas
 * recortadas e grama empilham camadas). No visual desenhado do jogo, o
 * brilho do PBR quase não aparece.
 */
export function toLambertMaterial(source) {
  return new THREE.MeshLambertMaterial({
    name: source.name,
    map: source.map,
    color: source.color,
    alphaTest: source.alphaTest,
    side: source.side,
    vertexColors: source.vertexColors,
  })
}

/**
 * Uma parte de um modelo (uma malha do `.glb`). `sharedMaps`: a primeira
 * textura de cada arquivo dividido (`SHARED_TEXTURES`) — os modelos que
 * usam o mesmo (a casca e as folhas das árvores) passam a usar uma só na
 * placa de vídeo. Textura recortada (flores, plantas, pedras) fica a do
 * próprio modelo.
 */
function buildPart(mesh, { sharedMaps, disposables }) {
  const kind = PART_KINDS[mesh.material.name] ?? 'solid'
  const source = toLambertMaterial(mesh.material)
  disposables.push(source)
  const sharedFile = SHARED_TEXTURES[source.name]
  if (source.map && sharedFile) {
    sharedMaps[sharedFile] ??= source.map
    source.map = sharedMaps[sharedFile]
  }
  const { geometry } = mesh
  const { baseY, height, box } = boundsOf(geometry)
  const part = { kind, geometry, material: source }

  if (kind === 'canopy') {
    const center = box.getCenter(new THREE.Vector3())
    const { material, depth } = createCanopyMaterials(source, {
      baseY,
      height,
      radius: canopyRadiusOf(geometry, center),
    })
    Object.assign(part, { material, depth, center })
    disposables.push(material, depth)
  } else if (kind === 'foliage') {
    part.material = createFoliageMaterial(source, { baseY, height })
    disposables.push(part.material)
  } else if (kind === 'bark') {
    part.material = createBarkMaterial(source)
    disposables.push(part.material)
  } else if (kind === 'rock' || kind === 'pebble') {
    part.material = createMossyRockMaterial(source)
    disposables.push(part.material)
  }
  // Tinta lida a cada quadro (`applyPartColor`).
  part.material.userData.colorFrom = PART_COLORS[source.name]
  return part
}

/**
 * Só os triângulos de `geometry` com algum vértice até a altura `maxY` —
 * com os mesmos buffers (`shareGeometry`), só o índice é novo.
 */
function trimAbove(geometry, maxY) {
  const index = geometry.index.array
  const y = geometry.attributes.position
  const kept = []
  for (let i = 0; i < index.length; i += 3) {
    const lowest = Math.min(
      y.getY(index[i]),
      y.getY(index[i + 1]),
      y.getY(index[i + 2]),
    )
    if (lowest <= maxY) kept.push(index[i], index[i + 1], index[i + 2])
  }
  return shareGeometry(
    geometry,
    new THREE.BufferAttribute(Uint32Array.from(kept), 1),
  )
}

/**
 * A árvore de longe (LOD): a casca só até um pouco acima da base da copa —
 * o tronco fica, os galhos (a maior parte dos triângulos da casca, quase
 * todos escondidos nas folhas) saem. Sem copa e casca, não tem versão de
 * longe.
 */
function buildFarModel(model, disposables) {
  const canopy = model.parts.find(({ kind }) => kind === 'canopy')
  const hasBark = model.parts.some(({ kind }) => kind === 'bark')
  if (!canopy || !hasBark) return undefined
  const { baseY } = boundsOf(canopy.geometry)
  const cut = baseY + GAME_CONFIG.TREES.LOD_TRIM_MARGIN
  return {
    name: `${model.name}-far`,
    parts: model.parts.map((part) => {
      if (part.kind !== 'bark') return part
      const geometry = trimAbove(part.geometry, cut)
      disposables.push({ dispose: () => releaseGeometry(geometry) })
      return { ...part, geometry }
    }),
  }
}

/** A grama (o tufo do stylized-scene) e o material dela. */
export function buildGrassModel(bladeScene) {
  const { geometry } = firstMesh(bladeScene)
  geometry.setAttribute('aBlade', bladePivotsOf(geometry))
  const bladeHeight = boundsOf(geometry).box.max.y
  const material = createGrassMaterial(bladeHeight)
  return { geometry, bladeHeight, material, disposables: [material] }
}

/**
 * Os modelos do MegaKit por tipo (`VEGETATION_MODELS`), de `scenes` na
 * ordem de `MODEL_PATHS`.
 *
 * @returns {{ kinds: Record<string, VegetationModel[]>, disposables: object[] }}
 */
export function buildVegetationModels(scenes) {
  const disposables = []
  const sharedMaps = {}
  const byName = {}
  MODEL_NAMES.forEach((name, index) => {
    const model = {
      name,
      parts: meshesOf(scenes[index]).map((mesh) =>
        buildPart(mesh, { sharedMaps, disposables }),
      ),
    }
    model.far = buildFarModel(model, disposables)
    byName[name] = model
  })
  const kinds = Object.fromEntries(
    Object.entries(VEGETATION_MODELS).map(([kind, names]) => [
      kind,
      names.map((name) => byName[name]),
    ]),
  )
  return { kinds, disposables }
}

/**
 * Tronco caído: cilindro deitado ao longo do X (comprimento e raio vêm da
 * escala da instância), casca nos lados e madeira nas pontas.
 */
export function buildLogModel(bark) {
  bark.colorSpace = THREE.SRGBColorSpace
  bark.wrapS = THREE.RepeatWrapping
  bark.wrapT = THREE.RepeatWrapping
  bark.repeat.set(2, 2)
  bark.needsUpdate = true
  const geometry = new THREE.CylinderGeometry(1, 1, 1, 12, 1).rotateZ(
    -Math.PI / 2,
  )
  const side = new THREE.MeshLambertMaterial({ map: bark })
  side.userData.colorFrom = PART_COLORS.Bark_Broadleaf
  const ends = new THREE.MeshLambertMaterial({
    color: GAME_CONFIG.LOGS.WOOD_COLOR,
  })
  // Grupos do cilindro: lado, topo, base.
  const materials = [side, ends, ends]
  return { geometry, materials, disposables: [geometry, side, ends] }
}

/**
 * @returns {{ grass: object, kinds: Record<string, VegetationModel[]>,
 *   log: object }}
 */
export function useVegetationModels() {
  const { scene: bladeScene } = useGLTF(GRASS_BLADES_PATH)
  const scenes = useGLTF(MODEL_PATHS).map(({ scene }) => scene)
  const bark = useTexture(BARK_TEXTURE_PATH)

  const grass = useOwned(() => buildGrassModel(bladeScene), [bladeScene])
  const models = useOwned(() => buildVegetationModels(scenes), scenes)
  const log = useOwned(() => buildLogModel(bark), [bark])

  // O mesmo objeto enquanto os modelos não mudam: as malhas de grama e de
  // chunk dependem dele, e um objeto novo a cada render remontava a
  // vegetação inteira a cada bloco de grama ou chunk que entrava.
  return useMemo(
    () => ({ grass, kinds: models.kinds, log }),
    [grass, models, log],
  )
}

/** Pinta o material com a cor do `GAME_CONFIG` dele (`PART_COLORS`). */
export function applyPartColor(material) {
  const colorFrom = material.userData.colorFrom
  if (colorFrom) material.color.set(colorFrom(GAME_CONFIG))
}

/** Os materiais de todas as partes de um tipo (para o vento e o debug). */
export function materialsOfKind(kinds, partKind) {
  return Object.values(kinds)
    .flat()
    .flatMap(({ parts }) => parts)
    .filter((part) => part.kind === partKind)
    .map((part) => part.material)
}

useGLTF.preload(GRASS_BLADES_PATH)
useGLTF.preload(MODEL_PATHS)
