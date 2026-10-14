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
 *   lgpe.md), onde cada tipo de
 *   árvore, planta ou pedra vem fundido numa malha só: separa os objetos
 *   (`splitObjects.js`) e fica com o mais comum de cada tipo;
 * - **props soltos** da `buildmodel/` (mato alto, flores, tufos, árvore de
 *   Corte, pedra de Força), inteiros;
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
 *   <7za> x LGPE-FieldMaps.7z 'field/forest/*' 'field/area02/*' 'field/area03/*' 'field/buildmodel/*' -o<pasta>
 *
 * Uso:
 *   node scripts/lgpe/pack-lgpe.js --field <pasta>/field
 */

const { values: args } = parseArgs({
  options: {
    field: { type: 'string' },
    out: { type: 'string', default: 'public/assets/vegetation/lgpe' },
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
    label: 'Árvore redonda (Rota 3)',
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
    id: 'grass-mound',
    label: 'Monte de grama (Rota 1)',
    category: 'plant',
    ...ROUTE_1,
    node: `${ROUTE_1_GRASS}/road001_00_grass05`,
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
  {
    id: 'strength-rock',
    label: 'Pedra de Força',
    category: 'rock',
    file: 'kairiki_rock',
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
  ],
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
  for (const { material } of parts) {
    materials[material] ??= materialEntry(
      model,
      model.materials.find(({ name }) => name === material),
      folder,
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

// Dos mapas: o objeto mais comum do nó.
const maps = new Map()
const mapOf = (path) => {
  if (!maps.has(path))
    maps.set(path, parseGfbmdl(readFileSync(join(args.field, path))))
  return maps.get(path)
}
for (const spec of MAP_PROPS) {
  const map = mapOf(spec.map)
  const meshes = map.groups
    .filter(({ boneIndex }) => bonePath(map, boneIndex) === spec.node)
    .map(({ meshIndex }) => ({
      meshIndex,
      decoded: decodeVertices(map.meshes[meshIndex]),
    }))
  if (meshes.length === 0)
    throw new Error(`nó ${spec.node} não achado em ${spec.map}`)
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
  const { pieceObject, objectBoxes } = clusterObjects(boxes)
  const counts = new Map()
  objectBoxes.forEach((box, i) => {
    const signature = sizeSignature(box)
    if (!counts.has(signature)) counts.set(signature, [])
    counts.get(signature).push(i)
  })
  const [, objects] = [...counts.entries()].sort(
    (a, b) => b[1].length - a[1].length,
  )[0]
  const chosen = objects[0]
  const objectOf = (meshIndex, vertex) =>
    pieceObject[
      pieceOffset.get(meshIndex) + vertexPieces.get(meshIndex)[vertex]
    ]
  saveProp(
    spec,
    map,
    spec.folder,
    buildPrimitives(
      map,
      meshes,
      (meshIndex, vertex) => objectOf(meshIndex, vertex) === chosen,
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
        "Pokémon Let's Go Pikachu/Eevee — forest001_00, road001_00, road003_00, road022_00 e buildmodel",
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
