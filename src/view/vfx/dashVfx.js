import { compileGradient, sampleCurve } from './particleSimulation'
import { buildJumpDustEmitters, JUMP_DUST_TEXTURE_PATHS } from './jumpDustVfx'
import {
  buildWaterSplashEmitters,
  WATER_SPLASH_TEXTURE_PATHS,
} from './waterSplashVfx'

/**
 * Efeito de DASH — linhas de velocidade enquanto dura o dash e poeira no chão
 * na saída. As linhas são tradução manual de `quickattack_dashlines.particle.
 * json` do Cobblemon (`.exemple/Coblemon/assets/cobblemon/bedrock/particles/
 * moves/quickattack/`); a poeira é a mesma do pulo (`jumpDustVfx.js` — pedido
 * do usuário na docs/features/057-lagos-e-rios.md) e, com os pés na água, o
 * respingo (`waterSplashVfx.js`). Mesmo contrato de
 * `ctx`/`rnd` de `emberVfx.js`, mas aqui o sistema roda em espaço do MUNDO,
 * com um quadro que segue a criatura (`system.setFrame`, ver
 * `particleEmitter.js`): os specs falam no referencial dela — +Z = pra onde
 * ela corre, origem nos pés — e as partículas ficam pra trás conforme ela
 * anda.
 *
 *   - `lines`  — contínuo: linhas de velocidade ao redor do corpo
 *   - `dust`   — o anel de poeira do pulo na saída (`DASH_EFFECT.DUST_COUNT`
 *     nuvens) — ou, na água, `foam` e `drops` (o respingo)
 *
 * Não existe efeito de dash PARA MOVIMENTO no Cobblemon (é o mod por turnos
 * do Minecraft): estes vêm do golpe Quick Attack e foram adaptados — as linhas
 * duram o dash inteiro (no original, 0.25 s) e saem do corpo da criatura.
 *
 * `SCALE` (config, `GAME_CONFIG.FEEDBACK.DASH_EFFECT`) multiplica tamanho e
 * raio; o original usa raio ≥ 1 m, grande pro tamanho das criaturas daqui.
 * Sem colisão com o chão.
 */

export const DASH_TEXTURE_PATHS = {
  lines: '/assets/effects/dash/dashlines.png',
  ...JUMP_DUST_TEXTURE_PATHS,
  ...WATER_SPLASH_TEXTURE_PATHS,
}

// A poeira (ou o respingo) da saída tem a forma da decolagem do pulo
// (`JumpDustView.jsx`, força média): o quanto se espalha (m/s) e o tamanho
// das nuvens (m), antes da escala.
const GROUND_SPEED = 1.8
const GROUND_SIZE = 0.475

// Valores de PARTIDA dos números de ajuste (a config do jogo, `GAME_CONFIG.
// FEEDBACK.DASH_EFFECT`, manda: `buildDashEmitters` recebe os dela). O original
// usa linhas de 0.2 × 0.02 m (a câmera do Minecraft é bem mais perto); mais
// grosso e mais comprido aqui pra aparecer.
const DEFAULTS = {
  lineRate: 100,
  lineLength: 0.6,
  lineThickness: 0.05,
  dustCount: 12,
}
// Raio (m, antes da escala) da nuvem de linhas ao redor do corpo.
const LINE_RADIUS = 1

const LINE_TINT = compileGradient([
  { at: 0.17, color: '#b4feff' },
  { at: 0.5, color: '#ffffff' },
  { at: 0.86, color: '#b7feff' },
])

// `variable.qsquish`: a linha nasce curta, estica e some (nós por vida).
const LINE_SQUISH = [0, 1, 1, 0]

// `offset` dos specs é multiplicado pela escala; uma medida REAL em metros
// (a altura do corpo) precisa entrar já dividida por ela.
const unscaled = (ctx, meters) => meters / ctx.scale

// Ponto sorteado no VOLUME de uma esfera de raio `radius` (direção sorteada,
// raio com cbrt pra não amontoar no centro).
function pointInSphere(rnd, radius) {
  const x = rnd[4] * 2 - 1
  const y = rnd[5] * 2 - 1
  const z = rnd[6] * 2 - 1
  const length = Math.hypot(x, y, z) || 1
  const r = radius * Math.cbrt(rnd[7])
  return [(x / length) * r, (y / length) * r, (z / length) * r]
}

/**
 * Os emissores do dash. `lineRate` (linhas por segundo), `lineLength` e
 * `lineThickness` (metros, antes da escala) e `dustCount` (nuvens de poeira
 * na saída) vêm da config; o que faltar usa o padrão acima. `water`: os pés
 * na água (respingo no lugar da poeira). `groundScale`: quanto a poeira
 * cresce para ficar do tamanho da do pulo (a escala do pulo dividida pela
 * do dash — o sistema do dash tem a escala dele).
 */
export function buildDashEmitters(options = {}) {
  const { lineRate, lineLength, lineThickness, dustCount, water, groundScale } =
    {
      ...DEFAULTS,
      water: false,
      groundScale: 1,
      ...options,
    }
  const ground = (water ? buildWaterSplashEmitters : buildJumpDustEmitters)({
    count: dustCount,
    speed: GROUND_SPEED * groundScale,
    size: GROUND_SIZE * groundScale,
  }).map((emitter) =>
    emitter.id === 'ring' ? { ...emitter, id: 'dust' } : emitter,
  )

  return [
    // quickattack_dashlines.particle.json — esfera de raio 1 centrada 1 m à
    // frente do corpo; as linhas disparam pra TRÁS (+Z do Bedrock = trás).
    {
      id: 'lines',
      texture: 'lines',
      strip: 7,
      frames: { first: 0, count: 7, fps: 16 },
      // quadro esticado na direção do movimento, face pra câmera
      facing: 'direction',
      blending: 'normal',
      start: 0,
      continuous: true,
      rate: () => lineRate,
      anchor: 'impact',
      offset: (ctx, rnd) => {
        const [x, y, z] = pointInSphere(rnd, LINE_RADIUS)
        // centro da esfera: meia altura do corpo, `LINE_RADIUS` à frente
        return [x, unscaled(ctx, ctx.height / 2) + y, z + LINE_RADIUS]
      },
      direction: () => [0, 0, -1],
      speed: () => 9,
      accel: () => [0, 0, -1],
      drag: () => 0,
      lifetime: () => 0.2,
      size: (t) => [lineLength * sampleCurve(LINE_SQUISH, t), lineThickness],
      spin: false,
      tint: LINE_TINT,
    },
    ...ground,
  ]
}

// Com os valores padrão (testes e uso sem config).
export const DASH_EMITTERS = buildDashEmitters()
