import { GAME_CONFIG } from '../gameConfig'
import { GraphicsSettings } from '../traits'

/**
 * Gráficos escolhidos pelo jogador (docs/features/066-revisao-dos-
 * biomas.md).
 */

/** Os níveis de sombra, do mais leve ao mais bonito. */
export const SHADOW_LEVELS = Object.keys(GAME_CONFIG.GRAPHICS.SHADOW.LEVELS)

/**
 * Põe o nível da sombra do `trainer` em `level` (um de `SHADOW_LEVELS`).
 * Nível desconhecido não muda nada. Devolve se mudou.
 */
export function definirSombra(trainer, level) {
  if (!trainer?.has?.(GraphicsSettings)) return false
  if (!SHADOW_LEVELS.includes(level)) return false
  const current = trainer.get(GraphicsSettings)
  if (current.shadow === level) return false
  trainer.set(GraphicsSettings, { ...current, shadow: level })
  return true
}

/**
 * Os números do nível de sombra `level` (`GAME_CONFIG.GRAPHICS.SHADOW.LEVELS`);
 * nível desconhecido ou ausente, os do padrão.
 */
export function shadowLevelOf(level) {
  const { LEVELS, DEFAULT } = GAME_CONFIG.GRAPHICS.SHADOW
  return LEVELS[level] ?? LEVELS[DEFAULT]
}

/** As proporções do canvas, a da janela primeiro. */
export const ASPECT_LEVELS = Object.keys(GAME_CONFIG.GRAPHICS.ASPECT.LEVELS)

/**
 * Põe a proporção do canvas do `trainer` em `level` (um de
 * `ASPECT_LEVELS`). Nível desconhecido não muda nada. Devolve se mudou.
 */
export function definirProporcao(trainer, level) {
  if (!trainer?.has?.(GraphicsSettings)) return false
  if (!ASPECT_LEVELS.includes(level)) return false
  const current = trainer.get(GraphicsSettings)
  if (current.aspect === level) return false
  trainer.set(GraphicsSettings, { ...current, aspect: level })
  return true
}

/**
 * Largura ÷ altura do canvas na proporção `level`, ou `null` para seguir a
 * da janela. Nível desconhecido ou ausente, o padrão.
 */
export function aspectRatioOf(level) {
  const { LEVELS, DEFAULT } = GAME_CONFIG.GRAPHICS.ASPECT
  return (LEVELS[level] ?? LEVELS[DEFAULT]).RATIO
}

/**
 * O tamanho do canvas `scale` (fração do lado) dentro do que o jogo aceita:
 * entre `GRAPHICS.CANVAS_SIZE.MIN` e a janela toda, no passo `STEP`. Valor
 * que não é número, o padrão.
 */
export function canvasScaleOf(scale) {
  const { DEFAULT, MIN, STEP } = GAME_CONFIG.GRAPHICS.CANVAS_SIZE
  if (!Number.isFinite(scale)) return DEFAULT
  const snapped = Number((Math.round(scale / STEP) * STEP).toFixed(6))
  return Math.min(1, Math.max(MIN, snapped))
}

/**
 * Põe o tamanho do canvas do `trainer` em `scale` (fração do lado, ajustada
 * por `canvasScaleOf`). Valor que não é número não muda nada. Devolve se
 * mudou.
 */
export function definirTamanhoDaTela(trainer, scale) {
  if (!trainer?.has?.(GraphicsSettings)) return false
  if (!Number.isFinite(scale)) return false
  const canvasScale = canvasScaleOf(scale)
  const current = trainer.get(GraphicsSettings)
  if (current.canvasScale === canvasScale) return false
  trainer.set(GraphicsSettings, { ...current, canvasScale })
  return true
}

/**
 * A distância de visão `chunks` (o raio carregado, em chunks) dentro do que
 * o jogo aceita: um inteiro entre `GRAPHICS.VIEW_DISTANCE.MIN` e `MAX`.
 * Valor que não é número, o padrão.
 */
export function viewDistanceOf(chunks) {
  const { DEFAULT, MIN, MAX } = GAME_CONFIG.GRAPHICS.VIEW_DISTANCE
  if (!Number.isFinite(chunks)) return DEFAULT
  return Math.min(MAX, Math.max(MIN, Math.round(chunks)))
}

/**
 * Põe a distância de visão do `trainer` em `chunks` (ajustada por
 * `viewDistanceOf`). Valor que não é número não muda nada. Devolve se
 * mudou.
 */
export function definirDistanciaDeVisao(trainer, chunks) {
  if (!trainer?.has?.(GraphicsSettings)) return false
  if (!Number.isFinite(chunks)) return false
  const viewDistance = viewDistanceOf(chunks)
  const current = trainer.get(GraphicsSettings)
  if (current.viewDistance === viewDistance) return false
  trainer.set(GraphicsSettings, { ...current, viewDistance })
  return true
}

/**
 * O tamanho (px, inteiros) do canvas num espaço de `width`×`height`: o maior
 * retângulo na proporção `ratio` (`null` = a do espaço) que cabe nele,
 * reduzido no tamanho `scale`.
 */
export function canvasSizeOf(width, height, ratio, scale) {
  let fitWidth = width
  let fitHeight = height
  if (ratio && width > 0 && height > 0) {
    if (width / height > ratio) fitWidth = height * ratio
    else fitHeight = width / ratio
  }
  const size = canvasScaleOf(scale)
  return {
    width: Math.round(fitWidth * size),
    height: Math.round(fitHeight * size),
  }
}
