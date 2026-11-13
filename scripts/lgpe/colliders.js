#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { readGlbPositions } from './glb.js'

/**
 * Os colisores dos props sólidos do LGPE (docs/features/052-assets-do-lgpe-
 * e-floresta.md): lê os `.glb` já empacotados (`pack-lgpe.js`) e grava, por
 * prop de árvore ou pedra, os pontos de um casco convexo que segue a malha
 * — o core monta o colisor com eles (`core/physics/colliders.js`), sem
 * carregar modelo.
 *
 * - **Pedra**: o casco da pedra inteira.
 * - **Prédio e objeto de rua** (docs/features/056-bioma-cidade.md): o casco
 *   do modelo inteiro, sem as peças achatadas (`FLAT`, o piso da entrada
 *   — senão o casco vira rampa até a parede), e a caixa dele no chão
 *   (`box`: a pegada retangular).
 * - **Anel** (`RINGS`, docs/features/069-revisao-do-bioma-cidade.md): o
 *   objeto oco (a fonte da praça) colide só na borda — `ring: { inner,
 *   outer, height }` (m, no tamanho do modelo), que o core monta em caixas
 *   em volta (`core/physics/colliders.js`); dentro dela, nada (dá para
 *   entrar na água). O casco (`points`) e a caixa no chão (`box`, a
 *   pegada) seguem iguais.
 * - **Moldura** (`FRAMES`, a mesma feature): o objeto oco retangular (o
 *   canteiro de tronco) colide só na moldura — `frame: { inner: [minX,
 *   minZ, maxX, maxZ], height }` (m, no tamanho do modelo), o vão de
 *   dentro; a moldura vai dele até a caixa no chão (`box`). Dentro, nada
 *   (dá para entrar no canteiro).
 * - **Árvore**: só o tronco — os vértices abaixo da copa (a copa começa no
 *   vértice mais baixo longe do eixo, `CROWN_REACH`, acima das raízes) —,
 *   com a ponta dele
 *   esticada até o alto do modelo: a coluna sobe por dentro da copa, sem
 *   degrau para subir em cima.
 *
 * O casco sai reduzido: só os pontos mais longe em cada uma de
 * `DIRECTIONS` direções (todos vértices do casco de verdade).
 *
 * Lê também os pacotes de fora que o jogo usa (`--packs`, a pasta de
 * `public/assets/vegetation/packs/`, docs/features/066-revisao-dos-
 * biomas.md), no mesmo formato.
 *
 * Grava `src/core/data/lgpeColliders.json`: id →
 * `{ points: [x, y, z, ...], reach, box? }` (m, no tamanho do modelo;
 * `reach` é o maior afastamento do eixo no chão — a pegada; `box`, só nos
 * prédios e objetos de rua, é `[minX, minZ, maxX, maxZ]`).
 *
 * Uso:
 *   node scripts/lgpe/colliders.js
 */

const { values: args } = parseArgs({
  options: {
    lgpe: { type: 'string', default: 'public/assets/vegetation/lgpe' },
    packs: { type: 'string', default: 'public/assets/vegetation/packs' },
    out: { type: 'string', default: 'src/core/data/lgpeColliders.json' },
  },
})

// Afastamento do eixo (m) a partir do qual o vértice já é copa — acima
// das raízes (`ROOTS`, m), que também abrem para os lados.
const CROWN_REACH = 0.9
const ROOTS = 0.5
// Parte de cima do tronco (fração da altura dele) que vira a coluna.
const TRUNK_TOP = 0.5
// Direções em que o casco é amostrado.
const DIRECTIONS = 96
const DECIMALS = 3
// Os objetos ocos que colidem só na borda: o raio de dentro e o de fora
// da borda e a altura dela (m, no tamanho do modelo — medidos na malha).
const RINGS = { fountain: { inner: 1.36, outer: 1.7, height: 0.65 } }
// Os objetos ocos retangulares que colidem só na moldura: o vão de dentro
// e a altura dela (m, no tamanho do modelo — medidos na malha).
const FRAMES = {
  'log-flower-bed': { inner: [-2.016, -1.324, 2.026, 1.27], height: 0.36 },
}

const SOLID_CATEGORIES = new Set(['tree', 'rock', 'building', 'street'])
// Os da cidade: casco inteiro e caixa no chão.
const BOX_CATEGORIES = new Set(['building', 'street'])
// Altura (m) abaixo da qual uma peça é achatada (piso) e não colide.
const FLAT = 0.1

// Direções espalhadas por igual na esfera (espiral de Fibonacci).
function sphereDirections(count) {
  const golden = Math.PI * (3 - Math.sqrt(5))
  return Array.from({ length: count }, (_, i) => {
    const y = 1 - ((i + 0.5) / count) * 2
    const ring = Math.sqrt(1 - y * y)
    return [Math.cos(golden * i) * ring, y, Math.sin(golden * i) * ring]
  })
}

/** Os pontos do casco: o mais longe em cada direção, sem repetir. */
export function hullPoints(points, directions = sphereDirections(DIRECTIONS)) {
  const kept = new Set()
  for (const [dx, dy, dz] of directions) {
    let best = 0
    let bestDot = -Infinity
    points.forEach(([x, y, z], index) => {
      const dot = x * dx + y * dy + z * dz
      if (dot > bestDot) {
        bestDot = dot
        best = index
      }
    })
    kept.add(best)
  }
  return [...kept].map((index) => points[index])
}

/** Os pontos do tronco de uma árvore, com a coluna até `top`. */
export function trunkPoints(points, top) {
  const crownBase = Math.min(
    ...points
      .filter(([x, y, z]) => y > ROOTS && Math.hypot(x, z) > CROWN_REACH)
      .map(([, y]) => y),
  )
  const trunk = points.filter(([, y]) => y < crownBase)
  if (trunk.length === 0) return points
  const trunkTop = Math.max(...trunk.map(([, y]) => y))
  const column = trunk
    .filter(([, y]) => y >= trunkTop * TRUNK_TOP)
    .map(([x, , z]) => [x, top, z])
  return [...trunk, ...column]
}

function pointsOf(primitives) {
  const points = []
  for (const { position } of primitives) {
    for (let i = 0; i < position.length; i += 3) {
      points.push([position[i], position[i + 1], position[i + 2]])
    }
  }
  return points
}

const round = (value) => Number(value.toFixed(DECIMALS))

// Sem as peças achatadas (o piso da entrada dos prédios).
function standingParts(primitives) {
  return primitives.filter(({ position }) => {
    let min = Infinity
    let max = -Infinity
    for (let i = 1; i < position.length; i += 3) {
      min = Math.min(min, position[i])
      max = Math.max(max, position[i])
    }
    return max - min >= FLAT
  })
}

function boxColliderOf(primitives) {
  const hull = hullPoints(pointsOf(standingParts(primitives)))
  const xs = hull.map(([x]) => x)
  const zs = hull.map(([, , z]) => z)
  return {
    points: hull.flat().map(round),
    reach: round(Math.max(...hull.map(([x, , z]) => Math.hypot(x, z)))),
    box: [
      Math.min(...xs),
      Math.min(...zs),
      Math.max(...xs),
      Math.max(...zs),
    ].map(round),
  }
}

function colliderOf(id, prop, primitives) {
  if (BOX_CATEGORIES.has(prop.category)) {
    const collider = boxColliderOf(primitives)
    if (RINGS[id]) return { ...collider, ring: RINGS[id] }
    if (FRAMES[id]) return { ...collider, frame: FRAMES[id] }
    return collider
  }
  const points = pointsOf(primitives)
  const top = Math.max(...points.map(([, y]) => y))
  const solid = prop.category === 'tree' ? trunkPoints(points, top) : points
  const hull = hullPoints(solid)
  return {
    points: hull.flat().map(round),
    reach: round(Math.max(...hull.map(([x, , z]) => Math.hypot(x, z)))),
  }
}

// O LGPE e os pacotes do jogo (cada um na pasta dele).
const packsList = join(args.packs, 'packs.json')
const dirs = [
  args.lgpe,
  ...(existsSync(packsList)
    ? JSON.parse(readFileSync(packsList, 'utf8')).map((id) =>
        join(args.packs, id),
      )
    : []),
]
const colliders = {}
for (const dir of dirs) {
  const manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'))
  for (const [id, prop] of Object.entries(manifest.props)) {
    if (!SOLID_CATEGORIES.has(prop.category)) continue
    const primitives = readGlbPositions(readFileSync(join(dir, prop.file)))
    colliders[id] = colliderOf(id, prop, primitives)
    console.log(
      `${id.padEnd(24)} ${colliders[id].points.length / 3} pontos, alcance ${colliders[id].reach} m`,
    )
  }
}
// Um prop por linha (os pontos não cabem um por linha).
const lines = Object.entries(colliders).map(
  ([id, collider]) => `  ${JSON.stringify(id)}: ${JSON.stringify(collider)}`,
)
writeFileSync(args.out, `{\n${lines.join(',\n')}\n}\n`)
