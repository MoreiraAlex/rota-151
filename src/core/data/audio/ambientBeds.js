/**
 * Som ambiente do mundo (docs/features/065-sons-do-mundo.md, Parte 4),
 * tocado por `view/systems/ambientBedSystem.js`. Do BigSoundBank (CC0),
 * convertidos por `scripts/audio/sons-do-mundo.sh` (os fundos emendados
 * pra repetir sem clique). As rajadas de vento são as da 019.
 *
 * - `AMBIENT_BEDS`: os fundos em loop (`path`, `volume`).
 * - `BIOME_AMBIENCE`: o fundo de cada bioma de dia e de noite. Bioma sem
 *   entrada (os escondidos, só vistos pelo F2) usa o do
 *   `AMBIENT_FALLBACK_BIOME`.
 * - `AMBIENT_ONE_SHOTS`: sons avulsos que tocam de vez em quando por cima
 *   do fundo. Por som: `files` (variações; uma é sorteada), `volume`,
 *   `interval` (s, sorteado entre `min` e `max` a cada vez), `biomes` (onde
 *   tocam), `time` (`'day'` ou `'night'`) e, pra quem vem de um ponto do
 *   mundo, `spatial` (alcance, a que distância e altura do jogador ele
 *   nasce). Só toca se o lugar e a hora batem com ele (`oneShotPresence`,
 *   `core/audio/ambience.js`).
 */
const AMBIENT_DIR = '/assets/audio/ambient'

export const AMBIENT_BEDS = {
  'forest-day': { path: `${AMBIENT_DIR}/forest-day.ogg`, volume: 0.5 },
  'plains-day': { path: `${AMBIENT_DIR}/plains-day.ogg`, volume: 0.5 },
  'savanna-day': { path: `${AMBIENT_DIR}/savanna-day.ogg`, volume: 0.35 },
  night: { path: `${AMBIENT_DIR}/night.ogg`, volume: 0.45 },
  city: { path: `${AMBIENT_DIR}/city.ogg`, volume: 0.4 },
}

export const BIOME_AMBIENCE = {
  forest: { day: 'forest-day', night: 'night' },
  plains: { day: 'plains-day', night: 'night' },
  savanna: { day: 'savanna-day', night: 'night' },
  city: { day: 'city', night: 'night' },
}

export const AMBIENT_FALLBACK_BIOME = 'plains'

export const AMBIENT_ONE_SHOTS = {
  owl: {
    files: [`${AMBIENT_DIR}/owl-01.ogg`, `${AMBIENT_DIR}/owl-02.ogg`],
    volume: 0.5,
    interval: { min: 40, max: 120 },
    biomes: ['forest', 'plains'],
    time: 'night',
    spatial: {
      refDistance: 8,
      maxDistance: 45,
      distance: { min: 15, max: 30 },
      // Altura (m) acima do jogador: vem do alto, das árvores.
      height: 6,
    },
  },
  gust: {
    files: [`${AMBIENT_DIR}/wind-01.wav`, `${AMBIENT_DIR}/wind-02.wav`],
    volume: 0.05,
    interval: { min: 6, max: 18 },
    biomes: ['plains', 'savanna'],
    time: 'day',
  },
}

export const AMBIENCE = {
  // Faixa da altura do sol (y da direção do sol, `sunDirection`) em que o
  // fundo de dia passa pro de noite: abaixo do mínimo é noite, acima do
  // máximo é dia, no meio os dois se misturam (amanhecer e entardecer).
  TWILIGHT: { min: -0.15, max: 0.1 },
  // Quanto tempo (s) o volume de cada fundo leva pra chegar no novo valor —
  // a borda de bioma e a chuva mudam sem salto.
  LEVEL_SMOOTHING: 1.5,
  // De quanto em quanto tempo (s) os pesos dos biomas em volta são lidos de
  // novo — não precisa ser todo frame.
  PROBE_INTERVAL: 0.5,
  // Quanto a chuva (e a tempestade) baixa o fundo de dia: com a chuva no
  // máximo, os pássaros e as cigarras ficam nessa fração a menos.
  RAIN_DUCKING: 0.75,
  // Abaixo dessa presença (lugar × hora), o som avulso não toca.
  ONE_SHOT_MIN_PRESENCE: 0.3,
}
