import { createNoise2D } from 'simplex-noise'
import { createRng } from '../rng'
import { GAME_CONFIG } from '../gameConfig'

// Cada camada de ondulação tem metade do tamanho da anterior (o padrão da
// técnica)...
const LAYER_SHRINK = 2
// ...e a menor ainda tem pelo menos 2 vértices de largura (1 vértice por
// metro, `terrainChunk.js`) — menor que isso nem aparece na malha.
const SMALLEST_LAYER_SIZE = 2

/** Quantas camadas cabem de `hillSize` até a menor visível. */
export function countLayers(hillSize) {
  return (
    Math.floor(
      Math.log(hillSize / SMALLEST_LAYER_SIZE) / Math.log(LAYER_SHRINK),
    ) + 1
  )
}

/**
 * Altura do relevo (m) em qualquer ponto `(x, z)` do mundo — a fonte das
 * alturas dos chunks (`terrainChunk.js`). Soma camadas de simplex
 * (`simplex-noise`, embaralhado pelo PRNG seedado — nunca `Math.random()`):
 * a primeira tem o tamanho dos morros (`HILL_SIZE`), cada uma seguinte é
 * menor e pesa `ROUGHNESS` vezes a anterior. O resultado (-1 a 1) passa por
 * `FLATNESS` (achata o meio) e vira metros (`HILL_HEIGHT`). Mesma seed e
 * mesmos parâmetros, mesma altura em todo ponto
 * (docs/features/045-terreno-de-um-chunk.md).
 *
 * `params` tem a forma de `GAME_CONFIG.TERRAIN` (os testes passam outros).
 */
export function createHeightSampler(seed, params = GAME_CONFIG.TERRAIN) {
  const noise2D = createNoise2D(createRng(seed))
  const { HILL_SIZE, HILL_HEIGHT, ROUGHNESS, FLATNESS } = params
  const layers = countLayers(HILL_SIZE)

  return function heightAt(x, z) {
    let sum = 0
    let weight = 1
    let totalWeight = 0
    let frequency = 1 / HILL_SIZE
    for (let layer = 0; layer < layers; layer++) {
      sum += noise2D(x * frequency, z * frequency) * weight
      totalWeight += weight
      weight *= ROUGHNESS
      frequency *= LAYER_SHRINK
    }
    const value = sum / totalWeight
    return HILL_HEIGHT * Math.sign(value) * Math.abs(value) ** FLATNESS
  }
}
