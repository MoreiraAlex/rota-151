import { compileGradient, sampleCurve } from './particleSimulation'

/**
 * CARGA de "absorver energia" — o que aparece enquanto um golpe de status
 * carrega (do disparo até o `effectAt`, ver `ChargeEffectsView.jsx`): orbes
 * verdes girando em volta do corpo e se fechando no centro. Grupo de carga
 * `'absorb'` (`visual.chargeGroup` da skill — hoje o Growth).
 *
 * Tradução de `gigadrain_actor.particle.json` e `gigadrain_actorouter.particle.json`
 * do Cobblemon (`.exemple/Coblemon/assets/cobblemon/bedrock/particles/moves/
 * gigadrain/`). No Giga Drain os orbes viajam do ALVO pro usuário girando; aqui
 * não há alvo: fica só o giro, num anel horizontal em volta do corpo, que se
 * fecha no centro (a mesma conta do raio, `(0.75 - idade² × 1.7) ×
 * drainopen`). O Synthesis (o golpe de "absorver sol") teria sido o tema mais
 * próximo, mas no pacote ele não está ligado a nada e a textura dele não existe.
 *
 *   contínuo  `inner`  — orbes menores, anel de 0.75 m (13/s)
 *   contínuo  `outer`  — orbes maiores, anel de 1.05 m (11/s)
 *
 * Diferenças pro original:
 * - os emissores rodam enquanto a carga durar (`continuous`), não 1.3 s fixos;
 * - o raio do anel vem do `radius` da skill (`0.75 = 1.5 × radius`, com
 *   `radius 0.5` = o original), e `visual.scale` encolhe tudo;
 * - o gradiente original faz o orbe aparecer e sumir pelo ALFA (`#00…` nas
 *   pontas); o motor não tem alfa no gradiente, então isso fica com a curva de
 *   tamanho (`gdsize`, que já nasce em 0) e o fade do fim da vida;
 * - sem as faíscas que cada orbe solta (`sparkle`, evento por partícula).
 *
 * Roda em espaço do MUNDO com o quadro nos pés da criatura (`system.setFrame`,
 * mesmo esquema do dash); o anel fica na meia altura do corpo.
 */

export const ABSORB_CHARGE_TEXTURE_PATHS = {
  orb: '/assets/effects/absorb/gigadrain_orb.png',
}

// `variable.drainopen` e `variable.gdsize` (nós ao longo da vida).
const DRAIN_OPEN = [0.35, 0.8, 0.98, 1, 1, 1, 1, 0.98, 0.9, 0.65, 0.01]
const ORB_SIZE = [0, 1, 1, 1, 0.9, 0.58, 0.25]
// O orbe já é verde; branco = sem tingir.
const NO_TINT = compileGradient([{ at: 0, color: '#ffffff' }])
const LIFETIME = 0.7

const deg = (degrees) => (degrees * Math.PI) / 180

// `offset` é multiplicado pela escala; a meia altura REAL do corpo (metros)
// entra já dividida por ela.
const bodyMiddle = (ctx) => [0, ctx.height / 2 / ctx.scale, 0]

/**
 * O anel que se fecha: `ring` é o raio inicial em múltiplos do `radius` da
 * skill (1.5 = os 0.75 m do original, com `radius 0.5`). O ângulo gira com a
 * idade da partícula (65°/s) e nasce onde o emissor está no giro (1523°/s),
 * como no original.
 */
function closingRing(ring) {
  return (age, particle) => {
    const start = particle.emitter.radius * ring
    const open = sampleCurve(DRAIN_OPEN, age / particle.life)
    // `0.75 - idade² × 1.7`, proporcional ao raio inicial
    const radius = start * (1 - (age * age * 1.7) / 0.75) * open
    const angle = deg(age * 65 + particle.emitter.age * 1523)
    return [Math.sin(angle) * radius, 0, Math.cos(angle) * radius]
  }
}

function orbEmitter({ id, row, rate, ring, size }) {
  return {
    id,
    texture: 'orb',
    // 9 quadros lado a lado, 2 linhas (a de cima e a de baixo do atlas)
    strip: 9,
    rows: 2,
    row,
    frames: { first: 0, count: 9, fps: 12 },
    blending: 'normal',
    start: 0,
    continuous: true,
    rate: () => rate,
    anchor: 'impact',
    offset: bodyMiddle,
    path: closingRing(ring),
    lifetime: () => LIFETIME,
    size: (t) => size * sampleCurve(ORB_SIZE, t),
    spin: false,
    tint: NO_TINT,
  }
}

export const ABSORB_CHARGE_EMITTERS = [
  // gigadrain_actor — linha de baixo do atlas (`base_UV [0, 11]`), 0.15 m
  orbEmitter({ id: 'inner', row: 1, rate: 13, ring: 1.5, size: 0.15 }),
  // gigadrain_actorouter — linha de cima, 0.25 m, anel maior (1.05 m)
  orbEmitter({ id: 'outer', row: 0, rate: 11, ring: 2.1, size: 0.25 }),
]
