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
 *   - `gust<N>` — só no AR (o dash do voo livre, docs/features/060-ajustes-
 *     por-especie.md), no lugar da poeira: ondas de ar (o arco do Growl,
 *     `growlVfx.js`) que estouram pra trás na saída (`DASH_EFFECT.AIR_WAVES`)
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
  wave: '/assets/effects/growl/wave.png',
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

// Ondas de ar do dash no ar: intervalo entre elas (s), quanto duram (s), até
// onde vão pra trás (m) e o arco, de quando nasce até quando some (largura e
// altura, m) — antes da escala.
const GUST_INTERVAL = 0.06
const GUST_LIFETIME = 0.35
const GUST_DISTANCE = 1.2
const GUST_THICKNESS = 0.35
const GUST_HEIGHT = [0.4, 1.6]

const GUST_TINT = compileGradient([
  { at: 0, color: '#e6fdff' },
  { at: 1, color: '#9fe9f5' },
])
// Alfa das ondas (o motor ainda esmaece no fim da vida): ar, não parede.
const GUST_OPACITY = 0.7

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
  const {
    lineRate,
    lineLength,
    lineThickness,
    dustCount,
    water,
    air,
    airWaves,
    groundScale,
  } = {
    ...DEFAULTS,
    water: false,
    air: false,
    airWaves: 0,
    groundScale: 1,
    ...options,
  }
  // no ar não tem chão: as ondas de ar no lugar da poeira/respingo
  const ground = air
    ? buildGustEmitters(airWaves)
    : (water ? buildWaterSplashEmitters : buildJumpDustEmitters)({
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

/**
 * Ondas de ar do dash no ar: `count` arcos que nascem no meio do corpo, um
 * logo depois do outro, e vão pra trás crescendo e sumindo — o ar empurrado
 * na arrancada. O arco fica deitado ao longo do movimento (`facing:
 * 'direction'`), convexo pra trás.
 */
function buildGustEmitters(count) {
  return Array.from({ length: count }, (_, index) => ({
    id: `gust${index}`,
    texture: 'wave',
    strip: 1,
    frames: { first: 0, count: 1, fps: 1 },
    facing: 'direction',
    blending: 'additive',
    start: index * GUST_INTERVAL,
    burst: 1,
    anchor: 'impact',
    offset: (ctx) => [0, unscaled(ctx, ctx.height / 2), 0],
    direction: () => [0, 0, -1],
    speed: () => GUST_DISTANCE / GUST_LIFETIME,
    accel: () => [0, 0, 0],
    drag: () => 0,
    lifetime: () => GUST_LIFETIME,
    size: (t) => [
      GUST_THICKNESS,
      GUST_HEIGHT[0] + t * (GUST_HEIGHT[1] - GUST_HEIGHT[0]),
    ],
    spin: false,
    tint: GUST_TINT,
    opacity: GUST_OPACITY,
  }))
}

// Com os valores padrão (testes e uso sem config).
export const DASH_EMITTERS = buildDashEmitters()
