import { createNoise2D } from 'simplex-noise'
import { GAME_CONFIG } from '../gameConfig'
import { smoothstep } from '../math'
import { createRng, deriveSeed } from '../rng'

/**
 * Clareiras (docs/features/049-vegetacao-e-floresta.md): um ruído pela seed
 * que diz quão "aberto" é cada ponto do mundo. Nos biomas com `clearings`,
 * a vegetação de sombra (`place: 'shade'`) rareia onde é aberto e a de
 * clareira (`place: 'clearing'`) só nasce ali. O ruído não depende do bioma
 * nem da altura — o mesmo em qualquer chunk.
 */

// Um ruído por seed, nome e tamanho (montar o simplex custa; os chunks
// repetem).
const noiseCache = new Map()

/**
 * Ruído de manchas (0 a 1) pela seed: `name` separa um uso do outro (as
 * clareiras, as manchas de cada tipo — `patches.js`) e `size` (m) é a
 * largura das manchas.
 *
 * @returns {(x: number, z: number) => number}
 */
export function patchNoiseFor(seed, name, size) {
  const key = `${seed}:${name}:${size}`
  if (!noiseCache.has(key)) {
    const noise2D = createNoise2D(createRng(deriveSeed(seed, name)))
    // Duas camadas: a mancha e um recorte miúdo na borda dela.
    noiseCache.set(key, (x, z) => {
      const value =
        noise2D(x / size, z / size) * 0.75 +
        noise2D((x * 3) / size, (z * 3) / size) * 0.25
      return value * 0.5 + 0.5
    })
  }
  return noiseCache.get(key)
}

/** O ruído das clareiras (0 a 1) em `(x, z)`. */
export function clearingNoiseAt(seed, x, z, params = GAME_CONFIG.CLEARINGS) {
  return patchNoiseFor(seed, 'clearings', params.SIZE)(x, z)
}

/**
 * Quão aberto (0 = mata, 1 = clareira) é um ponto com ruído `noise`, num
 * bioma com `amount` de clareira (0 = nenhuma, 1 = tudo aberto).
 */
export function opennessOf(noise, amount, params = GAME_CONFIG.CLEARINGS) {
  if (amount <= 0) return 0
  const threshold = 1 - amount
  return smoothstep(threshold - params.EDGE, threshold + params.EDGE, noise)
}
