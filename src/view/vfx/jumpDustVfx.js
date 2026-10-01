import { compileGradient, sampleCurve } from './particleSimulation'
import { DASH_TEXTURE_PATHS } from './dashVfx'

/**
 * Poeira do PULO — um anel de nuvens que estoura no chão e se espalha pros
 * lados, na decolagem e na aterrissagem (`jumpDustManager.js` decide quando e
 * com que força). Usa a mesma fumaça do dash (`big_smoke`, 12 quadros na
 * vertical — do `quickattack_dust` do Cobblemon), mas é um efeito próprio: o
 * Cobblemon não tem poeira de pulo.
 *
 * Os emissores nascem no MUNDO, na posição dos pés (`anchor: 'impact'` = a
 * origem do sistema, posta nos pés por quem cria), em espaço sem `frame`: cada
 * nuvem sai pra uma direção sorteada no plano (`rnd[4]`) e fica ali, subindo e
 * esvaziando. Cor de poeira clara; sem colisão com o chão.
 */

export const JUMP_DUST_TEXTURE_PATHS = {
  smoke: DASH_TEXTURE_PATHS.smoke,
}

const DUST_TINT = compileGradient([
  { at: 0, color: '#d6d0c4' },
  { at: 1, color: '#a39b8b' },
])
// A nuvem nasce pequena, cresce e esvazia (nós por vida).
const DUST_SIZE = [0.5, 1, 1.1, 0.9]

/**
 * O anel de poeira. `count`: nuvens soltas de uma vez; `speed`: o quanto vão
 * pra fora (m/s, antes da escala); `size`: tamanho de cada nuvem (m, antes da
 * escala); `lift`: o quanto sobem (aceleração vertical).
 */
export function buildJumpDustEmitters({
  count = 6,
  speed = 1.6,
  size = 0.45,
  lift = 0.8,
} = {}) {
  return [
    {
      id: 'ring',
      texture: 'smoke',
      strip: 12,
      vertical: true,
      frames: { first: 0, count: 12, step: 1, stretch: true },
      blending: 'normal',
      start: 0,
      burst: count,
      anchor: 'impact',
      // pequeno deslocamento inicial pro anel não nascer num ponto só
      offset: (ctx, rnd) => {
        const angle = rnd[4] * Math.PI * 2
        const r = 0.15 * (0.5 + rnd[5])
        return [Math.cos(angle) * r, 0.03, Math.sin(angle) * r]
      },
      // radial no plano do chão, a direção vem do mesmo `rnd[4]` do `offset`
      direction: (ctx, rnd) => {
        const angle = rnd[4] * Math.PI * 2
        return [Math.cos(angle), 0.05, Math.sin(angle)]
      },
      speed: (ctx, rnd) => speed * (0.7 + rnd[6] * 0.6),
      accel: () => [0, lift, 0],
      drag: () => 2.2,
      lifetime: (ctx, rnd) => 0.45 + rnd[8] * 0.4,
      size: (t, rnd) => size * sampleCurve(DUST_SIZE, t) * (0.8 + rnd[7] * 0.4),
      spin: true,
      tint: DUST_TINT,
    },
  ]
}
