import * as THREE from 'three'
import {
  MAX_TERRAIN_LAYERS,
  TERRAIN_LAYERS,
  terrainLayerPath,
} from './terrainLayers'

// Lado (px) de cada camada no array de texturas (o do JPEG empacotado).
const LAYER_SIZE = 512
// Filtro anisotrópico (nitidez do chão visto de lado).
const TEXTURE_ANISOTROPY = 8
// Cor neutra de uma camada ainda não carregada: claro e escuro no brilho
// médio, normal reta.
const NEUTRAL_TEXEL = [128, 128, 128, 255]

const VERTEX_HEADER = /* glsl */ `
attribute vec4 groundLayers0;
attribute vec4 groundLayers1;
attribute float groundDetail;
varying vec4 vGroundLayers0;
varying vec4 vGroundLayers1;
varying float vGroundDetail;
varying vec3 vTerrainWorld;
varying vec3 vTerrainNormal;
`

const FRAGMENT_HEADER = /* glsl */ `
uniform sampler2DArray uGroundLayers;
uniform float uTextureSize;
uniform float uNormalStrength;
uniform float uTextureDetail;
uniform float uPatchStrength;
uniform float uPatchSize;
uniform float uGrainStrength;
varying vec4 vGroundLayers0;
varying vec4 vGroundLayers1;
varying float vGroundDetail;
varying vec3 vTerrainWorld;
varying vec3 vTerrainNormal;

float terrainHash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

// Ruído de valor suave (0 a 1).
float terrainNoise(vec2 p) {
  vec2 cell = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = terrainHash(cell);
  float b = terrainHash(cell + vec2(1.0, 0.0));
  float c = terrainHash(cell + vec2(0.0, 1.0));
  float d = terrainHash(cell + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float terrainFbm(vec2 p) {
  float sum = 0.0;
  float weight = 0.5;
  for (int i = 0; i < 4; i++) {
    sum += terrainNoise(p) * weight;
    p *= 2.03;
    weight *= 0.5;
  }
  return sum / 0.9375;
}

// Projeção triplanar: a textura vem dos três eixos, pesada pela normal —
// não estica nas encostas.
vec3 triplanarWeights(vec3 n) {
  vec3 w = pow(abs(n), vec3(4.0));
  return w / (w.x + w.y + w.z);
}

// Normal da camada (G/B = x/y; z reconstruído).
vec3 layerNormal(vec4 texel) {
  vec2 xy = texel.gb * 2.0 - 1.0;
  return vec3(xy, sqrt(max(0.0, 1.0 - dot(xy, xy))));
}

// Uma camada em projeção triplanar: claro e escuro (1 = brilho médio) em
// .w e a normal ("whiteout", no espaço do mundo) em .xyz.
vec4 sampleLayer(float layer, vec3 p, vec3 n, vec3 w) {
  vec4 tx = texture(uGroundLayers, vec3(p.zy, layer));
  vec4 ty = texture(uGroundLayers, vec3(p.xz, layer));
  vec4 tz = texture(uGroundLayers, vec3(p.xy, layer));
  float detail = (tx.r * w.x + ty.r * w.y + tz.r * w.z) * 2.0;
  vec3 nx = layerNormal(tx);
  vec3 ny = layerNormal(ty);
  vec3 nz = layerNormal(tz);
  nx = vec3(nx.xy + n.zy, abs(nx.z) * n.x);
  ny = vec3(ny.xy + n.xz, abs(ny.z) * n.y);
  nz = vec3(nz.xy + n.xy, abs(nz.z) * n.z);
  vec3 normal = normalize(nx.zyx * w.x + ny.xzy * w.y + nz.xyz * w.z);
  return vec4(normal, detail);
}
`

const VERTEX_WORLD = /* glsl */ `
#include <begin_vertex>
vGroundLayers0 = groundLayers0;
vGroundLayers1 = groundLayers1;
vGroundDetail = groundDetail;
vTerrainWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
`

const VERTEX_NORMAL = /* glsl */ `
#include <beginnormal_vertex>
vTerrainNormal = normalize(mat3(modelMatrix) * objectNormal);
`

// Cor: a da paleta (por vértice) com manchas, granulado e o claro e escuro
// das camadas pelo peso de cada uma.
const FRAGMENT_COLOR = /* glsl */ `
#include <color_fragment>
vec3 terrainNormal = normalize(vTerrainNormal);
vec3 terrainPoint = vTerrainWorld / uTextureSize;
vec3 terrainWeights = triplanarWeights(terrainNormal);

float layerDetail = 0.0;
vec3 layerBump = vec3(0.0);
float layerTotal = 0.0;
for (int layer = 0; layer < ${MAX_TERRAIN_LAYERS}; layer++) {
  float weight = layer < 4 ? vGroundLayers0[layer] : vGroundLayers1[layer - 4];
  if (weight < 0.002) continue;
  vec4 sampled = sampleLayer(float(layer), terrainPoint, terrainNormal, terrainWeights);
  layerDetail += sampled.w * weight;
  layerBump += sampled.xyz * weight;
  layerTotal += weight;
}

float patches = terrainFbm(vTerrainWorld.xz / uPatchSize);
float grain = terrainNoise(vTerrainWorld.xz * 3.0);
float shade = 1.0
  + uPatchStrength * (patches - 0.5) * 2.0
  + uGrainStrength * (grain - 0.5) * 2.0;
if (layerTotal > 0.0) {
  float detail = layerDetail / layerTotal;
  shade *= mix(1.0, detail, uTextureDetail * vGroundDetail);
}
diffuseColor.rgb *= shade;
`

// Relevo de luz: o mapa de normal das camadas.
const FRAGMENT_NORMAL = /* glsl */ `
#include <normal_fragment_maps>
if (layerTotal > 0.0) {
  vec3 bumped = normalize(layerBump);
  vec3 worldNormal = normalize(mix(terrainNormal, bumped, uNormalStrength));
  normal = normalize((viewMatrix * vec4(worldNormal, 0.0)).xyz);
}
`

function createLayerArray() {
  const data = new Uint8Array(
    LAYER_SIZE * LAYER_SIZE * 4 * TERRAIN_LAYERS.length,
  )
  for (let i = 0; i < data.length; i += 4) data.set(NEUTRAL_TEXEL, i)
  const texture = new THREE.DataArrayTexture(
    data,
    LAYER_SIZE,
    LAYER_SIZE,
    TERRAIN_LAYERS.length,
  )
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.generateMipmaps = true
  texture.anisotropy = TEXTURE_ANISOTROPY
  texture.colorSpace = THREE.NoColorSpace
  texture.needsUpdate = true
  return texture
}

/**
 * Copia a imagem de uma camada para a fatia `index` do array, de cabeça
 * para baixo (a linha 0 do array é a de baixo da textura — assim o y do
 * mapa de normal fica certo).
 */
function copyLayer(texture, index, image) {
  const canvas = document.createElement('canvas')
  canvas.width = LAYER_SIZE
  canvas.height = LAYER_SIZE
  const context = canvas.getContext('2d')
  context.translate(0, LAYER_SIZE)
  context.scale(1, -1)
  context.drawImage(image, 0, 0, LAYER_SIZE, LAYER_SIZE)
  const { data } = context.getImageData(0, 0, LAYER_SIZE, LAYER_SIZE)
  texture.image.data.set(data, index * LAYER_SIZE * LAYER_SIZE * 4)
  texture.needsUpdate = true
}

/**
 * Material do relevo (docs/features/047-biomas.md): `MeshStandardMaterial`
 * com a cor da paleta por vértice e, por cima, manchas suaves, granulado e
 * o desenho das camadas de textura (claro e escuro + relevo de luz, em
 * projeção triplanar) pelo peso de cada camada no vértice
 * (`groundLayers0/1`, `groundDetail` — terrainGeometry.js). Os números são
 * de `GAME_CONFIG.TERRAIN_LOOK` (`applyTerrainLook`). Um material para todos
 * os chunks; quem cria chama `dispose()` (regra 5.3).
 */
export function createTerrainMaterial() {
  const layers = createLayerArray()
  const uniforms = {
    uGroundLayers: { value: layers },
    uTextureSize: { value: 1 },
    uNormalStrength: { value: 0 },
    uTextureDetail: { value: 0 },
    uPatchStrength: { value: 0 },
    uPatchSize: { value: 1 },
    uGrainStrength: { value: 0 },
  }

  const material = new THREE.MeshStandardMaterial({ vertexColors: true })
  material.userData.terrainUniforms = uniforms
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)
    shader.vertexShader = (VERTEX_HEADER + shader.vertexShader)
      .replace('#include <beginnormal_vertex>', VERTEX_NORMAL)
      .replace('#include <begin_vertex>', VERTEX_WORLD)
    shader.fragmentShader = (FRAGMENT_HEADER + shader.fragmentShader)
      .replace('#include <color_fragment>', FRAGMENT_COLOR)
      .replace('#include <normal_fragment_maps>', FRAGMENT_NORMAL)
  }
  material.customProgramCacheKey = () => 'terrain-ground'

  const loader = new THREE.ImageLoader()
  TERRAIN_LAYERS.forEach((layer, index) =>
    loader.load(terrainLayerPath(layer), (image) =>
      copyLayer(layers, index, image),
    ),
  )

  const dispose = material.dispose.bind(material)
  material.dispose = () => {
    layers.dispose()
    dispose()
  }
  return material
}

/**
 * Passa os números do desenho do chão (`GAME_CONFIG.TERRAIN_LOOK`) para o
 * material. `enabled = false` (modo "chão por bioma" do debug) deixa só a
 * cor por vértice.
 */
export function applyTerrainLook(material, look, enabled = true) {
  const uniforms = material.userData.terrainUniforms
  const on = enabled ? 1 : 0
  uniforms.uTextureSize.value = look.TEXTURE_SIZE
  uniforms.uNormalStrength.value = look.NORMAL_STRENGTH * on
  uniforms.uTextureDetail.value = look.TEXTURE_DETAIL * on
  uniforms.uPatchStrength.value = look.PATCH_STRENGTH * on
  uniforms.uPatchSize.value = look.PATCH_SIZE
  uniforms.uGrainStrength.value = look.GRAIN_STRENGTH * on
}
