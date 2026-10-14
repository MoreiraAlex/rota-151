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
 * Os modelos do LGPE que podem ser a grama (`models` da entrada
 * `tall-grass`): carregados sempre, para o painel (F2) trocar ao vivo.
 * Id do manifesto → nome no painel.
 */
export const GRASS_MODEL_CHOICES = {
  'grass-low': 'Grama baixa',
  'grass-clump': 'Moita de grama',
  tuft: 'Tufo',
  'tall-grass': 'Mato alto',
  'tall-grass-2': 'Mato alto 2',
  reeds: 'Capim alto',
}

/**
 * Os ids do LGPE que algum bioma usa (`models` das entradas), mais as
 * opções de grama (`GRASS_MODEL_CHOICES`).
 */
export function usedLgpeIds(biomes = listBiomes()) {
  const ids = new Set(Object.keys(GRASS_MODEL_CHOICES))
  for (const { vegetation } of biomes) {
    for (const entry of vegetation) {
      for (const id of entry.models ?? []) ids.add(id)
    }
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
// Categorias que fazem sombra (planta baixa e flor não: pequenas, e a
// sombra desenha tudo de novo).
const SHADOW_CATEGORIES = new Set(['tree', 'rock', 'bush'])
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

function buildPart(mesh, prop, textureOf, disposables) {
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
    sway: SWAY_BY_CATEGORY[prop.category] ?? null,
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
        buildPart(mesh, prop, textureOf, disposables),
      ),
    }
  }
  const materials = Object.values(models).flatMap(({ parts }) =>
    parts.map(({ material }) => material),
  )
  return { models, materials, disposables }
}
