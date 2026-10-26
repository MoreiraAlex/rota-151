import { compileGradient, sampleCurve } from './particleSimulation'

/**
 * Mordida (Bite) em partículas — tradução manual das definições do Cobblemon
 * (`.exemple/Coblemon/assets/cobblemon/bedrock/particles/moves/bite/` e a
 * linha do tempo em `data/cobblemon/action_effects/moves/bite.json`). Mesmo
 * contrato de `ctx`/`rnd` de `emberVfx.js`; só o IMPACTO no alvo (o resto do
 * golpe é a animação do corpo da criatura):
 *
 *   - `bite`   — as presas fechando, um flipbook de 10 quadros que aparece e
 *     some (o gradiente do original vai do transparente ao creme e volta)
 *   - `sparks` — faíscas âmbar que estouram pra todo lado 0.15 s depois
 *
 * Os dois nascem um pouco golpe adentro (o `-0.25` em Z do Bedrock, onde -Z
 * é o alvo). A textura das presas é empilhada na vertical (quadro 0 = o de
 * cima). No original o tamanho escala com o corpo do alvo
 * (`emitter_space.scaling: entity`); aqui quem escala é o `visual.scale`.
 * Sem colisão com o chão.
 */

export const BITE_TEXTURE_PATHS = {
  bite: '/assets/effects/bite/bite.png',
  spark: '/assets/effects/bite/critical_hit.png',
}

// `-0.25` no Z do Bedrock (-Z = alvo): golpe adentro.
const IMPACT_OFFSET = [0, 0, 0.25]

// O gradiente ARGB da mordida: cor e alfa nos mesmos pontos.
const BITE_TINT = compileGradient([
  { at: 0, color: '#2a1e11' },
  { at: 0.12, color: '#fff1d3' },
  { at: 0.54, color: '#fff1d3' },
  { at: 1, color: '#2a1e11' },
])
const BITE_ALPHA = [
  [0, 0],
  [0.12, 1],
  [0.54, 1],
  [1, 0],
]

const SPARK_TINT = compileGradient([
  { at: 0, color: '#291c0e' },
  { at: 0.27, color: '#ffdca1' },
  { at: 1, color: '#291c0e' },
])
// `variable.bitespark`: a faísca cresce, fica e encolhe (nós por vida).
const SPARK_SIZE = [0, 0.87, 1, 0.5, 0]

// Interpolação linear entre pontos `[t, valor]` (em ordem).
export function piecewise(points, t) {
  if (t <= points[0][0]) return points[0][1]
  for (let i = 1; i < points.length; i++) {
    const [t1, v1] = points[i]
    if (t <= t1) {
      const [t0, v0] = points[i - 1]
      return v0 + ((v1 - v0) * (t - t0)) / (t1 - t0)
    }
  }
  return points[points.length - 1][1]
}

// `math.random(a, b)` com uma random da partícula.
const between = (r, a, b) => a + r * (b - a)

export const BITE_EMITTERS = [
  // bite_target.particle.json — uma mordida, 10 quadros a 18 fps (0.55 s).
  {
    id: 'bite',
    texture: 'bite',
    strip: 10,
    vertical: true,
    frames: { first: 0, count: 10, fps: 18 },
    blending: 'normal',
    start: 0,
    burst: 1,
    anchor: 'impact',
    offset: () => IMPACT_OFFSET,
    direction: () => [0, 0, 1],
    speed: () => 0,
    accel: () => [0, 0, 0],
    drag: () => 0,
    lifetime: () => 0.55,
    size: () => 0.9,
    spin: false,
    tint: BITE_TINT,
    alpha: (t) => piecewise(BITE_ALPHA, t),
  },
  // bite_targetspark.particle.json — 14 faíscas pra fora (esfera de raio
  // 0.025, só a superfície), 0.15 s depois da mordida (a pausa da linha do
  // tempo).
  {
    id: 'sparks',
    texture: 'spark',
    strip: 1,
    frames: { first: 0, count: 1, fps: 1 },
    blending: 'normal',
    start: 0.15,
    burst: 14,
    anchor: 'impact',
    offset: () => IMPACT_OFFSET,
    shellRadius: () => 0.025,
    direction: (ctx, rnd) => [rnd[0] - 0.5, rnd[1] - 0.5, rnd[2] - 0.5],
    speed: (ctx, rnd) => between(rnd[3], 1.75, 4.55) * 3,
    accel: () => [0, -5, 0],
    drag: () => 4,
    lifetime: () => 0.35,
    size: (t) => 0.1 * sampleCurve(SPARK_SIZE, t),
    spin: false,
    tint: SPARK_TINT,
  },
]
