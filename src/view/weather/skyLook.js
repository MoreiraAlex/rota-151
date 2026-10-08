import { GAME_CONFIG } from '@/core/gameConfig'
import { hexToRgb } from '@/core/time/dayCycle'
import { WEATHER_TYPES } from '@/core/weather/weatherMap'

const luminance = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b
// Cinza do céu fechado: a mesma claridade da cor, um pouco mais escura.
const OVERCAST_GREY = 0.85
const toOvercast = (rgb, amount) => {
  const grey = luminance(rgb) * OVERCAST_GREY
  return rgb.map((value) => value + (grey - value) * amount)
}

/**
 * Quanto o céu está fechado (0 a 1): a soma, pela força de cada tipo de
 * clima agora, do quanto cada um fecha (`WEATHER.OVERCAST`).
 */
export function overcastOf(weather, params = GAME_CONFIG.WEATHER) {
  let total = 0
  for (const type of WEATHER_TYPES) {
    total += (weather[type] ?? 0) * (params.OVERCAST[type] ?? 0)
  }
  return Math.min(Math.max(total, 0), 1)
}

/**
 * Força do sol forte agora (0 a 1): a do clima vezes o quanto o sol está
 * acima do horizonte (`shadowIntensity`) — some no pôr do sol.
 */
export function sunnyOf(lighting, weather) {
  return (weather.sun ?? 0) * lighting.shadowIntensity
}

/**
 * A luz e o céu que a view aplica (docs/features/048-dia-noite-e-
 * clima.md): a luz da hora (`lightingAt`) com o clima por cima — o céu
 * fechado puxa as cores para o cinza, enfraquece a luz e esconde estrelas,
 * sol e lua; o sol forte deixa a luz do sol mais forte e mais quente e tira
 * as nuvens — e o clarão do relâmpago (`flash`, 0 a 1) acendendo a luz
 * ambiente. Só conta, sem Three.js.
 */
export function resolveSkyLook(lighting, weather, flash = 0) {
  const {
    OVERCAST_DIM,
    FLASH_STRENGTH,
    SUN_LIGHT_BOOST,
    SUN_TINT,
    SUN_TINT_AMOUNT,
  } = GAME_CONFIG.WEATHER
  const overcast = overcastOf(weather)
  const sunny = sunnyOf(lighting, weather)
  const dim = (1 - overcast * OVERCAST_DIM) * (1 + sunny * SUN_LIGHT_BOOST)
  const tint = hexToRgb(SUN_TINT)
  const sunLight = lighting.light.map(
    (value, i) => value + (tint[i] - value) * sunny * SUN_TINT_AMOUNT,
  )
  return {
    ...lighting,
    light: toOvercast(sunLight, overcast),
    ambient: toOvercast(lighting.ambient, overcast),
    skyTop: toOvercast(lighting.skyTop, overcast),
    horizon: toOvercast(lighting.horizon, overcast),
    lightIntensity: lighting.lightIntensity * dim,
    ambientIntensity:
      lighting.ambientIntensity * (1 - (overcast * OVERCAST_DIM) / 2) +
      flash * FLASH_STRENGTH,
    stars: lighting.stars * (1 - overcast),
    // Céu fechado: luz difusa, sombra mais fraca.
    shadowIntensity: lighting.shadowIntensity * (1 - overcast),
    // Quanto o sol e a lua aparecem no céu.
    celestial: 1 - overcast,
    overcast,
    flash,
    sunny,
    ...cloudLook(lighting, overcast, sunny, flash),
  }
}

// Parte da luz direta que chega à nuvem (o resto é a luz de todo lado).
const CLOUD_DIRECT_SHARE = 0.6
// O lado de baixo da nuvem, mais escuro que o de cima.
const CLOUD_SHADE = 0.6

/**
 * Nuvens (`GAME_CONFIG.CLOUDS`): cobertura entre a do dia limpo (menor com
 * sol forte) e a do céu fechado, pelo `overcast`; cor pela luz da hora —
 * brancas de dia, puxadas para o laranja no pôr do sol e escuras à noite.
 * Com o céu fechado, cinza.
 */
function cloudLook(lighting, overcast, sunny, flash) {
  const { COVER, OVERCAST_COVER } = GAME_CONFIG.CLOUDS
  const { SUN_CLOUD_COVER } = GAME_CONFIG.WEATHER
  // Sol forte: o céu limpo fica quase sem nuvem.
  const clearCover = COVER + (SUN_CLOUD_COVER - COVER) * sunny
  const lit = lighting.ambient.map((value, i) =>
    Math.min(
      1,
      value * lighting.ambientIntensity +
        lighting.light[i] * lighting.lightIntensity * CLOUD_DIRECT_SHARE +
        flash,
    ),
  )
  const cloudLit = toOvercast(lit, overcast)
  return {
    cloudCover: clearCover + (OVERCAST_COVER - clearCover) * overcast,
    cloudLit,
    cloudShade: cloudLit.map((value) => value * CLOUD_SHADE),
  }
}
