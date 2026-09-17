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
 * uma malha separada — nível ainda é só boxes/rampas/terraços, sem
 * ferramenta de autoria de navmesh no projeto.
 *
 * Nível é estático (estes dados nunca mudam em runtime — mesma premissa de
 * `createStaticLevel`, que também baka os colliders uma vez só), então a
 * grade é construída de forma preguiçosa e cacheada (`getNavGrid`) — só a
 * primeira chamada paga o custo de bake.
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
 * Dois tipos contribuem elevação (o resto do mundo fica em `0`, chão
 * padrão):
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
 * verdade, bloqueando acima do auto-step como sempre bloqueou.
 *
 * ### Regra de "penhasco"
 *
 * Depois do bloqueio duro (obstáculos `'box'`), cada célula ainda livre é
 * comparada com as 8 vizinhas (`allowDiagonal: true` no finder, então
 * diagonais contam) que TAMBÉM estão livres — uma vizinha já bloqueada não
 * entra na conta, já está fora do grafo de qualquer jeito. Se a diferença
 * de elevação para qualquer vizinha passar de
 * `GAME_CONFIG.PATHFINDING.MAX_CLIMB_STEP`, a célula vira bloqueada. Uma
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

let cachedGrid = null

function rampElevationAt(obstacle, x, z) {
  const { axis, angle } = obstacle.rotation
  const [ox, oy, oz] = obstacle.position
  return axis === 'z'
    ? oy + (x - ox) * Math.tan(angle)
    : oy - (z - oz) * Math.tan(angle)
}

function buildNavGrid() {
  const { CELL_SIZE, OBSTACLE_MARGIN, MAX_CLIMB_STEP } = GAME_CONFIG.PATHFINDING
  const { AUTOSTEP_HEIGHT } = GAME_CONFIG.PHYSICS.CHARACTER
  const { ground, obstacles } = TEST_LEVEL

  const cols = Math.round(ground.size / CELL_SIZE)
  const rows = cols
  const origin = -ground.size / 2

  const elevation = new Float32Array(cols * rows) // default 0 — chão
  const blocked = new Uint8Array(cols * rows)
  const index = (col, row) => row * cols + col

  const cellRangeFor = (ox, oz, halfW, halfD) => ({
    minCol: clamp(Math.floor((ox - halfW - origin) / CELL_SIZE), 0, cols - 1),
    maxCol: clamp(
      Math.ceil((ox + halfW - origin) / CELL_SIZE) - 1,
      0,
      cols - 1,
    ),
    minRow: clamp(Math.floor((oz - halfD - origin) / CELL_SIZE), 0, rows - 1),
    maxRow: clamp(
      Math.ceil((oz + halfD - origin) / CELL_SIZE) - 1,
      0,
      rows - 1,
    ),
  })

  // Passada 1: elevação — 'floor' (constante) primeiro, 'ramp' (interpolada)
  // depois, de propósito NESSA ordem: onde os footprints rasterizados de
  // uma rampa e um terraço vizinho encostam, quase sempre sobra 1 célula
  // de sobreposição (o próprio arredondamento do rasterizador, não um erro
  // de conteúdo) — se o terraço (valor constante) vencesse ali, a célula
  // ficaria com um salto artificial em relação à célula anterior da rampa
  // (a rampa não necessariamente alcança a altura EXATA do terraço bem no
  // limite do próprio footprint — pequena imprecisão de autoria, sempre
  // existiu, só passou a importar agora). Deixando a rampa vencer nessa
  // sobreposição, a célula de fronteira fica com um valor intermediário
  // (a própria curva da rampa), suave nos dois lados — sem isso, a regra
  // de penhasco (abaixo) bloqueava incorretamente a própria junção
  // rampa→terraço (achado rodando os testes desta função).
  for (const obstacle of obstacles) {
    if (obstacle.type !== 'floor') continue
    const [ox, , oz] = obstacle.position
    const [halfW, , halfD] = obstacle.size.map((s) => s / 2)
    const { minCol, maxCol, minRow, maxRow } = cellRangeFor(
      ox,
      oz,
      halfW,
      halfD,
    )
    const topY = obstacle.position[1] + obstacle.size[1] / 2

    for (let col = minCol; col <= maxCol; col++) {
      for (let row = minRow; row <= maxRow; row++) {
        elevation[index(col, row)] = topY
      }
    }
  }

  for (const obstacle of obstacles) {
    if (obstacle.type !== 'ramp') continue
    const [ox, , oz] = obstacle.position
    const [halfW, , halfD] = obstacle.size.map((s) => s / 2)
    const { minCol, maxCol, minRow, maxRow } = cellRangeFor(
      ox,
      oz,
      halfW,
      halfD,
    )

    for (let col = minCol; col <= maxCol; col++) {
      for (let row = minRow; row <= maxRow; row++) {
        const { x, z } = gridToWorldXZ(origin, CELL_SIZE, col, row)
        elevation[index(col, row)] = rampElevationAt(obstacle, x, z)
      }
    }
  }

  // Passada 2: bloqueio duro — só 'box' acima do auto-step, igual sempre foi.
  for (const obstacle of obstacles) {
    if (obstacle.type !== 'box') continue

    const topY = obstacle.position[1] + obstacle.size[1] / 2
    if (topY <= AUTOSTEP_HEIGHT) continue

    const [ox, , oz] = obstacle.position
    const [halfW, , halfD] = obstacle.size.map((s) => s / 2 + OBSTACLE_MARGIN)
    const { minCol, maxCol, minRow, maxRow } = cellRangeFor(
      ox,
      oz,
      halfW,
      halfD,
    )

    for (let col = minCol; col <= maxCol; col++) {
      for (let row = minRow; row <= maxRow; row++) {
        blocked[index(col, row)] = 1
      }
    }
  }

  // Passada 3: penhasco — célula livre com salto de elevação grande demais
  // pra qualquer vizinha (das 8) que também esteja livre vira bloqueada.
  const grid = new PF.Grid(cols, rows)
  for (let col = 0; col < cols; col++) {
    for (let row = 0; row < rows; row++) {
      const i = index(col, row)
      if (blocked[i]) {
        grid.setWalkableAt(col, row, false)
        continue
      }

      let isCliff = false
      for (let dc = -1; dc <= 1 && !isCliff; dc++) {
        for (let dr = -1; dr <= 1 && !isCliff; dr++) {
          if (dc === 0 && dr === 0) continue
          const nc = col + dc
          const nr = row + dr
          if (nc < 0 || nc >= cols || nr < 0 || nr >= rows) continue
          const ni = index(nc, nr)
          if (blocked[ni]) continue
          if (Math.abs(elevation[i] - elevation[ni]) > MAX_CLIMB_STEP)
            isCliff = true
        }
      }
      if (isCliff) grid.setWalkableAt(col, row, false)
    }
  }

  return { grid, elevation, cols, rows, origin, cellSize: CELL_SIZE, index }
}

/**
 * Inspeciona a célula da grade que contém `(x, z)` — elevação e se está
 * andável. Uso exclusivo de teste (`pathfinding.test.js`): testar a regra
 * de penhasco/elevação direto pelas células é mais preciso e menos frágil
 * do que inferir pelo caminho final que `findPath` devolve (que hoje já
 * expõe uma célula por waypoint, mas testar a célula direto continua mais
 * direto pra casos pontuais, sem depender de origem/destino específicos).
 */
export function inspectCell(x, z) {
  const nav = getNavGrid()
  const { col, row } = worldToGrid(nav, x, z)
  return {
    elevation: nav.elevation[nav.index(col, row)],
    walkable: nav.grid.isWalkableAt(col, row),
  }
}

function getNavGrid() {
  if (!cachedGrid) cachedGrid = buildNavGrid()
  return cachedGrid
}

function worldToGrid({ origin, cellSize, cols, rows }, x, z) {
  return {
    col: clamp(Math.floor((x - origin) / cellSize), 0, cols - 1),
    row: clamp(Math.floor((z - origin) / cellSize), 0, rows - 1),
  }
}

function gridToWorldXZ(origin, cellSize, col, row) {
  return {
    x: origin + (col + 0.5) * cellSize,
    z: origin + (row + 0.5) * cellSize,
  }
}

function gridToWorld(nav, col, row) {
  const { x, z } = gridToWorldXZ(nav.origin, nav.cellSize, col, row)
  return { x, y: nav.elevation[nav.index(col, row)], z }
}

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
 * uma — pode ainda assim virar UM waypoint só a 20-30m de distância (uma
 * lane de rampa de ~4m de largura tem exatamente esse formato: reta,
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
 * Retorna `[]` quando origem/destino caem na mesma célula ou quando não
 * existe caminho (alvo bloqueado/inatingível, incluindo do lado errado de
 * um penhasco) — quem chama trata isso como "sem obstáculo relevante no
 * meio", indo direto.
 *
 * `finder.findPath` MUTA a grade recebida (marca nós visitados) — por isso
 * sempre `grid.clone()` aqui; a grade cacheada (`getNavGrid`) nunca é
 * passada direto pra busca.
 *
 * O último waypoint é substituído pela posição EXATA de `toWorld` (x/z da
 * grade, y do próprio `toWorld` se presente) — sem isso, todo alvo chega
 * deslocado em até meia célula (`CELL_SIZE`), mesmo sem obstáculo nenhum
 * no meio (o centro da célula raramente cai exatamente em cima do alvo de
 * verdade). Waypoints intermediários continuam em centro de célula — só a
 * chegada final precisa ser precisa.
 */
export function findPath(fromWorld, toWorld) {
  const nav = getNavGrid()
  const from = worldToGrid(nav, fromWorld.x, fromWorld.z)
  const to = worldToGrid(nav, toWorld.x, toWorld.z)

  if (from.col === to.col && from.row === to.row) return []

  const rawPath = finder.findPath(
    from.col,
    from.row,
    to.col,
    to.row,
    nav.grid.clone(),
  )
  if (rawPath.length <= 1) return []

  const smoothed = boundedSmoothPath(
    nav.grid,
    rawPath,
    GAME_CONFIG.PATHFINDING.MAX_SHORTCUT_DISTANCE,
  )
  const waypoints = smoothed
    .slice(1)
    .map(([col, row]) => gridToWorld(nav, col, row))
  waypoints[waypoints.length - 1] = {
    x: toWorld.x,
    y: toWorld.y ?? waypoints[waypoints.length - 1].y,
    z: toWorld.z,
  }
  return waypoints
}
