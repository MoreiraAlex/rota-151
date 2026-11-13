#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { decodeDds } from './dds.js'
import { bonePath, decodeVertices, parseGfbmdl } from './gfbmdl.js'

/**
 * O ponto de partida do layout de uma cidade montada à mão
 * (docs/features/069-revisao-do-bioma-cidade.md, `src/core/data/
 * cityLayouts/`): lê o chão do mapa original e imprime as duas grades, uma
 * célula por metro do original, prontas para colar no layout e editar à
 * mão.
 *
 * - **níveis** (`rows`): a altura média da célula em degraus de meio metro
 *   a partir do chão da cidade (`-` um abaixo, `.` o chão, `:` um acima,
 *   `+` dois ou mais, `~` o fundo do lago). O paredão (`#`) é à mão.
 * - **chão** (`ground`): o que cobre a célula por cima — `a` asfalto, `t`
 *   terra (a camada de cima dos shaders de mistura), `g` grama (a de
 *   baixo), `p` as pedras de pisar, `m` as manchas de terra (os remendos
 *   com máscara em volta delas). A célula sem chão (debaixo dos prédios)
 *   copia a vizinha.
 *
 * Nos shaders de mistura, a camada de cima aparece pelo canal vermelho da
 * cor por vértice VEZES o que a máscara (`BlendTex`, lida no terceiro UV,
 * de cabeça para baixo) deixa: o alfa dela é a de baixo. Os lotes têm o
 * vermelho cheio e a máscara faz a grama no miolo e a borda de terra (a
 * guia) só na beira — a borda, mais fina que a célula, é desenhada por
 * pixel no jogo (`curb` no layout).
 *
 * A grade vai de `(x0, z0)` (m, a partir de `origin`: o original menos
 * ela — o centro do mapa inteiro, o mesmo do layout e do
 * `city-props/<cidade>.json`) com `cols` × `rows` células.
 *
 * Uso:
 *   node scripts/lgpe/city-layout.js --field <pasta>/field \
 *     --map area02/town002_00.gfbmdl --origin=26.95,2,-61.7501 \
 *     --x0=-30 --z0=-20 --cols 60 --rows 42
 */

const { values: args } = parseArgs({
  options: {
    field: { type: 'string' },
    map: { type: 'string' },
    origin: { type: 'string' },
    x0: { type: 'string' },
    z0: { type: 'string' },
    cols: { type: 'string' },
    rows: { type: 'string' },
  },
})
for (const key of ['field', 'map', 'origin', 'x0', 'z0', 'cols', 'rows']) {
  if (args[key] == null) throw new Error(`faltou --${key}`)
}

const CENTIMETERS = 0.01
// O chão que se pisa (o resto — barranco, grama, objeto — fica de fora).
const GROUND_SHADER = 'FieldGroundShader01'
// As pedras de pisar e as manchas de terra: quadrados rentes ao chão, por
// cima dele.
const STEPPING_STONE = /ground_plane/
const SOIL_PATCH = /^rockmask/
// Peso (canal vermelho) acima do qual a camada de cima vence.
const TOP_LAYER = 0.5
// Folga (m) de quem fica por cima de quem no mesmo ponto.
const ABOVE = 0.05
// Os pontos de cada célula que votam (frações do lado dela).
const SAMPLES = [0.25, 0.75]
// Degrau (m) do original e onde fica o fundo do lago (degraus abaixo).
const STEP = 0.5
const LAKE_BELOW = 1.3
// Quem vence o empate.
const PRIORITY = ['a', 'p', 'm', 't', 'g']

const origin = args.origin.split(',').map(Number)
const x0 = Number(args.x0)
const z0 = Number(args.z0)
const cols = Number(args.cols)
const rows = Number(args.rows)

const model = parseGfbmdl(readFileSync(join(args.field, args.map)))

// As máscaras de mistura (`BlendTex`), decodificadas uma vez cada.
const folder = args.map.split('/')[0]
const masks = new Map()
function maskOf(name) {
  if (!masks.has(name)) {
    masks.set(
      name,
      decodeDds(readFileSync(join(args.field, folder, `${name}.dds`))),
    )
  }
  return masks.get(name)
}

// O alfa (0 a 1) da máscara em `(u, v)` (o UV do jogo: de cabeça para
// baixo na imagem), repetindo.
function maskAlphaAt(mask, u, v) {
  const wrap = (value) => value - Math.floor(value)
  const x = Math.min(Math.floor(wrap(u) * mask.width), mask.width - 1)
  const y = Math.min(Math.floor(wrap(1 - v) * mask.height), mask.height - 1)
  return mask.data[(y * mask.width + x) * 4 + 3] / 255
}

// Os triângulos do chão (no espaço do modelo): os três vértices, o canal
// vermelho de cada um, o terceiro UV (onde a máscara é lida) e o que a
// camada de baixo e a de cima são.
const triangles = []
for (const { boneIndex, meshIndex } of model.groups) {
  const mesh = model.meshes[meshIndex]
  const decoded = decodeVertices(mesh)
  const position = decoded.position.array
  const color = decoded.color0
  const uv2 = decoded.uv2
  const path = bonePath(model, boneIndex)
  for (const polygon of mesh.polygons) {
    const material = model.materials[polygon.materialIndex]
    const kind = surfaceKindOf(material, path)
    if (!kind) continue
    const blend = material.textures.find(
      ({ sampler }) => sampler === 'BlendTex',
    )
    const mask = blend && uv2 ? maskOf(model.textureNames[blend.index]) : null
    const faces = polygon.faces
    for (let f = 0; f < faces.length; f += 3) {
      const vertices = []
      const red = []
      const uvs = []
      for (let k = 0; k < 3; k++) {
        const v = faces[f + k]
        vertices.push([
          position[v * 3] * CENTIMETERS - origin[0],
          position[v * 3 + 1] * CENTIMETERS - origin[1],
          position[v * 3 + 2] * CENTIMETERS - origin[2],
        ])
        red.push(color ? color.array[v * color.size] / 255 : 0)
        uvs.push(uv2 ? [uv2.array[v * 2], uv2.array[v * 2 + 1]] : [0, 0])
      }
      triangles.push({ vertices, red, uvs, mask, kind })
    }
  }
}

/**
 * O que o material cobre: `{ low, high }` (a camada de baixo e a de cima,
 * pelo canal vermelho), ou `null` se não é chão.
 */
function surfaceKindOf(material, path) {
  if (STEPPING_STONE.test(path)) return { low: 'p', high: 'p', decal: true }
  if (SOIL_PATCH.test(material.name)) {
    return { low: 'm', high: 'm', decal: true }
  }
  if (material.shader !== GROUND_SHADER) return null
  if (/asphalt/.test(material.name)) return { low: 'a', high: 'a' }
  const [low, high] = material.name.split('_com_')
  const letterOf = (name) => (/grass/.test(name ?? '') ? 'g' : 't')
  return { low: letterOf(low), high: letterOf(high ?? low) }
}

/** O chão por cima em `(x, z)`: `{ y, letter }` ou `null`. */
function topAt(x, z) {
  let best = null
  for (const { vertices, red, uvs, mask, kind } of triangles) {
    const weights = barycentric(vertices, x, z)
    if (!weights) continue
    const y = weights.reduce((sum, w, k) => sum + w * vertices[k][1], 0)
    // O que é por cima do chão (pedra, mancha) vence nele mesmo rente; a
    // pedra vence a mancha.
    if (best && y <= best.y + (kind.decal ? -ABOVE : ABOVE)) {
      if (!(kind.low === 'p' && best.letter === 'm' && y >= best.y - ABOVE)) {
        continue
      }
    }
    // A de cima: o vermelho vezes o que a máscara deixa (o alfa dela é a
    // de baixo).
    const lerp = (c) => weights.reduce((sum, w, k) => sum + w * uvs[k][c], 0)
    const open = mask ? 1 - maskAlphaAt(mask, lerp(0), lerp(1)) : 1
    const weight = weights.reduce((sum, w, k) => sum + w * red[k], 0) * open
    best = { y, letter: weight < TOP_LAYER ? kind.low : kind.high }
  }
  return best
}

function barycentric([a, b, c], x, z) {
  const area = (b[0] - a[0]) * (c[2] - a[2]) - (c[0] - a[0]) * (b[2] - a[2])
  if (Math.abs(area) < 1e-9) return null
  const wa = ((b[0] - x) * (c[2] - z) - (c[0] - x) * (b[2] - z)) / area
  const wb = ((c[0] - x) * (a[2] - z) - (a[0] - x) * (c[2] - z)) / area
  const wc = 1 - wa - wb
  if (wa < -1e-6 || wb < -1e-6 || wc < -1e-6) return null
  return [wa, wb, wc]
}

// A altura do chão da cidade: a mais comum entre as do asfalto.
const floorY = (() => {
  const counts = new Map()
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const top = topAt(x0 + col + 0.5, z0 + row + 0.5)
      if (top?.letter !== 'a') continue
      const key = top.y.toFixed(1)
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
  }
  return Number([...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0)
})()

const levels = []
const ground = []
for (let row = 0; row < rows; row++) {
  const levelRow = []
  const groundRow = []
  for (let col = 0; col < cols; col++) {
    const votes = new Map()
    let height = 0
    let count = 0
    for (const dx of SAMPLES) {
      for (const dz of SAMPLES) {
        const top = topAt(x0 + col + dx, z0 + row + dz)
        if (!top) continue
        votes.set(top.letter, (votes.get(top.letter) ?? 0) + 1)
        height += top.y
        count++
      }
    }
    groundRow.push(count ? winnerOf(votes) : null)
    levelRow.push(count ? levelOf(height / count - floorY) : null)
  }
  levels.push(levelRow)
  ground.push(groundRow)
}
fillGaps(levels)
fillGaps(ground)

function winnerOf(votes) {
  let best = null
  for (const letter of PRIORITY) {
    if (!votes.has(letter)) continue
    if (!best || votes.get(letter) > votes.get(best)) best = letter
  }
  return best
}

function levelOf(height) {
  if (height < -LAKE_BELOW * STEP) return '~'
  const steps = Math.round(height / STEP)
  if (steps <= -1) return '-'
  if (steps === 0) return '.'
  if (steps === 1) return ':'
  return '+'
}

// As células sem chão copiam a vizinha (de novo até não sobrar nenhuma).
function fillGaps(grid) {
  let missing = true
  while (missing) {
    missing = false
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        if (grid[row][col] != null) continue
        const near = [
          grid[row - 1]?.[col],
          grid[row + 1]?.[col],
          grid[row][col - 1],
          grid[row][col + 1],
        ].find((value) => value != null)
        if (near == null) missing = true
        else grid[row][col] = near
      }
    }
  }
}

const print = (name, grid) =>
  console.log(
    `  ${name}: [\n${grid.map((row) => `    '${row.join('')}',`).join('\n')}\n  ],`,
  )
print('rows', levels)
print('ground', ground)
