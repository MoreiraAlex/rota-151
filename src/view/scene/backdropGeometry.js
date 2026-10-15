import { createNoise2D } from 'simplex-noise'
import * as THREE from 'three'
import { GAME_CONFIG } from '@/core/gameConfig'
import { createRng, deriveSeed } from '@/core/rng'

/**
 * As serras do fundo (docs/features/058-ajuste-dos-biomas.md): atrás da
 * névoa, silhuetas de montanha em volta da câmera, como parte do céu — o
 * mundo não acaba num limbo. Cada camada é uma faixa em volta da câmera
 * (`radius`), com a crista por um ruído sobre o círculo (sem emenda) pela
 * seed: mesma seed, mesmas serras.
 *
 * A altura é em ângulo acima do horizonte (`minAngle` a `maxAngle`, graus):
 * a serra fica do mesmo tamanho na tela qualquer que seja o raio. A base
 * desce `belowAngle` abaixo do horizonte (fica atrás do chão enevoado).
 * `ridged` (0 a 1) troca morro redondo por crista pontuda; `frequency`,
 * quantas serras em volta; `octaves`, o detalhe.
 *
 * O shader enevoa a serra do horizonte para baixo (pela altura do vértice).
 */

/** Altura (0 a 1) da crista no ângulo `theta` (rad). */
export function ridgeAt(noise, theta, { frequency, octaves, ridged }) {
  let sum = 0
  let weight = 1
  let total = 0
  let scale = frequency
  for (let octave = 0; octave < octaves; octave++) {
    const value = noise(Math.cos(theta) * scale, Math.sin(theta) * scale)
    const crest = 1 - Math.abs(value)
    const round = value * 0.5 + 0.5
    sum += (round + (crest - round) * ridged) * weight
    total += weight
    weight *= 0.5
    scale *= 2
  }
  return sum / total
}

/**
 * Geometria de uma camada: `segments` colunas em volta da câmera, cada uma
 * com o pé (abaixo do horizonte) e a crista.
 */
export function buildBackdropLayer(seed, index, layer, { radius, segments }) {
  const noise = createNoise2D(createRng(deriveSeed(seed, `backdrop:${index}`)))
  const toRad = Math.PI / 180
  const positions = new Float32Array((segments + 1) * 2 * 3)
  const foot = -Math.tan(layer.belowAngle * toRad) * radius
  for (let i = 0; i <= segments; i++) {
    const theta = (i / segments) * Math.PI * 2
    const ridge = ridgeAt(noise, theta, layer)
    const angle = layer.minAngle + (layer.maxAngle - layer.minAngle) * ridge
    const x = Math.cos(theta) * radius
    const z = Math.sin(theta) * radius
    const crest = Math.tan(angle * toRad) * radius
    positions.set([x, foot, z, x, crest, z], i * 6)
  }
  const indices = []
  for (let i = 0; i < segments; i++) {
    const a = i * 2
    // Faces para dentro (a câmera no meio).
    indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  return geometry
}

const LUMA = [0.2126, 0.7152, 0.0722]
const lumaOf = ({ r, g, b }) => r * LUMA[0] + g * LUMA[1] + b * LUMA[2]
const scratchTint = new THREE.Color()

/**
 * A cor de uma camada (`BACKDROP.LAYERS`) a partir da cor do horizonte
 * (`base`, linear): escurecida (`shade`) e puxada para o tom da camada
 * (`tint`, com a força `tintAmount`), mantendo o brilho — a serra vista
 * pela bruma. Em `out`.
 */
export function mountainColor(base, layer, out = new THREE.Color()) {
  const shaded = out.copy(base).multiplyScalar(layer.shade)
  scratchTint.set(layer.tint)
  const brightness = lumaOf(shaded) / Math.max(lumaOf(scratchTint), 1e-3)
  scratchTint.multiplyScalar(brightness)
  return shaded.lerp(scratchTint, layer.tintAmount)
}

/**
 * A cor da névoa a partir da do horizonte (`horizon`, linear): com as
 * serras do fundo (`BACKDROP.ENABLED`), a da camada da frente — o mundo
 * some direto na serra que encosta nele; sem, a do horizonte. Em `out`.
 */
export function fogColorOf(horizon, out = new THREE.Color()) {
  if (!GAME_CONFIG.BACKDROP.ENABLED) return out.copy(horizon)
  return mountainColor(horizon, GAME_CONFIG.BACKDROP.LAYERS.at(-1), out)
}
