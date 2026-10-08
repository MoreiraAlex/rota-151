import PF from 'pathfinding'
import { GAME_CONFIG } from './gameConfig'
import { TEST_LEVEL } from './data/testLevel'
import { clamp } from './math'

/**
 * Grade de navegação (plano XZ, com elevação — ver "Elevação (heightmap)"
 * abaixo) usada por `creatureFollowSystem.js` pra contornar obstáculos e
 * subir terrenos elevados em vez de andar em linha reta até o treinador —
 * usa a lib `pathfinding` (A* em grade) em cima da MESMA fonte de dados dos
 * colliders físicos (`TEST_LEVEL`, ver `core/physics/colliders.js`), não
 * uma malha separada.
 *
 * `createNavigation(level)` monta a navegação de um nível qualquer
 * (`{ bounds?, terrain?, obstacles }`, a forma de `TEST_LEVEL`) — os testes
 * usam níveis próprios. `findPath`/`isWalkableAt`/`inspectCell` exportados
 * usam a do nível do jogo, feita de uma região de grade por chunk carregado
 * (docs/features/046-sistema-de-chunks.md, ver `createNavigation`).
 *
 * ## Elevação (heightmap)
 *
 * A grade não é só um bit walkable/bloqueado — cada célula também guarda
 * uma ELEVAÇÃO (`elevationAt`). Sem isso, marcar um terreno elevado como
 * "sempre andável" (do jeito que rampa já era antes desta função existir)
 * deixaria o A* traçar uma rota reta por CIMA da lateral sólida de um
 * terraço (que fisicamente é uma parede) — o creature ficaria preso na
 * parede de novo, o bug exato que o pathfinding resolveu, só que
 * realocado. Só um bit não basta; precisa saber QUANTO um vizinho é mais
 * alto.
 *
 * A base é a altura do RELEVO (`level.terrain.heightAt`, no centro de cada
 * célula — docs/features/045-terreno-de-um-chunk.md; sem terreno, `0`). Dois
 * tipos de obstáculo sobrescrevem:
 * - `type: 'ramp'`: elevação varia ao longo do eixo de inclinação,
 *   calculada exatamente pela mesma rotação de eixo único que
 *   `quaternionFromAxisAngle` usa (`axis: 'z'` inclina ao longo de X,
 *   `axis: 'x'` ao longo de Z — sinais conferidos contra o comentário
 *   "-x encosta no chão, +x sobe" da rampa original de `testLevel.js`).
 * - `type: 'floor'`: terraço elevado, elevação CONSTANTE (topo da caixa,
 *   `position[1] + size[1]/2`) — terreno andável (não bloqueia, como
 *   rampa), só não tem inclinação.
 *
 * `type: 'box'` nunca contribui elevação — continua sendo parede de
 * verdade, bloqueando quando o topo passa do auto-step ACIMA DO TERRENO onde
 * ela está.
 *
 * ### Regra de "penhasco"
 *
 * Depois do bloqueio duro (obstáculos `'box'`), cada célula ainda livre é
 * comparada com as 8 vizinhas (`allowDiagonal: true` no finder, então
 * diagonais contam) que TAMBÉM estão livres — uma vizinha já bloqueada não
 * entra na conta, já está fora do grafo de qualquer jeito. Se a diferença
 * de elevação para qualquer vizinha passar de
 * `GAME_CONFIG.PATHFINDING.MAX_CLIMB_STEP` (vezes a distância entre os
 * centros, em células: a diagonal é mais longa), a célula vira bloqueada —
 * é também o que bloqueia a encosta íngreme do relevo. Uma
 * rampa, com elevação variando suavemente célula a célula ao longo do
 * próprio comprimento, nunca dispara essa regra nela mesma — só a borda
 * entre dois terraços SEM rampa entre eles (um salto grande numa única
 * célula) dispara, bloqueando exatamente aquela borda e forçando o desvio
 * pela rampa. Continua usando só `PF.Grid`/`AStarFinder` sem nenhuma
 * mudança na lib — a regra de penhasco só decide o walkable de cada célula
 * ANTES de passar pro finder, igual ao bloqueio por obstáculo.
 *
 * ### Limitação assumida
 *
 * A grade guarda UMA elevação por célula X/Z — não modela dois andares
 * exatamente empilhados no mesmo X/Z (um só pode existir "por cima" do
 * outro se estiverem em posições X/Z diferentes, nunca sobrepostos). Pra
 * terrenos que sobem (morros, montanhas, trilhas em espiral, terraços em
 * sequência como a trilha de teste em `testLevel.js`) isso não é problema,
 * já que nenhum ponto do caminho passa por baixo de si mesmo. Um prédio
 * com andares literalmente sobrepostos exigiria uma grade "por nível"
 * (várias grades empilhadas conectadas por rampas) — fora de escopo aqui.
 */

/**
 * Grade de uma região (um chunk ou a área fixa de um nível): células de
 * mundo `minCol..minCol + cols - 1` × `minRow..minRow + rows - 1`, por
 * linha (`(row - minRow) × cols + (col - minCol)`).
 *
 * @typedef {object} NavRegion
 * @property {number} minCol
 * @property {number} minRow
 * @property {number} cols
 * @property {number} rows
 * @property {Uint8Array} walkable - 1 = andável
 * @property {Float32Array} elevation - m
 */

function rampElevationAt(obstacle, x, z) {
  const { axis, angle } = obstacle.rotation
  const [ox, oy, oz] = obstacle.position
  return axis === 'z'
    ? oy + (x - ox) * Math.tan(angle)
    : oy - (z - oz) * Math.tan(angle)
}

// Faixa de células `{ minCol, minRow, cols, rows }` (índices de célula de
// mundo: a célula `col` vai de `col × CELL_SIZE` a `(col + 1) × CELL_SIZE`)
// que cobre os limites `{ minX, maxX, minZ, maxZ }`.
function cellRectFromBounds({ minX, maxX, minZ, maxZ }) {
  const { CELL_SIZE } = GAME_CONFIG.PATHFINDING
  return {
    minCol: Math.round(minX / CELL_SIZE),
    minRow: Math.round(minZ / CELL_SIZE),
    cols: Math.round((maxX - minX) / CELL_SIZE),
    rows: Math.round((maxZ - minZ) / CELL_SIZE),
  }
}

/**
 * Assa a grade de uma região (um chunk, ou o nível inteiro de quem tem
 * `bounds`): elevação e andável por célula. As passadas trabalham numa
 * faixa uma célula MAIOR que a região em cada lado (a "moldura"), com o
 * relevo e os obstáculos de lá — assim a regra de penhasco da borda compara
 * com a vizinha de verdade, do chunk do lado, carregado ou não
 * (docs/features/046-sistema-de-chunks.md). Só as células de dentro são
 * guardadas.
 *
 * @returns {NavRegion}
 */
function bakeNavRegion(level, { minCol, minRow, cols, rows }) {
  const { CELL_SIZE, OBSTACLE_MARGIN, MAX_CLIMB_STEP } = GAME_CONFIG.PATHFINDING
  const { AUTOSTEP_HEIGHT } = GAME_CONFIG.PHYSICS.CHARACTER
  const { obstacles } = level
  const groundAt = (x, z) => level.terrain?.heightAt(x, z) ?? 0

  // A faixa com a moldura.
  const frameCols = cols + 2
  const frameRows = rows + 2
  const frameMinCol = minCol - 1
  const frameMinRow = minRow - 1

  const elevation = new Float32Array(frameCols * frameRows)
  const blocked = new Uint8Array(frameCols * frameRows)
  const index = (col, row) => row * frameCols + col
  const cellCenter = (col, row) => ({
    x: (frameMinCol + col + 0.5) * CELL_SIZE,
    z: (frameMinRow + row + 0.5) * CELL_SIZE,
  })

  // Células da faixa debaixo do retângulo; `null` se ele não toca a faixa.
  const cellRangeFor = (ox, oz, halfW, halfD) => {
    const minC = Math.floor((ox - halfW) / CELL_SIZE) - frameMinCol
    const maxC = Math.ceil((ox + halfW) / CELL_SIZE) - 1 - frameMinCol
    const minR = Math.floor((oz - halfD) / CELL_SIZE) - frameMinRow
    const maxR = Math.ceil((oz + halfD) / CELL_SIZE) - 1 - frameMinRow
    if (maxC < 0 || maxR < 0 || minC >= frameCols || minR >= frameRows) {
      return null
    }
    return {
      minCol: clamp(minC, 0, frameCols - 1),
      maxCol: clamp(maxC, 0, frameCols - 1),
      minRow: clamp(minR, 0, frameRows - 1),
      maxRow: clamp(maxR, 0, frameRows - 1),
    }
  }

  // Passada 0: o relevo.
  for (let col = 0; col < frameCols; col++) {
    for (let row = 0; row < frameRows; row++) {
      const { x, z } = cellCenter(col, row)
      elevation[index(col, row)] = groundAt(x, z)
    }
  }

  // Passada 1: elevação — 'floor' (constante) primeiro, 'ramp' (interpolada)
  // depois, de propósito NESSA ordem: onde os footprints rasterizados de
  // uma rampa e um terraço vizinho encostam, quase sempre sobra 1 célula
  // de sobreposição (o próprio arredondamento do rasterizador, não um erro
  // de conteúdo) — se o terraço (valor constante) vencesse ali, a célula
  // ficaria com um salto artificial em relação à célula anterior da rampa
  // (a rampa não necessariamente alcança a altura EXATA do terraço bem no
  // limite do próprio footprint — pequena imprecisão de autoria). Deixando
  // a rampa vencer nessa sobreposição, a célula de fronteira fica com um
  // valor intermediário (a própria curva da rampa), suave nos dois lados —
  // sem isso, a regra de penhasco (abaixo) bloqueava incorretamente a
  // própria junção rampa→terraço.
  for (const obstacle of obstacles) {
    if (obstacle.type !== 'floor') continue
    const [ox, , oz] = obstacle.position
    const [halfW, , halfD] = obstacle.size.map((s) => s / 2)
    const range = cellRangeFor(ox, oz, halfW, halfD)
    if (!range) continue
    const topY = obstacle.position[1] + obstacle.size[1] / 2

    for (let col = range.minCol; col <= range.maxCol; col++) {
      for (let row = range.minRow; row <= range.maxRow; row++) {
        elevation[index(col, row)] = topY
      }
    }
  }

  for (const obstacle of obstacles) {
    if (obstacle.type !== 'ramp') continue
    const [ox, , oz] = obstacle.position
    const [halfW, , halfD] = obstacle.size.map((s) => s / 2)
    const range = cellRangeFor(ox, oz, halfW, halfD)
    if (!range) continue

    for (let col = range.minCol; col <= range.maxCol; col++) {
      for (let row = range.minRow; row <= range.maxRow; row++) {
        const { x, z } = cellCenter(col, row)
        elevation[index(col, row)] = rampElevationAt(obstacle, x, z)
      }
    }
  }

  // Passada 2: bloqueio duro — 'box' cujo topo passa do auto-step acima do
  // chão onde ela está.
  for (const obstacle of obstacles) {
    if (obstacle.type !== 'box') continue

    const [ox, , oz] = obstacle.position
    const topY = obstacle.position[1] + obstacle.size[1] / 2
    if (topY - groundAt(ox, oz) <= AUTOSTEP_HEIGHT) continue

    const [halfW, , halfD] = obstacle.size.map((s) => s / 2 + OBSTACLE_MARGIN)
    const range = cellRangeFor(ox, oz, halfW, halfD)
    if (!range) continue

    for (let col = range.minCol; col <= range.maxCol; col++) {
      for (let row = range.minRow; row <= range.maxRow; row++) {
        blocked[index(col, row)] = 1
      }
    }
  }

  // Passada 3: penhasco, só nas células de dentro (a moldura dá as
  // vizinhas da borda) — célula livre com salto de elevação grande demais
  // pra qualquer vizinha (das 8) que também esteja livre vira bloqueada. O
  // limite cresce com a distância até a vizinha (diagonal = √2 células).
  const region = {
    minCol,
    minRow,
    cols,
    rows,
    walkable: new Uint8Array(cols * rows),
    elevation: new Float32Array(cols * rows),
  }
  for (let col = 1; col <= cols; col++) {
    for (let row = 1; row <= rows; row++) {
      const i = index(col, row)
      const inner = (row - 1) * cols + (col - 1)
      region.elevation[inner] = elevation[i]
      if (blocked[i]) continue

      let isCliff = false
      for (let dc = -1; dc <= 1 && !isCliff; dc++) {
        for (let dr = -1; dr <= 1 && !isCliff; dr++) {
          if (dc === 0 && dr === 0) continue
          const ni = index(col + dc, row + dr)
          if (blocked[ni]) continue
          const maxStep = MAX_CLIMB_STEP * Math.hypot(dc, dr)
          if (Math.abs(elevation[i] - elevation[ni]) > maxStep) isCliff = true
        }
      }
      if (!isCliff) region.walkable[inner] = 1
    }
  }

  return region
}

/** A célula de mundo que contém `(x, z)`. */
function worldToCell(x, z) {
  const { CELL_SIZE } = GAME_CONFIG.PATHFINDING
  return { col: Math.floor(x / CELL_SIZE), row: Math.floor(z / CELL_SIZE) }
}

const regionHasCell = (region, col, row) =>
  col >= region.minCol &&
  row >= region.minRow &&
  col < region.minCol + region.cols &&
  row < region.minRow + region.rows

const regionIndex = (region, col, row) =>
  (row - region.minRow) * region.cols + (col - region.minCol)

const finder = new PF.AStarFinder({
  allowDiagonal: true,
  dontCrossCorners: true,
})

/**
 * Suaviza o caminho bruto do A* — mesma técnica de "string pulling" de
 * `PF.Util.smoothenPath` (do ponto `i`, acha o ponto `j` mais distante com
 * linha de visão livre — `PF.Util.interpolate`/Bresenham, célula a célula
 * — e pula direto pra lá), MAS limitando a distância de cada salto a
 * `GAME_CONFIG.PATHFINDING.MAX_SHORTCUT_DISTANCE`.
 *
 * Sem esse limite (o que `PF.Util.smoothenPath` sozinho faz), um trecho
 * reto e andável célula a célula — verdade, `isWalkableAt` confirma cada
 * uma — pode ainda assim virar UM waypoint só bem longe (uma lane de
 * rampa estreita tem exatamente esse formato: reta,
 * andável, e comprida). Célula andável não é o mesmo que "seguro mirar de
 * tão longe": entre um recálculo e o próximo
 * (`PATHFINDING.REPATH_INTERVAL`), a criatura anda reto na direção daquele
 * waypoint distante, e qualquer imprecisão real (giro suavizado por
 * `turnSpeed`, física) desvia da lane estreita antes da próxima correção —
 * ela acaba esbarrando de lado numa rampa (ou passando por baixo dela,
 * pelo vão físico sob a parte inclinada) em vez de subir. Bug real,
 * relatado depois de jogar contra a trilha de teste. Limitar o salto
 * mantém os trechos abertos/sem obstáculo eficientes (poucos waypoints,
 * igual antes) sem permitir um atalho tão comprido quanto o do bug.
 */
function boundedSmoothPath(grid, rawPath, maxJumpDistance) {
  if (rawPath.length <= 2) return rawPath

  const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1])
  const hasLineOfSight = (a, b) =>
    PF.Util.interpolate(a[0], a[1], b[0], b[1]).every(([col, row]) =>
      grid.isWalkableAt(col, row),
    )

  const smoothed = [rawPath[0]]
  let anchor = 0
  while (anchor < rawPath.length - 1) {
    let next = anchor + 1
    for (
      let candidate = rawPath.length - 1;
      candidate > anchor + 1;
      candidate--
    ) {
      if (
        distance(rawPath[anchor], rawPath[candidate]) <= maxJumpDistance &&
        hasLineOfSight(rawPath[anchor], rawPath[candidate])
      ) {
        next = candidate
        break
      }
    }
    smoothed.push(rawPath[next])
    anchor = next
  }
  return smoothed
}

/**
 * Navegação de um nível (`{ bounds?, terrain?, obstacles }`), feita de
 * REGIÕES de grade (docs/features/046-sistema-de-chunks.md): no jogo, uma
 * por chunk carregado (`addRegion`/`removeRegion`, chamadas por
 * `carregarChunk`/`descarregarChunk`); num nível com `bounds` fixos (os dos
 * testes), uma região só com a área toda, assada na primeira consulta.
 *
 * O A* roda numa janela em volta da origem e do destino
 * (`PATHFINDING.SEARCH_MARGIN` a mais em cada lado), montada das regiões
 * que a tocam — célula sem região é bloqueada. Assim o caminho atravessa
 * a borda de chunks, e a busca não paga pelo mundo carregado inteiro.
 */
export function createNavigation(level) {
  const regions = new Map()
  let isFixedAreaBaked = !level.bounds

  const allRegions = () => {
    if (!isFixedAreaBaked) {
      regions.set(
        'level',
        bakeNavRegion(level, cellRectFromBounds(level.bounds)),
      )
      isFixedAreaBaked = true
    }
    return regions.values()
  }

  const regionAtCell = (col, row) => {
    for (const region of allRegions()) {
      if (regionHasCell(region, col, row)) return region
    }
    return null
  }

  /** Assa a região `key` (um chunk) cobrindo `bounds`. */
  function addRegion(key, bounds) {
    regions.set(key, bakeNavRegion(level, cellRectFromBounds(bounds)))
  }

  /** Libera a região `key`. */
  function removeRegion(key) {
    regions.delete(key)
  }

  const hasRegion = (key) => regions.has(key)

  /**
   * Inspeciona a célula que contém `(x, z)` — elevação e se está andável.
   * Uso de teste: testar a regra de penhasco/elevação direto pelas
   * células é mais preciso que inferir pelo caminho que `findPath` devolve.
   * Fora de toda região: `null`.
   */
  function inspectCell(x, z) {
    const { col, row } = worldToCell(x, z)
    const region = regionAtCell(col, row)
    if (!region) return null
    const i = regionIndex(region, col, row)
    return {
      elevation: region.elevation[i],
      walkable: region.walkable[i] === 1,
    }
  }

  /**
   * O ponto `(x, z)` está numa região (chunk carregado, ou dentro do mapa
   * de um nível fixo) e numa célula andável? Usado pra escolher destino de
   * fuga (`core/battle/flee.js`) — destino dentro de obstáculo ou fora do
   * mapa fazia a criatura correr contra a parede.
   */
  function isWalkableAt(x, z) {
    return inspectCell(x, z)?.walkable ?? false
  }

  // Grade do A* na janela: andável só onde uma região diz que é.
  function buildSearchWindow(from, to) {
    const { CELL_SIZE, SEARCH_MARGIN } = GAME_CONFIG.PATHFINDING
    const margin = Math.ceil(SEARCH_MARGIN / CELL_SIZE)
    const minCol = Math.min(from.col, to.col) - margin
    const minRow = Math.min(from.row, to.row) - margin
    const cols = Math.abs(from.col - to.col) + 2 * margin + 1
    const rows = Math.abs(from.row - to.row) + 2 * margin + 1

    // `PF.Grid` lê a matriz por linha: 1 = bloqueado.
    const matrix = Array.from({ length: rows }, () => new Array(cols).fill(1))
    for (const region of allRegions()) {
      const colStart = Math.max(minCol, region.minCol)
      const colEnd = Math.min(minCol + cols, region.minCol + region.cols)
      const rowStart = Math.max(minRow, region.minRow)
      const rowEnd = Math.min(minRow + rows, region.minRow + region.rows)
      for (let row = rowStart; row < rowEnd; row++) {
        const line = matrix[row - minRow]
        for (let col = colStart; col < colEnd; col++) {
          if (region.walkable[regionIndex(region, col, row)]) {
            line[col - minCol] = 0
          }
        }
      }
    }
    return { grid: new PF.Grid(cols, rows, matrix), minCol, minRow }
  }

  // Centro da célula, com a elevação dela.
  function cellToWorld(col, row) {
    const { CELL_SIZE } = GAME_CONFIG.PATHFINDING
    const region = regionAtCell(col, row)
    return {
      x: (col + 0.5) * CELL_SIZE,
      y: region ? region.elevation[regionIndex(region, col, row)] : 0,
      z: (row + 0.5) * CELL_SIZE,
    }
  }

  /**
   * Calcula um caminho de `fromWorld` até `toWorld` (`{x, z}` cada, `y`
   * ignorado na entrada) desviando dos obstáculos e penhascos do nível.
   * Retorna uma lista de waypoints em coordenadas de mundo (`[{x, y, z},
   * ...]`, SEM o ponto de partida), suavizada por `boundedSmoothPath`
   * (string pulling com salto máximo — ver docstring dela pra entender POR
   * QUE não é `PF.Util.smoothenPath` puro). O `y` de cada waypoint
   * intermediário vem da elevação da própria célula (`heightmap`) — não é
   * necessário pro movimento em si (a física já sobe rampa/degrau sozinha
   * via auto-step/slope-climb a partir só da direção horizontal), mas deixa
   * a visualização de debug (`PathfindingDebugView.jsx`) acompanhar o
   * relevo de verdade em vez de flutuar na altura atual da criatura.
   *
   * Retorna `[]` quando origem/destino caem na mesma célula, quando um dos
   * dois está fora de toda região (chunk não carregado) ou quando não
   * existe caminho dentro da janela de busca (alvo bloqueado/inatingível,
   * incluindo do lado errado de um penhasco) — quem chama trata isso como
   * "sem obstáculo relevante no meio", indo direto.
   *
   * O último waypoint é substituído pela posição EXATA de `toWorld` (x/z da
   * grade, y do próprio `toWorld` se presente) — sem isso, todo alvo chega
   * deslocado em até meia célula (`CELL_SIZE`), mesmo sem obstáculo nenhum
   * no meio (o centro da célula raramente cai exatamente em cima do alvo de
   * verdade). Waypoints intermediários continuam em centro de célula — só a
   * chegada final precisa ser precisa.
   */
  function findPath(fromWorld, toWorld) {
    const from = worldToCell(fromWorld.x, fromWorld.z)
    const to = worldToCell(toWorld.x, toWorld.z)

    if (from.col === to.col && from.row === to.row) return []
    if (!regionAtCell(from.col, from.row) || !regionAtCell(to.col, to.row)) {
      return []
    }

    const { grid, minCol, minRow } = buildSearchWindow(from, to)
    const rawPath = finder.findPath(
      from.col - minCol,
      from.row - minRow,
      to.col - minCol,
      to.row - minRow,
      grid,
    )
    if (rawPath.length <= 1) return []

    const smoothed = boundedSmoothPath(
      grid,
      rawPath,
      GAME_CONFIG.PATHFINDING.MAX_SHORTCUT_DISTANCE,
    )
    const waypoints = smoothed
      .slice(1)
      .map(([col, row]) => cellToWorld(col + minCol, row + minRow))
    waypoints[waypoints.length - 1] = {
      x: toWorld.x,
      y: toWorld.y ?? waypoints[waypoints.length - 1].y,
      z: toWorld.z,
    }
    return waypoints
  }

  return {
    findPath,
    isWalkableAt,
    inspectCell,
    addRegion,
    removeRegion,
    hasRegion,
  }
}

let levelNavigation = null

function getLevelNavigation() {
  if (!levelNavigation) levelNavigation = createNavigation(TEST_LEVEL)
  return levelNavigation
}

/**
 * Descarta a navegação do nível do jogo, regiões incluídas; a próxima
 * consulta começa do zero (relevo ajustado em tempo real,
 * `regenerarTerreno`).
 */
export function resetLevelNavigation() {
  levelNavigation = null
}

/** Assa a grade do chunk `key` (`carregarChunk`, core/actions/chunks.js). */
export function addLevelNavigationRegion(key, bounds) {
  getLevelNavigation().addRegion(key, bounds)
}

/** Libera a grade do chunk `key` (`descarregarChunk`). */
export function removeLevelNavigationRegion(key) {
  getLevelNavigation().removeRegion(key)
}

/** O chunk `key` tem grade na navegação do nível do jogo? */
export function hasLevelNavigationRegion(key) {
  return getLevelNavigation().hasRegion(key)
}

/** `findPath` da navegação do nível do jogo (ver `createNavigation`). */
export function findPath(fromWorld, toWorld) {
  return getLevelNavigation().findPath(fromWorld, toWorld)
}

/** `isWalkableAt` da navegação do nível do jogo (ver `createNavigation`). */
export function isWalkableAt(x, z) {
  return getLevelNavigation().isWalkableAt(x, z)
}

/** `inspectCell` da navegação do nível do jogo (ver `createNavigation`). */
export function inspectCell(x, z) {
  return getLevelNavigation().inspectCell(x, z)
}
