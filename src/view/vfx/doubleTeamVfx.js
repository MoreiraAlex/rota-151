import { compileGradient, sampleCurve } from './particleSimulation'
import { DASH_TEXTURE_PATHS } from './dashVfx'

/**
 * Bando Duplo (Double Team) em partículas — tradução do
 * `doubleteam_dashlines` do Cobblemon (`.exemple/Coblemon/assets/cobblemon/
 * bedrock/particles/moves/doubleteam/`), as linhas de velocidade pros lados.
 * Mesmo contrato de `ctx`/`rnd` de `emberVfx.js`; nasce nos pés de quem usa,
 * virado pra onde ele olha. Os vultos (as cópias do modelo dos dois lados)
 * são do `afterimageSystem` (`visual.afterimages`).
 *
 *   - `lines` — riscos curtos de uma esfera em volta do corpo, cada um
 *     correndo pra direita ou pra esquerda
 *
 * A textura é a das linhas do Quick Attack (a mesma do dash).
 */

export const DOUBLE_TEAM_TEXTURE_PATHS = { lines: DASH_TEXTURE_PATHS.lines }

// O centro do corpo acima dos pés (m, ×escala) e o raio da esfera.
const BODY_CENTER = 0.3
const SPHERE = 0.45

// Branco puxando pro ciano (o gradiente ARGB).
const LINE_TINT = compileGradient([
  { at: 0.17, color: '#b4feff' },
  { at: 0.5, color: '#ffffff' },
  { at: 0.86, color: '#b7feff' },
])
// `variable.qsquish`: o risco cresce e recolhe.
const SQUISH = [0, 1, 1, 0]

export const DOUBLE_TEAM_EMITTERS = [
  {
    id: 'lines',
    texture: 'lines',
    strip: 7,
    frames: { first: 0, count: 7, fps: 16 },
    facing: 'direction',
    blending: 'normal',
    start: 0,
    duration: 0.5,
    rate: () => 100,
    anchor: 'impact',
    offset: () => [0, BODY_CENTER, 0],
    shellRadius: () => SPHERE,
    // pra direita ou pra esquerda (`math.round(random) * 2 - 1`)
    direction: (ctx, rnd) => [Math.round(rnd[0]) * 2 - 1, 0, 0],
    speed: () => 1,
    accel: () => [0, 0, 0],
    drag: () => 0,
    lifetime: () => 0.2,
    size: (t) => [0.2 * sampleCurve(SQUISH, t), 0.02],
    spin: false,
    tint: LINE_TINT,
  },
]
