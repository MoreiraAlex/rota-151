/**
 * Simulação PURA de partículas de golpe (sem Three.js) — a matemática de
 * nascer/mover/colorir uma partícula, separada de `particleEmitter.js` (que
 * só liga isso a `THREE.Sprite`) pra ser testável sem WebGL.
 *
 * Os números dos efeitos vêm das definições de partícula do Cobblemon
 * (Bedrock "Snowstorm", `.exemple/Coblemon/assets/cobblemon/bedrock/
 * particles/moves/`), traduzidas à mão pra funções JS (ver `emberVfx.js`).
 * Por isso cada spec recebe `rnd` — as mesmas "randoms por partícula"
 * (`v.particle_random_1..4`) das expressões originais, mais extras pra
 * os `math.random(a, b)` — e `ctx`, o contexto do emissor (idade, progresso
 * ao longo do trajeto, comprimento do golpe...). Assim cada linha da config
 * pode ser conferida contra o JSON de origem.
 *
 * Espaço LOCAL do efeito: +Z aponta na direção do golpe, +Y é pra cima, e o
 * ponto de impacto é a origem (0, 0, 0) — a criatura fica em
 * (0, 0, -length). É a mesma convenção de `resolveEffectRotation`.
 */

export const RANDOM_COUNT = 10

/** `#rrggbb` → `[r, g, b]` em 0..1 (sRGB, sem conversão de espaço). */
export function hexToRgb(hex) {
  const value = hex.replace('#', '')
  return [
    parseInt(value.slice(0, 2), 16) / 255,
    parseInt(value.slice(2, 4), 16) / 255,
    parseInt(value.slice(4, 6), 16) / 255,
  ]
}

/** Gradiente de cor ao longo da vida — `stops`: `[{ at: 0..1, color: '#rrggbb' }]`, em ordem. */
export function compileGradient(stops) {
  return stops.map(({ at, color }) => ({ at, rgb: hexToRgb(color) }))
}

/** Cor (`[r, g, b]`, 0..1) em `t` — antes do 1º stop e depois do último, segura o valor da ponta. */
export function sampleGradient(gradient, t) {
  if (t <= gradient[0].at) return gradient[0].rgb
  const last = gradient[gradient.length - 1]
  if (t >= last.at) return last.rgb
  for (let i = 1; i < gradient.length; i++) {
    const next = gradient[i]
    if (t <= next.at) {
      const prev = gradient[i - 1]
      const k = (t - prev.at) / (next.at - prev.at)
      return [
        prev.rgb[0] + (next.rgb[0] - prev.rgb[0]) * k,
        prev.rgb[1] + (next.rgb[1] - prev.rgb[1]) * k,
        prev.rgb[2] + (next.rgb[2] - prev.rgb[2]) * k,
      ]
    }
  }
  return last.rgb
}

/** Curva por nós igualmente espaçados em 0..1 (o `"type": "linear"` dos `curves` do Bedrock). */
export function sampleCurve(nodes, t) {
  if (nodes.length === 1) return nodes[0]
  const position = Math.min(Math.max(t, 0), 1) * (nodes.length - 1)
  const index = Math.floor(position)
  if (index >= nodes.length - 1) return nodes[nodes.length - 1]
  const k = position - index
  return nodes[index] + (nodes[index + 1] - nodes[index]) * k
}

/**
 * Quadro do flipbook. Dois modos: `fps` quadros por segundo (segura no
 * último, sem repetir) ou, com `stretch` (o `stretch_to_lifetime` do
 * Bedrock), todos os quadros distribuídos ao longo da vida da partícula.
 * `step` (padrão 1) é o passo entre quadros — negativo percorre a sequência
 * de trás pra frente (as faíscas do Tackle).
 */
export function frameAt(age, frames, life) {
  const progress =
    frames.stretch && life ? (age / life) * frames.count : age * frames.fps
  const index = Math.min(Math.floor(progress), frames.count - 1)
  return frames.first + (frames.step ?? 1) * index
}

/**
 * Quantas partículas nascem neste passo de um emissor de taxa contínua —
 * a fração que sobra (`carry`) passa pro próximo passo, senão uma taxa
 * baixa nunca soltaria nada com `delta` pequeno.
 */
export function consumeSpawns(carry, rate, dt) {
  const total = carry + rate * dt
  const count = Math.floor(total)
  return { count, carry: total - count }
}

function normalize([x, y, z]) {
  const length = Math.hypot(x, y, z)
  return length > 1e-9 ? [x / length, y / length, z / length] : [0, 0, 1]
}

/** Ponto aleatório na superfície de uma esfera de raio `radius`. */
function randomOnSphere(radius, random) {
  const z = random() * 2 - 1
  const angle = random() * Math.PI * 2
  const ring = Math.sqrt(1 - z * z)
  return [
    Math.cos(angle) * ring * radius,
    Math.sin(angle) * ring * radius,
    z * radius,
  ]
}

/**
 * Gira um vetor em torno de Y por `yaw` — o referencial do jogo: +Z local vira
 * a frente `(sin yaw, 0, cos yaw)` (mesma convenção de `resolveEffectRotation`).
 */
export function rotateY([x, y, z], yaw) {
  const cos = Math.cos(yaw)
  const sin = Math.sin(yaw)
  return [x * cos + z * sin, y, -x * sin + z * cos]
}

/**
 * Base de uma partícula "linha de velocidade" (`facing: 'direction'`, o
 * `lookat_direction` do Bedrock): o eixo X do quadro vai ao longo do movimento
 * (`direction`) e a face do quadro (eixo Z) olha pra câmera, o mais que der —
 * a componente de `toCamera` perpendicular a `direction`. Devolve `{ x, y, z }`
 * (vetores unitários, ortonormais). Movimento parado ou alinhado com a visão
 * não tem eixo único: cai num eixo qualquer perpendicular.
 */
export function resolveBeamBasis(direction, toCamera) {
  const x = normalize(direction)
  const along = x[0] * toCamera[0] + x[1] * toCamera[1] + x[2] * toCamera[2]
  let z = [
    toCamera[0] - x[0] * along,
    toCamera[1] - x[1] * along,
    toCamera[2] - x[2] * along,
  ]
  if (Math.hypot(z[0], z[1], z[2]) < 1e-6) {
    // alinhado com a visão: qualquer perpendicular serve
    z = Math.abs(x[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]
    const d = x[0] * z[0] + x[1] * z[1] + x[2] * z[2]
    z = [z[0] - x[0] * d, z[1] - x[1] * d, z[2] - x[2] * d]
  }
  z = normalize(z)
  // y = z × x
  const y = [
    z[1] * x[2] - z[2] * x[1],
    z[2] * x[0] - z[0] * x[2],
    z[0] * x[1] - z[1] * x[0],
  ]
  return { x, y, z }
}

function anchorPoint(anchor, ctx) {
  switch (anchor) {
    case 'path':
      // do corpo da criatura (0, 0, -length) até o impacto (0, 0, 0)
      return [0, 0, -ctx.length * (1 - ctx.progress)]
    case 'origin':
      return [0, 0, -ctx.length]
    case 'impact':
    default:
      return [0, 0, 0]
  }
}

/**
 * Cria o estado de UMA partícula a partir do spec do emissor.
 * `ctx`: `{ age, progress, length, scale, radius, frame }` — idade do emissor,
 * fração (0..1) já percorrida da janela de emissão, comprimento do golpe,
 * multiplicador de tamanho, raio do golpe e, opcional, o QUADRO do emissor
 * (`frame: { origin: [x, y, z], yaw, height }`): quando presente, tudo o que o
 * spec calcula (posição, velocidade, aceleração) é no referencial LOCAL da
 * criatura (+Z = pra onde ela olha) e a partícula nasce no MUNDO, na origem e
 * girada pelo `yaw` do quadro — o jeito de um efeito acompanhar quem se move
 * (o dash). `height` (altura do corpo) fica em `ctx.height` pros specs.
 *
 * Spec com `path` (o `particle_motion_parametric` do Bedrock): em vez de
 * velocidade e aceleração, a posição é uma FUNÇÃO da idade — ver
 * `stepPathParticle`. `direction`/`speed`/`accel`/`drag` não são usados.
 */
export function spawnParticle(spec, ctx, random) {
  const rnd = Array.from({ length: RANDOM_COUNT }, () => random())
  // 'line': um ponto sorteado em TODO o trajeto, criatura → impacto — o jeito
  // de o efeito já aparecer inteiro no instante do golpe, sem "viajar".
  const base =
    spec.anchor === 'line'
      ? [0, 0, -ctx.length * random()]
      : anchorPoint(spec.anchor, ctx)
  const shell = spec.shellRadius
    ? randomOnSphere(spec.shellRadius(ctx) * ctx.scale, random)
    : [0, 0, 0]
  // deslocamento fixo (metros, ×escala) somado ao ponto de nascimento
  const offset = spec.offset ? spec.offset(ctx, rnd) : [0, 0, 0]
  const parametric = Boolean(spec.path)
  const [dx, dy, dz] = parametric
    ? [0, 0, 0]
    : normalize(spec.direction(ctx, rnd))
  const speed = parametric ? 0 : spec.speed(ctx, rnd)
  const [ax, ay, az] = parametric ? [0, 0, 0] : spec.accel(ctx, rnd)

  let position = [
    base[0] + shell[0] + offset[0] * ctx.scale,
    base[1] + shell[1] + offset[1] * ctx.scale,
    base[2] + shell[2] + offset[2] * ctx.scale,
  ]
  let velocity = [dx * speed, dy * speed, dz * speed]
  let accel = [ax, ay, az]
  if (ctx.frame) {
    // do referencial da criatura pro mundo
    const { origin, yaw } = ctx.frame
    const rotated = rotateY(position, yaw)
    position = [
      origin[0] + rotated[0],
      origin[1] + rotated[1],
      origin[2] + rotated[2],
    ]
    velocity = rotateY(velocity, yaw)
    accel = rotateY(accel, yaw)
  }

  const particle = {
    x: position[0],
    y: position[1],
    z: position[2],
    vx: velocity[0],
    vy: velocity[1],
    vz: velocity[2],
    ax: accel[0],
    ay: accel[1],
    az: accel[2],
    drag: parametric ? 0 : spec.drag(ctx, rnd),
    age: 0,
    life: spec.lifetime(ctx, rnd),
    rnd,
    scale: ctx.scale,
    // giro inicial em quartos de volta: `true` sorteia 0..3; uma função
    // devolve o valor (pode ser negativo, ex.: o -90° do Scratch)
    spin:
      typeof spec.spin === 'function'
        ? spec.spin(rnd)
        : spec.spin
          ? Math.floor(random() * 4)
          : 0,
  }
  if (parametric) {
    // ponto de nascimento no MUNDO e o referencial pra girar o `path`
    particle.anchor = position
    particle.yaw = ctx.frame?.yaw ?? 0
    // o que o `path` pode ler do emissor no instante em que nasceu
    particle.emitter = { age: ctx.age, radius: ctx.radius, height: ctx.height }
    placeOnPath(spec, particle)
  }
  return particle
}

/**
 * Avança uma partícula de spec com `path` (`particle_motion_parametric`): a
 * posição é `anchor + path(...)`, girada pelo `yaw` do quadro e multiplicada
 * pela escala. `spec.path(age, particle)` devolve `[x, y, z]` em metros, no
 * referencial LOCAL (+Z = frente), a partir de onde a partícula nasceu —
 * lê `particle.age`/`life`/`rnd` e `particle.emitter` (`age` do emissor no
 * nascimento, `radius`, `height`). Devolve `false` quando a vida acabou.
 */
export function stepPathParticle(spec, particle, dt) {
  particle.age += dt
  placeOnPath(spec, particle)
  return particle.age < particle.life
}

function placeOnPath(spec, particle) {
  const local = spec.path(particle.age, particle)
  const [x, y, z] = rotateY(
    [
      local[0] * particle.scale,
      local[1] * particle.scale,
      local[2] * particle.scale,
    ],
    particle.yaw,
  )
  particle.x = particle.anchor[0] + x
  particle.y = particle.anchor[1] + y
  particle.z = particle.anchor[2] + z
}

/**
 * Avança a partícula `dt` segundos: `v += (a - drag·v)·dt`, `p += v·dt`
 * (o arrasto do Bedrock age contra a velocidade). Devolve `false` quando a
 * vida acabou.
 */
export function stepParticle(particle, dt) {
  particle.age += dt
  particle.vx += (particle.ax - particle.drag * particle.vx) * dt
  particle.vy += (particle.ay - particle.drag * particle.vy) * dt
  particle.vz += (particle.az - particle.drag * particle.vz) * dt
  particle.x += particle.vx * dt
  particle.y += particle.vy * dt
  particle.z += particle.vz * dt
  return particle.age < particle.life
}

/**
 * Tamanho da partícula agora, em metros, já multiplicado pela escala do golpe:
 * um número (lado do quadrado) ou, pra linha de velocidade, `[comprimento,
 * espessura]` — o spec devolve o tamanho cru e a mesma forma volta.
 */
export function particleSize(spec, particle) {
  const t = particle.age / particle.life
  const size = spec.size(t, particle.rnd)
  if (Array.isArray(size)) {
    return size.map((value) => Math.max(0, value) * particle.scale)
  }
  return Math.max(0, size) * particle.scale
}
