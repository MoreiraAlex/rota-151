/**
 * Sons da água (docs/features/057-lagos-e-rios.md) — da mesma biblioteca de
 * passos (`.exemple/Steps/Steps/`, `WaterFootStep*`).
 *
 * - `splash`: algo afundando (bola, fruta) — `files` (variações; uma é
 *   sorteada), `volume` (0-1) e `refDistance` (m), como os da Pokébola;
 * - `step`: o passo de quem anda no raso, no lugar do passo da espécie —
 *   `walk`/`run` (variações), com o volume e o alcance do passo.
 *
 * `WATER_AMBIENT` (docs/features/065-sons-do-mundo.md, Parte 5): o som de
 * fundo da água parada (`lake`) e da correnteza (`river`), em loop, vindo
 * do ponto de cada uma mais perto do jogador. Do BigSoundBank (CC0),
 * convertidos por `scripts/audio/sons-do-mundo.sh`.
 */
const splash = (n) => `/assets/audio/water/splash-0${n}.ogg`
const step = (gait, n) => `/assets/audio/footsteps/water/${gait}-0${n}.ogg`
const VARIATIONS = [1, 2, 3, 4, 5]

export const WATER_SOUNDS = {
  splash: { files: [1, 2, 3, 4].map(splash), volume: 0.5, refDistance: 6 },
  step: {
    volume: 0.06,
    refDistance: 5,
    walk: VARIATIONS.map((n) => step('walk', n)),
    run: VARIATIONS.map((n) => step('run', n)),
  },
}

export const WATER_AMBIENT = {
  // Por tipo: o arquivo, o volume e o alcance (volume cheio até
  // `refDistance` m, some de vez em `maxDistance`).
  lake: {
    path: '/assets/audio/ambient/lake.ogg',
    volume: 0.6,
    refDistance: 4,
    maxDistance: 28,
  },
  river: {
    path: '/assets/audio/ambient/river.ogg',
    volume: 0.7,
    refDistance: 5,
    maxDistance: 34,
  },
  // A busca da água mais perto (`nearestWaterPoints`): até onde procura
  // (m, pelo menos o maior `maxDistance`), o passo entre os anéis (m), os
  // pontos por anel e a correnteza a partir da qual a água é de rio.
  SEARCH_RADIUS: 36,
  SEARCH_STEP: 3,
  SEARCH_DIRECTIONS: 16,
  RIVER_FLOW: 0.5,
  // De quanto em quanto tempo (s) a busca roda — não precisa ser todo frame.
  PROBE_INTERVAL: 0.5,
  // Quanto tempo (s) o som leva pra chegar no ponto novo: andando na margem,
  // ele desliza em vez de pular de um ponto pro outro.
  MOVE_SMOOTHING: 0.4,
}
