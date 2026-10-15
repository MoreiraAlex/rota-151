#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { decodeDds } from './dds.js'
import { bonePath, decodeVertices, parseGfbmdl } from './gfbmdl.js'
import { encodePng, hasAlpha, shrinkTo } from './image.js'
import { writeGlb } from './glb.js'
import { clusterObjects, piecesOf, sizeSignature } from './splitObjects.js'

/**
 * Empacota os assets de cenário do Pokémon Let's Go para o jogo
 * (docs/features/052-assets-do-lgpe-e-floresta.md — a vegetação e o chão
 * dos biomas):
 *
 * - **props** tirados dos mapas da Floresta de Viridian (`forest001_00`),
 *   da Rota 1 (`road001_00`, as árvores redondas) e das rotas de campo da
 *   planície (Rotas 3 e 22 — docs/features/053-planicie-com-assets-do-
 *   lgpe.md) e das rotas secas da savana (Rotas 4 e 9 —
 *   docs/features/054-savana-lgpe-e-saida-do-megakit.md), onde cada tipo de
 *   árvore, planta ou pedra vem fundido numa malha só: separa os objetos
 *   (`splitObjects.js`) e fica com o mais comum de cada tipo;
 * - **props soltos** da `buildmodel/` (mato alto, flores, tufos, árvore de
 *   Corte), inteiros;
 * - **texturas** (DDS BC1/BC3 → PNG, até `MAX_TEXTURE` px) dos props, do
 *   chão do mapa e as tabelas de toon (rampa da sombra).
 *
 * Grava em `public/assets/vegetation/lgpe/`: `props/<id>.glb` (centímetros →
 * metros, base no chão e centro no meio), `textures/<nome>.png` e
 * `manifest.json` (o material de cada parte: texturas por papel, corte do
 * alfa, cor da sombra e da luz de borda — os números do jogo original).
 *
 * Entrada: a pasta `field/` extraída do `LGPE-FieldMaps.7z` (guardado em
 * `.exemple/ambient/LGPE/`). Para extrair só o necessário:
 *   npx -y -p 7zip-bin node -e "console.log(require('7zip-bin').path7za)"
 *   <7za> x LGPE-FieldMaps.7z 'field/forest/*' 'field/area02/*' 'field/area03/*' 'field/area04/*' 'field/buildmodel/*' -o<pasta>
 *
 * Uso:
 *   node scripts/lgpe/pack-lgpe.js --field <pasta>/field
 *
 * `--extra <arquivo.json>`: props a mais (a mesma forma de `MAP_PROPS`),
 * para olhar candidatos sem mexer na lista — com `--out` numa pasta à
 * parte.
 */

const { values: args } = parseArgs({
  options: {
    field: { type: 'string' },
    out: { type: 'string', default: 'public/assets/vegetation/lgpe' },
    extra: { type: 'string' },
  },
})
if (!args.field) throw new Error('faltou --field <pasta field/ extraída>')

const MAX_TEXTURE = 512
const CENTIMETERS = 0.01
// Props tirados de mapas (onde vêm fundidos): o mapa, a pasta das
// texturas dele e o nó (caminho do osso) de cada um.
const FOREST = { map: 'forest/forest001_00.gfbmdl', folder: 'forest' }
const ROUTE_1 = { map: 'area02/road001_00.gfbmdl', folder: 'area02' }
const ROUTE_1_TREES = 'road001_00_tree/tree35'
const ROUTE_1_GRASS = 'road001_00_grass'
// Rotas de campo (docs/features/053-planicie-com-assets-do-lgpe.md): as
// árvores, tufos, flores e pedras da planície.
const ROUTE_3 = { map: 'area03/road003_00.gfbmdl', folder: 'area03' }
const ROUTE_22 = { map: 'area02/road022_00.gfbmdl', folder: 'area02' }
// Rotas secas (docs/features/054-savana-lgpe-e-saida-do-megakit.md): as
// pedras na terra da savana.
const ROUTE_4 = { map: 'area03/road004_1_00.gfbmdl', folder: 'area03' }
const ROUTE_9 = { map: 'area04/road009_00.gfbmdl', folder: 'area04' }
// Cidades (docs/features/056-bioma-cidade.md): os prédios e os objetos de
// rua. Os prédios vêm em nós próprios (com filhos: telhado, janela, placa),
// tirados inteiros (`whole`); a porta fica do lado +Z do modelo.
const PALLET = { map: 'area02/town001_00.gfbmdl', folder: 'area02' }
const PEWTER = { map: 'area03/town003_00.gfbmdl', folder: 'area03' }
// Os temas das cidades (um tema por cidade de Kanto): as casas, o prédio
// especial e o poste de cada uma. Nas cidades em que as casas vêm fundidas
// num nó, `object` diz qual delas.
const CERULEAN = { map: 'area04/town004_00.gfbmdl', folder: 'area04' }
const VERMILION = { map: 'area09/town006_00.gfbmdl', folder: 'area09' }
const LAVENDER = { map: 'area08/town005_00.gfbmdl', folder: 'area08' }
// Um objeto de um nó fundido (`object`, docs/features/056-bioma-cidade.md):
// os grandes (prédios), da esquerda para a direita e de trás para a frente.
const BUILDING_MIN_WIDTH = 200
const BUILDING_MIN_HEIGHT = 150
// Folga (cm) em que as peças de um prédio ainda são o mesmo objeto (o
// telhado solto da parede).
const BUILDING_MARGIN = 30
// Quanto (m) para cada lado do buraco da porta conta como a parede em
// volta dele (a frente onde a porta encaixa).
const DOOR_WALL_REACH = 1
const MAP_PROPS = [
  {
    id: 'round-tree',
    label: 'Árvore redonda (Rota 1)',
    category: 'tree',
    ...ROUTE_1,
    node: `${ROUTE_1_TREES}/tree001`,
  },
  {
    id: 'round-tree-b',
    label: 'Árvore redonda 2 (Rota 1)',
    category: 'tree',
    ...ROUTE_1,
    node: `${ROUTE_1_TREES}/tree002`,
  },
  {
    id: 'round-tree-c',
    label: 'Árvore redonda 3 (Rota 1)',
    category: 'tree',
    ...ROUTE_1,
    node: `${ROUTE_1_TREES}/tree004`,
  },
  {
    id: 'round-tree-d',
    label: 'Árvore redonda 4 (Rota 1)',
    category: 'tree',
    ...ROUTE_1,
    node: `${ROUTE_1_TREES}/tree005`,
  },
  {
    id: 'round-bush',
    label: 'Moita redonda (Rota 1)',
    category: 'bush',
    ...ROUTE_1,
    node: `${ROUTE_1_TREES}/tree006`,
  },
  {
    id: 'pine-viridian',
    label: 'Pinheiro (Viridian)',
    category: 'tree',
    ...FOREST,
    node: 'tree1',
  },
  {
    id: 'tall-trunk',
    label: 'Tronco alto (borda da mata)',
    category: 'tree',
    ...FOREST,
    node: 'tree/tree01',
  },
  {
    id: 'young-tree',
    label: 'Árvore jovem (Viridian)',
    category: 'tree',
    ...FOREST,
    node: 'tree/tree02',
  },
  {
    id: 'fern',
    label: 'Samambaia',
    category: 'bush',
    ...FOREST,
    node: 'plant02',
  },
  { id: 'tuft', label: 'Tufo', category: 'tuft', ...FOREST, node: 'plant01' },
  {
    id: 'clover',
    label: 'Trevo',
    category: 'plant',
    ...FOREST,
    node: 'plant03',
  },
  {
    id: 'clover-large',
    label: 'Trevo grande',
    category: 'plant',
    ...FOREST,
    node: 'plant04',
  },
  {
    id: 'rock-large',
    label: 'Pedra com trevo',
    category: 'rock',
    ...FOREST,
    node: 'rock/rock01',
  },
  {
    id: 'rock-small',
    label: 'Pedra pequena',
    category: 'rock',
    ...FOREST,
    node: 'rock/rock02',
  },
  {
    id: 'round-tree-e',
    label: 'Pinheiro (Rota 3)',
    category: 'tree',
    ...ROUTE_3,
    node: 'road003_00_tree/tree02_3',
  },
  {
    id: 'round-tree-f',
    label: 'Árvore redonda média (Rota 3)',
    category: 'tree',
    ...ROUTE_3,
    node: 'road003_00_tree/tree01_2',
  },
  {
    id: 'tuft-route',
    label: 'Tufo (Rota 1)',
    category: 'tuft',
    ...ROUTE_1,
    node: `${ROUTE_1_GRASS}/road001_00_grass01`,
  },
  {
    id: 'tuft-medium',
    label: 'Tufo médio (Rota 1)',
    category: 'tuft',
    ...ROUTE_1,
    node: `${ROUTE_1_GRASS}/road001_00_grass06`,
  },
  {
    id: 'rock-grass',
    label: 'Pedrinha na grama (Rota 1)',
    category: 'rock',
    ...ROUTE_1,
    node: 'road001_00_rock',
  },
  {
    id: 'rock-soil',
    label: 'Pedrinha na terra (Rota 22)',
    category: 'rock',
    ...ROUTE_22,
    node: 'road022_00_rock/road022_00_rock02',
  },
  {
    id: 'rock-soil-b',
    label: 'Pedrinha na terra (Rota 3)',
    category: 'rock',
    ...ROUTE_3,
    node: 'road003_00_rock/road003_00_rock02_001',
  },
  {
    id: 'rock-dirt',
    label: 'Pedra na terra (Rota 9)',
    category: 'rock',
    ...ROUTE_9,
    node: 'road009_00_rock/road009_00_mountain_rock01',
  },
  {
    id: 'rock-dirt-b',
    label: 'Pedra na terra escura (Rota 4)',
    category: 'rock',
    ...ROUTE_4,
    node: 'road004_1_00_rock/road004_1_00_rock03',
  },
  {
    id: 'rock-dirt-c',
    label: 'Pedra média na terra (Rota 4)',
    category: 'rock',
    ...ROUTE_4,
    node: 'road004_1_00_rock/road004_1_00_rock04',
  },
  {
    id: 'pokecenter',
    label: 'Pokécenter',
    category: 'building',
    ...PEWTER,
    node: 'bldg_pc',
    door: { model: 'combldg_pc_door01' },
    whole: true,
  },
  {
    id: 'poke-mart',
    label: 'Loja',
    category: 'building',
    ...PEWTER,
    node: 'bldg_shop',
    door: { model: 'combldg_shop_door01' },
    whole: true,
  },
  {
    id: 'gym',
    label: 'Ginásio',
    category: 'building',
    ...PEWTER,
    node: 'bldg_gym',
    door: { model: 'combldg_gym_door01' },
    whole: true,
  },
  {
    id: 'house-lab',
    label: 'Laboratório (Pallet)',
    category: 'building',
    ...PALLET,
    node: 'masaratown_house_labo',
    whole: true,
  },
  {
    id: 'house-pewter',
    label: 'Casa de pedra (Pewter)',
    category: 'building',
    ...PEWTER,
    node: 'bldg_nibi_minka01',
    door: { model: 'town003_door02' },
    whole: true,
  },
  {
    id: 'house-pewter-b',
    label: 'Casa de pedra 2 (Pewter)',
    category: 'building',
    ...PEWTER,
    node: 'bldg_nibi_minka02',
    door: { model: 'town003_door02' },
    whole: true,
  },
  {
    id: 'pewter-museum',
    label: 'Museu (Pewter)',
    category: 'building',
    ...PEWTER,
    node: 'bldg_nibi_museum',
    whole: true,
  },
  // As duas últimas não têm porta na frente (casas fechadas no jogo).
  ...[2, 3, 5, 6].map((object, index) => ({
    id: `cerulean-house-${'abcd'[index]}`,
    label: `Casa ${index + 1} (Cerulean)`,
    category: 'building',
    ...CERULEAN,
    node: 'house',
    object,
    ...(index < 2 && { door: { model: 'town004_door01' } }),
  })),
  {
    id: 'cerulean-bike-shop',
    label: 'Loja de bicicleta (Cerulean)',
    category: 'building',
    ...CERULEAN,
    node: 'house',
    object: 1,
    door: { model: 'town004_door01' },
  },
  {
    id: 'cerulean-lamp',
    label: 'Poste (Cerulean)',
    category: 'street',
    ...CERULEAN,
    node: 'lamp',
  },
  // A segunda não tem porta na frente (casa fechada no jogo).
  ...[0, 2].map((object, index) => ({
    id: `vermilion-house-${'ab'[index]}`,
    label: `Casa ${index + 1} (Vermilion)`,
    category: 'building',
    ...VERMILION,
    node: 'bldg_minka',
    object,
    ...(index === 0 && { door: { model: 'town006_door01' } }),
  })),
  {
    id: 'vermilion-fan-club',
    label: 'Fã-clube (Vermilion)',
    category: 'building',
    ...VERMILION,
    node: 'bldg_minka',
    object: 1,
    door: { model: 'town006_door02' },
  },
  {
    id: 'lavender-house',
    label: 'Casa (Lavender)',
    category: 'building',
    ...LAVENDER,
    node: 'bldg_minka005_00',
    door: { model: 'town005_door01', x: 0 },
    whole: true,
  },
  {
    id: 'lavender-tower',
    label: 'Torre Pokémon (Lavender)',
    category: 'building',
    ...LAVENDER,
    node: 'tower005_00',
    whole: true,
  },
  {
    id: 'fence-wood',
    label: 'Cerca de madeira (Pallet)',
    category: 'street',
    ...PALLET,
    node: 'fence02',
    whole: true,
  },
  {
    id: 'bench',
    label: 'Banco (Pewter)',
    category: 'street',
    ...PEWTER,
    node: 'benchi_1',
  },
  {
    id: 'street-lamp',
    label: 'Poste (Pewter)',
    category: 'street',
    ...PEWTER,
    node: 'lamp01',
  },
]

// Props soltos (`buildmodel/<arquivo>.gfbmdl`).
const LOOSE_PROPS = [
  {
    id: 'tall-grass',
    label: 'Mato alto',
    category: 'tall-grass',
    file: 'enc_grass01',
  },
  {
    id: 'tall-grass-2',
    label: 'Mato alto 2',
    category: 'tall-grass',
    file: 'enc_grass02',
  },
  { id: 'grass-low', label: 'Grama baixa', category: 'tuft', file: 'grass01' },
  {
    id: 'grass-clump',
    label: 'Moita de grama',
    category: 'tuft',
    file: 'grass03',
  },
  { id: 'reeds', label: 'Capim alto', category: 'tall-grass', file: 'grass04' },
  { id: 'shrub', label: 'Arbusto', category: 'bush', file: 'grass02_2' },
  {
    id: 'fern-loose',
    label: 'Samambaia solta',
    category: 'bush',
    file: 'grass05',
  },
  {
    id: 'flower-white',
    label: 'Flores brancas',
    category: 'flower',
    file: 'flower01',
  },
  {
    id: 'flower-small',
    label: 'Flores pequenas',
    category: 'flower',
    file: 'flower02',
  },
  {
    id: 'flower-carpet',
    label: 'Tapete de flores',
    category: 'flower',
    file: 'flower04',
  },
  {
    id: 'flower-yellow',
    label: 'Flores amarelas',
    category: 'flower',
    file: 'flowers03',
  },
  {
    id: 'flower-bush',
    label: 'Moita florida',
    category: 'bush',
    file: 'flowers05',
  },
  {
    id: 'flower-forest',
    label: 'Flores da mata',
    category: 'flower',
    file: 'flowers_forest01',
  },
  {
    id: 'flower-tree',
    label: 'Árvore florida',
    category: 'tree',
    file: 'flower12',
  },
  {
    id: 'flower-bush-b',
    label: 'Moita florida grande',
    category: 'bush',
    file: 'flowers07',
  },
  {
    id: 'flower-6',
    label: 'Flores 6',
    category: 'flower',
    file: 'flowers06',
  },
  {
    id: 'flower-9',
    label: 'Flores 9',
    category: 'flower',
    file: 'flowers09',
  },
  {
    id: 'flower-10',
    label: 'Flores 10',
    category: 'flower',
    file: 'flowers10',
  },
  {
    id: 'flower-11',
    label: 'Flores 11',
    category: 'flower',
    file: 'flowers11',
  },
  {
    id: 'flower-13',
    label: 'Flores 13',
    category: 'flower',
    file: 'flowers13',
  },
  {
    id: 'cut-tree-b',
    label: 'Árvore de Corte 2',
    category: 'tree',
    file: 'iaigiri_tree02',
  },
  {
    id: 'cut-tree',
    label: 'Árvore de Corte',
    category: 'tree',
    file: 'iaigiri_tree01',
  },
]

// Texturas do chão do mapa (as camadas de cor do chão dos biomas), pela
// pasta de onde vêm: as da floresta e as das rotas de campo.
const GROUND_TEXTURES = {
  forest: [
    'floor01_forest',
    'grass01_com',
    'grass02_com',
    'soil01_com',
    'soil08_com',
    'soil12_com',
    'soil13_com',
    'rock01_forest',
    'cliff01_com',
    'roadstone01_com',
    'greenblend01_com',
    'glassmask01_com',
  ],
  area02: [
    'grass01_area02',
    'grass02_area02',
    'grass03_area02',
    'grass03_com',
    'grass04_com',
    'soil01_area02',
    'soil08_area02',
    'soil09_com',
    'soil10_com',
    'sand01_com',
    'sand02_com',
    'cliff01_area02',
    // Calçamento das ruas das cidades (docs/features/056-bioma-cidade.md).
    'roadtile01_area02',
    'roadtile02_area02',
    'asphalt01_area02',
    'tile02_01_area02',
  ],
  area03: ['tile01_01_area03'],
  area04: ['cliff02_com', 'tile01_01_area04'],
  // As ruas dos temas de Vermilion e Lavender.
  area09: ['tile02_01_area09'],
  area08: ['asphalt01_area08'],
}
const TOON_TABLES = ['shadowtable01_t', 'shadowtable02_t', 'lighttable01_t']

// Papéis de textura que não vão (profundidade, rampa e nuvem projetada).
const SKIPPED_SAMPLERS = new Set([
  'DepthBuffer',
  'ShadowToonTable',
  'lightToonTable',
  'LightProjMap',
])
const SHADOW_ONLY = 'FieldShadowOnlyShader'

const out = args.out
for (const dir of ['', 'props', 'textures'])
  mkdirSync(join(out, dir), { recursive: true })

const textures = {}
function packTexture(folder, name) {
  if (textures[name]) return name
  const path = join(args.field, folder, `${name}.dds`)
  if (!existsSync(path)) return null
  const image = decodeDds(readFileSync(path))
  const small = shrinkTo(image, MAX_TEXTURE)
  const alpha = hasAlpha(small)
  writeFileSync(
    join(out, 'textures', `${name}.png`),
    encodePng(small, { opaque: !alpha }),
  )
  textures[name] = {
    file: `textures/${name}.png`,
    width: small.width,
    height: small.height,
    alpha,
  }
  return name
}

function materialEntry(model, material, folder) {
  const maps = {}
  for (const { sampler, index } of material.textures) {
    if (SKIPPED_SAMPLERS.has(sampler)) continue
    const name = packTexture(folder, model.textureNames[index])
    if (name) maps[sampler] = name
  }
  const { values, colors, commonValues } = material
  return {
    shader: material.shader,
    maps,
    // Corte do alfa (só nos recortados: folha, planta, mato).
    cutoff: values.DiscardValuie ?? null,
    doubleSided: commonValues.CullMode === 2 || values.DiscardValuie != null,
    shadowColor: colors.Shadow_Color ?? null,
    rimColor: colors.RimColor ?? null,
    rim:
      values.RimLight_Strength != null
        ? [values.RimLight_Min, values.RimLight_Max, values.RimLight_Strength]
        : null,
    lightColor: colors.LightColor ?? null,
    greenColor: colors.GreenColor ?? null,
  }
}

/**
 * Monta as primitivas (uma por material) dos vértices escolhidos
 * (`keepVertex(mesh, vertex)`), em metros, com o centro em XZ e a base em
 * Y = 0.
 */
function buildPrimitives(model, meshes, keepVertex) {
  const parts = []
  const box = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity]
  for (const { meshIndex, decoded } of meshes) {
    const mesh = model.meshes[meshIndex]
    for (const polygon of mesh.polygons) {
      const material = model.materials[polygon.materialIndex]
      if (material.shader === SHADOW_ONLY) continue
      const remap = new Map()
      const indices = []
      for (let i = 0; i < polygon.faces.length; i += 3) {
        const triangle = [
          polygon.faces[i],
          polygon.faces[i + 1],
          polygon.faces[i + 2],
        ]
        if (!keepVertex(meshIndex, triangle[0])) continue
        for (const vertex of triangle) {
          if (!remap.has(vertex)) remap.set(vertex, remap.size)
          indices.push(remap.get(vertex))
        }
      }
      if (indices.length === 0) continue
      const vertices = [...remap.keys()]
      const pick = (attribute, size) => {
        if (!decoded[attribute]) return undefined
        const array = new Float32Array(vertices.length * size)
        vertices.forEach((vertex, i) => {
          for (let c = 0; c < size; c++) {
            array[i * size + c] =
              decoded[attribute].array[vertex * decoded[attribute].size + c]
          }
        })
        return array
      }
      const position = pick('position', 3).map((value) => value * CENTIMETERS)
      for (let i = 0; i < position.length; i += 3) {
        for (let c = 0; c < 3; c++) {
          box[c] = Math.min(box[c], position[i + c])
          box[c + 3] = Math.max(box[c + 3], position[i + c])
        }
      }
      const normal = pick('normal', 3)
      if (normal) {
        for (let i = 0; i < normal.length; i += 3) {
          const length =
            Math.hypot(normal[i], normal[i + 1], normal[i + 2]) || 1
          for (let c = 0; c < 3; c++) normal[i + c] /= length
        }
      }
      const color = decoded.color0
        ? Uint8Array.from(pick('color0', 4), (value) => Math.round(value))
        : undefined
      parts.push({
        material: material.name,
        position,
        normal,
        uv0: pick('uv0', 2),
        uv1: pick('uv1', 2),
        color,
        indices: Uint32Array.from(indices),
      })
    }
  }
  const center = [(box[0] + box[3]) / 2, box[1], (box[2] + box[5]) / 2]
  for (const part of parts) {
    for (let i = 0; i < part.position.length; i += 3) {
      for (let c = 0; c < 3; c++) part.position[i + c] -= center[c]
    }
  }
  const size = [box[3] - box[0], box[4] - box[1], box[5] - box[2]]
  return { parts, size }
}

const props = {}
function saveProp(spec, model, folder, { parts, size }, extra = {}) {
  const materials = {}
  // A parte pode vir de outro modelo (`source`: a porta encaixada no
  // prédio, `withDoor`).
  for (const { material, source = { model, folder } } of parts) {
    materials[material] ??= materialEntry(
      source.model,
      source.model.materials.find(({ name }) => name === material),
      source.folder,
    )
  }
  writeFileSync(join(out, 'props', `${spec.id}.glb`), writeGlb(spec.id, parts))
  props[spec.id] = {
    label: spec.label,
    category: spec.category,
    file: `props/${spec.id}.glb`,
    size: size.map((value) => Number(value.toFixed(3))),
    materials,
    ...extra,
  }
  const triangles = parts.reduce(
    (sum, part) => sum + part.indices.length / 3,
    0,
  )
  console.log(
    `${spec.id.padEnd(16)} ${size.map((v) => v.toFixed(2)).join(' × ')} m, ${triangles} triângulos`,
  )
}

// A caixa `[minX, minY, minZ, maxX, maxY, maxZ]` dos vértices das partes.
function boxOfParts(parts) {
  const box = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity]
  for (const { position } of parts) {
    for (let i = 0; i < position.length; i += 3) {
      for (let c = 0; c < 3; c++) {
        box[c] = Math.min(box[c], position[i + c])
        box[c + 3] = Math.max(box[c + 3], position[i + c])
      }
    }
  }
  return box
}

/**
 * A porta do prédio (docs/features/056-bioma-cidade.md): no Let's Go ela é
 * um modelo à parte da `buildmodel/` (`spec.door.model`), posto pelo mapa;
 * no prédio só fica o vão escuro (material `doorway`). Encaixa a porta na
 * boca do vão (o meio dele em X, o chão dele, a frente dele em Z) — ou,
 * sem vão (a porta é um buraco na parede), em `spec.door.x`, na frente da
 * parede ali. A porta entra como mais partes do prédio (`source`: os
 * materiais vêm do modelo dela).
 */
function withDoor(spec, built) {
  if (!spec.door) return built
  const door = parseGfbmdl(
    readFileSync(join(args.field, 'buildmodel', `${spec.door.model}.gfbmdl`)),
  )
  const doorParts = buildPrimitives(
    door,
    door.meshes.map((mesh, meshIndex) => ({
      meshIndex,
      decoded: decodeVertices(mesh),
    })),
    () => true,
  )
  const doorways = built.parts.filter(({ material }) =>
    /doorway/i.test(material),
  )
  let at
  if (doorways.length > 0) {
    const box = boxOfParts(doorways)
    at = [(box[0] + box[3]) / 2, box[1], box[5]]
  } else {
    // A frente da parede em volta do buraco (sem o telhado, que avança).
    const x = spec.door.x
    const near = built.parts.map(({ position }) => {
      const kept = []
      for (let i = 0; i < position.length; i += 3) {
        const isNear =
          Math.abs(position[i] - x) < DOOR_WALL_REACH &&
          position[i + 1] < doorParts.size[1]
        if (isNear) kept.push(position[i], position[i + 1], position[i + 2])
      }
      return { position: kept }
    })
    at = [x, 0, boxOfParts(near)[5]]
  }
  const [x, y, z] = [at[0], at[1], at[2] - doorParts.size[2] / 2]
  for (const part of doorParts.parts) {
    for (let i = 0; i < part.position.length; i += 3) {
      part.position[i] += x
      part.position[i + 1] += y
      part.position[i + 2] += z
    }
    part.source = { model: door, folder: 'buildmodel' }
  }
  return { parts: [...built.parts, ...doorParts.parts], size: built.size }
}

// Dos mapas: o objeto mais comum do nó.
const extraProps = args.extra
  ? JSON.parse(readFileSync(args.extra, 'utf8'))
  : []
const maps = new Map()
const mapOf = (path) => {
  if (!maps.has(path))
    maps.set(path, parseGfbmdl(readFileSync(join(args.field, path))))
  return maps.get(path)
}
// O `n`-ésimo objeto grande (prédio) de um nó fundido, pela posição.
function nthBuildingOf(objectBoxes, n) {
  const buildings = objectBoxes
    .map((box, index) => ({ box, index }))
    .filter(
      ({ box }) =>
        box[3] - box[0] >= BUILDING_MIN_WIDTH &&
        box[4] - box[1] >= BUILDING_MIN_HEIGHT,
    )
    .sort((a, b) => a.box[0] - b.box[0] || a.box[2] - b.box[2])
  if (!buildings[n]) throw new Error(`não há o prédio ${n} no nó`)
  return buildings[n].index
}

// O nó (ou, com `whole` ou `object`, o nó e os filhos dele).
const isNodeOf = (spec, path) =>
  path === spec.node ||
  ((spec.whole || spec.object != null) && path.startsWith(`${spec.node}/`))
for (const spec of [...MAP_PROPS, ...extraProps]) {
  const map = mapOf(spec.map)
  const meshes = map.groups
    .filter(({ boneIndex }) => isNodeOf(spec, bonePath(map, boneIndex)))
    .map(({ meshIndex }) => ({
      meshIndex,
      decoded: decodeVertices(map.meshes[meshIndex]),
    }))
  if (meshes.length === 0)
    throw new Error(`nó ${spec.node} não achado em ${spec.map}`)
  // Inteiro: o prédio é um objeto só (telhado, janela e placa juntos).
  if (spec.whole) {
    saveProp(
      spec,
      map,
      spec.folder,
      withDoor(
        spec,
        buildPrimitives(map, meshes, () => true),
      ),
    )
    continue
  }
  const boxes = []
  const pieceOffset = new Map()
  const vertexPieces = new Map()
  for (const { meshIndex, decoded } of meshes) {
    const { boxes: own, vertexPiece } = piecesOf(
      decoded.position.array,
      map.meshes[meshIndex].polygons.map(({ faces }) => faces),
    )
    pieceOffset.set(meshIndex, boxes.length)
    vertexPieces.set(meshIndex, vertexPiece)
    boxes.push(...own)
  }
  const { pieceObject, objectBoxes } = clusterObjects(
    boxes,
    spec.object == null ? 0 : BUILDING_MARGIN,
  )
  const counts = new Map()
  objectBoxes.forEach((box, i) => {
    const signature = sizeSignature(box)
    if (!counts.has(signature)) counts.set(signature, [])
    counts.get(signature).push(i)
  })
  const [, objects] = [...counts.entries()].sort(
    (a, b) => b[1].length - a[1].length,
  )[0]
  const chosen =
    spec.object == null ? objects[0] : nthBuildingOf(objectBoxes, spec.object)
  const objectOf = (meshIndex, vertex) =>
    pieceObject[
      pieceOffset.get(meshIndex) + vertexPieces.get(meshIndex)[vertex]
    ]
  saveProp(
    spec,
    map,
    spec.folder,
    withDoor(
      spec,
      buildPrimitives(
        map,
        meshes,
        (meshIndex, vertex) => objectOf(meshIndex, vertex) === chosen,
      ),
    ),
    { copiesInMap: objects.length },
  )
}

// Soltos: o modelo inteiro.
for (const spec of LOOSE_PROPS) {
  const model = parseGfbmdl(
    readFileSync(join(args.field, 'buildmodel', `${spec.file}.gfbmdl`)),
  )
  const meshes = model.meshes.map((mesh, meshIndex) => ({
    meshIndex,
    decoded: decodeVertices(mesh),
  }))
  saveProp(
    spec,
    model,
    'buildmodel',
    buildPrimitives(model, meshes, () => true),
  )
}

const ground = Object.entries(GROUND_TEXTURES)
  .flatMap(([folder, names]) => names.map((name) => packTexture(folder, name)))
  .filter(Boolean)
for (const name of TOON_TABLES) packTexture('forest', name)

writeFileSync(
  join(out, 'manifest.json'),
  JSON.stringify(
    {
      source:
        "Pokémon Let's Go Pikachu/Eevee — forest001_00, road001_00, road003_00, road022_00, road004_1_00, road009_00, town001_00, town003_00 e buildmodel",
      props,
      ground,
      toonTables: TOON_TABLES,
      textures,
    },
    null,
    2,
  ),
)
console.log(
  `${Object.keys(props).length} props, ${Object.keys(textures).length} texturas → ${out}`,
)
