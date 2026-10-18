import * as THREE from 'three'
import { GAME_CONFIG } from '@/core/gameConfig'
import { Fainted } from '@/core/traits'
import { getFireLightEntries } from '@/view/registry/fireLightRegistry'

/**
 * Luz de fogo presa num osso (`species.vfx.fireLight`, docs/features/060-
 * ajustes-por-especie.md): a chama da cauda do Charmander é do próprio
 * modelo; aqui só entra a luz quente que ela joga em volta, tremendo.
 *
 * A luz é filha do osso (`bone.add`, em `useAnimatedModel.js`), então o
 * Three leva ela junto da pose animada sem conta nenhuma aqui. O que o
 * system faz por frame: o deslocamento (`position`, em metros, dividido pela
 * escala do osso no mundo — senão a escala pequena do rig encolheria o
 * valor), o tremor e o enfraquecer com o desmaio (`Fainted`): desmaiada, a
 * luz desce até `faintedIntensity` (fração do brilho) e volta ao acordar.
 *
 * Fase: presentation, depois do `animationSystem`.
 */

// Reaproveitado pra não alocar um vetor por entidade a cada frame.
const worldScale = new THREE.Vector3()

/** `species.vfx.fireLight` com os padrões de `GAME_CONFIG.FIRE_LIGHT`. */
export function resolveFireLight(config = {}) {
  const defaults = GAME_CONFIG.FIRE_LIGHT
  const flicker = config.flicker ?? {}
  return {
    bone: config.bone,
    color: config.color ?? defaults.COLOR,
    intensity: config.intensity ?? defaults.INTENSITY,
    distance: config.distance ?? defaults.DISTANCE,
    decay: config.decay ?? defaults.DECAY,
    faintedIntensity: config.faintedIntensity ?? defaults.FAINTED_INTENSITY,
    position: {
      x: config.position?.x ?? 0,
      y: config.position?.y ?? 0,
      z: config.position?.z ?? 0,
    },
    flicker: {
      speed: flicker.speed ?? defaults.FLICKER_SPEED,
      amount: flicker.amount ?? defaults.FLICKER_AMOUNT,
      noise: flicker.noise ?? defaults.FLICKER_NOISE,
    },
  }
}

/**
 * Brilho da luz no instante `elapsed`: o base, oscilando pelo seno e com um
 * ruído por cima (`random` em 0..1, injetável pro teste).
 */
export function resolveFireLightIntensity(
  intensity,
  elapsed,
  flicker,
  random = Math.random(),
) {
  const wave = flicker.amount * Math.sin(elapsed * flicker.speed)
  const noise = flicker.noise * (random - 0.5)
  return Math.max(0, intensity * (1 + wave + noise))
}

/**
 * Próximo `fade` (0 = desmaiada por inteiro, 1 = acordada): anda até o alvo
 * sem passar.
 */
export function resolveFireLightFade(
  fade,
  fainted,
  delta,
  duration = GAME_CONFIG.FIRE_LIGHT.FAINT_FADE_DURATION,
) {
  const target = fainted ? 0 : 1
  const step = duration > 0 ? delta / duration : 1
  return target > fade
    ? Math.min(target, fade + step)
    : Math.max(target, fade - step)
}

/**
 * Quanto do brilho vale com o desmaio em `fade`: de `faintedIntensity`
 * (desmaiada) a 1 (acordada).
 */
export function resolveFaintedScale(fade, faintedIntensity) {
  return faintedIntensity + (1 - faintedIntensity) * fade
}

/**
 * Um frame de uma luz (`entry` do `fireLightRegistry`): enfraquece ou volta
 * pelo desmaio, põe no deslocamento e treme. Separado do system pro
 * laboratório de luz (`tools/fireLightLab/`) usar a mesma conta.
 */
export function applyFireLight(entry, fainted, delta) {
  const { light, bone, config } = entry

  entry.fade = resolveFireLightFade(entry.fade, fainted, delta)
  // Mesmo com `faintedIntensity` zero a luz nunca vira `visible = false`:
  // tirar a luz da cena muda a contagem de luzes e o Three recompila os
  // materiais (engasgo).
  const faintedScale = resolveFaintedScale(entry.fade, config.faintedIntensity)

  bone.getWorldScale(worldScale)
  light.position.set(
    config.position.x / worldScale.x,
    config.position.y / worldScale.y,
    config.position.z / worldScale.z,
  )

  entry.elapsed += delta
  light.intensity =
    resolveFireLightIntensity(config.intensity, entry.elapsed, config.flicker) *
    faintedScale
}

export function fireLightSystem(context) {
  for (const [entity, entry] of getFireLightEntries()) {
    applyFireLight(entry, entity.has(Fainted), context.delta)
  }
}
