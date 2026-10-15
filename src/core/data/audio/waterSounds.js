/**
 * Sons da água (docs/features/057-lagos-e-rios.md) — da mesma biblioteca de
 * passos (`.exemple/Steps/Steps/`, `WaterFootStep*`).
 *
 * - `splash`: algo afundando (bola, fruta) — `files` (variações; uma é
 *   sorteada), `volume` (0-1) e `refDistance` (m), como os da Pokébola;
 * - `step`: o passo de quem anda no raso, no lugar do passo da espécie —
 *   `walk`/`run` (variações), com o volume e o alcance do passo.
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
