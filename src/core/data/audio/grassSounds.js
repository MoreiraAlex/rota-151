/**
 * Passo na grama (docs/features/066-revisao-dos-biomas.md): no lugar do
 * passo da espécie onde o chão é de grama (`groundSurfaceAt`), para os
 * grupos de passo com `grass` (`footstepGroups.js` — quem pisa; quem
 * rasteja ou voa fica com o próprio). Toca no volume do passo da espécie:
 * os arquivos saem com a intensidade do passo do treinador
 * (`scripts/audio/passos-na-grama.sh`, que diz de onde vêm).
 */
const step = (gait, n) => `/assets/audio/footsteps/grass/${gait}-0${n}.ogg`
const VARIATIONS = [1, 2, 3, 4, 5, 6, 7]

export const GRASS_SOUNDS = {
  step: {
    walk: VARIATIONS.map((n) => step('walk', n)),
    run: VARIATIONS.map((n) => step('run', n)),
  },
}
