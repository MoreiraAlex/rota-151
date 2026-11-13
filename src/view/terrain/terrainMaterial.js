import * as THREE from 'three'
import { GAME_CONFIG } from '@/core/gameConfig'
import {
  COLOR_WEIGHT_GROUPS,
  MAX_COLOR_LAYERS,
  MAX_TERRAIN_LAYERS,
  TERRAIN_COLOR_LAYERS,
  TERRAIN_LAYERS,
  CURB_LAYER_BASE,
  CURB_MASKS,
  curbMaskPath,
  terrainColorLayerIndex,
  terrainColorLayerPath,
  terrainLayerPath,
} from './terrainLayers'
import { markAsScenery } from '@/view/materials/characterStencil'

// Lado (px) de cada camada no array de texturas (o do JPEG empacotado).
const LAYER_SIZE = 512
// Filtro anisotrópico (nitidez do chão visto de lado).
const TEXTURE_ANISOTROPY = 8
// Cor neutra de uma camada ainda não carregada: claro e escuro no brilho
// médio, normal reta.
const NEUTRAL_TEXEL = [128, 128, 128, 255]

// Uma linha de GLSL por grupo de quatro pesos de camada de cor.
const colorGroups = (line) =>
  Array.from({ length: COLOR_WEIGHT_GROUPS }, (_, i) => line(i)).join('\n')

// Ruído de valor, nos dois estágios: as manchas grandes saem no vértice
// (são bem maiores que o espaço entre vértices) e o granulado fino, no
// pixel.
const NOISE = /* glsl */ `
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
`

const VERTEX_HEADER = /* glsl */ `
${NOISE}
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

uniform float uPatchSize;
varying float vGroundPatches;
attribute vec4 groundLayers0;
attribute vec4 groundLayers1;
attribute float groundDetail;
${colorGroups((i) => `attribute vec4 groundColors${i};`)}
attribute float groundTextureShare;
attribute vec4 groundSlope;
attribute vec4 groundGrass;
varying vec4 vGroundGrass;
attribute vec4 groundCurb;
varying vec4 vGroundCurb;
flat varying float vGroundSlopeLayer;
varying vec2 vGroundSlope;
varying vec4 vGroundLayers0;
varying vec4 vGroundLayers1;
varying float vGroundDetail;
${colorGroups((i) => `varying vec4 vGroundColors${i};`)}
varying float vGroundTextureShare;
varying vec3 vTerrainWorld;
varying vec3 vTerrainNormal;
`

const FRAGMENT_HEADER = /* glsl */ `
uniform sampler2DArray uGroundLayers;
uniform sampler2DArray uColorLayers;
uniform float uColorLayerSizes[${MAX_COLOR_LAYERS}];
// 1 nas camadas de grama (o tom do chão só pega nelas).
uniform float uColorLayerGrass[${MAX_COLOR_LAYERS}];
// A camada que aparece onde esta é transparente (o índice + 1; 0 = nenhuma,
// \`setColorLayerSizes\`).
uniform float uColorLayerUnder[${MAX_COLOR_LAYERS}];
uniform float uTextureSize;
uniform float uNormalStrength;
uniform float uTextureDetail;
uniform float uPatchStrength;
uniform float uGrainStrength;
uniform vec3 uGroundTint;
uniform float uGroundTintAmount;
uniform float uGroundBrightness;
// A grama em fios no chão debaixo das manchas: a cor dela, o tom e quanto.
uniform vec3 uGrassColor;
uniform float uGrassGroundShade;
uniform float uGrassGroundAmount;
varying vec4 vGroundGrass;
// A beira da rua da cidade montada à mão (069): a distância até ela (em
// larguras da faixa, positiva fora da rua), a coordenada da máscara ao
// longo dela, quanto o ponto é da cidade e as camadas da rua e da borda de
// terra num número só (\`packCurbLayers\`, terrainGeometry.js — o mesmo no
// chunk inteiro); as duas máscaras do original e se elas já chegaram.
varying vec4 vGroundCurb;
uniform sampler2D uCurbLotMask;
uniform sampler2D uCurbRoadMask;
uniform float uCurbMasksReady;
// A encosta por pixel: normal.y onde começa e onde fica cheia.
uniform vec2 uSlopeRange;
flat varying float vGroundSlopeLayer;
varying vec2 vGroundSlope;
varying vec4 vGroundLayers0;
varying vec4 vGroundLayers1;
varying float vGroundDetail;
${colorGroups((i) => `varying vec4 vGroundColors${i};`)}
varying float vGroundTextureShare;
varying vec3 vTerrainWorld;
varying vec3 vTerrainNormal;
varying float vGroundPatches;

// Menor peso de camada que ainda entra no desenho.
const float MIN_LAYER_WEIGHT = 0.002;
// Onde a faixa da beira da rua fica nas máscaras do original (o V do UV
// delas): na beira e quanto ele anda até o fim da faixa, do lado do lote e
// do da rua; e o tom do miolo da rua na máscara dela (dividido: a rua
// fora da faixa fica como era).
const float CURB_LOT_EDGE = 0.998;
const float CURB_LOT_SPAN = 0.078;
const float CURB_ROAD_EDGE = 0.993;
const float CURB_ROAD_SPAN = 0.053;
const float CURB_ROAD_INNER = 0.851;
// Acima deste peso de cima (normal.y), o chão conta como plano: a textura
// sai só de cima, numa leitura (a projeção dos três lados é para encosta).
const float FLAT_GROUND = 0.98;
${NOISE}
// Projeção triplanar: a textura vem dos três eixos, pesada pela normal —
// não estica nas encostas.
vec3 triplanarWeights(vec3 n) {
  vec3 w = pow(abs(n), vec3(4.0));
  return w / (w.x + w.y + w.z);
}

// Uma camada de cor (docs/features/066-revisao-dos-biomas.md): de cima no
// chão plano; nas encostas, projetada dos três lados e pesada pela normal
// (de cima, a parede esticava a textura em listras).
vec4 colorTexelAt(int layer, vec3 world, vec3 w) {
  vec3 p = world / uColorLayerSizes[layer];
  float index = float(layer);
  if (w.y > FLAT_GROUND) return texture(uColorLayers, vec3(p.xz, index));
  return texture(uColorLayers, vec3(p.zy, index)) * w.x
    + texture(uColorLayers, vec3(p.xz, index)) * w.y
    + texture(uColorLayers, vec3(p.xy, index)) * w.z;
}

vec3 colorLayerAt(int layer, vec3 world, vec3 w) {
  return colorTexelAt(layer, world, w).rgb;
}

// A camada com a de baixo onde ela é transparente (as pedras de pisar
// sobre a terra, 069): as que não têm camada de baixo saem como estão.
vec3 coveredLayerAt(int layer, vec3 world, vec3 w) {
  int under = int(uColorLayerUnder[layer] + 0.5) - 1;
  if (under < 0) return colorLayerAt(layer, world, w);
  vec4 top = colorTexelAt(layer, world, w);
  return mix(colorLayerAt(under, world, w), top.rgb, top.a);
}

// Normal da camada (G/B = x/y; z reconstruído).
vec3 layerNormal(vec4 texel) {
  vec2 xy = texel.gb * 2.0 - 1.0;
  return vec3(xy, sqrt(max(0.0, 1.0 - dot(xy, xy))));
}

// Uma camada em projeção triplanar: claro e escuro (1 = brilho médio) em
// .w e a normal ("whiteout", no espaço do mundo) em .xyz. No chão plano,
// só a leitura de cima.
vec4 sampleLayer(float layer, vec3 p, vec3 n, vec3 w) {
  if (w.y > FLAT_GROUND) {
    vec4 top = texture(uGroundLayers, vec3(p.xz, layer));
    vec3 topNormal = layerNormal(top);
    topNormal = vec3(topNormal.xy + n.xz, abs(topNormal.z) * n.y);
    return vec4(normalize(topNormal.xzy), top.r * 2.0);
  }
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

// Soma uma camada de detalhe, se ela tiver peso.
void addGroundLayer(float layer, float weight, vec3 p, vec3 n, vec3 w,
    inout float detail, inout vec3 bump, inout float total) {
  if (weight < MIN_LAYER_WEIGHT) return;
  vec4 sampled = sampleLayer(layer, p, n, w);
  detail += sampled.w * weight;
  bump += sampled.xyz * weight;
  total += weight;
}

// As camadas da rua e da borda de terra, de volta do número só (a camada
// + 1 de cada, em base \`CURB_LAYER_BASE\`; -1 = nenhuma).
const float CURB_LAYER_BASE = ${CURB_LAYER_BASE}.0;
ivec2 curbLayersOf(float packed) {
  float code = floor(packed + 0.5);
  float road = mod(code, CURB_LAYER_BASE);
  return ivec2(int(road) - 1, int(floor(code / CURB_LAYER_BASE)) - 1);
}

// O peso (no ponto) da camada de cor \`layer\`.
float colorWeightOf(int layer) {
  int group = layer / 4;
  vec4 weights = vGroundColors0;
${Array.from({ length: COLOR_WEIGHT_GROUPS - 1 }, (_, i) => `  if (group == ${i + 1}) weights = vGroundColors${i + 1};`).join('\n')}
  return weights[layer - group * 4];
}

// Soma uma camada de cor, se ela tiver peso.
void addColorLayer(int layer, float weight, vec3 w,
    inout vec3 color, inout float total, inout float grass) {
  if (weight < MIN_LAYER_WEIGHT) return;
  color += coveredLayerAt(layer, vTerrainWorld, w) * weight;
  total += weight;
  grass += weight * uColorLayerGrass[layer];
}
`

// As camadas vêm em grupos de quatro pesos (um vec4 por grupo): o grupo
// sem peso nenhum é pulado inteiro; dentro dele, cada camada pelo
// componente, sem procurar o peso por índice.
const SLOTS = ['x', 'y', 'z', 'w']
const layerGroups = (groups, varying, add) =>
  Array.from(
    { length: groups },
    (_, group) => `if (dot(${varying}${group}, vec4(1.0)) > MIN_LAYER_WEIGHT) {
${SLOTS.map((slot, i) => `  ${add(group * 4 + i, `${varying}${group}.${slot}`)}`).join('\n')}
}`,
  ).join('\n')

const VERTEX_WORLD = /* glsl */ `
#include <begin_vertex>
vGroundLayers0 = groundLayers0;
vGroundLayers1 = groundLayers1;
vGroundDetail = groundDetail;
${colorGroups((i) => `vGroundColors${i} = groundColors${i};`)}
vGroundTextureShare = groundTextureShare;
vGroundSlopeLayer = groundSlope.x;
vGroundSlope = groundSlope.yz;
vGroundGrass = groundGrass;
vGroundCurb = groundCurb;
vTerrainWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
vGroundPatches = terrainFbm(vTerrainWorld.xz / uPatchSize);
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
${layerGroups(
  MAX_TERRAIN_LAYERS / 4,
  'vGroundLayers',
  (layer, weight) =>
    `addGroundLayer(${layer}.0, ${weight}, terrainPoint, terrainNormal, terrainWeights, layerDetail, layerBump, layerTotal);`,
)}

// Cor por textura (biomas com \`ground.colors\`, docs/features/052-*.md):
// a cor das camadas pelo peso de cada uma, no lugar da paleta, na parte
// do vértice que é desses biomas.
// A parte do ponto que é grama (para o tom do chão): nas camadas de cor,
// o peso das de grama; na paleta (sem textura), tudo.
float grassShare = 1.0;
// A troca da rua para o lote fica num pixel (a borda nítida).
float curbEdge = max(fwidth(vGroundCurb.x), 1e-4);
if (vGroundTextureShare > 0.001) {
  vec3 textured = vec3(0.0);
  float texturedTotal = 0.0;
  float grassTotal = 0.0;
${layerGroups(
  COLOR_WEIGHT_GROUPS,
  'vGroundColors',
  (layer, weight) =>
    `addColorLayer(${layer}, ${weight}, terrainWeights, textured, texturedTotal, grassTotal);`,
)}
  if (texturedTotal > 0.0) {
    vec3 groundColor = textured / texturedTotal;
    float grassPart = grassTotal / texturedTotal;
    // A beira da rua da cidade montada à mão (069), por pixel: a rua sai
    // da mistura por vértice e entra de um lado da beira, o resto (o lote)
    // do outro; a borda de terra e a franja da grama do lado do lote e a
    // guia do lado da rua vêm das máscaras do original.
    float curbOn = clamp(vGroundCurb.z, 0.0, 1.0);
    ivec2 curbLayers = curbLayersOf(vGroundCurb.w);
    if (curbOn > 0.001 && curbLayers.x >= 0) {
      int roadLayer = curbLayers.x;
      int soilLayer = curbLayers.y;
      vec3 roadColor = coveredLayerAt(roadLayer, vTerrainWorld, terrainWeights);
      float roadWeight = colorWeightOf(roadLayer);
      if (roadWeight < MIN_LAYER_WEIGHT) roadWeight = 0.0;
      float lotTotal = texturedTotal - roadWeight;
      bool hasLot = lotTotal > MIN_LAYER_WEIGHT;
      vec3 lot = hasLot ? (textured - roadColor * roadWeight) / lotTotal : roadColor;
      float lotGrass = hasLot ? grassTotal / lotTotal : 0.0;
      vec3 road = roadColor;
      float d = vGroundCurb.x;
      if (uCurbMasksReady > 0.5 && soilLayer >= 0) {
        vec3 soil = coveredLayerAt(soilLayer, vTerrainWorld, terrainWeights);
        vec4 lotMask = texture(uCurbLotMask,
          vec2(vGroundCurb.y, CURB_LOT_EDGE - CURB_LOT_SPAN * clamp(d, 0.0, 1.0)));
        lot = mix(soil, lot, lotMask.a) * lotMask.rgb;
        lotGrass *= lotMask.a;
        vec4 roadMask = texture(uCurbRoadMask,
          vec2(vGroundCurb.y, CURB_ROAD_EDGE - CURB_ROAD_SPAN * clamp(-d, 0.0, 1.0)));
        road = mix(soil, roadColor, roadMask.a) * roadMask.rgb / CURB_ROAD_INNER;
      }
      float roadShare = 1.0 - smoothstep(-curbEdge, curbEdge, d);
      groundColor = mix(groundColor, mix(lot, road, roadShare), curbOn);
      grassPart = mix(grassPart, lotGrass * (1.0 - roadShare), curbOn);
    }
    // A encosta por pixel, pela inclinação ali (066): a troca segue a borda
    // do barranco, sem as faixas em diagonal da mistura por vértice. O pico
    // cobre a encosta.
    float steep = 1.0 - smoothstep(uSlopeRange.y, uSlopeRange.x, terrainNormal.y);
    float slopeAmount = steep * clamp(vGroundSlope.x, 0.0, 1.0)
      * (1.0 - clamp(vGroundSlope.y, 0.0, 1.0));
    if (slopeAmount > 0.001) {
      vec3 slopeColor = coveredLayerAt(int(vGroundSlopeLayer + 0.5), vTerrainWorld, terrainWeights);
      groundColor = mix(groundColor, slopeColor, slopeAmount);
      grassPart *= 1.0 - slopeAmount;
    }
    diffuseColor.rgb = mix(diffuseColor.rgb, groundColor, vGroundTextureShare);
    grassShare = mix(1.0, grassPart, vGroundTextureShare);
  }
}

float grain = terrainNoise(vTerrainWorld.xz * 3.0);
float shade = 1.0
  + uPatchStrength * (vGroundPatches - 0.5) * 2.0
  + uGrainStrength * (grain - 0.5) * 2.0;
if (layerTotal > 0.0) {
  float detail = layerDetail / layerTotal;
  shade *= mix(1.0, detail, uTextureDetail * vGroundDetail);
}
diffuseColor.rgb *= shade;
// Tom e brilho do chão de grama (TERRAIN_LOOK.TINT*, BRIGHTNESS): puxa a
// cor para o tom mantendo o claro e escuro e clareia ou escurece — só na
// parte que é grama; trilha, margem e encosta ficam como estão.
vec3 groundLuma = vec3(0.2126, 0.7152, 0.0722);
vec3 groundHue = uGroundTint / max(dot(uGroundTint, groundLuma), 1e-3);
vec3 groundTinted = mix(diffuseColor.rgb,
  groundHue * dot(diffuseColor.rgb, groundLuma), uGroundTintAmount)
  * uGroundBrightness;
diffuseColor.rgb = mix(diffuseColor.rgb, groundTinted, grassShare);
// Debaixo das manchas de grama em fios, a cor dela (docs/features/066-
// revisao-dos-biomas.md): de longe, onde as lâminas sumiram, a mancha
// continua; perto, elas brotam em cima da mesma cor. O claro e escuro do
// chão fica por cima.
float grassCover = clamp(vGroundGrass.a, 0.0, 1.0) * uGrassGroundAmount;
if (grassCover > 0.001) {
  vec3 grassGround = uGrassColor * vGroundGrass.rgb * uGrassGroundShade * shade;
  diffuseColor.rgb = mix(diffuseColor.rgb, grassGround, grassCover);
}
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

function createColorArray() {
  const data = new Uint8Array(
    LAYER_SIZE * LAYER_SIZE * 4 * TERRAIN_COLOR_LAYERS.length,
  )
  for (let i = 0; i < data.length; i += 4) data.set(NEUTRAL_TEXEL, i)
  const texture = new THREE.DataArrayTexture(
    data,
    LAYER_SIZE,
    LAYER_SIZE,
    TERRAIN_COLOR_LAYERS.length,
  )
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.generateMipmaps = true
  texture.anisotropy = TEXTURE_ANISOTROPY
  texture.colorSpace = THREE.SRGBColorSpace
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

// Tamanho de cada camada de cor, compartilhado pelos materiais do relevo.
const colorLayerSizes = new Float32Array(MAX_COLOR_LAYERS).fill(1)
// A camada de baixo de cada uma (o índice + 1; 0 = nenhuma), também
// compartilhada (`setColorLayerSizes`).
const colorLayerUnder = new Float32Array(MAX_COLOR_LAYERS)
// As camadas de grama (o tom do chão, `TERRAIN_LOOK.TINT`, só pega nelas).
const GRASS_LAYER = /grass|forest-floor/
export const colorLayerGrass = Float32Array.from(
  { length: MAX_COLOR_LAYERS },
  (_, index) =>
    GRASS_LAYER.test(TERRAIN_COLOR_LAYERS[index]?.[0] ?? '') ? 1 : 0,
)

// A luz do chão (`TERRAIN_LOOK.LIGHTING`): o material do three de cada uma.
const LIGHTING_MATERIALS = {
  standard: THREE.MeshStandardMaterial,
  lambert: THREE.MeshLambertMaterial,
}

/**
 * Materiais do relevo (docs/features/047-biomas.md): a cor da paleta por
 * vértice e, por cima, manchas suaves, granulado e o desenho das camadas de
 * textura (claro e escuro + relevo de luz, em projeção triplanar) pelo peso
 * de cada camada no vértice (`groundLayers0/1`, `groundDetail` —
 * terrainGeometry.js). Nos biomas com `ground.colors`
 * (docs/features/052-assets-do-lgpe-e-floresta.md), a cor vem das camadas
 * de cor do Let's Go (`groundColors0/1`), na parte do vértice que é deles
 * (`groundTextureShare`). Os números são de `GAME_CONFIG.TERRAIN_LOOK`
 * (`applyTerrainLook`).
 *
 * Um material por luz (`forLighting`, criado na primeira vez que é pedido —
 * docs/features/066-revisao-dos-biomas.md), todos com as mesmas texturas e
 * números; quem cria chama `dispose()` (regra 5.3).
 */
export function createTerrainMaterials() {
  const layers = createLayerArray()
  const colorLayers = createColorArray()
  const uniforms = {
    uGroundLayers: { value: layers },
    uColorLayers: { value: colorLayers },
    // O mesmo array em todos os materiais (`setColorLayerSizes`).
    uColorLayerSizes: { value: colorLayerSizes },
    uColorLayerGrass: { value: colorLayerGrass },
    uColorLayerUnder: { value: colorLayerUnder },
    uTextureSize: { value: 1 },
    uNormalStrength: { value: 0 },
    uTextureDetail: { value: 0 },
    uPatchStrength: { value: 0 },
    uPatchSize: { value: 1 },
    uGrainStrength: { value: 0 },
    uGroundTint: { value: new THREE.Color(1, 1, 1) },
    uGroundTintAmount: { value: 0 },
    uGroundBrightness: { value: 1 },
    uSlopeRange: { value: new THREE.Vector2(0.9, 0.75) },
    uGrassColor: { value: new THREE.Color(1, 1, 1) },
    uGrassGroundShade: { value: 1 },
    uGrassGroundAmount: { value: 0 },
    uCurbLotMask: { value: null },
    uCurbRoadMask: { value: null },
    uCurbMasksReady: { value: 0 },
  }
  const curbMasks = createCurbMasks(uniforms)

  const build = (lighting) => {
    const Material = LIGHTING_MATERIALS[lighting]
    // O chão apaga a marca do stencil (materials/characterStencil.js).
    const material = markAsScenery(new Material({ vertexColors: true }))
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
    material.customProgramCacheKey = () => `terrain-ground-${lighting}`
    return material
  }
  const materials = new Map()

  const loader = new THREE.ImageLoader()
  TERRAIN_LAYERS.forEach((layer, index) =>
    loader.load(terrainLayerPath(layer), (image) =>
      copyLayer(layers, index, image),
    ),
  )

  TERRAIN_COLOR_LAYERS.forEach(([layer], index) =>
    loader.load(terrainColorLayerPath(layer), (image) =>
      copyLayer(colorLayers, index, image),
    ),
  )

  return {
    uniforms,
    /** O material da luz pedida (uma desconhecida cai na `standard`). */
    forLighting(lighting) {
      const key = lighting in LIGHTING_MATERIALS ? lighting : 'standard'
      if (!materials.has(key)) materials.set(key, build(key))
      return materials.get(key)
    },
    dispose() {
      for (const material of materials.values()) material.dispose()
      colorLayers.dispose()
      layers.dispose()
      curbMasks.forEach((texture) => texture.dispose())
    },
  }
}

/**
 * As máscaras da beira da rua (`CURB_MASKS`): repetem ao longo da beira e
 * param no fim da faixa; valem quando as duas chegam (`uCurbMasksReady`).
 */
function createCurbMasks(uniforms) {
  const loader = new THREE.TextureLoader()
  let pending = 2
  const load = (name, uniform) => {
    const texture = loader.load(curbMaskPath(name), () => {
      pending -= 1
      if (pending === 0) uniforms.uCurbMasksReady.value = 1
    })
    texture.wrapS = THREE.RepeatWrapping
    texture.wrapT = THREE.ClampToEdgeWrapping
    texture.colorSpace = THREE.NoColorSpace
    texture.anisotropy = TEXTURE_ANISOTROPY
    uniforms[uniform].value = texture
    return texture
  }
  return [
    load(CURB_MASKS.lot, 'uCurbLotMask'),
    load(CURB_MASKS.road, 'uCurbRoadMask'),
  ]
}

/**
 * Tamanho (m) de uma repetição de cada camada de cor: o próprio dela
 * (`COLOR_LAYER_SIZES`) ou o de todas (`COLOR_TEXTURE_SIZE`); e a camada
 * que aparece onde ela é transparente (`COLOR_LAYER_UNDER`). Vale na hora
 * (o painel do debug chama de novo ao mexer).
 */
export function setColorLayerSizes(look) {
  TERRAIN_COLOR_LAYERS.forEach(([layer], index) => {
    colorLayerSizes[index] =
      look.COLOR_LAYER_SIZES?.[layer] ?? look.COLOR_TEXTURE_SIZE
    const under = look.COLOR_LAYER_UNDER?.[layer]
    colorLayerUnder[index] = under ? terrainColorLayerIndex(under) + 1 : 0
  })
}

/**
 * Passa os números do desenho do chão (`GAME_CONFIG.TERRAIN_LOOK`) para os
 * materiais do relevo (`createTerrainMaterials`).
 */
export function applyTerrainLook(terrain, look) {
  const { uniforms } = terrain
  uniforms.uTextureSize.value = look.TEXTURE_SIZE
  setColorLayerSizes(look)
  uniforms.uNormalStrength.value = look.NORMAL_STRENGTH
  uniforms.uTextureDetail.value = look.TEXTURE_DETAIL
  uniforms.uPatchStrength.value = look.PATCH_STRENGTH
  uniforms.uPatchSize.value = look.PATCH_SIZE
  uniforms.uGrainStrength.value = look.GRAIN_STRENGTH
  uniforms.uGroundTint.value.set(look.TINT ?? '#ffffff')
  uniforms.uGroundTintAmount.value = look.TINT_AMOUNT ?? 0
  uniforms.uGroundBrightness.value = look.BRIGHTNESS ?? 1
  const { SLOPE_START, SLOPE_FULL } = GAME_CONFIG.TERRAIN_COLOR
  uniforms.uSlopeRange.value.set(SLOPE_START, SLOPE_FULL)
  // A grama em fios no chão (some junto com a grama escondida).
  const { GRASS_BLADES, GRASS } = GAME_CONFIG
  uniforms.uGrassColor.value.set(GRASS_BLADES.COLOR)
  uniforms.uGrassGroundShade.value = GRASS_BLADES.GROUND_SHADE ?? 1
  uniforms.uGrassGroundAmount.value = GRASS.VISIBLE
    ? (GRASS_BLADES.GROUND_COVER ?? 0)
    : 0
}
