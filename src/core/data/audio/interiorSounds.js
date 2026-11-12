/**
 * Sons dos prédios por dentro (docs/features/068-interior-dos-predios.md),
 * gerados por `scripts/audio/sons-do-pokecenter.sh` (que diz de onde vêm):
 *
 * - `door`: a porta automática abrindo, ao passar por ela (para dentro e
 *   para fora) — sem posição no mundo, no canal de efeitos;
 * - `step`: o passo no piso de dentro, no lugar do passo da espécie, para
 *   os grupos de passo de quem pisa (`grass` em `footstepGroups.js`). Os
 *   arquivos saem na intensidade do passo do treinador.
 *
 * Mesmo formato dos outros sons: `files` (variações; uma é sorteada) e
 * `volume` (0-1); o passo, `walk`/`run`.
 */
const step = (gait, n) => `/assets/audio/footsteps/indoor/${gait}-0${n}.ogg`

export const INTERIOR_SOUNDS = {
  door: { files: ['/assets/audio/interior/door.ogg'], volume: 0.1 },
  step: {
    walk: [1, 2, 3, 4, 5, 6].map((n) => step('walk', n)),
    run: [1, 2, 3, 4, 5, 6, 7].map((n) => step('run', n)),
  },
}
