import { GAME_CONFIG } from '../gameConfig'
import { smoothstep } from '../math'

/**
 * Dia e noite (docs/features/048-dia-noite-e-clima.md): só contas, sem
 * estado. O horário (`time`) é medido em dias de jogo — a parte inteira são
 * os dias que já passaram, a fração é a hora do dia (`WorldClock`). Quem
 * aplica a luz e o céu é a view.
 *
 * `params` tem a forma de `GAME_CONFIG.DAY_CYCLE` — os testes passam outros.
 */

const HOURS_PER_DAY = 24
const PHASE_ORDER = ['dawn', 'day', 'dusk', 'night']

/** Fração do dia (0 a 1) do horário `time`. */
export function dayFraction(time) {
  return time - Math.floor(time)
}

/** Hora do dia (0 a 24) do horário `time`. */
export function hourOf(time) {
  return dayFraction(time) * HOURS_PER_DAY
}

/**
 * Fase do dia: `'dawn'` | `'day'` | `'dusk'` | `'night'`, pela hora em que
 * cada uma começa (`params.PHASES`). Antes da primeira, ainda é a última
 * (a noite que vem da véspera).
 */
export function dayPhaseOf(time, params = GAME_CONFIG.DAY_CYCLE) {
  const hour = hourOf(time)
  let current = PHASE_ORDER[PHASE_ORDER.length - 1]
  for (const phase of PHASE_ORDER) {
    if (hour >= params.PHASES[phase]) current = phase
  }
  return current
}

/**
 * Direção (vetor de tamanho 1, apontando PARA o sol) na hora do horário
 * `time`. O sol nasce no `+x` em `SUNRISE`, passa pelo alto (inclinado
 * `SUN_TILT` para `+z`) e se põe no `-x` em `SUNSET`; na outra metade do dia
 * ele está abaixo do horizonte (`y < 0`).
 */
export function sunDirection(time, params = GAME_CONFIG.DAY_CYCLE) {
  const { SUNRISE, SUNSET, SUN_TILT } = params
  const hour = hourOf(time)
  const dayLength = SUNSET - SUNRISE
  const nightLength = HOURS_PER_DAY - dayLength
  // Ângulo no caminho: 0 no nascer, π no pôr, 2π no próximo nascer.
  const sinceRise = (hour - SUNRISE + HOURS_PER_DAY) % HOURS_PER_DAY
  const angle =
    sinceRise <= dayLength
      ? (sinceRise / dayLength) * Math.PI
      : Math.PI + ((sinceRise - dayLength) / nightLength) * Math.PI
  const up = Math.sin(angle)
  return {
    x: Math.cos(angle),
    y: up * Math.cos(SUN_TILT),
    z: up * Math.sin(SUN_TILT),
  }
}

/** Se o sol está acima do horizonte no horário `time`. */
export function isDaytime(time, params = GAME_CONFIG.DAY_CYCLE) {
  return sunDirection(time, params).y > 0
}

/** Direção da lua: o lado oposto do sol. */
export function moonDirection(time, params = GAME_CONFIG.DAY_CYCLE) {
  const sun = sunDirection(time, params)
  return { x: -sun.x, y: -sun.y, z: -sun.z }
}

/** `'#rrggbb'` → `[r, g, b]` de 0 a 1. */
export function hexToRgb(hex) {
  const value = parseInt(hex.slice(1), 16)
  return [
    ((value >> 16) & 255) / 255,
    ((value >> 8) & 255) / 255,
    (value & 255) / 255,
  ]
}

const mix = (a, b, t) => a + (b - a) * t
const mixRgb = (a, b, t) => a.map((value, i) => mix(value, b[i], t))

const COLOR_FIELDS = ['light', 'ambient', 'skyTop', 'horizon']
const NUMBER_FIELDS = ['lightIntensity', 'ambientIntensity', 'stars']

/**
 * Os dois `KEYFRAMES` em volta da `hour` e quanto (0 a 1) já se andou do
 * primeiro para o segundo — dando a volta na meia-noite.
 */
function surroundingKeyframes(keyframes, hour) {
  const last = keyframes.length - 1
  for (let i = 0; i < last; i++) {
    const from = keyframes[i]
    const to = keyframes[i + 1]
    if (hour >= from.hour && hour < to.hour) {
      return { from, to, t: (hour - from.hour) / (to.hour - from.hour) }
    }
  }
  // Entre o último e o primeiro (do dia seguinte).
  const from = keyframes[last]
  const to = keyframes[0]
  const span = to.hour + HOURS_PER_DAY - from.hour
  const since = (hour - from.hour + HOURS_PER_DAY) % HOURS_PER_DAY
  return { from, to, t: span > 0 ? since / span : 0 }
}

/**
 * A luz e o céu no horário `time`, misturando as horas marcadas
 * (`KEYFRAMES`) em volta dele:
 *
 * - cores (`light`, `ambient`, `skyTop`, `horizon`) como `[r, g, b]` de 0 a
 *   1, e `lightIntensity`, `ambientIntensity` e `stars`;
 * - `lightDirection`: o sol enquanto ele está acima do horizonte, senão a
 *   lua (apontando PARA ela);
 * - `lightIntensity` já vem apagando perto do horizonte
 *   (`LIGHT_FADE_HEIGHT`): na troca de sol para lua a luz direta passa por
 *   zero, e a sombra não pula de lado.
 * - `shadowIntensity` (0 a 1): só o sol faz sombra — some quando ele chega
 *   ao horizonte e fica em zero a noite toda (a luz da lua não tem sombra).
 * - `sun` e `moon`: as direções dos dois, para o céu desenhar.
 */
export function lightingAt(time, params = GAME_CONFIG.DAY_CYCLE) {
  const { from, to, t } = surroundingKeyframes(params.KEYFRAMES, hourOf(time))
  const lighting = {}
  for (const field of COLOR_FIELDS) {
    lighting[field] = mixRgb(hexToRgb(from[field]), hexToRgb(to[field]), t)
  }
  for (const field of NUMBER_FIELDS) {
    lighting[field] = mix(from[field], to[field], t)
  }

  const sun = sunDirection(time, params)
  const moon = moonDirection(time, params)
  const source = sun.y >= 0 ? sun : moon
  lighting.lightDirection = source
  lighting.lightIntensity *= smoothstep(0, params.LIGHT_FADE_HEIGHT, source.y)
  lighting.shadowIntensity = smoothstep(0, params.LIGHT_FADE_HEIGHT, sun.y)
  lighting.sun = sun
  lighting.moon = moon
  return lighting
}
