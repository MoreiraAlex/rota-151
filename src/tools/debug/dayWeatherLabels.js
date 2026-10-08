/** Nomes da fase do dia e do clima no debug (F2). */
export const DAY_PHASE_LABELS = {
  dawn: 'amanhecer',
  day: 'dia',
  dusk: 'entardecer',
  night: 'noite',
}

export const WEATHER_LABELS = {
  clear: 'limpo',
  sun: 'sol forte',
  rain: 'chuva',
  storm: 'tempestade',
  snow: 'neve',
}

/** Hora do dia (0 a 24) como `hh:mm`. */
export function formatHour(hour) {
  const minutes = Math.floor(hour * 60) % (24 * 60)
  const pad = (value) => String(value).padStart(2, '0')
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`
}
