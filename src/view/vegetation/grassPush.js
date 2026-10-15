import * as THREE from 'three'
import { TEST_LEVEL } from '@/core/data/testLevel'
import { GAME_CONFIG } from '@/core/gameConfig'
import { verticalClearance } from '@/core/physics/capsule'
import { CharacterController, Position } from '@/core/traits'
import { resolveRenderPosition } from '@/view/registry/renderInterpolation'

/**
 * Vegetação abrindo para quem passa (docs/features/053-planicie-com-
 * assets-do-lgpe.md): as plantas — grama, tufos, flores, arbustos e
 * plantas largas do Let's Go; árvores não — dobram para
 * longe do treinador e das criaturas (`CharacterController`) — os `MAX_PUSHERS`
 * mais perto da câmera.
 *
 * A grama tem **memória**: um mapa visto de cima em volta da câmera
 * (`GRASS_PUSH.AREA` m, `MAP_SIZE` texels), atualizado na placa de vídeo
 * uma vez por quadro. Em cada texel fica o empurrão de agora (xy: direção
 * vezes força) e a velocidade dele (zw). A cada quadro o mapa:
 *
 * - **puxa para o carimbo** de quem está perto, numa mola amortecida
 *   (sem quicar) — parte parada, acelera e assenta: a grama tocada deita
 *   em cerca de `ATTACK` s e, solta, levanta em cerca de `RECOVERY` s, do
 *   jeito que foi deitada. A velocidade da mola fica no mapa (zw) e dá o
 *   tremor das folhas enquanto se mexem.
 *
 * O mapa anda com a câmera presa à grade dos texels (sem tremer) e cada
 * quadro lê o anterior pela posição no mundo. A grama lê o mapa na origem
 * de cada planta (`GRASS_PUSH_SHADER`, em toonMaterial.js).
 *
 * Só apresentação: lê o ECS (posição desenhada) e escreve uniforms
 * (`grassPushUniforms`, os mesmos objetos em todos os materiais com o
 * empurrão).
 */

/**
 * O empurrão no shader das plantas (o toon do LGPE), depois do
 * `WIND_SHADER` (usa `vegToLocalFrame` e o tempo do
 * vento): `vegPush(y, altura, origem, giro, semente, dobra)` lê o mapa na
 * origem da planta e devolve o deslocamento (espaço local da instância)
 * na mesma dobra em arco do vento, com o tremor enquanto ela se mexe.
 * `dobra`: `uPushBend` (grama, tufo, flor) ou `uPushBushBend` (arbusto e
 * planta larga, mais altos).
 */
export const GRASS_PUSH_SHADER = /* glsl */ `
uniform sampler2D uPushMap;
uniform vec3 uPushArea;
uniform float uPushBend;
uniform float uPushBushBend;
uniform float uPushRustle;
uniform float uPushRustleSpeed;

vec3 vegPush(float y, float height, vec2 origin, vec2 facing, float seed, float maxBend) {
  vec2 uv = (origin - uPushArea.xy) / uPushArea.z + 0.5;
  if (any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))) return vec3(0.0);
  vec4 stored = texture2D(uPushMap, uv);
  float amount = min(length(stored.xy), 1.0);
  if (amount < 1e-3) return vec3(0.0);
  vec2 direction = stored.xy / length(stored.xy);
  float eased = amount * amount * (3.0 - 2.0 * amount);
  float moving = min(length(stored.zw) / uPushRustleSpeed, 1.0);
  float tremble = sin(uWindTime * 4.0 + seed * 6.28318) * uPushRustle * moving;
  float bend = max(maxBend * eased + tremble * maxBend / max(uPushBend, 1e-3), 0.0);
  vec2 arc = vegArc(y, height, bend, 1.6);
  return vegToLocalFrame(direction * arc.x, arc.y, facing);
}
`

// Quantos carimbam ao mesmo tempo (tamanho do array no shader do mapa).
export const MAX_PUSHERS = 6

/** Uniforms que a grama lê: o mapa e onde ele está no mundo. */
export const grassPushUniforms = {
  uPushMap: { value: null },
  // xy: centro do mapa (mundo, xz); z: lado (m).
  uPushArea: { value: new THREE.Vector3(0, 0, 1) },
  uPushBend: { value: 0 },
  uPushBushBend: { value: 0 },
  uPushRustle: { value: 0 },
  uPushRustleSpeed: { value: 1 },
}

// Passo máximo (s) da mola por quadro.
const MAX_STEP = 1 / 30
// Rapidez × tempo em que a mola (sem quicar) chega quase toda ao alvo.
const SETTLE = 4
// Rapidez × passo máximo com que a mola continua estável (com folga).
const STABLE = 0.5

/**
 * Rapidez da mola (1/s) para assentar em cerca de `seconds` s (deitar ou
 * voltar). Limitada para a mola ficar estável no passo `maxStep`; sem
 * tempo, a mais rápida possível.
 */
export function springRate(seconds, maxStep) {
  const limit = STABLE / maxStep
  return seconds > 0 ? Math.min(SETTLE / seconds, limit) : limit
}

/**
 * Força do carimbo pela altura do pé acima do chão: inteira no chão,
 * sumindo até `gate` m (pulo).
 */
export function liftStrength(heightAboveGround, gate) {
  const t = Math.min(Math.max(heightAboveGround / Math.max(gate, 1e-3), 0), 1)
  return 1 - t * t * (3 - 2 * t)
}

/**
 * Os `count` mais perto de `point` (xz) entre `candidates` (`{ x, z }`),
 * do mais perto para o mais longe.
 */
export function nearestPushers(candidates, point, count) {
  return candidates
    .map((item) => ({
      item,
      distance: Math.hypot(item.x - point.x, item.z - point.z),
    }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, count)
    .map(({ item }) => item)
}

/** Raio do corpo no chão: o da cápsula, mais o comprimento se deitada. */
export function footprintRadius(body) {
  const lying = body.capsuleAxis && body.capsuleAxis !== 'y'
  return body.capsuleRadius + (lying ? body.capsuleHalfHeight : 0)
}

// Atualização do mapa: lê o anterior (pela posição no mundo), esmaece e
// puxa para o carimbo de cada um (afastando do corpo, inteiro no miolo e
// suave na borda).
const UPDATE_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`
const UPDATE_FRAGMENT = /* glsl */ `
uniform sampler2D uPrevious;
uniform vec2 uPreviousCenter;
uniform vec2 uCenter;
uniform float uArea;
uniform float uDelta;
uniform float uAttackRate;
uniform float uRecoveryRate;
uniform float uInner;
uniform vec4 uPushers[${MAX_PUSHERS}];
// Para onde anda (abre para a frente bem no meio do corpo).
uniform vec2 uPusherHeading[${MAX_PUSHERS}];
varying vec2 vUv;

void main() {
  vec2 world = uCenter + (vUv - 0.5) * uArea;
  vec2 previousUv = (world - uPreviousCenter) / uArea + 0.5;
  bool inside = all(greaterThanEqual(previousUv, vec2(0.0)))
    && all(lessThanEqual(previousUv, vec2(1.0)));
  // xy: o empurrão guardado; zw: a velocidade dele (a mola).
  vec4 state = inside ? texture2D(uPrevious, previousUv) : vec4(0.0);

  vec2 push = vec2(0.0);
  for (int i = 0; i < ${MAX_PUSHERS}; i++) {
    vec4 pusher = uPushers[i];
    if (pusher.w <= 0.0) continue;
    vec2 away = world - pusher.xy;
    float distance = length(away);
    float weight = (1.0 - smoothstep(pusher.z * uInner, pusher.z, distance)) * pusher.w;
    vec2 direction = distance > 1e-3 ? away / distance : uPusherHeading[i];
    push += direction * weight;
  }
  float amount = min(length(push), 1.0);
  vec2 target = amount > 1e-4 ? normalize(push) * amount : vec2(0.0);

  // Mola amortecida sem quicar: parte parada, acelera e assenta — deita
  // no ritmo de deitar (o empurrão crescendo) e levanta no de voltar.
  float rate = amount >= length(state.xy) ? uAttackRate : uRecoveryRate;
  vec2 velocity = state.zw
    + (rate * rate * (target - state.xy) - 2.0 * rate * state.zw) * uDelta;
  vec2 value = state.xy + velocity * uDelta;
  gl_FragColor = vec4(value, velocity);
}
`

function createTarget(size) {
  const target = new THREE.WebGLRenderTarget(size, size, {
    type: THREE.HalfFloatType,
    format: THREE.RGBAFormat,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: false,
    stencilBuffer: false,
  })
  target.texture.generateMipmaps = false
  return target
}

/**
 * O mapa do empurrão (dois alvos que se revezam) e a cena de um quadrado
 * que o atualiza. `update` uma vez por quadro; `dispose` ao desmontar.
 */
export function createGrassPushMap() {
  let size = 0
  let targets = []
  let current = 0
  const center = new THREE.Vector2()
  const previousCenter = new THREE.Vector2()
  let hasPrevious = false
  const material = new THREE.ShaderMaterial({
    vertexShader: UPDATE_VERTEX,
    fragmentShader: UPDATE_FRAGMENT,
    uniforms: {
      uPrevious: { value: null },
      uPreviousCenter: { value: previousCenter },
      uCenter: { value: center },
      uArea: { value: 1 },
      uDelta: { value: 0 },
      uAttackRate: { value: 1 },
      uRecoveryRate: { value: 1 },
      uInner: { value: 0 },
      uPushers: {
        value: Array.from({ length: MAX_PUSHERS }, () => new THREE.Vector4()),
      },
      uPusherHeading: {
        value: Array.from({ length: MAX_PUSHERS }, () => new THREE.Vector2()),
      },
    },
    depthTest: false,
    depthWrite: false,
  })
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material)
  quad.frustumCulled = false
  const scene = new THREE.Scene()
  scene.add(quad)
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  const drawn = {}
  const lastSeen = new Map()

  function resize(next) {
    if (next === size) return
    for (const target of targets) target.dispose()
    size = next
    targets = [createTarget(size), createTarget(size)]
    hasPrevious = false
  }

  function update(renderer, world, focus, delta) {
    const { GRASS_PUSH } = GAME_CONFIG
    resize(GRASS_PUSH.MAP_SIZE)
    const area = GRASS_PUSH.AREA
    const texel = area / size
    center.set(
      Math.round(focus.x / texel) * texel,
      Math.round(focus.z / texel) * texel,
    )
    if (!hasPrevious) previousCenter.copy(center)

    const uniforms = material.uniforms
    uniforms.uArea.value = area
    // A mola só é estável com passo curto: quadro longo (aba em segundo
    // plano) anda em passo limitado.
    uniforms.uDelta.value = Math.min(delta, MAX_STEP)
    uniforms.uAttackRate.value = springRate(GRASS_PUSH.ATTACK, MAX_STEP)
    uniforms.uRecoveryRate.value = springRate(GRASS_PUSH.RECOVERY, MAX_STEP)
    uniforms.uInner.value = GRASS_PUSH.INNER
    uniforms.uPrevious.value = targets[current].texture

    const bodies = []
    if (GRASS_PUSH.ENABLED) {
      world.query(Position, CharacterController).forEach((entity) => {
        const position = resolveRenderPosition(entity, drawn)
        if (!position) return
        const body = entity.get(CharacterController)
        const feet = position.y - verticalClearance(body)
        bodies.push({
          entity,
          x: position.x,
          z: position.z,
          strength: liftStrength(
            feet - TEST_LEVEL.terrain.heightAt(position.x, position.z),
            GRASS_PUSH.HEIGHT_GATE,
          ),
          radius: footprintRadius(body) + GRASS_PUSH.RADIUS,
        })
      })
    }
    const chosen = nearestPushers(bodies, focus, MAX_PUSHERS)
    const seen = new Set()
    uniforms.uPushers.value.forEach((pusher, index) => {
      const body = chosen[index]
      if (!body) {
        pusher.set(0, 0, 0, 0)
        return
      }
      seen.add(body.entity)
      const last = lastSeen.get(body.entity) ?? body
      const dx = body.x - last.x
      const dz = body.z - last.z
      const moved = Math.hypot(dx, dz)
      lastSeen.set(body.entity, { x: body.x, z: body.z })
      pusher.set(body.x, body.z, body.radius, body.strength)
      uniforms.uPusherHeading.value[index].set(
        moved > 1e-5 ? dx / moved : 1,
        moved > 1e-5 ? dz / moved : 0,
      )
    })
    for (const entity of lastSeen.keys()) {
      if (!seen.has(entity)) lastSeen.delete(entity)
    }

    const next = 1 - current
    const previousTarget = renderer.getRenderTarget()
    renderer.setRenderTarget(targets[next])
    renderer.render(scene, camera)
    renderer.setRenderTarget(previousTarget)
    current = next
    previousCenter.copy(center)
    hasPrevious = true

    grassPushUniforms.uPushMap.value = targets[current].texture
    grassPushUniforms.uPushArea.value.set(center.x, center.y, area)
    grassPushUniforms.uPushBend.value = GRASS_PUSH.BEND
    grassPushUniforms.uPushBushBend.value = GRASS_PUSH.BEND * GRASS_PUSH.BUSH
    grassPushUniforms.uPushRustle.value = GRASS_PUSH.RUSTLE
    // Velocidade da mola que dá o tremor cheio: a de deitar inteiro.
    grassPushUniforms.uPushRustleSpeed.value = springRate(
      GRASS_PUSH.ATTACK,
      MAX_STEP,
    )
  }

  function dispose() {
    for (const target of targets) target.dispose()
    material.dispose()
    quad.geometry.dispose()
    grassPushUniforms.uPushMap.value = null
  }

  return { update, dispose }
}
