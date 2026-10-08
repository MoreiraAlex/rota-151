import { describe, expect, it } from 'vitest'
import { GAME_CONFIG } from '../gameConfig'
import {
  dayPhaseOf,
  hexToRgb,
  hourOf,
  isDaytime,
  lightingAt,
  moonDirection,
  sunDirection,
} from './dayCycle'

// Dia e noite (docs/features/048-dia-noite-e-clima.md). As regras valem
// para a config do jogo — nada de cor ou hora fixada aqui.
const PARAMS = GAME_CONFIG.DAY_CYCLE
const HOURS = 24
const atHour = (hour, day = 0) => day + hour / HOURS
const length = ({ x, y, z }) => Math.hypot(x, y, z)

describe('hourOf', () => {
  it('a hora só depende da fração do dia', () => {
    expect(hourOf(atHour(13))).toBeCloseTo(13)
    expect(hourOf(atHour(13, 5))).toBeCloseTo(13)
    expect(hourOf(0)).toBe(0)
  })
})

describe('dayPhaseOf', () => {
  const phases = Object.entries(PARAMS.PHASES).sort((a, b) => a[1] - b[1])

  it('cada fase começa na hora dela e segue até a próxima', () => {
    phases.forEach(([phase, start], i) => {
      const end = phases[i + 1]?.[1] ?? HOURS
      expect(dayPhaseOf(atHour(start))).toBe(phase)
      expect(dayPhaseOf(atHour((start + end) / 2))).toBe(phase)
    })
  })

  it('antes da primeira fase ainda é a última (a noite da véspera)', () => {
    const [, firstStart] = phases[0]
    const [lastPhase] = phases[phases.length - 1]
    expect(dayPhaseOf(atHour(firstStart / 2))).toBe(lastPhase)
  })

  it('as 24 horas sempre caem numa fase', () => {
    for (let hour = 0; hour < HOURS; hour += 0.25) {
      expect(Object.keys(PARAMS.PHASES)).toContain(dayPhaseOf(atHour(hour)))
    }
  })
})

describe('sol e lua', () => {
  it('o sol fica acima do horizonte de dia e abaixo à noite', () => {
    const middayHour = (PARAMS.SUNRISE + PARAMS.SUNSET) / 2
    const midnightHour = (middayHour + HOURS / 2) % HOURS
    expect(sunDirection(atHour(middayHour)).y).toBeGreaterThan(0)
    expect(sunDirection(atHour(midnightHour)).y).toBeLessThan(0)
    expect(sunDirection(atHour(PARAMS.SUNRISE)).y).toBeCloseTo(0)
    expect(sunDirection(atHour(PARAMS.SUNSET)).y).toBeCloseTo(0)
  })

  it('isDaytime: entre o nascer e o pôr do sol', () => {
    const middayHour = (PARAMS.SUNRISE + PARAMS.SUNSET) / 2
    expect(isDaytime(atHour(middayHour))).toBe(true)
    expect(isDaytime(atHour((middayHour + HOURS / 2) % HOURS))).toBe(false)
  })

  it('nasce de um lado e se põe do outro', () => {
    const rise = sunDirection(atHour(PARAMS.SUNRISE))
    const set = sunDirection(atHour(PARAMS.SUNSET))
    expect(Math.sign(rise.x)).toBe(-Math.sign(set.x))
  })

  it('direções têm tamanho 1 e a lua é o oposto do sol', () => {
    for (let hour = 0; hour < HOURS; hour += 1.5) {
      const sun = sunDirection(atHour(hour))
      const moon = moonDirection(atHour(hour))
      expect(length(sun)).toBeCloseTo(1)
      expect(moon.x).toBeCloseTo(-sun.x)
      expect(moon.y).toBeCloseTo(-sun.y)
      expect(moon.z).toBeCloseTo(-sun.z)
    }
  })
})

describe('lightingAt', () => {
  const STEP = 1 / (HOURS * 60) // um minuto
  const maxColorJump = (a, b) =>
    Math.max(
      ...['light', 'ambient', 'skyTop', 'horizon'].flatMap((field) =>
        a[field].map((value, i) => Math.abs(value - b[field][i])),
      ),
    )

  it('nas horas marcadas, devolve as cores da config', () => {
    for (const keyframe of PARAMS.KEYFRAMES) {
      const lighting = lightingAt(atHour(keyframe.hour))
      hexToRgb(keyframe.skyTop).forEach((value, i) =>
        expect(lighting.skyTop[i]).toBeCloseTo(value),
      )
      expect(lighting.ambientIntensity).toBeCloseTo(keyframe.ambientIntensity)
      expect(lighting.stars).toBeCloseTo(keyframe.stars)
    }
  })

  it('sem salto entre minutos vizinhos, inclusive na meia-noite', () => {
    let previous = lightingAt(0)
    for (let time = STEP; time <= 1 + STEP; time += STEP) {
      const current = lightingAt(time)
      expect(maxColorJump(previous, current)).toBeLessThan(0.05)
      expect(
        Math.abs(current.lightIntensity - previous.lightIntensity),
      ).toBeLessThan(0.05)
      previous = current
    }
  })

  it('a luz direta apaga no horizonte (troca de sol para lua sem salto)', () => {
    expect(lightingAt(atHour(PARAMS.SUNRISE)).lightIntensity).toBeCloseTo(0)
    expect(lightingAt(atHour(PARAMS.SUNSET)).lightIntensity).toBeCloseTo(0)
  })

  it('a luz vem de cima: do sol de dia e da lua à noite', () => {
    for (let hour = 0; hour < HOURS; hour += 0.5) {
      const lighting = lightingAt(atHour(hour))
      expect(lighting.lightDirection.y).toBeGreaterThanOrEqual(-1e-9)
    }
    const middayHour = (PARAMS.SUNRISE + PARAMS.SUNSET) / 2
    const midday = lightingAt(atHour(middayHour))
    expect(midday.lightDirection).toEqual(midday.sun)
    const midnight = lightingAt(atHour((middayHour + HOURS / 2) % HOURS))
    expect(midnight.lightDirection).toEqual(midnight.moon)
  })

  it('só o sol faz sombra: cheia de dia, nenhuma à noite', () => {
    const middayHour = (PARAMS.SUNRISE + PARAMS.SUNSET) / 2
    expect(lightingAt(atHour(middayHour)).shadowIntensity).toBeCloseTo(1)
    for (let hour = 0; hour < HOURS; hour += 0.25) {
      const lighting = lightingAt(atHour(hour))
      if (lighting.sun.y <= 0) expect(lighting.shadowIntensity).toBe(0)
    }
  })

  it('o meio-dia é mais claro que a meia-noite', () => {
    const middayHour = (PARAMS.SUNRISE + PARAMS.SUNSET) / 2
    const midday = lightingAt(atHour(middayHour))
    const midnight = lightingAt(atHour((middayHour + HOURS / 2) % HOURS))
    expect(midday.ambientIntensity).toBeGreaterThan(midnight.ambientIntensity)
    expect(midday.stars).toBeLessThan(midnight.stars)
  })
})
