import { GAME_CONFIG } from '../gameConfig'

/**
 * Consultas da água (docs/features/057-lagos-e-rios.md). A água fica toda no
 * mesmo nível (`TERRAIN.WATER_LEVEL`); a profundidade num ponto é o quanto o
 * chão fica abaixo dele. Dois limites:
 * - **de cada corpo** (`wadeLimit`): até onde ele entra andando — uma
 *   fração (`WATER.WADE_FRACTION`) da altura dele; o Charmander entra menos
 *   que o treinador, a Caterpie quase nada. Mais funda que isso, a água o
 *   barra (`stepOutOfDeepWater`), e quanto mais perto do limite, mais
 *   devagar (`shallowSpeedFactor`);
 * - **o fundo** (`isDeepWater`, `WATER.NAV_DEPTH`): o trecho pequeno de
 *   raso por onde a IA navega; dali para baixo o pathfinding desvia, o que
 *   é arremessado afunda e ninguém nasce.
 *
 * Tudo puro: quem chama passa a altura do chão (`heightAt` do relevo do
 * nível, `TEST_LEVEL.terrain`).
 */

/** Profundidade (m) da água em `(x, z)`; 0 ou menos = terra seca. */
export function waterDepthAt(
  heightAt,
  x,
  z,
  waterLevel = GAME_CONFIG.TERRAIN.WATER_LEVEL,
) {
  return waterLevel - heightAt(x, z)
}

/**
 * A profundidade `depth` (m) já é o fundo — fora do trecho de raso da
 * navegação?
 */
export function isDeepWater(depth, params = GAME_CONFIG.WATER) {
  return depth > params.NAV_DEPTH
}

/** Até que profundidade (m) entra andando um corpo de `bodyHeight` m. */
export function wadeLimit(bodyHeight, params = GAME_CONFIG.WATER) {
  return bodyHeight * params.WADE_FRACTION
}

/**
 * Quanto da velocidade sobra na água (0 a 1): 1 na terra e na margem,
 * caindo até `SHALLOW_MIN_SPEED` no limite `limit` (m) de quem anda.
 */
export function shallowSpeedFactor(depth, limit, params = GAME_CONFIG.WATER) {
  if (depth <= 0) return 1
  const t = Math.min(depth / Math.max(limit, 1e-6), 1)
  return 1 - t * (1 - params.SHALLOW_MIN_SPEED)
}

/**
 * O passo `(dx, dz)` de quem está em `(x, z)` sem passar do limite `limit`
 * (m, o `wadeLimit` do corpo): a ponta do corpo (`reach` m à frente do
 * passo) não pode cair em água mais funda que o limite e que a de onde ele
 * está — assim quem já está fundo demais (um teleporte, um save antigo)
 * sempre consegue sair. Barrado de frente, desliza pelo eixo livre (como
 * numa parede); barrado nos dois, para.
 *
 * @param {(x: number, z: number) => number} depthAt - profundidade (m)
 * @returns {{ dx: number, dz: number }}
 */
export function stepOutOfDeepWater(x, z, dx, dz, depthAt, reach, limit) {
  const here = depthAt(x, z)
  const blocked = (stepX, stepZ) => {
    const length = Math.hypot(stepX, stepZ)
    if (length === 0) return false
    const scale = (length + reach) / length
    const ahead = depthAt(x + stepX * scale, z + stepZ * scale)
    return ahead > limit && ahead > here
  }
  if (!blocked(dx, dz)) return { dx, dz }
  if (Math.abs(dx) >= Math.abs(dz)) {
    if (!blocked(dx, 0)) return { dx, dz: 0 }
    if (!blocked(0, dz)) return { dx: 0, dz }
  } else {
    if (!blocked(0, dz)) return { dx: 0, dz }
    if (!blocked(dx, 0)) return { dx, dz: 0 }
  }
  return { dx: 0, dz: 0 }
}

// Quantas direções a consulta "perto de água" olha em volta do ponto.
const NEAR_WATER_DIRECTIONS = 8

/**
 * Tem água (qualquer profundidade) até `radius` m de `(x, z)`? É a tag
 * "perto de água" do spawn (060). Olha o ponto, um anel no raio e um na
 * metade dele.
 */
export function nearWaterAt(
  depthAt,
  x,
  z,
  radius = GAME_CONFIG.WATER.NEAR_RADIUS,
) {
  if (depthAt(x, z) > 0) return true
  for (const distance of [radius / 2, radius]) {
    for (let i = 0; i < NEAR_WATER_DIRECTIONS; i++) {
      const angle = (i / NEAR_WATER_DIRECTIONS) * Math.PI * 2
      const depth = depthAt(
        x + Math.cos(angle) * distance,
        z + Math.sin(angle) * distance,
      )
      if (depth > 0) return true
    }
  }
  return false
}

// Busca da margem: passo (m) entre os anéis, direções por anel e até onde
// procura (m) — mais que o lago mais largo.
const SHORE_SEARCH_STEP = 1
const SHORE_SEARCH_DIRECTIONS = 16
const SHORE_SEARCH_RADIUS = 400

/**
 * O ponto em terra seca mais perto de `(x, z)` se ele está em água mais
 * funda que `limit` (m; sem ele, o fundo da navegação — `isDeepWater`): um
 * save de antes dos lagos e rios, ou de um mundo regerado. Senão, o próprio
 * ponto. Sem terra até `SHORE_SEARCH_RADIUS`, fica onde está.
 *
 * @param {(x: number, z: number) => number} depthAt - profundidade (m)
 * @returns {{ x: number, z: number }}
 */
export function shoreNear(depthAt, x, z, limit) {
  const depth = depthAt(x, z)
  if (limit === undefined ? !isDeepWater(depth) : depth <= limit) {
    return { x, z }
  }
  for (
    let distance = SHORE_SEARCH_STEP;
    distance <= SHORE_SEARCH_RADIUS;
    distance += SHORE_SEARCH_STEP
  ) {
    for (let i = 0; i < SHORE_SEARCH_DIRECTIONS; i++) {
      const angle = (i / SHORE_SEARCH_DIRECTIONS) * Math.PI * 2
      const pointX = x + Math.cos(angle) * distance
      const pointZ = z + Math.sin(angle) * distance
      if (depthAt(pointX, pointZ) <= 0) return { x: pointX, z: pointZ }
    }
  }
  return { x, z }
}

/**
 * Onde o trajeto de `from` a `from + step` mergulha na água funda: o ponto
 * em que ele cruza a superfície (`WATER_LEVEL`) descendo, se ali a água é
 * funda; senão `null` (no raso, o objeto segue até o fundo, como em terra).
 *
 * @param {{ x: number, y: number, z: number }} from
 * @param {{ x: number, y: number, z: number }} step
 * @param {(x: number, z: number) => number} depthAt - profundidade (m)
 * @returns {{ x: number, y: number, z: number } | null}
 */
export function deepWaterEntry(
  from,
  step,
  depthAt,
  waterLevel = GAME_CONFIG.TERRAIN.WATER_LEVEL,
) {
  const toY = from.y + step.y
  if (from.y < waterLevel || toY > waterLevel || step.y >= 0) return null
  const t = (from.y - waterLevel) / (from.y - toY)
  const x = from.x + step.x * t
  const z = from.z + step.z * t
  if (!isDeepWater(depthAt(x, z))) return null
  return { x, y: waterLevel, z }
}

/** `(x, z)` fica sobre água funda? */
export function overDeepWater(depthAt, x, z) {
  return isDeepWater(depthAt(x, z))
}
