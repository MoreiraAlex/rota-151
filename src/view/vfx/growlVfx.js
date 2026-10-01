import { compileGradient } from './particleSimulation'

/**
 * Growl em partículas — ondas sonoras que saem da boca da criatura e se
 * alargam até o fim do cone. Diferente de Ember/Tackle, NÃO vem do Cobblemon
 * (lá o Growl não tem partícula): é um efeito próprio, no mesmo motor.
 *
 * Cada onda é um arco ")" (`public/assets/effects/growl/wave.png`, branco com
 * alfa) em `facing: 'direction'` — o quadro fica deitado ao longo do movimento,
 * com a convexidade pra frente, e de frente pra câmera. Nasce na boca
 * (`anchor: 'origin'`), viaja até a ponta do cone (`ctx.length` = alcance do
 * golpe) e cresce em altura na proporção da abertura do cone (`ctx.radius` é o
 * raio na ponta), então o arco acompanha o formato que o indicador mostra.
 *
 * Espaço local: criatura em (0, 0, -length), impacto em (0, 0, 0), +Z na
 * direção do golpe. Ajuste aqui: nº de ondas (`WAVE_COUNT`), duração de cada
 * uma (`WAVE_LIFETIME`) e intervalo entre elas (`WAVE_INTERVAL`).
 *
 * `visual.effectVisualDuration` do Growl precisa cobrir a última onda
 * (`(WAVE_COUNT - 1) * WAVE_INTERVAL + WAVE_LIFETIME`).
 */

export const GROWL_TEXTURE_PATHS = {
  wave: '/assets/effects/growl/wave.png',
}

export const WAVE_COUNT = 3
export const WAVE_INTERVAL = 0.15
export const WAVE_LIFETIME = 0.5

// Altura do arco na boca (m) e espessura (comprimento ao longo do movimento)
const MIN_HEIGHT = 0.35
const THICKNESS = 0.45
// Altura do arco na ponta do cone (m): 2 × `radius` do Growl (1.5). O spec de
// tamanho não enxerga o `ctx`, então o valor fica aqui — ajuste junto do `radius`.
const TIP_HEIGHT = 3

const WAVE_TINT = compileGradient([
  { at: 0, color: '#ffffff' },
  { at: 1, color: '#d8d8d8' },
])

export const GROWL_EMITTERS = Array.from(
  { length: WAVE_COUNT },
  (_, index) => ({
    id: `wave${index}`,
    texture: 'wave',
    strip: 1,
    frames: { first: 0, count: 1, fps: 1 },
    facing: 'direction',
    blending: 'additive',
    start: index * WAVE_INTERVAL,
    burst: 1,
    anchor: 'origin',
    direction: () => [0, 0, 1],
    // percorre o alcance inteiro na vida da onda
    speed: (ctx) => ctx.length / WAVE_LIFETIME,
    accel: () => [0, 0, 0],
    drag: () => 0,
    lifetime: () => WAVE_LIFETIME,
    // [comprimento no movimento, altura]: a altura abre junto com o cone
    size: (t) => [THICKNESS, MIN_HEIGHT + t * (TIP_HEIGHT - MIN_HEIGHT)],
    spin: false,
    tint: WAVE_TINT,
  }),
)
