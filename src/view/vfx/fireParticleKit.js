import { compileGradient } from './particleSimulation'

/**
 * Peças compartilhadas pelos golpes de fogo em partículas (`emberVfx.js`,
 * `flamethrowerVfx.js`): as 3 texturas (cópia do Cobblemon, ver docs/
 * features/033-skills-de-combate-e-vfx.md) e os gradientes de cor
 * que se repetem entre os JSONs de origem.
 */
export const FIRE_TEXTURE_PATHS = {
  cloud: '/assets/effects/ember/cloudyfire_white.png',
  ember: '/assets/effects/ember/ember.png',
  powder: '/assets/effects/ember/powder.png',
}

// Fogo "nuvem": branco → amarelo → laranja → vermelho-escuro.
export const CLOUD_TINT = compileGradient([
  { at: 0, color: '#ffffff' },
  { at: 0.2, color: '#ffe872' },
  { at: 0.4, color: '#ffcc00' },
  { at: 0.55, color: '#ff9400' },
  { at: 0.75, color: '#ff4700' },
  { at: 0.9, color: '#ff4700' },
  { at: 1, color: '#531c0e' },
])

// Brasa que sobe do alvo.
export const LINGER_TINT = compileGradient([
  { at: 0, color: '#ffc8b3' },
  { at: 1, color: '#b23000' },
])

// `variable.fun`/`variable.shrink`: tamanho ao longo da vida, nós
// igualmente espaçados (usado por `sampleCurve`).
export const CLOUD_FUN = [1, 1, 1, 1, 1, 1, 0.96, 0.85, 0.6, -0.05]

export const clamp = (value, min, max) => Math.min(Math.max(value, min), max)
