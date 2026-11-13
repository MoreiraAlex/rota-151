#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { bonePath, decodeVertices, parseGfbmdl } from './gfbmdl.js'
import { clusterObjects, piecesOf } from './splitObjects.js'

/**
 * As peças soltas de uma cidade montada à mão (docs/features/069-revisao-
 * do-bioma-cidade.md, `src/core/data/cityLayouts/`) — cercas, cercas-
 * vivas, moitas, árvores e os objetos de rua (postes, bancos, canteiro,
 * vasos e placas): lê o mapa original e
 * imprime os `props` do layout, cada peça do kit (`pack-lgpe.js`, com
 * `keepOrigin`) no lugar dela, prontos para colar e editar à mão. No jogo
 * cada peça assenta sozinha no chão (o nosso degrau não é o do original),
 * por isso o kit e não o nó inteiro.
 *
 * O que ler sai de um arquivo da cidade (`--config`, ex.:
 * `scripts/lgpe/city-props/viridian.json`):
 *
 * - **`fence`** (`{ node, kit }`): um módulo do kit (`<kit>-<comprimento>`)
 *   por trilho do mapa, de poste a poste, girado pelo eixo dele, e o poste
 *   (`<kit>-post`) em cada ponta que nenhum módulo cobre;
 * - **`groups`**, cada um num nó (e nos filhos dele), de um de dois jeitos:
 *   - **`core`** (`{ size, material?, tolerance?, merge? }`): uma peça
 *     por cópia (com `merge`, as achadas a menos disso, em m, são a mesma
 *     cópia: o meio delas e o menor tamanho),
 *     a "assinatura" (o tronco da árvore, o miolo da moita, a primeira
 *     folha do mato) — toda peça com o mesmo formato em qualquer tamanho é
 *     uma cópia, no tamanho dela, e com os lados trocados ela vem girada
 *     um quarto de volta. O kit (`model`) saiu de uma dessas cópias
 *     (`kitNode`/`kitCore`, se for de outro nó ou outra assinatura);
 *   - **`objects`** (`{ margin, models, scaleBy? }`): um objeto por grupo
 *     de peças (a `margin` em m), com o modelo do kit de formato mais
 *     perto (ou, com `scaleBy: 'height'`, de altura mais perto, no tamanho
 *     dele);
 *   e `kind`/`rest` vão para cada peça (sem `kind`, enfeite). Com
 *   `spots: true` (só `core`), o grupo não tem modelo: sai em `trees` do
 *   layout, o meio de cada assinatura e o tamanho dela (vezes `spotScale`)
 *   — as árvores, desenhadas com a árvore do bioma.
 *
 * O lugar de cada peça sai da `origin` dela no manifesto do kit (onde o
 * centro dela ficava no original), relativo à peça de onde ela saiu.
 * Coordenadas do layout: o original menos a `origin` do arquivo (o centro
 * do mapa inteiro, m do original) menos `(x0, z0)`, como no
 * `city-layout.js`.
 *
 * Uso:
 *   node scripts/lgpe/city-props.js --field <pasta>/field \
 *     --config scripts/lgpe/city-props/viridian.json
 */

const { values: args } = parseArgs({
  options: {
    field: { type: 'string' },
    config: { type: 'string' },
    kit: {
      type: 'string',
      default: 'public/assets/vegetation/lgpe/manifest.json',
    },
  },
})
for (const key of ['field', 'config']) {
  if (args[key] == null) throw new Error(`faltou --${key}`)
}
const config = JSON.parse(readFileSync(args.config, 'utf8'))

const CENTIMETERS = 0.01
const SHADOW_ONLY = 'FieldShadowOnlyShader'
const STREET_PROP = 'street-prop'
// Trilho: a face de cima (chata e com largura) da peça comprida da cerca
// (m); poste: as faces altas e estreitas, juntas por poste.
const RAIL_MIN = 0.8
const RAIL_TOP_WIDTH = 0.04
const FLAT = 0.01
const POST_MIN_HEIGHT = 0.6
const POST_MAX_SIDE = 0.25
// Folga (m) para casar posições.
const NEAR = 0.05
// A assinatura: quanto as proporções podem diferir (fração) e os tamanhos
// aceitos (vezes o dela).
const CORE_TOLERANCE = 0.03
const CORE_SCALES = [0.4, 2.5]
const QUARTER_TURN = -Math.PI / 2
const DECIMALS = 2

const mapOrigin = config.origin
const kit = JSON.parse(readFileSync(args.kit, 'utf8')).props
// Do original (m) para o layout.
const toLayout = (x, z) => [
  x - mapOrigin[0] - config.x0,
  z - mapOrigin[2] - config.z0,
]
const model = parseGfbmdl(readFileSync(join(args.field, config.map)))

/**
 * As peças (caixas ligadas, cm do original: `[minX, minY, minZ, maxX,
 * maxY, maxZ]`) dos nós que começam em `node` — só do material
 * `material`, se vier —, sem as sombras falsas.
 */
function piecesUnder(node, material = null) {
  const boxes = []
  for (const { boneIndex, meshIndex } of model.groups) {
    const path = bonePath(model, boneIndex)
    if (path !== node && !path.startsWith(`${node}/`)) continue
    const mesh = model.meshes[meshIndex]
    const position = decodeVertices(mesh).position.array
    for (const polygon of mesh.polygons) {
      const own = model.materials[polygon.materialIndex]
      if (own.shader === SHADOW_ONLY) continue
      if (material && own.name !== material) continue
      boxes.push(...piecesOf(position, [polygon.faces]).boxes)
    }
  }
  return boxes
}

// Caixa em cm do original → m do layout.
function layoutBox(box) {
  const [minX, minZ] = toLayout(box[0] * CENTIMETERS, box[2] * CENTIMETERS)
  const [maxX, maxZ] = toLayout(box[3] * CENTIMETERS, box[5] * CENTIMETERS)
  return {
    minX,
    minZ,
    maxX,
    maxZ,
    minY: box[1] * CENTIMETERS,
    maxY: box[4] * CENTIMETERS,
  }
}

const sizeOf = (box) => [
  box.maxX - box.minX,
  box.maxZ - box.minZ,
  box.maxY - box.minY,
]
const centerOf = (box) => [(box.minX + box.maxX) / 2, (box.minZ + box.maxZ) / 2]
const kitIds = (prefix, rest = /^/) =>
  Object.keys(kit).filter(
    (id) => id.startsWith(prefix) && rest.test(id.slice(prefix.length)),
  )
const kitOrigin = (id) => {
  if (!kit[id]?.origin) throw new Error(`${id}: fora do kit (ou sem origin)`)
  return toLayout(kit[id].origin[0], kit[id].origin[2])
}
// O deslocamento `(dx, dz)` girado `yaw` (um quarto de volta ou nada), como
// o jogo gira o modelo.
const turn = ([dx, dz], yaw) => (yaw ? [-dz, dx] : [dx, dz])
const round = (value) => Number(value.toFixed(DECIMALS))
const props = []
// Os pontos dos grupos sem modelo (`spots`, as árvores).
const spots = []
// O tipo primeiro (como no layout escrito à mão), depois o resto.
const put = (model, x, z, { kind, ...extra } = {}) =>
  props.push({
    ...(kind && { kind }),
    model,
    x: round(x),
    z: round(z),
    ...extra,
  })
const extrasOf = (group, { yaw = 0, scale = 1 } = {}) => ({
  ...(group.kind && { kind: group.kind }),
  ...(yaw && { yaw }),
  ...(Math.abs(scale - 1) > NEAR && { scale: round(scale) }),
  ...(group.rest && { rest: group.rest }),
})

// Cerca -------------------------------------------------------------------
if (config.fence) {
  const pieces = piecesUnder(config.fence.node).map(layoutBox)
  // Os trilhos de cima (um por módulo; a face de cima de cada um): o eixo,
  // a linha e de onde a onde.
  const top = Math.max(
    ...pieces
      .filter((p) => Math.max(p.maxX - p.minX, p.maxZ - p.minZ) > RAIL_MIN)
      .map((p) => p.maxY),
  )
  const rails = new Map()
  for (const p of pieces) {
    const alongX = p.maxX - p.minX
    const alongZ = p.maxZ - p.minZ
    if (Math.max(alongX, alongZ) <= RAIL_MIN) continue
    if (Math.abs(p.maxY - top) > NEAR || p.maxY - p.minY > FLAT) continue
    if (Math.min(alongX, alongZ) < RAIL_TOP_WIDTH) continue
    const axis = alongX > alongZ ? 'x' : 'z'
    const rail = {
      axis,
      line: axis === 'x' ? (p.minZ + p.maxZ) / 2 : (p.minX + p.maxX) / 2,
      from: axis === 'x' ? p.minX : p.minZ,
      to: axis === 'x' ? p.maxX : p.maxZ,
    }
    rails.set(
      [axis, rail.line, rail.from, rail.to]
        .map((v) => v.toFixed?.(1) ?? v)
        .join(),
      rail,
    )
  }
  const allRails = [...rails.values()]
  // Os postes: as faces altas e estreitas, juntas por poste (as que ficam
  // a menos de meio poste uma da outra; os postes ficam bem mais longe), e
  // o meio de cada um.
  const postFaces = pieces
    .filter(
      (p) =>
        p.maxY - p.minY >= POST_MIN_HEIGHT &&
        Math.max(p.maxX - p.minX, p.maxZ - p.minZ) <= POST_MAX_SIDE,
    )
    .map((p) => [p.minX, p.minY, p.minZ, p.maxX, p.maxY, p.maxZ])
  const posts = new Map(
    clusterObjects(postFaces, POST_MAX_SIDE / 2).objectBoxes.map(
      (box, index) => [
        index,
        { x: (box[0] + box[3]) / 2, z: (box[2] + box[5]) / 2 },
      ],
    ),
  )
  const alongOf = (rail, x, z) => (rail.axis === 'x' ? x : z)
  const acrossOf = (rail, x, z) => (rail.axis === 'x' ? z : x)
  // O módulo de cada comprimento: o trilho de onde ele saiu e quanto o
  // centro dele fica depois do começo do trilho.
  const modules = kitIds(`${config.fence.kit}-`, /^(?!post)/).map((id) => {
    const [x, z] = kitOrigin(id)
    const source = allRails.find(
      (rail) =>
        Math.abs(acrossOf(rail, x, z) - rail.line) < NEAR &&
        alongOf(rail, x, z) > rail.from &&
        alongOf(rail, x, z) < rail.to,
    )
    if (!source) throw new Error(`${id}: sem trilho de origem`)
    return {
      id,
      length: source.to - source.from,
      offset: alongOf(source, x, z) - source.from,
    }
  })
  const moduleOf = (rail) => {
    const length = rail.to - rail.from
    const found = modules.find((m) => Math.abs(m.length - length) < NEAR)
    if (!found) throw new Error(`trilho de ${length.toFixed(2)} m sem módulo`)
    return found
  }
  // O módulo cobre os postes do começo até antes do fim do trilho.
  const covers = (rail, post) =>
    Math.abs(acrossOf(rail, post.x, post.z) - rail.line) < NEAR &&
    alongOf(rail, post.x, post.z) > rail.from - POST_MAX_SIDE &&
    alongOf(rail, post.x, post.z) < rail.to - POST_MAX_SIDE
  for (const rail of allRails.sort(
    (a, b) =>
      a.axis.localeCompare(b.axis) || a.line - b.line || a.from - b.from,
  )) {
    const { id, offset } = moduleOf(rail)
    const center = rail.from + offset
    const [x, z] = rail.axis === 'x' ? [center, rail.line] : [rail.line, center]
    put(id, x, z, {
      kind: STREET_PROP,
      ...(rail.axis === 'z' && { yaw: -Math.PI / 2 }),
    })
  }
  // Os postes das pontas: os que nenhum módulo cobre, no eixo do trilho
  // que acaba neles.
  const postId = `${config.fence.kit}-post`
  const [postX, postZ] = kitOrigin(postId)
  const source = [...posts.values()].find(
    (post) => Math.hypot(post.x - postX, post.z - postZ) < POST_MAX_SIDE,
  )
  if (!source) throw new Error(`${postId}: sem poste de origem`)
  for (const post of posts.values()) {
    if (allRails.some((rail) => covers(rail, post))) continue
    const ending = allRails.find(
      (rail) =>
        Math.abs(acrossOf(rail, post.x, post.z) - rail.line) < NEAR &&
        Math.abs(alongOf(rail, post.x, post.z) - rail.to) < POST_MAX_SIDE,
    )
    const isZ = ending?.axis === 'z'
    // O deslocamento do kit (no eixo x) girado para o eixo do trilho.
    const dx = postX - source.x
    const dz = postZ - source.z
    put(postId, post.x + (isZ ? -dz : dx), post.z + (isZ ? dx : dz), {
      kind: STREET_PROP,
      ...(isZ && { yaw: -Math.PI / 2 }),
    })
  }
}

// Grupos por assinatura (`core`) ------------------------------------------

/**
 * As cópias da assinatura `size` (m: largura em x, em z, altura) entre as
 * peças: o meio, o tamanho (vezes o dela) e o giro (um quarto de volta
 * com os lados trocados). Peças repetidas no mesmo lugar contam uma vez.
 */
function coresOf(pieces, size, tolerance = CORE_TOLERANCE) {
  const found = []
  for (const piece of pieces.map(layoutBox)) {
    const dims = sizeOf(piece)
    for (const [yaw, [w, d, h]] of [
      [0, size],
      [QUARTER_TURN, [size[1], size[0], size[2]]],
    ]) {
      const ratios = [dims[0] / w, dims[1] / d, dims[2] / h]
      const scale = ratios.reduce((sum, r) => sum + r, 0) / 3
      const spread = Math.max(...ratios) / Math.min(...ratios) - 1
      if (spread > tolerance) continue
      if (scale < CORE_SCALES[0] || scale > CORE_SCALES[1]) continue
      const [x, z] = centerOf(piece)
      const isRepeated = found.some(
        (core) => Math.hypot(core.x - x, core.z - z) < NEAR,
      )
      if (!isRepeated) found.push({ x, z, yaw, scale })
      break
    }
  }
  return found.sort((a, b) => a.z - b.z || a.x - b.x)
}

/**
 * As cópias achadas a menos de `merge` m uma da outra numa só (a peça que
 * se repete dentro de cada cópia): o meio delas, o menor tamanho e o giro
 * da primeira.
 */
function mergeCores(cores, merge) {
  if (!merge) return cores
  const groups = []
  for (const core of cores) {
    const near = groups.find((members) =>
      members.some((m) => Math.hypot(m.x - core.x, m.z - core.z) < merge),
    )
    if (near) near.push(core)
    else groups.push([core])
  }
  return groups.map((members) => ({
    x: members.reduce((sum, m) => sum + m.x, 0) / members.length,
    z: members.reduce((sum, m) => sum + m.z, 0) / members.length,
    yaw: members[0].yaw,
    scale: Math.min(...members.map((m) => m.scale)),
  }))
}

function placeByCore(group) {
  const { size, material, tolerance, merge } = group.core
  const cores = mergeCores(
    coresOf(piecesUnder(group.node, material), size, tolerance),
    merge,
  )
  if (group.spots) {
    for (const core of cores) {
      const scale = core.scale * (group.spotScale ?? 1)
      spots.push({
        x: round(core.x),
        z: round(core.z),
        ...(Math.abs(scale - 1) > NEAR && { scale: round(scale) }),
      })
    }
    return
  }
  // A cópia de onde o kit saiu (a mais perto da origem dele) e quanto o
  // centro do kit fica dela; o tamanho de cada cópia é relativo ao dela.
  const kitCores = mergeCores(
    coresOf(
      piecesUnder(group.kitNode ?? group.node, material),
      group.kitCore ?? size,
      tolerance,
    ),
    merge,
  )
  const [originX, originZ] = kitOrigin(group.model)
  const source = kitCores.reduce((best, core) =>
    Math.hypot(core.x - originX, core.z - originZ) <
    Math.hypot(best.x - originX, best.z - originZ)
      ? core
      : best,
  )
  // O tamanho da assinatura deste grupo perto da do kit (outra assinatura:
  // a mesma árvore maior).
  const kitSize = group.kitCore ?? size
  const ratio =
    (size[0] + size[1] + size[2]) / (kitSize[0] + kitSize[1] + kitSize[2])
  for (const core of cores) {
    const scale = (core.scale * ratio) / source.scale
    const [dx, dz] = turn(
      [(originX - source.x) * scale, (originZ - source.z) * scale],
      core.yaw,
    )
    put(
      group.model,
      core.x + dx,
      core.z + dz,
      extrasOf(group, core.yaw ? { yaw: core.yaw, scale } : { scale }),
    )
  }
}

// Grupos por objeto (`objects`) -------------------------------------------

function placeByObject(group) {
  const { margin, models, scaleBy } = group.objects
  const shapes = models.map((id) => ({
    id,
    size: kit[id].size,
  }))
  const objects = clusterObjects(
    piecesUnder(group.node),
    margin / CENTIMETERS,
  ).objectBoxes.map(layoutBox)
  for (const box of objects.sort(
    (a, b) => a.minZ - b.minZ || a.minX - b.minX,
  )) {
    const [w, d, h] = sizeOf(box)
    let best = null
    for (const { id, size } of shapes) {
      for (const [yaw, [sx, sz]] of [
        [0, [size[0], size[2]]],
        [QUARTER_TURN, [size[2], size[0]]],
      ]) {
        const distance =
          scaleBy === 'height'
            ? Math.abs(size[1] - h)
            : Math.hypot(sx - w, sz - d)
        if (!best || distance < best.distance - 1e-9) {
          best = { id, yaw: scaleBy === 'height' ? 0 : yaw, distance, size }
        }
      }
    }
    const scale = scaleBy === 'height' ? h / best.size[1] : 1
    const [x, z] = centerOf(box)
    put(best.id, x, z, extrasOf(group, { yaw: best.yaw, scale }))
  }
}

for (const group of config.groups ?? []) {
  if (group.core) placeByCore(group)
  else if (group.objects) placeByObject(group)
  else throw new Error(`grupo ${group.node} sem \`core\` nem \`objects\``)
}

const format = (prop) =>
  `{ ${Object.entries(prop)
    .map(([key, value]) =>
      key === 'yaw' && value === QUARTER_TURN
        ? 'yaw: -Math.PI / 2'
        : `${key}: ${typeof value === 'string' ? `'${value}'` : value}`,
    )
    .join(', ')} },`
console.log(props.map(format).join('\n'))
if (spots.length > 0) {
  console.log('// trees')
  console.log(spots.map(format).join('\n'))
}
console.error(`${props.length} peças, ${spots.length} pontos`)
