import * as THREE from 'three'
import { listBiomes } from '@/core/data/biomes'
import { createToonMaterial } from './toonMaterial'

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
export const lgpePropPath = (id) => `${LGPE_DIR}/props/${id}.glb`
export const lgpeTexturePath = (name) => `${LGPE_DIR}/textures/${name}.png`

/**
 * As categorias do manifesto que cada tipo de vegetação aceita
 * (docs/features/053-planicie-com-assets-do-lgpe.md): as opções do
 * "Modelos" do painel (F2) e a regra dos `models` dos biomas.
 */
export const LGPE_KIND_CATEGORIES = {
  'broadleaf-tree': ['tree'],
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

/** As texturas do LGPE como o jogo original lê: sRGB, repetindo, UV de baixo para cima. */
export function prepareLgpeTexture(texture) {
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.flipY = true
  texture.anisotropy = 4
  texture.needsUpdate = true
  return texture
}

function buildPart(mesh, id, prop, textureOf, disposables) {
  const entry = prop.materials[mesh.material.name] ?? {}
  const colorName = COLOR_SAMPLERS.map((sampler) => entry.maps?.[sampler]).find(
    Boolean,
  )
  // Árvore redonda: cor pela rampa (Texture02) no segundo UV.
  const geometry = withoutColorAlpha(mesh.geometry)
  if (geometry !== mesh.geometry) disposables.push(geometry)
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
export function buildLgpeModels(manifest, scenes, textureOf) {
  const disposables = []
  const models = {}
  for (const [id, scene] of Object.entries(scenes)) {
    const prop = manifest.props[id]
    if (!prop) throw new Error(`modelo do LGPE desconhecido: ${id}`)
    models[id] = {
      name: id,
      category: prop.category,
      parts: meshesOf(scene).map((mesh) =>
        buildPart(mesh, id, prop, textureOf, disposables),
      ),
    }
  }
  const materials = Object.values(models).flatMap(({ parts }) =>
    parts.map(({ material }) => material),
  )
  return { models, materials, disposables }
}
