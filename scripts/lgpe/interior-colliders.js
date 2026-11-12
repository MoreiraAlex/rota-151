#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { bonePath, decodeVertices, parseGfbmdl } from './gfbmdl.js'
import { clusterObjects, piecesOf } from './splitObjects.js'

/**
 * A colisão das salas por dentro dos prédios (docs/features/068-interior-
 * dos-predios.md). O mapa da sala do Let's Go não traz malha de colisão:
 * ela sai daqui, no mesmo espaço do `.glb` que o `pack-lgpe.js` grava
 * (metros, centro em XZ e base em Y = 0 — a mesma conta de
 * `buildPrimitives`, sobre o mapa inteiro):
 *
 * - **piso**: o retângulo andável (o do piso da sala, até a frente do vão
 *   da entrada) e a altura dele;
 * - **paredes**: caixas por fora dos lados, do fundo e da frente — a frente
 *   da sala é aberta (diorama, a câmera olha por ali), então ali é uma
 *   barreira invisível, com o vão da entrada avançando;
 * - **móveis**: o resto (o que não é piso, parede, tapete, vidro nem luz),
 *   separado em peças ligadas e juntado quando se encostam (dois sofás no
 *   mesmo material viram dois); cada objeto colide pela pegada dele numa
 *   grade vista de cima (`GRID_CELL`), em retângulos — o balcão em arco
 *   segue o arco;
 * - **objetos soltos** (`props`, a máquina de cura): onde o `.glb` de cada
 *   um fica na sala, e a caixa dele;
 * - **saída**: o meio do tapete de luz da entrada (`exitNode`), onde o
 *   treinador aparece ao entrar e de onde sai.
 *
 * Grava em `src/core/data/interiorColliders.json`.
 *
 * Uso:
 *   node scripts/lgpe/interior-colliders.js --field <pasta>/field
 */

const { values: args } = parseArgs({
  options: {
    field: { type: 'string' },
    out: { type: 'string', default: 'src/core/data/interiorColliders.json' },
  },
})
if (!args.field) throw new Error('faltou --field <pasta field/ extraída>')

const CENTIMETERS = 0.01
const SHADOW_ONLY = 'FieldShadowOnlyShader'
// Espessura (m) das paredes de colisão, por fora da sala.
const WALL_THICKNESS = 0.5
// Folga (cm) para juntar peças que se encostam num objeto só.
const TOUCH_MARGIN = 5
// Abaixo disto (m, do piso para cima) a peça não segura ninguém (tapete,
// tampo de vidro solto).
const MIN_SOLID_HEIGHT = 0.15
// Pegada mínima (m) num dos lados — fio solto, borda de quadro.
const MIN_SOLID_SIDE = 0.1
// Lado (cm) da célula da grade da pegada dos móveis: menor = colisão mais
// justa e mais caixas.
const GRID_CELL = 10
// Os objetos soltos (`file`) que vão nas salas, com as partes que ficam de
// fora (`skip`) — os mesmos do `pack-lgpe.js`.
const LOOSE_SPECS = JSON.parse(
  readFileSync(new URL('./interiors.json', import.meta.url), 'utf8'),
).filter((spec) => spec.file)

/**
 * As salas: o mapa (o mesmo de `interiors.json`), o que é estrutura (os
 * materiais que não são móvel), os nós do piso e do tapete de saída, e o
 * que a geometria não diz sozinha (metros, no espaço do mapa original):
 * `frontZ`, a borda da frente da sala; `doorway`, o vão da entrada que
 * avança (de `minX` a `maxX`, até `frontZ`); `inner` (opcional), a face de
 * dentro dos lados e do fundo quando o piso passa por baixo das paredes (a
 * loja; sem ele, a borda do piso); `props`, os objetos soltos da sala (os
 * do `interiors.json` com `file`) e onde vão (`against: 'back'`, encostado
 * no meio do fundo).
 */
const INTERIORS = [
  {
    id: 'pokecenter-interior',
    map: 't003pc01/t003pc01_00.gfbmdl',
    structure: /^(floor|wall|carpet|bm_combg|bubble|glass|bm_comlight)/,
    floorNodes: ['floor_01', 'floor_03'],
    exitNode: 'light_grp/bm_comlight02_01',
    frontZ: 9.45,
    doorway: { minX: 6, maxX: 10, frontZ: 10.06 },
    props: [{ id: 'pc-machine', against: 'back' }],
  },
  {
    id: 'poke-mart-interior',
    map: 't003fs01/t003fs01_00.gfbmdl',
    // A janela é `glass01_com_fs`; o vidro das vitrines (`…_fs1`) é móvel.
    structure:
      /^(floor|wall|carpet|bm_combg|bm_comlight|flame|glass01_com_fs$)/,
    floorNodes: ['floor'],
    exitNode: 'comlight01_01',
    inner: { minX: 1, maxX: 10.5, minZ: 1 },
    frontZ: 6.75,
    doorway: { minX: 4.5, maxX: 6.5, frontZ: 8 },
  },
]

const emptyBox = () => [
  Infinity,
  Infinity,
  Infinity,
  -Infinity,
  -Infinity,
  -Infinity,
]
const growBox = (box, x, y, z) => {
  box[0] = Math.min(box[0], x)
  box[1] = Math.min(box[1], y)
  box[2] = Math.min(box[2], z)
  box[3] = Math.max(box[3], x)
  box[4] = Math.max(box[4], y)
  box[5] = Math.max(box[5], z)
}
const round = (value) => Number(value.toFixed(3))

// As posições (cm) da malha em trincas, qualquer que seja o tamanho do
// atributo.
function positionsOf(decoded) {
  const { array, size } = decoded.position
  const count = array.length / size
  const out = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    for (let c = 0; c < 3; c++) out[i * 3 + c] = array[i * size + c]
  }
  return out
}

const cellKey = (x, z) => `${x},${z}`
const parseCell = (key) => key.split(',').map(Number)

// Pontos espalhados no triângulo (`corners`, cm), a cada `step` cm.
function* trianglePoints(corners, step) {
  const [a, b, c] = corners
  const longest = Math.max(
    Math.hypot(a[0] - b[0], a[2] - b[2]),
    Math.hypot(b[0] - c[0], b[2] - c[2]),
    Math.hypot(c[0] - a[0], c[2] - a[2]),
  )
  const steps = Math.max(1, Math.ceil(longest / step))
  for (let i = 0; i <= steps; i++) {
    for (let j = 0; j <= steps - i; j++) {
      const k = steps - i - j
      yield [0, 1, 2].map(
        (axis) => (a[axis] * i + b[axis] * j + c[axis] * k) / steps,
      )
    }
  }
}

// As células cheias mais as vazias que ficam presas dentro delas (sem
// caminho até a borda da caixa) — o miolo de um objeto oco.
function fillHoles(cells) {
  const points = [...cells].map(parseCell)
  const xs = points.map(([x]) => x)
  const zs = points.map(([, z]) => z)
  const [minX, maxX] = [Math.min(...xs) - 1, Math.max(...xs) + 1]
  const [minZ, maxZ] = [Math.min(...zs) - 1, Math.max(...zs) + 1]
  const outside = new Set([cellKey(minX, minZ)])
  const queue = [[minX, minZ]]
  while (queue.length) {
    const [x, z] = queue.pop()
    for (const [dx, dz] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = x + dx
      const nz = z + dz
      if (nx < minX || nx > maxX || nz < minZ || nz > maxZ) continue
      const key = cellKey(nx, nz)
      if (cells.has(key) || outside.has(key)) continue
      outside.add(key)
      queue.push([nx, nz])
    }
  }
  const filled = new Set(cells)
  for (let x = minX; x <= maxX; x++) {
    for (let z = minZ; z <= maxZ; z++) {
      const key = cellKey(x, z)
      if (!outside.has(key)) filled.add(key)
    }
  }
  return filled
}

// Retângulos `[x0, z0, x1, z1]` (em células, fim exclusivo) que cobrem as
// células: as corridas de cada linha, juntando a mesma corrida em linhas
// seguidas.
function rectanglesOf(cells) {
  const rows = new Map()
  for (const [x, z] of [...cells].map(parseCell)) {
    if (!rows.has(z)) rows.set(z, [])
    rows.get(z).push(x)
  }
  const rects = []
  let open = new Map()
  for (const z of [...rows.keys()].sort((a, b) => a - b)) {
    const xs = rows.get(z).sort((a, b) => a - b)
    const runs = []
    for (const x of xs) {
      const last = runs.at(-1)
      if (last && x === last[1]) last[1] = x + 1
      else runs.push([x, x + 1])
    }
    const next = new Map()
    for (const [x0, x1] of runs) {
      const key = cellKey(x0, x1)
      const rect = open.get(key)
      if (rect && rect[3] === z) {
        rect[3] = z + 1
        open.delete(key)
        next.set(key, rect)
      } else {
        const created = [x0, z, x1, z + 1]
        rects.push(created)
        next.set(key, created)
      }
    }
    open = next
  }
  return rects
}

// A caixa (m, no espaço do modelo original) das partes que ficam do objeto
// solto `id` (as mesmas que o `pack-lgpe.js` grava).
function looseBoxOf(id) {
  const spec = LOOSE_SPECS.find((entry) => entry.id === id)
  if (!spec) throw new Error(`objeto solto desconhecido: ${id}`)
  const model = parseGfbmdl(
    readFileSync(join(args.field, 'buildmodel', `${spec.file}.gfbmdl`)),
  )
  const skip = spec.skip ? new RegExp(spec.skip) : null
  const box = emptyBox()
  for (const { boneIndex, meshIndex } of model.groups) {
    if (skip?.test(bonePath(model, boneIndex))) continue
    const mesh = model.meshes[meshIndex]
    const position = positionsOf(decodeVertices(mesh))
    for (const polygon of mesh.polygons) {
      if (model.materials[polygon.materialIndex].shader === SHADOW_ONLY)
        continue
      for (const vertex of polygon.faces) {
        const [x, y, z] = position.subarray(vertex * 3, vertex * 3 + 3)
        growBox(box, x, y, z)
      }
    }
  }
  return box.map((value) => value * CENTIMETERS)
}

function buildInterior(spec) {
  const model = parseGfbmdl(readFileSync(join(args.field, spec.map)))
  const meshes = model.groups.map(({ boneIndex, meshIndex }) => ({
    path: bonePath(model, boneIndex),
    mesh: model.meshes[meshIndex],
    position: positionsOf(decodeVertices(model.meshes[meshIndex])),
  }))

  // O centro e a base que o `pack-lgpe.js` usa (todas as partes, menos as
  // só de sombra).
  const whole = emptyBox()
  const floor = emptyBox()
  const exit = emptyBox()
  for (const { path, mesh, position } of meshes) {
    const isFloor = spec.floorNodes.includes(path)
    const isExit = path === spec.exitNode
    for (const polygon of mesh.polygons) {
      const material = model.materials[polygon.materialIndex]
      if (material.shader === SHADOW_ONLY) continue
      for (const vertex of polygon.faces) {
        const [x, y, z] = position.subarray(vertex * 3, vertex * 3 + 3)
        growBox(whole, x, y, z)
        if (isFloor) growBox(floor, x, y, z)
        if (isExit) growBox(exit, x, y, z)
      }
    }
  }
  if (!Number.isFinite(floor[0])) throw new Error(`${spec.id}: sem piso`)
  if (!Number.isFinite(exit[0])) throw new Error(`${spec.id}: sem saída`)
  const centerX = ((whole[0] + whole[3]) / 2) * CENTIMETERS
  const baseY = whole[1] * CENTIMETERS
  const centerZ = ((whole[2] + whole[5]) / 2) * CENTIMETERS
  // Do mapa original (m) para o espaço do `.glb`.
  const toX = (meters) => round(meters - centerX)
  const toY = (meters) => round(meters - baseY)
  const toZ = (meters) => round(meters - centerZ)
  const toBox = ([minX, minY, minZ, maxX, maxY, maxZ]) => [
    toX(minX),
    toY(minY),
    toZ(minZ),
    toX(maxX),
    toY(maxY),
    toZ(maxZ),
  ]

  const room = {
    minX: spec.inner?.minX ?? floor[0] * CENTIMETERS,
    maxX: spec.inner?.maxX ?? floor[3] * CENTIMETERS,
    minZ: spec.inner?.minZ ?? floor[2] * CENTIMETERS,
    floorY: floor[4] * CENTIMETERS,
    topY: whole[4] * CENTIMETERS,
  }
  const { doorway, frontZ } = spec
  const t = WALL_THICKNESS
  const { minX, maxX, minZ, floorY, topY } = room
  const bottom = floorY - t
  const walls = [
    // Lados e fundo.
    [minX - t, bottom, minZ - t, minX, topY, doorway.frontZ + t],
    [maxX, bottom, minZ - t, maxX + t, topY, doorway.frontZ + t],
    [minX - t, bottom, minZ - t, maxX + t, topY, minZ],
    // A frente aberta, dos dois lados do vão.
    [minX, bottom, frontZ, doorway.minX, topY, frontZ + t],
    [doorway.maxX, bottom, frontZ, maxX, topY, frontZ + t],
    // O vão: os lados dele e a frente.
    [doorway.minX - t, bottom, frontZ, doorway.minX, topY, doorway.frontZ],
    [doorway.maxX, bottom, frontZ, doorway.maxX + t, topY, doorway.frontZ],
    [
      doorway.minX - t,
      bottom,
      doorway.frontZ,
      doorway.maxX + t,
      topY,
      doorway.frontZ + t,
    ],
  ].map(toBox)

  // Os móveis: peças ligadas só dos triângulos que não são estrutura,
  // juntadas em objetos quando se encostam.
  const pieceBoxes = []
  const furniture = []
  for (const { mesh, position } of meshes) {
    const faceLists = mesh.polygons
      .filter(({ materialIndex }) => {
        const material = model.materials[materialIndex]
        return (
          material.shader !== SHADOW_ONLY && !spec.structure.test(material.name)
        )
      })
      .map(({ faces }) => faces)
    if (faceLists.length === 0) continue
    const { boxes, vertexPiece } = piecesOf(position, faceLists)
    // Só os pedaços com triângulo (os vértices soltos da malha ficam fora).
    const globalPiece = new Map()
    for (const faces of faceLists) {
      for (const vertex of faces) {
        const piece = vertexPiece[vertex]
        if (globalPiece.has(piece)) continue
        globalPiece.set(piece, pieceBoxes.length)
        pieceBoxes.push(boxes[piece])
      }
    }
    furniture.push({ position, faceLists, vertexPiece, globalPiece })
  }
  const { pieceObject, objectBoxes } = clusterObjects(pieceBoxes, TOUCH_MARGIN)
  const kept = objectBoxes.map((box) => {
    const meters = box.map((value) => value * CENTIMETERS)
    return (
      meters[4] - floorY >= MIN_SOLID_HEIGHT &&
      meters[3] - meters[0] >= MIN_SOLID_SIDE &&
      meters[5] - meters[2] >= MIN_SOLID_SIDE
    )
  })

  // A pegada de cada objeto numa grade vista de cima: a colisão cobre só
  // onde o modelo está (o balcão em arco não vira uma caixa com os cantos
  // e o miolo).
  const footprints = new Map()
  for (const { position, faceLists, vertexPiece, globalPiece } of furniture) {
    for (const faces of faceLists) {
      for (let i = 0; i < faces.length; i += 3) {
        const object = pieceObject[globalPiece.get(vertexPiece[faces[i]])]
        if (!kept[object]) continue
        if (!footprints.has(object)) footprints.set(object, new Set())
        const cells = footprints.get(object)
        const corners = [faces[i], faces[i + 1], faces[i + 2]].map((vertex) =>
          position.subarray(vertex * 3, vertex * 3 + 3),
        )
        for (const [x, , z] of trianglePoints(corners, GRID_CELL / 2)) {
          cells.add(
            cellKey(Math.floor(x / GRID_CELL), Math.floor(z / GRID_CELL)),
          )
        }
      }
    }
  }
  // Um retângulo inteiro atrás de uma parede (a prateleira no nicho do
  // fundo da loja) não segura ninguém: a parede já fecha ali.
  const behindWall = ([x0, , x1, z1]) => x1 <= minX || x0 >= maxX || z1 <= minZ
  const solids = []
  for (const [object, cells] of footprints) {
    const top = objectBoxes[object][4] * CENTIMETERS
    for (const rect of rectanglesOf(fillHoles(cells))) {
      const meters = rect.map((cell) => cell * GRID_CELL * CENTIMETERS)
      if (behindWall(meters)) continue
      const [x0, z0, x1, z1] = meters
      solids.push(toBox([x0, floorY, z0, x1, top, z1]))
    }
  }

  // Os objetos soltos da sala (a máquina de cura): onde o `.glb` dele fica
  // (a origem dele, base no piso) e a caixa dele, que também colide.
  const props = []
  for (const { id, against } of spec.props ?? []) {
    const looseBox = looseBoxOf(id)
    if (against !== 'back') throw new Error(`${id}: lugar desconhecido`)
    // Encostado no fundo, no meio dele: a origem do modelo na parede.
    const atX = (minX + maxX) / 2
    const atZ = minZ
    const [bx0, by0, bz0, bx1, by1, bz1] = looseBox
    props.push({
      model: id,
      x: toX(atX + (bx0 + bx1) / 2),
      y: toY(floorY + by0),
      z: toZ(atZ + (bz0 + bz1) / 2),
    })
    solids.push(
      toBox([atX + bx0, floorY, atZ + bz0, atX + bx1, floorY + by1, atZ + bz1]),
    )
  }

  return {
    floor: {
      minX: toX(minX),
      maxX: toX(maxX),
      minZ: toZ(minZ),
      maxZ: toZ(doorway.frontZ),
      y: toY(floorY),
    },
    walls,
    solids,
    props,
    exit: {
      x: toX(((exit[0] + exit[3]) / 2) * CENTIMETERS),
      z: toZ(((exit[2] + exit[5]) / 2) * CENTIMETERS),
    },
  }
}

const result = {}
for (const spec of INTERIORS) {
  result[spec.id] = buildInterior(spec)
  const { walls, solids, floor, props } = result[spec.id]
  console.log(
    `${spec.id}: piso ${(floor.maxX - floor.minX).toFixed(1)} × ${(floor.maxZ - floor.minZ).toFixed(1)} m, ${walls.length} paredes, ${solids.length} caixas de móveis, ${props.length} objetos soltos`,
  )
}
writeFileSync(args.out, `${JSON.stringify(result, null, 2)}\n`)
console.log(`→ ${args.out}`)
