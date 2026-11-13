import { clamp, smoothstep } from '../math'

/**
 * Platôs com barranco e rampa (docs/features/066-revisao-dos-biomas.md):
 * o relevo de um bioma com `relief.terraces` sobe em degraus — patamares
 * de topo quase plano, ligados por uma faixa estreita e íngreme (o
 * barranco, que a encosta do terreno pinta com outra textura). Em manchas
 * pela seed (`ramps`), o degrau não acontece e o chão sobe suave: os
 * caminhos até o topo.
 *
 * @typedef {object} Terraces - o `relief.terraces` do bioma
 * @property {number} step - altura (m) de um patamar ao outro
 * @property {number} cliff - quanto da subida vira barranco (0 a 1): 0 =
 *   sem degrau (o relevo de sempre), 1 = barranco seco
 * @property {number} tilt - quanto do declive natural fica no topo do
 *   patamar (0 a 1): o topo nunca é plano de todo — o Rapier erra raios em
 *   célula plana do relevo (docs/roadmap.md, 090)
 * @property {number} ramps - parte do chão (0 a 1) onde o degrau vira
 *   rampa
 * @property {number} rampSize - largura típica (m) de uma rampa
 */

// Faixa (fração da subida de um patamar) que o barranco ocupa com `cliff`
// no máximo — nunca zero: o barranco ainda tem largura na malha.
const NARROWEST_CLIFF = 0.06
// Largura da borda da mancha de rampa (0 a 1 do ruído).
const RAMP_EDGE = 0.15

/**
 * A faixa (fração da subida de um patamar ao outro, 0 a 1) que o barranco
 * ocupa com `cliff` (0 a 1): estreita com ele, nunca zero.
 */
export function cliffBand(cliff) {
  return 1 - (1 - NARROWEST_CLIFF) * clamp(cliff, 0, 1)
}

/**
 * A altura em degraus de `height` (m acima da água): patamares de `step` m,
 * a subida de cada um concentrada numa faixa (o barranco), com `tilt` do
 * declive natural no topo.
 */
export function terraceHeight(height, { step, cliff, tilt }) {
  if (!(step > 0) || !(cliff > 0)) return height
  const level = height / step
  const base = Math.floor(level)
  const within = level - base
  // A subida acontece no fim de cada patamar, numa faixa que estreita com
  // `cliff` (1 = a mais estreita).
  const band = cliffBand(cliff)
  const rise = smoothstep(1 - band, 1, within)
  const stepped = (base + rise) * step
  return stepped + (height - stepped) * clamp(tilt, 0, 1)
}

/**
 * Quanto o ponto é rampa (0 a 1), pelo ruído de rampa `rampNoise` (0 a 1)
 * do lugar: a parte `ramps` do chão de maior ruído.
 */
export function rampShareAt(rampNoise, ramps) {
  if (!(ramps > 0)) return 0
  const threshold = 1 - clamp(ramps, 0, 1)
  return smoothstep(
    threshold - RAMP_EDGE / 2,
    threshold + RAMP_EDGE / 2,
    rampNoise,
  )
}

/**
 * A altura do bioma com os degraus: os patamares (`terraceHeight`) e, onde
 * é rampa (`rampShare`), a altura natural de volta — a subida suave.
 */
export function terracedHeight(height, terraces, rampShare) {
  const stepped = terraceHeight(height, terraces)
  return stepped + (height - stepped) * clamp(rampShare, 0, 1)
}
