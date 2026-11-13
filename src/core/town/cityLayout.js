import LGPE_COLLIDERS from '../data/lgpeColliders.json'
import { clamp, smoothstep } from '../math'
import { cliffBand } from '../terrain/terraces'

/**
 * O chão de uma cidade montada a partir do layout de uma cidade do Let's
 * Go (docs/features/069-revisao-do-bioma-cidade.md, `core/data/
 * cityLayouts/`): a grade de níveis do original vira o nosso relevo.
 *
 * - **Degraus**: cada nível é um platô nosso — o mesmo degrau dos biomas
 *   (`terraceHeight`, `core/terrain/terraces.js`), com o barranco na divisa
 *   entre as células. Com `soften`, os níveis são borrados antes do
 *   degrau: o barranco fica mais largo e a borda dele arredonda, sem
 *   seguir a grade — menos onde há objeto do layout (as células debaixo
 *   dele e em volta seguem no nível delas, e o barranco fica do outro
 *   lado).
 * - **Rampas**: onde o layout marca, o degrau vira uma subida reta de um
 *   nível ao outro.
 * - **Montanha** (`#`): o barranco em patamares da nossa montanha
 *   (`relief.mountains`), subindo da beira para dentro e seguindo além da
 *   borda da grade.
 * - **Lago** (`~`): uma bacia abaixo do chão.
 * - **Desenho** (`ground` e `paint`): a camada de cor que cobre cada
 *   célula (grama, terra, asfalto…) e a rocha do barranco — a dos degraus
 *   ou a da montanha, pelo patamar.
 * - **Rua com guia** (`road`, a letra da rua): a beira dela é desenhada
 *   por pixel, com a borda de terra e a guia do original — a distância com
 *   sinal até a beira (`cityLayoutRoadDistanceAt`) diz de que lado o ponto
 *   está e quanto.
 *
 * O layout está em metros do original (uma célula por metro); as alturas e
 * as larguras do relevo, em metros do mundo — `scale` passa de um para o
 * outro. Puro e determinístico.
 *
 * @typedef {object} CityLayoutGround - forma de `CITIES.FIRST_TOWN.GROUND`
 * @property {{ step: number, cliff: number, tilt: number }} terraces - os
 *   degraus (como `relief.terraces`)
 * @property {{ height: number, rise: number, step: number, cliff: number,
 *   tilt: number }} mountain - a montanha: `height` (m), a altura máxima;
 *   `rise`, quantos metros ela sobe por metro para dentro; o resto como
 *   `relief.mountains`
 * @property {number} lakeDepth - fundo (m) do lago abaixo do chão
 * @property {number} lakeWater - a superfície (m) da água do lago abaixo
 *   do chão
 * @property {number} swell - quanto (0 a 1) do relevo da seed o chão
 *   acompanha: o topo dos platôs nunca fica plano de todo (o Rapier erra
 *   raios em célula plana, docs/roadmap.md, 090)
 * @property {number} rampEdge - largura (m) da beirada das rampas
 * @property {{ radius: number, keep: number }} [soften] - o borrão dos
 *   níveis: `radius` (células), até onde cada célula mistura as vizinhas
 *   (0 = o degrau na divisa, como no original); `keep` (células), a folga
 *   em volta dos objetos do layout em que o nível fica o da célula
 * @property {{ width: number, along: number }} [curb] - a borda da rua:
 *   `width` (m do layout), a largura da faixa de cada lado da beira (a da
 *   terra e a guia, a das máscaras do original); `along`, quantas
 *   repetições da máscara por metro do layout ao longo da beira
 */

// O nível (em degraus a partir do chão da cidade) de cada caractere. A
// montanha e o lago partem do nível do chão em volta (`prepareCityLayout`).
const LEVEL_OF = { '-': -1, '.': 0, ':': 1, '+': 2, '#': 0, '~': 0 }
const MOUNTAIN = '#'
const LAKE = '~'
// Meia largura (fração da célula) da beira do lago: a bacia desce quase
// reta na divisa, onde fica a parede da borda de pedra.
const LAKE_EDGE = 0.15

const prepared = new WeakMap()

/**
 * As grades do layout prontas para a conta (guardadas por layout): o nível
 * de cada célula, onde é lago, quanto cada célula fica para dentro da
 * montanha (em células; negativo fora dela) e a letra do chão dela (o
 * índice em `letters`; sem `ground` no layout, nenhuma). A camada de cor de
 * cada letra (`paint.ground`) é lida na hora de desenhar: dá para trocar
 * sem preparar de novo (o laboratório da cidade troca).
 */
export function prepareCityLayout(layout) {
  const cached = prepared.get(layout)
  if (cached) return cached
  const rows = layout.rows.length
  const cols = layout.rows[0].length
  const levels = new Float32Array(cols * rows)
  const lake = new Float32Array(cols * rows)
  const mountainDepth = new Float32Array(cols * rows)
  const isMountain = (col, row) => layout.rows[row][col] === MOUNTAIN

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const char = layout.rows[row][col]
      if (!(char in LEVEL_OF)) {
        throw new Error(`layout ${layout.id}: caractere "${char}" sem nível`)
      }
      const index = row * cols + col
      levels[index] = LEVEL_OF[char]
      lake[index] = char === LAKE ? 1 : 0
      // Fora da montanha, meia célula antes da divisa: a conta das quatro
      // células em volta põe a beira dela no meio do caminho.
      mountainDepth[index] = -0.5
    }
  }

  // Cada célula da montanha: a distância até a célula de fora mais perto
  // (a beira fica no meio do caminho) e o nível dela — a montanha sobe do
  // chão que encosta nela.
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (!isMountain(col, row)) continue
      let best = Infinity
      let level = 0
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (isMountain(c, r)) continue
          const distance = Math.hypot(c - col, r - row)
          if (distance >= best) continue
          best = distance
          level = LEVEL_OF[layout.rows[r][c]]
        }
      }
      const index = row * cols + col
      mountainDepth[index] = Number.isFinite(best) ? best - 0.5 : 0
      levels[index] = level
    }
  }

  const { letters, letter } = groundLettersOf(layout, cols, rows)
  // A rua com guia: 1 nas células da letra `road`.
  const roadIndex = layout.road ? letters.indexOf(layout.road) : -1
  const road =
    roadIndex >= 0
      ? Uint8Array.from(letter, (k) => (k === roadIndex ? 1 : 0))
      : null
  const result = {
    layout,
    cols,
    rows,
    levels,
    lake,
    mountainDepth,
    letters,
    letter,
    road,
  }
  prepared.set(layout, result)
  return result
}

/**
 * As letras do chão do layout (`letters`, as de `paint.ground`) e a de
 * cada célula (`letter`, o índice nelas), pela grade `ground`.
 */
function groundLettersOf(layout, cols, rows) {
  const letter = new Uint8Array(cols * rows)
  if (!layout.ground) return { letters: [], letter }
  const letters = Object.keys(layout.paint.ground)
  if (layout.ground.length !== rows) {
    throw new Error(`layout ${layout.id}: \`ground\` sem ${rows} linhas`)
  }
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const char = layout.ground[row][col]
      const index = letters.indexOf(char)
      if (index < 0) {
        throw new Error(`layout ${layout.id}: chão "${char}" sem camada`)
      }
      letter[row * cols + col] = index
    }
  }
  return { letters, letter }
}

/**
 * O valor de `field` (uma grade do layout) em `(x, z)` (m do layout),
 * misturando as quatro células em volta (o valor de cada uma vale no meio
 * dela). Fora da grade, o da borda.
 */
function fieldAt({ cols, rows }, field, x, z) {
  const fx = clamp(x - 0.5, 0, cols - 1)
  const fz = clamp(z - 0.5, 0, rows - 1)
  const col = Math.min(Math.floor(fx), cols - 2)
  const row = Math.min(Math.floor(fz), rows - 2)
  const tx = fx - col
  const tz = fz - row
  const at = (dc, dr) => field[(row + dr) * cols + col + dc]
  const near = at(0, 0) * (1 - tx) + at(1, 0) * tx
  const far = at(0, 1) * (1 - tx) + at(1, 1) * tx
  return near * (1 - tz) + far * tz
}

const softened = new WeakMap()

/**
 * Os níveis borrados (`soften`, guardados por layout e por borrão): cada
 * célula, a média das vizinhas até `radius` células (o peso cai com a
 * distância); as células presas (`pinnedCellsOf`) ficam no nível delas.
 * Sem borrão, os níveis.
 */
function softLevelsOf(layoutData, soften) {
  const radius = soften?.radius ?? 0
  if (!(radius > 0)) return layoutData.levels
  const keep = soften.keep ?? 0
  const key = `${radius}:${keep}`
  let byKey = softened.get(layoutData)
  if (!byKey) {
    byKey = new Map()
    softened.set(layoutData, byKey)
  }
  const cached = byKey.get(key)
  if (cached) return cached
  const { cols, rows, levels } = layoutData
  const pinned = pinnedCellsOf(layoutData, keep)
  const reach = Math.ceil(radius)
  const result = new Float32Array(levels.length)
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const index = row * cols + col
      if (pinned[index]) {
        result[index] = levels[index]
        continue
      }
      let sum = 0
      let total = 0
      for (let dr = -reach; dr <= reach; dr++) {
        for (let dc = -reach; dc <= reach; dc++) {
          const weight = 1 - Math.hypot(dc, dr) / (radius + 1)
          if (weight <= 0) continue
          // Fora da grade, a célula da borda continua.
          const r = clamp(row + dr, 0, rows - 1)
          const c = clamp(col + dc, 0, cols - 1)
          sum += levels[r * cols + c] * weight
          total += weight
        }
      }
      result[index] = sum / total
    }
  }
  byKey.set(key, result)
  return result
}

/**
 * As células debaixo dos objetos do layout que assentam no chão (os com
 * `kind`, menos os que assentam pelo meio) e até `keep` células em volta:
 * pela caixa do modelo no chão (girada de quarto em quarto de volta) ou,
 * sem caixa, pelo alcance do casco.
 */
function pinnedCellsOf({ layout, cols, rows }, keep) {
  const pinned = new Uint8Array(cols * rows)
  for (const prop of layout.props ?? []) {
    if (!prop.kind || prop.rest === 'center') continue
    const collider = LGPE_COLLIDERS[prop.model]
    const size = prop.scale ?? 1
    let box = collider?.box?.map((value) => value * size)
    if (!box) {
      const reach = (collider?.reach ?? 0) * size
      box = [-reach, -reach, reach, reach]
    }
    const turned = Math.abs(Math.sin(prop.yaw ?? 0)) > 0.5
    const [minX, minZ, maxX, maxZ] = turned
      ? [box[1], box[0], box[3], box[2]]
      : box
    const col0 = Math.max(0, Math.floor(prop.x + minX - keep))
    const col1 = Math.min(cols - 1, Math.floor(prop.x + maxX + keep))
    const row0 = Math.max(0, Math.floor(prop.z + minZ - keep))
    const row1 = Math.min(rows - 1, Math.floor(prop.z + maxZ + keep))
    for (let row = row0; row <= row1; row++) {
      for (let col = col0; col <= col1; col++) pinned[row * cols + col] = 1
    }
  }
  // O campo de treino inteiro (os bonecos não estão em `props`).
  const field = layout.trainingField
  if (field?.size) {
    const half = field.size / 2 + keep
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const isInside =
          Math.abs(col + 0.5 - field.x) <= half &&
          Math.abs(row + 0.5 - field.z) <= half
        if (isInside) pinned[row * cols + col] = 1
      }
    }
  }
  return pinned
}

/** O nível da célula de `(x, z)` (m do layout), sem misturar. */
function levelOfCell({ cols, rows, levels }, x, z) {
  const col = clamp(Math.floor(x), 0, cols - 1)
  const row = clamp(Math.floor(z), 0, rows - 1)
  return levels[row * cols + col]
}

/** Quanto (m do layout) `(x, z)` fica fora da grade (0 dentro). */
function outsideOf({ cols, rows }, x, z) {
  return Math.hypot(Math.max(-x, 0, x - cols), Math.max(-z, 0, z - rows))
}

/**
 * O degrau dos platôs (como o `terraceHeight` dos biomas, com o mesmo
 * barranco: `cliffBand`) para uma altura que já vem em patamares inteiros
 * no meio de cada célula: a subida fica centrada na divisa entre as
 * células (no meio do caminho de um patamar ao outro), na largura do
 * barranco — o patamar fica inteiro no nível dele, com qualquer `cliff`.
 */
function centeredTerrace(height, { step, cliff, tilt }) {
  if (!(step > 0) || !(cliff > 0)) return height
  const level = height / step
  const base = Math.floor(level)
  const half = cliffBand(cliff) / 2
  const rise = smoothstep(0.5 - half, 0.5 + half, level - base)
  const stepped = (base + rise) * step
  return stepped + (height - stepped) * clamp(tilt, 0, 1)
}

/**
 * A rampa em `(x, z)` (m do layout): `share` (0 a 1), quanto o ponto é
 * rampa (some na beirada dos lados), e `height` (m), a altura da subida
 * reta de um nível ao outro. Duas rampas no mesmo ponto: a mais forte.
 */
function rampAt(layoutData, ground, scale, x, z) {
  let share = 0
  let height = 0
  for (const ramp of layoutData.layout.ramps ?? []) {
    const [fromX, fromZ] = ramp.from
    const [toX, toZ] = ramp.to
    const dx = toX - fromX
    const dz = toZ - fromZ
    const lengthSq = dx * dx + dz * dz
    if (!(lengthSq > 0)) continue
    const along = ((x - fromX) * dx + (z - fromZ) * dz) / lengthSq
    // Além das pontas o chão já está no nível delas.
    if (along < 0 || along > 1) continue
    const across =
      (Math.abs((x - fromX) * dz - (z - fromZ) * dx) / Math.sqrt(lengthSq)) *
      scale
    const half = (ramp.width * scale) / 2
    const edge = ground.rampEdge
    const rampShare = 1 - smoothstep(half - edge, half + edge, across)
    if (rampShare <= share) continue
    const from = levelOfCell(layoutData, fromX, fromZ)
    const to = levelOfCell(layoutData, toX, toZ)
    share = rampShare
    height = (from + (to - from) * along) * ground.terraces.step
  }
  return { share, height }
}

/**
 * A altura (m) da montanha em `(x, z)` (m do layout): sobe `rise` m por
 * metro do mundo da beira para dentro, até `height`, em patamares com
 * barranco. Além da borda da grade ela continua subindo.
 */
function mountainAt(layoutData, mountain, scale, x, z) {
  const natural = mountainNaturalAt(layoutData, mountain, scale, x, z)
  return natural > 0 ? centeredTerrace(natural, mountain) : 0
}

/** A altura (m) da montanha em `(x, z)` sem os patamares (0 fora dela). */
function mountainNaturalAt(layoutData, mountain, scale, x, z) {
  const depth = fieldAt(layoutData, layoutData.mountainDepth, x, z)
  if (depth <= 0) return 0
  const inside = (depth + outsideOf(layoutData, x, z)) * scale
  return Math.min(mountain.height, inside * mountain.rise)
}

/**
 * A altura (m, a partir do chão da cidade) do chão do layout em `(x, z)`
 * (m do layout): os degraus em platôs, as rampas, a montanha e o lago.
 *
 * @param {ReturnType<typeof prepareCityLayout>} layoutData
 * @param {CityLayoutGround} ground
 * @param {number} scale - metros do mundo por metro do layout
 * @param {number} x
 * @param {number} z
 */
export function cityLayoutHeightAt(layoutData, ground, scale, x, z) {
  const level = fieldAt(
    layoutData,
    softLevelsOf(layoutData, ground.soften),
    x,
    z,
  )
  const stepped = centeredTerrace(level * ground.terraces.step, ground.terraces)
  const ramp = rampAt(layoutData, ground, scale, x, z)
  const floor = stepped + (ramp.height - stepped) * ramp.share
  const lake = cityLayoutLakeAt(layoutData, x, z)
  return (
    floor +
    mountainAt(layoutData, ground.mountain, scale, x, z) -
    lake * ground.lakeDepth
  )
}

/**
 * O desenho do chão do layout em `(x, z)` (m do layout): o peso de cada
 * letra do chão (`weights`, na ordem de `layoutData.letters` — a mistura
 * das quatro células em volta; somam 1; a camada de cada uma é a do
 * `paint.ground`) e a camada do barranco
 * ali (`cliff`): na montanha, a do patamar dela (`paint.mountain`, de
 * baixo para cima — cada barranco fica inteiro numa só); fora, a dos
 * degraus (`paint.steps`). Sem `paint` no layout, `null`.
 *
 * @param {ReturnType<typeof prepareCityLayout>} layoutData
 * @param {CityLayoutGround} ground
 * @param {number} scale
 * @param {number} x
 * @param {number} z
 * @param {Float32Array} weights - recebe os pesos
 * @returns {{ weights: Float32Array, cliff: string | null } | null}
 */
export function cityLayoutPaintAt(layoutData, ground, scale, x, z, weights) {
  const { layout, cols, rows, letter } = layoutData
  if (!layout.paint) return null
  weights.fill(0)
  const fx = clamp(x - 0.5, 0, cols - 1)
  const fz = clamp(z - 0.5, 0, rows - 1)
  const col = Math.min(Math.floor(fx), cols - 2)
  const row = Math.min(Math.floor(fz), rows - 2)
  const tx = fx - col
  const tz = fz - row
  const add = (dc, dr, weight) => {
    weights[letter[(row + dr) * cols + col + dc]] += weight
  }
  add(0, 0, (1 - tx) * (1 - tz))
  add(1, 0, tx * (1 - tz))
  add(0, 1, (1 - tx) * tz)
  add(1, 1, tx * tz)
  return { weights, cliff: cliffLayerAt(layoutData, ground, scale, x, z) }
}

/**
 * A camada do barranco em `(x, z)`: o patamar é o da altura sem degraus
 * (a subida de cada barranco fica no meio do patamar dela, `centeredTerrace`
 * — o patamar contado por baixo é o mesmo dos dois lados do barranco).
 */
function cliffLayerAt(layoutData, ground, scale, x, z) {
  const { paint } = layoutData.layout
  const natural = mountainNaturalAt(layoutData, ground.mountain, scale, x, z)
  const mountainLayers = paint.mountain ?? []
  if (natural <= 0 || mountainLayers.length === 0) return paint.steps ?? null
  const band = Math.floor(natural / Math.max(ground.mountain.step, 1e-6))
  return mountainLayers[Math.min(band, mountainLayers.length - 1)]
}

/**
 * A distância (m do layout) de `(x, z)` até a beira da rua (`layout.road`),
 * com sinal: positiva fora da rua, negativa dentro — presa em `reach`
 * (além dele, `±reach`). A rua é a união das células dela (fora da grade,
 * a célula da borda continua: a rua segue pelas saídas). Sem rua no
 * layout, `reach`.
 */
export function cityLayoutRoadDistanceAt(layoutData, x, z, reach) {
  const { cols, rows, road } = layoutData
  if (!road) return reach
  const isRoad = (col, row) =>
    road[clamp(row, 0, rows - 1) * cols + clamp(col, 0, cols - 1)] === 1
  const col = Math.floor(x)
  const row = Math.floor(z)
  const inside = isRoad(col, row)
  const span = Math.ceil(reach) + 1
  let best = reach
  for (let dr = -span; dr <= span; dr++) {
    for (let dc = -span; dc <= span; dc++) {
      const c = col + dc
      const r = row + dr
      if (isRoad(c, r) === inside) continue
      // Até a célula do outro lado (a beira é a borda dela).
      const dx = Math.max(c - x, 0, x - (c + 1))
      const dz = Math.max(r - z, 0, z - (r + 1))
      best = Math.min(best, Math.hypot(dx, dz))
    }
  }
  return inside ? -best : best
}

/**
 * Quanto `(x, z)` (m do layout) é lago (0 a 1): 1 dentro, 0 fora, a troca
 * quase reta na divisa das células.
 */
export function cityLayoutLakeAt(layoutData, x, z) {
  const share = fieldAt(layoutData, layoutData.lake, x, z)
  return smoothstep(0.5 - LAKE_EDGE, 0.5 + LAKE_EDGE, share)
}

/**
 * O retângulo das células do lago (`[minX, minZ, maxX, maxZ]`, m do
 * layout), ou `null` sem lago.
 */
export function cityLayoutLakeRect({ cols, rows, lake }) {
  let rect = null
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (!lake[row * cols + col]) continue
      rect = rect
        ? [
            Math.min(rect[0], col),
            Math.min(rect[1], row),
            Math.max(rect[2], col + 1),
            Math.max(rect[3], row + 1),
          ]
        : [col, row, col + 1, row + 1]
    }
  }
  return rect
}
