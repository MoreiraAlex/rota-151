import * as THREE from 'three'
import { listBiomes } from '@/core/data/biomes'
import { GAME_CONFIG } from '@/core/gameConfig'
import { createToonMaterial } from './toonMaterial'
import { buildBladeGrassModel } from './bladeGrass'

/**
 * Os modelos do Pokémon Let's Go na vegetação (docs/features/052-assets-do-
 * lgpe-e-floresta.md), empacotados por `scripts/lgpe/pack-lgpe.js` em
 * `public/assets/vegetation/lgpe/`: um `.glb` por prop, as texturas e o
 * `manifest.json` (o material de cada parte — texturas por papel, corte do
 * alfa, luz de borda — e a categoria do prop).
 *
 * Os biomas dizem os modelos de cada tipo (`models` na entrada do
 * `vegetation`, ids do manifesto); só os usados são carregados.
 */

export const LGPE_DIR = '/assets/vegetation/lgpe'
export const LGPE_MANIFEST_PATH = `${LGPE_DIR}/manifest.json`

/**
 * Pacotes de fora (docs/features/066-revisao-dos-biomas.md, laboratório de
 * biomas): manifestos no mesmo formato, cada um na própria pasta
 * (`scripts/lab/`), juntados ao do LGPE — o painel e a vegetação veem os
 * modelos deles como se fossem do LGPE. O jogo e o lab registram ao abrir
 * (`vegetationPacks.js`).
 */
let extraPacks = []
const extraPropDirs = new Map()
const extraTextureDirs = new Map()

/** Registra um pacote (`manifest` já lido, servido em `dir`). */
export function registerExtraLgpePack(manifest, dir) {
  extraPacks = [
    ...extraPacks.filter((pack) => pack.dir !== dir),
    { manifest, dir },
  ]
  for (const id of Object.keys(manifest.props ?? {})) extraPropDirs.set(id, dir)
  for (const name of Object.keys(manifest.textures ?? {})) {
    extraTextureDirs.set(name, dir)
  }
}

/**
 * O manifesto do LGPE com os dos pacotes de fora (`packs`, `{ manifest,
 * dir }`) por cima: os props e as texturas de todos, cada um com a pasta
 * dele (`dir`, `undefined` nos do LGPE).
 */
export function mergeLgpeManifests(base, packs = extraPacks) {
  if (packs.length === 0) return base
  const props = { ...base.props }
  const textures = { ...base.textures }
  for (const { manifest, dir } of packs) {
    for (const [id, prop] of Object.entries(manifest.props ?? {})) {
      props[id] = { ...prop, dir }
    }
    for (const [name, texture] of Object.entries(manifest.textures ?? {})) {
      textures[name] = { ...texture, dir }
    }
  }
  return { ...base, props, textures }
}

// As partes de folha das árvores dos pacotes (pelo nome do material).
const PACK_LEAF_MATERIAL = /leaves/i

/** O material de folha (o recortado, dos dois lados) de um prop, ou `null`. */
function leafMaterialOf(prop) {
  return (
    Object.values(prop?.materials ?? {}).find(
      ({ cutoff, doubleSided }) => cutoff != null && doubleSided,
    ) ?? null
  )
}

/**
 * As árvores dos pacotes (docs/features/066-revisao-dos-biomas.md) com as
 * folhas de uma árvore do LGPE (`sourceId`, `LGPE.PACK_LEAVES`; `null` =
 * as folhas delas): o material de folha dela inteiro (recorte, cor e
 * sombreado). Nas árvores redondas a cor vem da rampa pela altura na copa
 * (o segundo UV, que os pacotes não têm — `rampFromHeight` pede para a
 * vegetação gerar pela altura de cada vértice). O tronco fica o delas.
 */
export function withBorrowedLeaves(
  manifest,
  sourceId = GAME_CONFIG.LGPE.PACK_LEAVES,
) {
  const leaf = sourceId ? leafMaterialOf(manifest.props?.[sourceId]) : null
  if (!leaf) return manifest
  const props = { ...manifest.props }
  for (const [id, prop] of Object.entries(manifest.props)) {
    if (!prop.dir || prop.category !== 'tree') continue
    const names = Object.keys(prop.materials ?? {}).filter((name) =>
      PACK_LEAF_MATERIAL.test(name),
    )
    if (names.length === 0) continue
    const materials = { ...prop.materials }
    for (const name of names) {
      materials[name] = { ...leaf, rampFromHeight: true }
    }
    props[id] = { ...prop, materials }
  }
  return { ...manifest, props }
}

// Campos que a vegetação lê de cada prop (`buildLgpeModels`).
const PROP_FIELDS = ['label', 'category', 'size', 'materials']

/**
 * O que falta num prop do manifesto para a vegetação montar ele (lista
 * vazia = completo): os campos, o tamanho (3 números) e, em cada material,
 * as texturas por papel.
 */
export function missingPropFields(prop) {
  const missing = PROP_FIELDS.filter((field) => prop?.[field] == null)
  if (prop?.size && (prop.size.length !== 3 || prop.size.some((v) => !(v > 0))))
    missing.push('size')
  for (const [name, entry] of Object.entries(prop?.materials ?? {})) {
    if (!entry?.maps) missing.push(`materials.${name}.maps`)
  }
  return missing
}

export const lgpePropPath = (id) =>
  `${extraPropDirs.get(id) ?? LGPE_DIR}/props/${id}.glb`
export const lgpeTexturePath = (name) =>
  `${extraTextureDirs.get(name) ?? LGPE_DIR}/textures/${name}.png`

/**
 * As categorias do manifesto que cada tipo de vegetação aceita
 * (docs/features/053-planicie-com-assets-do-lgpe.md): as opções do
 * "Modelos" do painel (F2) e a regra dos `models` dos biomas.
 */
export const LGPE_KIND_CATEGORIES = {
  'broadleaf-tree': ['tree'],
  'giant-tree': ['tree'],
  'ancient-tree': ['tree'],
  'pine-tree': ['tree'],
  'acacia-tree': ['tree'],
  'dead-tree': ['tree'],
  bush: ['bush'],
  fern: ['bush', 'plant'],
  'leafy-plant': ['plant', 'tuft'],
  flower: ['flower'],
  rock: ['rock'],
  pebble: ['rock'],
  'tall-grass': ['tuft', 'tall-grass'],
  'encounter-grass': ['tall-grass'],
}

/** Os props do manifesto que podem ser o tipo `kind` (id → nome). */
export function lgpeChoicesOf(manifest, kind) {
  const categories = LGPE_KIND_CATEGORIES[kind] ?? []
  return Object.fromEntries(
    Object.entries(manifest.props)
      .filter(([, prop]) => categories.includes(prop.category))
      .map(([id, prop]) => [id, prop.label]),
  )
}

/**
 * Os modelos da cidade de um bioma (`town`, docs/features/056-bioma-
 * cidade.md): os prédios e os objetos de rua.
 */
export function townModelIds(town) {
  if (!town) return []
  const { lamp, fence, bench } = town.props
  const themed = town.themes.flatMap((theme) => [
    ...[theme.special, ...theme.houses]
      .filter(Boolean)
      .map(({ model }) => model),
    theme.lamp,
    theme.fence,
  ])
  return [
    ...town.landmarks.map(({ model }) => model),
    ...themed,
    lamp,
    fence,
    bench,
  ].filter(Boolean)
}

/**
 * Os ids do LGPE que algum bioma usa (`models` das entradas e os da
 * cidade).
 */
export function usedLgpeIds(biomes = listBiomes()) {
  const ids = new Set()
  for (const { vegetation, town } of biomes) {
    for (const entry of vegetation) {
      for (const id of entry.models ?? []) ids.add(id)
    }
    for (const id of townModelIds(town)) ids.add(id)
  }
  return [...ids]
}

// Onde fica a cor, pela ordem de preferência (objeto, janela, penhasco — o
// tronco alto —, chão e grama).
const COLOR_SAMPLERS = [
  'Texture01',
  'TextureMap01',
  'CliffTex01',
  'GroundTex01',
  'GrassTex01',
  'green_hikari',
  // O tronco das árvores dos cenários de batalha (`FieldBattleShader01`).
  'Ground00Tex01',
]
// Shaders do jogo em que a cor vem da rampa (as árvores redondas).
const RAMP_SHADERS = new Set(['FieldTreeShader04', 'FieldTreeShader05'])
// Como o vento mexe em cada categoria (`createToonMaterial`): árvore como
// copa, o resto que é planta dobrando; pedra parada.
const SWAY_BY_CATEGORY = {
  tree: 'tree',
  'tall-grass': 'plant',
  tuft: 'plant',
  flower: 'plant',
  bush: 'plant',
  plant: 'plant',
}
// Como cada categoria abre para quem passa (grassPush.js): com a dobra da
// grama ou, nas maiores, a dos arbustos. Árvore e pedra não abrem.
const PUSH_BY_CATEGORY = {
  'tall-grass': 'grass',
  tuft: 'grass',
  flower: 'grass',
  bush: 'bush',
  plant: 'bush',
}

// Props que são só um leque de planos virados quase para o mesmo lado (os
// tufos): de perfil eles somem, então ficam sempre de frente para a câmera.
const BILLBOARD_PROPS = new Set(['tuft', 'tuft-route', 'tuft-medium'])

/** Se o prop `id` fica sempre de frente para a câmera. */
export const lgpeBillboardOf = (id) => BILLBOARD_PROPS.has(id)

/** Como um prop da `category` abre para quem passa (`false`: não abre). */
export const lgpePushOf = (category) => PUSH_BY_CATEGORY[category] ?? false

/** Como o vento mexe num prop da `category` (`null`: parado). */
export const lgpeSwayOf = (category) => SWAY_BY_CATEGORY[category] ?? null
// Categorias que fazem sombra (planta baixa e flor não: pequenas, e a
// sombra desenha tudo de novo).
const SHADOW_CATEGORIES = new Set([
  'tree',
  'rock',
  'bush',
  'building',
  'street',
])
// Brilho médio abaixo do qual a cor por vértice não é cor: nas árvores
// redondas o canal vem quase preto (o jogo guarda outro dado nele).
const MIN_VERTEX_COLOR = 0.15

/** As texturas que os props `ids` usam (nomes do manifesto). */
export function lgpeTextureNames(manifest, ids) {
  const names = new Set()
  for (const id of ids) {
    for (const entry of Object.values(manifest.props[id]?.materials ?? {})) {
      for (const name of Object.values(entry.maps ?? {})) names.add(name)
    }
  }
  return [...names].filter((name) => manifest.textures[name])
}

const meshesOf = (scene) => {
  const meshes = []
  scene.traverse((object) => {
    if (object.isMesh) meshes.push(object)
  })
  return meshes
}

function hasPaintedColor(geometry) {
  const color = geometry.getAttribute('color')
  if (!color) return false
  let sum = 0
  for (let i = 0; i < color.count; i++) {
    sum += (color.getX(i) + color.getY(i) + color.getZ(i)) / 3
  }
  return sum / color.count >= MIN_VERTEX_COLOR
}

/**
 * A cor por vértice do LGPE tem alfa (não é transparência): fica só o RGB,
 * senão o three multiplica o alfa no recorte.
 */
function withoutColorAlpha(geometry) {
  const color = geometry.getAttribute('color')
  if (!color || color.itemSize !== 4) return geometry
  const copy = geometry.clone()
  const rgb = new Float32Array(color.count * 3)
  for (let i = 0; i < color.count; i++) {
    rgb.set([color.getX(i), color.getY(i), color.getZ(i)], i * 3)
  }
  copy.setAttribute('color', new THREE.BufferAttribute(rgb, 3))
  return copy
}

// Faixa do segundo UV que a copa das árvores redondas do LGPE ocupa (do pé
// ao alto da copa) — a rampa de cor é lida nela.
const RAMP_UV_LOW = 0.1
const RAMP_UV_HIGH = 1

/**
 * A geometria com o segundo UV da rampa de cor pela altura (o pé da peça
 * embaixo, o alto em cima), como o das árvores redondas do LGPE — para as
 * folhas dos pacotes (`withBorrowedLeaves`). Cópia; a original fica.
 */
export function withHeightRamp(geometry) {
  const position = geometry.getAttribute('position')
  let min = Infinity
  let max = -Infinity
  for (let i = 0; i < position.count; i++) {
    min = Math.min(min, position.getY(i))
    max = Math.max(max, position.getY(i))
  }
  const span = Math.max(max - min, 1e-6)
  const uv1 = new Float32Array(position.count * 2)
  for (let i = 0; i < position.count; i++) {
    const rise = (position.getY(i) - min) / span
    uv1[i * 2] = 0.5
    uv1[i * 2 + 1] = RAMP_UV_LOW + (RAMP_UV_HIGH - RAMP_UV_LOW) * rise
  }
  const copy = geometry.clone()
  copy.setAttribute('uv1', new THREE.BufferAttribute(uv1, 2))
  return copy
}

/** As texturas do LGPE como o jogo original lê: sRGB, repetindo, UV de baixo para cima. */
export function prepareLgpeTexture(texture, info = {}) {
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  // O LGPE guarda o UV de baixo para cima; os pacotes do lab que vêm do
  // Blender (glTF) não, e dizem `flipY: false` no manifesto.
  texture.flipY = info.flipY ?? true
  texture.anisotropy = 4
  texture.needsUpdate = true
  return texture
}

// Categorias que somem inteiras com a câmera dentro (`CAMERA.NEAR_HIDE`,
// toonMaterial.js) — nas árvores, só as folhas.
const SOLID_HIDE_CATEGORIES = new Set(['rock', 'building'])

// A caixa do modelo inteiro (as partes no espaço do modelo, como a
// vegetação desenha): todas as partes somem juntas.
function wholeBoxOf(meshes) {
  const box = new THREE.Box3()
  for (const { geometry } of meshes) {
    if (!geometry.boundingBox) geometry.computeBoundingBox()
    box.union(geometry.boundingBox)
  }
  return box
}

function buildPart(mesh, id, prop, textureOf, disposables, solidBox) {
  const entry = prop.materials[mesh.material.name] ?? {}
  const colorName = COLOR_SAMPLERS.map((sampler) => entry.maps?.[sampler]).find(
    Boolean,
  )
  // Árvore redonda: cor pela rampa (Texture02) no segundo UV — gerado pela
  // altura nas folhas emprestadas (`withBorrowedLeaves`).
  const clean = withoutColorAlpha(mesh.geometry)
  if (clean !== mesh.geometry) disposables.push(clean)
  const geometry =
    entry.rampFromHeight && !clean.getAttribute('uv1')
      ? withHeightRamp(clean)
      : clean
  if (geometry !== clean) disposables.push(geometry)
  // Folhas de árvore (recortadas, com o vento de copa): somem perto da
  // câmera pela caixa delas; pedras e prédios, pela do modelo inteiro
  // (`solidBox`). `CAMERA.NEAR_HIDE`, toonMaterial.js.
  const isLeaves = lgpeSwayOf(prop.category) === 'tree' && Boolean(entry.cutoff)
  if (isLeaves && !geometry.boundingBox) geometry.computeBoundingBox()
  let nearHide = null
  if (isLeaves) nearHide = { box: geometry.boundingBox, kind: 'CANOPY' }
  else if (solidBox) nearHide = { box: solidBox, kind: 'SOLID' }
  const isRamp =
    RAMP_SHADERS.has(entry.shader) &&
    Boolean(entry.maps?.Texture02) &&
    Boolean(geometry.getAttribute('uv1'))
  const material = createToonMaterial({
    map: colorName ? textureOf(colorName) : null,
    cutoff: entry.cutoff,
    doubleSided: entry.doubleSided,
    // Na rampa a cor já vem pronta (o canal do vértice é dado do jogo).
    vertexColors: !isRamp && hasPaintedColor(geometry),
    rimColor: entry.rimColor,
    rim: entry.rim,
    sway: lgpeSwayOf(prop.category),
    push: lgpePushOf(prop.category),
    billboard: lgpeBillboardOf(id),
    height: prop.size[1],
    rampMap: isRamp ? textureOf(entry.maps.Texture02) : null,
    shadeMap:
      isRamp && entry.maps.Texture03 ? textureOf(entry.maps.Texture03) : null,
    nearHide,
  })
  disposables.push(material)
  return {
    kind: SHADOW_CATEGORIES.has(prop.category) ? 'toon' : 'toon-low',
    geometry,
    material,
    // O material do jogo original (a cor do ginásio pinta só alguns).
    materialName: mesh.material.name,
  }
}

/**
 * Os modelos do LGPE no formato da vegetação (`VegetationModel`, uma parte
 * por material): `scenes` e `textureOf(nome)` já carregados.
 *
 * @returns {{ models: Record<string, import('./useVegetationModels').VegetationModel>,
 *   materials: THREE.Material[], disposables: object[] }}
 */
export function buildLgpeModels(
  manifest,
  scenes,
  textureOf,
  proceduralIds = [],
) {
  const disposables = []
  const models = {}
  // Os gerados por código (a grama em fios, bladeGrass.js), sem arquivo.
  for (const id of proceduralIds) {
    models[id] = buildBladeGrassModel(disposables)
  }
  for (const [id, scene] of Object.entries(scenes)) {
    const prop = manifest.props[id]
    if (!prop) throw new Error(`modelo do LGPE desconhecido: ${id}`)
    const meshes = meshesOf(scene)
    const solidBox = SOLID_HIDE_CATEGORIES.has(prop.category)
      ? wholeBoxOf(meshes)
      : null
    models[id] = {
      name: id,
      category: prop.category,
      parts: meshes.map((mesh) =>
        buildPart(mesh, id, prop, textureOf, disposables, solidBox),
      ),
    }
  }
  const materials = Object.values(models).flatMap(({ parts }) =>
    parts.map(({ material }) => material),
  )
  return { models, materials, disposables }
}
