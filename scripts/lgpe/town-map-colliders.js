#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { bonePath, decodeVertices, parseGfbmdl } from './gfbmdl.js'
import { clusterObjects, piecesOf } from './splitObjects.js'

/**
 * A colisão das cidades copiadas inteiras do Let's Go (docs/features/069-
 * revisao-do-bioma-cidade.md, Pallet), no espaço do `.glb` que o
 * `pack-lgpe.js` gerou (`scripts/lgpe/town-maps.json`; a `origin` do
 * manifesto é onde o centro do modelo ficava no original). O mapa não traz
 * colisão (como as salas, 068): ela sai da geometria.
 *
 * - **chão**: uma grade de alturas (`step` m) com o ponto mais alto do chão,
 *   dos barrancos e das pedras (os shaders de chão do jogo) — vira o
 *   heightfield do Rapier, como o relevo dos chunks;
 * - **grama**: em cada ponto da grade, se o chão ali é grama (a camada de
 *   baixo dos shaders de mistura) — o som do passo;
 * - **água**: em cada ponto, se o mar (`sea_00`, da mesma área) cobre — ou
 *   a água do próprio mapa (`waterSurface`) —, e a
 *   altura da superfície — a profundidade é a superfície menos o chão;
 * - **caixas**: prédios (um por grupo de peças), caixas de correio, cercas
 *   (com `fenceCells`, uma caixa por trecho reto), placas, objetos de rua
 *   (`props`), troncos das árvores e cercas-vivas, e as paredes da borda
 *   do mapa — com `exits`, sem parede nos vãos das saídas, e com
 *   `wallAbove`, baixas (só passam isso do chão mais alto do trecho);
 * - **chegada**: à frente da porta do prédio `arrivalDoor` (o primeiro, a
 *   casa do jogador, sem ele), virado para fora;
 * - **saídas** (`exits`): o meio de cada vão, na borda da grade — de onde
 *   sairiam as estradas da seed numa cidade fixa no mundo.
 *
 * As opções `waterSurface`, `fenceCells`, `props`, `exits`, `wallAbove`,
 * `arrivalDoor` e `gridFromGround` serviram a Viridian quando ela vinha do
 * mapa inteiro (hoje é montada à mão, `core/data/cityLayouts/`): ficam
 * para as próximas cidades copiadas.
 *
 * Com `gridFromGround`, a grade cobre só o chão (as copas passam da borda)
 * e a beira dela que nenhum triângulo pegou copia o chão vizinho.
 *
 * Uso:
 *   node scripts/lgpe/town-map-colliders.js --field <pasta>/field
 *
 * (a mesma pasta `field/` do `pack-lgpe.js`; grava
 * `src/core/data/townMapColliders.json`).
 */

const { values: args } = parseArgs({
  options: {
    field: { type: 'string' },
    manifest: {
      type: 'string',
      default: 'public/assets/town-maps/lgpe/manifest.json',
    },
    out: { type: 'string', default: 'src/core/data/townMapColliders.json' },
  },
})
if (!args.field) throw new Error('faltou --field <pasta field/ extraída>')

const CENTIMETERS = 0.01

// As cidades: o modelo (id no manifesto), os mapas do original e o que é o
// quê pelo caminho do nó.
const TOWN_MAPS = [
  {
    id: 'pallet-town',
    map: 'area02/town001_00.gfbmdl',
    sea: 'area02/sea_00.gfbmdl',
    // Malhas do mar: a superfície e o fundo (o chão debaixo d'água).
    seaSurface: /^sea_01$/,
    seaFloor: /^(grand01_10_DUP|sea_bottom|road021_00_umi_bottom_plane)$/,
    buildings: /^masaratown_house_(house1|house2|labo)/,
    mailboxes: /masaratown_house_home3_post/,
    fences: /^fence\d+$/,
    signs: /^signboard/,
    hedges: /^town001_00_tree\/town001_00_tree0[78]$/,
    doorways: /^inndoor$/,
    // O material do tronco das árvores redondas.
    trunk: /tree_miki/,
  },
]

// Lado (m) de cada célula da grade do chão (no tamanho do original).
const STEP = 0.5
// Shaders que são chão (o resto — grama, árvore, objeto — não pisa).
const GROUND_SHADERS =
  /^(FieldGroundShader01|FieldCliffShader01|FieldRockShader)$/
// Até que altura (m, acima da base do tronco) o tronco conta (a copa não).
const TRUNK_HEIGHT = 2
// Folga (m) em que dois pedaços ainda são o mesmo objeto (o telhado solto
// da parede; os pedaços de uma cerca-viva).
const OBJECT_MARGIN = 0.3
// Altura (m) e espessura (m) das paredes da borda do mapa.
const WALL_HEIGHT = 30
const WALL_THICKNESS = 2
// Quanto (m) à frente da porta o treinador chega.
const ARRIVAL_DISTANCE = 1.5
// Peso (canal vermelho) acima do qual a camada de cima (terra, pedra)
// vence a grama.
const TOP_LAYER = 0.5

const round = (value, digits = 3) => Number(value.toFixed(digits))

// Cada triângulo do modelo (em metros do original): o caminho do nó, o
// material, os três vértices `[x, y, z]` e o canal vermelho de cada um.
function eachTriangle(model, fn) {
  for (const { boneIndex, meshIndex } of model.groups) {
    const mesh = model.meshes[meshIndex]
    const decoded = decodeVertices(mesh)
    const position = decoded.position.array
    const color = decoded.color0
    const path = bonePath(model, boneIndex)
    for (const polygon of mesh.polygons) {
      const material = model.materials[polygon.materialIndex]
      const faces = polygon.faces
      for (let f = 0; f < faces.length; f += 3) {
        const vertices = []
        const red = []
        for (let k = 0; k < 3; k++) {
          const v = faces[f + k]
          vertices.push([
            position[v * 3] * CENTIMETERS,
            position[v * 3 + 1] * CENTIMETERS,
            position[v * 3 + 2] * CENTIMETERS,
          ])
          red.push(color ? color.array[v * color.size] / 255 : 0)
        }
        fn(path, material, vertices, red)
      }
    }
  }
}

// Os pontos `(ix, iz)` da grade dentro do triângulo (no plano XZ), com o
// peso de cada vértice (baricêntricas).
function rasterize(grid, vertices, fn) {
  const [a, b, c] = vertices
  const xs = vertices.map((v) => v[0])
  const zs = vertices.map((v) => v[2])
  const ix0 = Math.max(0, Math.ceil((Math.min(...xs) - grid.minX) / grid.step))
  const ix1 = Math.min(
    grid.nx - 1,
    Math.floor((Math.max(...xs) - grid.minX) / grid.step),
  )
  const iz0 = Math.max(0, Math.ceil((Math.min(...zs) - grid.minZ) / grid.step))
  const iz1 = Math.min(
    grid.nz - 1,
    Math.floor((Math.max(...zs) - grid.minZ) / grid.step),
  )
  const area = (b[0] - a[0]) * (c[2] - a[2]) - (c[0] - a[0]) * (b[2] - a[2])
  if (Math.abs(area) < 1e-9) return
  for (let ix = ix0; ix <= ix1; ix++) {
    for (let iz = iz0; iz <= iz1; iz++) {
      const x = grid.minX + ix * grid.step
      const z = grid.minZ + iz * grid.step
      const wa = ((b[0] - x) * (c[2] - z) - (c[0] - x) * (b[2] - z)) / area
      const wb = ((c[0] - x) * (a[2] - z) - (a[0] - x) * (c[2] - z)) / area
      const wc = 1 - wa - wb
      if (wa < -1e-6 || wb < -1e-6 || wc < -1e-6) continue
      fn(ix, iz, [wa, wb, wc])
    }
  }
}

const emptyBox = () => [
  Infinity,
  Infinity,
  Infinity,
  -Infinity,
  -Infinity,
  -Infinity,
]
function grow(box, [x, y, z]) {
  box[0] = Math.min(box[0], x)
  box[1] = Math.min(box[1], y)
  box[2] = Math.min(box[2], z)
  box[3] = Math.max(box[3], x)
  box[4] = Math.max(box[4], y)
  box[5] = Math.max(box[5], z)
}

// As caixas dos objetos de um grupo de triângulos (pedaços ligados que se
// encostam no plano viram um objeto).
function objectBoxesOf(triangles, margin) {
  const position = new Float32Array(triangles.length * 9)
  const faces = new Uint32Array(triangles.length * 3)
  triangles.forEach((triangle, t) => {
    triangle.forEach((vertex, k) => {
      position.set(vertex, (t * 3 + k) * 3)
      faces[t * 3 + k] = t * 3 + k
    })
  })
  // Vértices iguais (o mesmo ponto em triângulos vizinhos) ligam os
  // pedaços: junta pelo ponto arredondado.
  const key = (i) =>
    `${position[i * 3].toFixed(3)},${position[i * 3 + 1].toFixed(3)},${position[i * 3 + 2].toFixed(3)}`
  const first = new Map()
  const merged = Uint32Array.from(faces, (vertex) => {
    const k = key(vertex)
    if (!first.has(k)) first.set(k, vertex)
    return first.get(k)
  })
  const { boxes } = piecesOf(position, [merged])
  const used = boxes.filter((box) => Number.isFinite(box[0]))
  return clusterObjects(used, margin).objectBoxes
}

// As caixas de um grupo de triângulos finos (a cerca em L): as células da
// grade (`step`) que cada triângulo toca, juntadas em faixas ao longo de X
// e as faixas iguais em linhas seguidas — uma caixa por trecho reto.
function cellBoxesOf(triangles, step) {
  const box = emptyBox()
  for (const triangle of triangles) for (const v of triangle) grow(box, v)
  const cells = new Set()
  const cellOf = (value, min) => Math.floor((value - min) / step)
  for (const triangle of triangles) {
    const xs = triangle.map((v) => v[0])
    const zs = triangle.map((v) => v[2])
    for (
      let ix = cellOf(Math.min(...xs), box[0]);
      ix <= cellOf(Math.max(...xs) - 1e-6, box[0]);
      ix++
    ) {
      for (
        let iz = cellOf(Math.min(...zs), box[2]);
        iz <= cellOf(Math.max(...zs) - 1e-6, box[2]);
        iz++
      ) {
        cells.add(`${ix},${iz}`)
      }
    }
  }
  const rows = new Map()
  for (const key of cells) {
    const [ix, iz] = key.split(',').map(Number)
    if (!rows.has(iz)) rows.set(iz, [])
    rows.get(iz).push(ix)
  }
  // As faixas de cada linha: `[ix0, ix1, iz0, iz1]`.
  const runs = []
  for (const iz of [...rows.keys()].sort((a, b) => a - b)) {
    const xs = rows.get(iz).sort((a, b) => a - b)
    let start = xs[0]
    for (let i = 1; i <= xs.length; i++) {
      if (i < xs.length && xs[i] === xs[i - 1] + 1) continue
      const end = xs[i - 1]
      const above = runs.find(
        (run) => run[0] === start && run[1] === end && run[3] === iz - 1,
      )
      if (above) above[3] = iz
      else runs.push([start, end, iz, iz])
      start = xs[i]
    }
  }
  return runs.map(([ix0, ix1, iz0, iz1]) => [
    Math.max(box[0], box[0] + ix0 * step),
    box[1],
    Math.max(box[2], box[2] + iz0 * step),
    Math.min(box[3], box[0] + (ix1 + 1) * step),
    box[4],
    Math.min(box[5], box[2] + (iz1 + 1) * step),
  ])
}

// Os pontos sem chão copiam o de um vizinho com chão (e a grama dele), uma
// volta por vez, até não sobrar nenhum.
function fillFromNeighbors(heights, grass, grid, indexOf) {
  const steps = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]
  let missing = true
  while (missing) {
    missing = false
    const before = Float32Array.from(heights)
    for (let ix = 0; ix < grid.nx; ix++) {
      for (let iz = 0; iz < grid.nz; iz++) {
        const i = indexOf(ix, iz)
        if (Number.isFinite(before[i])) continue
        const near = steps
          .map(([dx, dz]) => [ix + dx, iz + dz])
          .filter(([x, z]) => x >= 0 && z >= 0 && x < grid.nx && z < grid.nz)
          .map(([x, z]) => indexOf(x, z))
          .find((j) => Number.isFinite(before[j]))
        if (near == null) {
          missing = true
          continue
        }
        heights[i] = before[near]
        grass[i] = grass[near]
      }
    }
  }
}

function buildTownMap(spec, origin) {
  const model = parseGfbmdl(readFileSync(join(args.field, spec.map)))
  const sea = spec.sea
    ? parseGfbmdl(readFileSync(join(args.field, spec.sea)))
    : null
  // Do original para o espaço do modelo.
  const toModel = ([x, y, z]) => [x - origin[0], y - origin[1], z - origin[2]]

  const mapBox = emptyBox()
  const groundBox = emptyBox()
  const ground = []
  const ownWater = []
  const groups = {
    buildings: [],
    mailboxes: [],
    fences: new Map(),
    signs: [],
    hedges: [],
    props: [],
    doorways: [],
    trunks: [],
  }
  eachTriangle(model, (path, material, vertices, red) => {
    const local = vertices.map(toModel)
    if (material.shader !== 'FieldShadowOnlyShader') {
      for (const vertex of local) grow(mapBox, vertex)
    }
    if (spec.waterSurface?.test(path)) {
      ownWater.push(local)
      return
    }
    if (GROUND_SHADERS.test(material.shader) && !spec.buildings.test(path)) {
      ground.push({ vertices: local, red, material })
      for (const vertex of local) grow(groundBox, vertex)
      return
    }
    if (spec.doorways.test(path)) groups.doorways.push(local)
    else if (spec.mailboxes.test(path)) groups.mailboxes.push(local)
    else if (spec.buildings.test(path)) groups.buildings.push(local)
    else if (spec.fences.test(path)) {
      if (!groups.fences.has(path)) groups.fences.set(path, [])
      groups.fences.get(path).push(local)
    } else if (spec.signs.test(path)) groups.signs.push(local)
    else if (
      spec.hedges.test(path) &&
      material.shader !== 'FieldShadowOnlyShader'
    )
      groups.hedges.push(local)
    else if (spec.props?.test(path)) groups.props.push(local)
    else if (spec.trunk.test(material.name)) groups.trunks.push(local)
  })

  // A grade do chão cobre a caixa do mapa (com `gridFromGround`, só a do
  // chão).
  const gridBox = spec.gridFromGround ? groundBox : mapBox
  const grid = {
    minX: gridBox[0],
    minZ: gridBox[2],
    step: STEP,
    nx: Math.ceil((gridBox[3] - gridBox[0]) / STEP) + 1,
    nz: Math.ceil((gridBox[5] - gridBox[2]) / STEP) + 1,
  }
  const count = grid.nx * grid.nz
  const heights = new Float32Array(count).fill(-Infinity)
  const grass = new Uint8Array(count)
  const indexOf = (ix, iz) => iz + ix * grid.nz
  for (const { vertices, red, material } of ground) {
    rasterize(grid, vertices, (ix, iz, weights) => {
      const y = weights.reduce((sum, w, k) => sum + w * vertices[k][1], 0)
      const i = indexOf(ix, iz)
      if (y <= heights[i]) return
      heights[i] = y
      const weight = weights.reduce((sum, w, k) => sum + w * red[k], 0)
      // Grama: a camada de baixo vence, ou as duas são grama.
      const topIsGrass = /grass/i.test(material.name.split('_com_')[1] ?? '')
      grass[i] = weight < TOP_LAYER || topIsGrass ? 1 : 0
    })
  }
  // O mar: o fundo entra no chão (onde o mapa não tem chão mais alto) e a
  // superfície marca onde há água.
  const water = new Uint8Array(count)
  let surface = null
  if (sea) {
    eachTriangle(sea, (path, material, vertices) => {
      const local = vertices.map(toModel)
      if (spec.seaFloor.test(path)) {
        rasterize(grid, local, (ix, iz, weights) => {
          const y = weights.reduce((sum, w, k) => sum + w * local[k][1], 0)
          const i = indexOf(ix, iz)
          heights[i] = Math.max(heights[i], y)
        })
      } else if (spec.seaSurface.test(path)) {
        rasterize(grid, local, (ix, iz, weights) => {
          const y = weights.reduce((sum, w, k) => sum + w * local[k][1], 0)
          surface = surface == null ? y : Math.max(surface, y)
          water[indexOf(ix, iz)] = 1
        })
      }
    })
  }

  // A água do próprio mapa: a superfície marca onde há água (o fundo já é
  // chão).
  for (const local of ownWater) {
    rasterize(grid, local, (ix, iz, weights) => {
      const y = weights.reduce((sum, w, k) => sum + w * local[k][1], 0)
      surface = surface == null ? y : Math.max(surface, y)
      water[indexOf(ix, iz)] = 1
    })
  }

  // Fora de todo chão (os cantos da caixa, atrás do morro): o mais alto
  // do mapa — um paredão que ninguém sobe (e que fica fora da vista, atrás
  // das árvores).
  // Com `gridFromGround` (a grade só sobre o chão), o que falta é a beira
  // da grade (pontos que nenhum triângulo pegou): o chão vizinho.
  if (spec.gridFromGround) fillFromNeighbors(heights, grass, grid, indexOf)
  let highest = -Infinity
  for (const h of heights)
    if (Number.isFinite(h)) highest = Math.max(highest, h)
  for (let i = 0; i < count; i++) {
    if (!Number.isFinite(heights[i])) heights[i] = highest
  }

  const boxes = []
  const addBox = (box, kind) =>
    boxes.push({ kind, box: box.map((value) => round(value)) })
  const boxOf = (triangles) => {
    const box = emptyBox()
    for (const triangle of triangles) for (const v of triangle) grow(box, v)
    return box
  }
  for (const box of objectBoxesOf(groups.buildings, OBJECT_MARGIN))
    addBox(box, 'building')
  for (const box of objectBoxesOf(groups.mailboxes, 0)) addBox(box, 'prop')
  for (const triangles of groups.fences.values()) {
    if (spec.fenceCells) {
      for (const box of cellBoxesOf(triangles, STEP)) addBox(box, 'fence')
    } else addBox(boxOf(triangles), 'fence')
  }
  for (const box of objectBoxesOf(groups.signs, OBJECT_MARGIN))
    addBox(box, 'prop')
  for (const box of objectBoxesOf(groups.hedges, OBJECT_MARGIN))
    addBox(box, 'hedge')
  for (const box of objectBoxesOf(groups.props, OBJECT_MARGIN))
    addBox(box, 'prop')
  // Os troncos: só o pé de cada um (a copa fica de fora).
  for (const box of objectBoxesOf(groups.trunks, 0)) {
    addBox(
      [box[0], box[1], box[2], box[3], box[1] + TRUNK_HEIGHT, box[5]],
      'trunk',
    )
  }
  // As paredes da borda (por fora da grade do chão), do ponto mais baixo
  // do chão (o fundo do mar) para cima. Com `exits`, cada lado tem os vãos
  // das saídas; com `wallAbove`, a parede só passa isso do chão mais alto
  // do lado.
  // Com `gridFromGround`, a borda é a da grade (a área do chão no jogo).
  const [minX, , minZ, maxX, , maxZ] = spec.gridFromGround
    ? [
        grid.minX,
        0,
        grid.minZ,
        grid.minX + (grid.nx - 1) * grid.step,
        0,
        grid.minZ + (grid.nz - 1) * grid.step,
      ]
    : mapBox
  const low = heights.reduce((min, h) => Math.min(min, h), Infinity)
  const t = WALL_THICKNESS
  const exits = (spec.exits ?? []).map(({ side, from, to, road }) => {
    // Do original para o modelo, no eixo do lado.
    const axis = side === 'north' || side === 'south' ? 0 : 2
    return {
      side,
      road,
      from: Math.min(from, to) - origin[axis],
      to: Math.max(from, to) - origin[axis],
    }
  })
  // O chão mais alto ao longo de um trecho `[a, b]` de um lado (na linha
  // da grade dele).
  const sideHigh = (side, a, b) => {
    let high = -Infinity
    const along = side === 'north' || side === 'south'
    const count = along ? grid.nx : grid.nz
    const start = along ? grid.minX : grid.minZ
    const fixed =
      side === 'north' || side === 'west'
        ? 0
        : along
          ? grid.nz - 1
          : grid.nx - 1
    for (let i = 0; i < count; i++) {
      const at = start + i * grid.step
      if (at < a - grid.step || at > b + grid.step) continue
      const index = along ? indexOf(i, fixed) : indexOf(fixed, i)
      high = Math.max(high, heights[index])
    }
    return high
  }
  // Os trechos `[de, até]` de um lado sem os vãos das saídas dele.
  const segmentsOf = (side, start, end) => {
    const gaps = exits
      .filter((exit) => exit.side === side)
      .sort((a, b) => a.from - b.from)
    const segments = []
    let at = start
    for (const gap of gaps) {
      if (gap.from > at) segments.push([at, gap.from])
      at = Math.max(at, gap.to)
    }
    if (at < end) segments.push([at, end])
    return segments
  }
  const wallTop = (side, a, b) =>
    spec.wallAbove == null
      ? low + WALL_HEIGHT
      : sideHigh(side, a, b) + spec.wallAbove
  for (const [a, b] of segmentsOf('north', minX - t, maxX + t))
    addBox([a, low, minZ - t, b, wallTop('north', a, b), minZ], 'wall')
  for (const [a, b] of segmentsOf('south', minX - t, maxX + t))
    addBox([a, low, maxZ, b, wallTop('south', a, b), maxZ + t], 'wall')
  for (const [a, b] of segmentsOf('west', minZ, maxZ))
    addBox([minX - t, low, a, minX, wallTop('west', a, b), b], 'wall')
  for (const [a, b] of segmentsOf('east', minZ, maxZ))
    addBox([maxX, low, a, maxX + t, wallTop('east', a, b), b], 'wall')

  // A chegada: à frente do primeiro vão de porta (de oeste para leste),
  // virado para onde a porta olha (+Z).
  const doorways = objectBoxesOf(groups.doorways, 0.1).sort(
    (a, b) => a[0] - b[0] || a[2] - b[2],
  )
  const door = doorways[spec.arrivalDoor ?? 0]
  const arrival = {
    x: round((door[0] + door[3]) / 2),
    y: round(door[1]),
    z: round(door[5] + ARRIVAL_DISTANCE),
    yaw: 0,
  }

  const toText = (flags) =>
    Array.from(flags, (flag) => (flag ? '1' : '0')).join('')
  console.log(
    `${spec.id}: chão ${grid.nx} × ${grid.nz} pontos, ${boxes.length} caixas, ${water.reduce((s, v) => s + v, 0)} pontos com água`,
  )
  return {
    box: mapBox.map((value) => round(value)),
    ground: {
      minX: round(grid.minX),
      minZ: round(grid.minZ),
      step: STEP,
      nx: grid.nx,
      nz: grid.nz,
      // Por coluna (`iz + ix × nz`), como o heightfield dos chunks.
      heights: Array.from(heights, (value) => round(value, 2)),
      grass: toText(grass),
    },
    water:
      surface == null
        ? null
        : { surface: round(surface), cells: toText(water) },
    boxes,
    arrival,
    // Só nas com `exits`: o meio de cada saída, na borda da grade (de onde
    // as estradas da seed saem).
    ...(exits.length > 0 && {
      exits: exits.map(({ side, road, from, to }) => {
        const middle = (from + to) / 2
        const point =
          side === 'north'
            ? { x: middle, z: minZ }
            : side === 'south'
              ? { x: middle, z: maxZ }
              : side === 'west'
                ? { x: minX, z: middle }
                : { x: maxX, z: middle }
        return {
          side,
          road,
          x: round(point.x),
          z: round(point.z),
          width: round(to - from),
        }
      }),
    }),
  }
}

const manifest = JSON.parse(readFileSync(args.manifest, 'utf8'))
const out = {}
for (const spec of TOWN_MAPS) {
  const origin = manifest.props[spec.id]?.origin
  if (!origin) throw new Error(`${spec.id} sem origin no manifesto`)
  out[spec.id] = buildTownMap(spec, origin)
}
writeFileSync(args.out, `${JSON.stringify(out)}\n`)
console.log(`→ ${args.out}`)
