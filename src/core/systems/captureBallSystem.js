import { GAME_CONFIG } from '../gameConfig'
import { castRay, castRayWithNormal } from '../physics/raycast'
import { isPhysicsReady } from '../physics/physicsWorld'
import { gameplayRng } from '../rng'
import { rollShake } from '../battle/capture'
import { captureBallBroke, captureShook } from '../events'
import {
  findWildByCollider,
  findWildHit,
  sweepBall,
} from '../battle/captureFlight'
import {
  capturarSelvagem,
  comecarCaptura,
  resolveCaptureTarget,
  selvagemEscapou,
} from '../actions/capture'
import { resolveOwner } from '../actions/owner'
import { verticalClearance } from '../physics/colliders'
import { getSpecies } from '../data/species'
import {
  CaptureBall,
  PhysicsBody,
  Position,
  Velocity,
  WildCreature,
} from '../traits'

// Folga (m) acima da bola de onde sai o raio que procura o chão — pequena:
// maior, o raio podia nascer dentro de um obstáculo do lado e "achar" o topo
// dele.
const GROUND_PROBE_LIFT = 0.05
// Até onde (m) o raio procura o chão embaixo da bola.
const GROUND_PROBE_DEPTH = 50
const DOWN = { x: 0, y: -1, z: 0 }
const UP = { x: 0, y: 1, z: 0 }
// Superfície com a normal mais em pé que isto (y) conta como chão.
const FLOOR_NORMAL_Y = 0.7
// Folga (m) em que a bola rolando ainda conta como encostada no chão.
const FLOOR_SNAP = 0.02
// Quantas vezes, num tick, a bola pode encostar e seguir deslizando.
const SLIDE_STEPS = 3

/**
 * A Pokébola de captura (docs/features/043-captura.md), fase a fase
 * (`CaptureBall.state`):
 *
 * - `'flying'` — em arco (gravidade `CAPTURE.GRAVITY`). A cada tick varre o
 *   caminho: encostou num selvagem (`findWildHit`, cápsula + raio da bola)
 *   → `comecarCaptura`; bateu em outra coisa (chão, parede, criatura do
 *   time, treinador — raycast) ou voou demais → `'missed'`.
 * - `'absorbing'` — parada no ar enquanto ele entra; depois `'falling'`.
 * - `'falling'` — cai até o chão embaixo dela; depois `'shaking'`.
 * - `'shaking'` — a cada `SHAKE_INTERVAL`, uma balançada sorteada com
 *   `shakeChance` (`rng`); falhou → `selvagemEscapou` (`'escaped'`); todas
 *   passaram → depois de `RESULT_DELAY`, `capturarSelvagem` (`'caught'`).
 * - `'caught'` / `'escaped'` — fica `CAUGHT_LINGER` pros efeitos e some.
 * - `'missed'` — rola com física só visual e, depois de `MISS_LIFETIME`,
 *   quebra (`captureBallBroke`) e some.
 *
 * O selvagem sumir no meio (não deveria) termina como escape sem efeito.
 * As trocas de fase que mexem em outras entidades ficam pra depois do
 * `updateEach` (um `set` lá dentro num trait da query seria sobrescrito).
 *
 * Headless. Fase: simulation — depois do `burnSystem`/`faintSystem` (quem
 * desmaia na bola já está desmaiado ao resolver) e antes do
 * `characterPhysicsSystem`.
 */
export function captureBallSystem(context) {
  const { world, delta, events } = context
  const rng = context.rng ?? gameplayRng
  const CAPTURE = GAME_CONFIG.CAPTURE

  const transitions = []
  world
    .query(CaptureBall, Position, Velocity)
    .updateEach(([ball, pos, vel], entity) => {
      ball.timer += delta

      switch (ball.state) {
        case 'flying':
          flyBall(world, entity, ball, pos, vel, delta, transitions)
          return
        case 'absorbing':
          pos.y = ball.hitY + resolveAbsorbHop(ball.timer)
          if (ball.timer >= CAPTURE.ABSORB_DURATION) {
            ball.state = 'falling'
            ball.timer = 0
            vel.x = 0
            vel.y = 0
            vel.z = 0
          }
          return
        case 'falling':
          vel.y += CAPTURE.FALL_GRAVITY * delta
          pos.y += vel.y * delta
          if (pos.y <= ball.floorY + CAPTURE.BALL_RADIUS) {
            pos.y = ball.floorY + CAPTURE.BALL_RADIUS
            vel.y = 0
            ball.state = 'shaking'
            ball.timer = 0
          }
          return
        case 'shaking':
          shakeBall(entity, ball, rng, events, transitions)
          return
        case 'caught':
        case 'escaped':
          if (ball.timer >= CAPTURE.CAUGHT_LINGER) {
            transitions.push({ kind: 'destroy', entity })
          }
          return
        case 'missed':
          rollMissedBall(entity, ball, pos, vel, delta)
          if (ball.timer >= CAPTURE.MISS_LIFETIME) {
            transitions.push({ kind: 'broke', entity })
          }
      }
    })

  for (const transition of transitions) {
    applyTransition(world, events, rng, transition)
  }
}

function flyBall(world, entity, ball, pos, vel, delta, transitions) {
  const CAPTURE = GAME_CONFIG.CAPTURE
  ball.flightTime += delta
  vel.y += CAPTURE.GRAVITY * delta

  const seg = { x: vel.x * delta, y: vel.y * delta, z: vel.z * delta }
  const segLength = Math.hypot(seg.x, seg.y, seg.z)
  if (segLength === 0) return

  const thrower = resolveOwner(entity)
  const excludeColliderHandle = thrower?.get(PhysicsBody)?.colliderHandle
  const dir = {
    x: seg.x / segLength,
    y: seg.y / segLength,
    z: seg.z / segLength,
  }
  // Até onde ela vai antes de encostar em alguma coisa (`sweepBall`).
  const sweep = sweepBall(pos, dir, segLength, { excludeColliderHandle })
  const worldHit = sweep.hit
  const wildHit = findWildHit(world, pos, seg, sweep.travel)

  // O selvagem atingido pelo raio (a cápsula dele) também vale.
  const rayWild = worldHit
    ? findWildByCollider(world, worldHit.colliderHandle)
    : null
  const wild = wildHit?.wild ?? rayWild
  if (wild) {
    const point = wildHit?.point ?? worldHit.point
    pos.x = point.x
    pos.y = point.y
    pos.z = point.z
    transitions.push({ kind: 'hitWild', entity, wild, velocity: { ...vel } })
    return
  }

  if (worldHit) {
    // Bateu no chão/parede/outra criatura: encosta, quica pela superfície e
    // vira bola perdida.
    pos.x += dir.x * sweep.travel
    pos.y += dir.y * sweep.travel
    pos.z += dir.z * sweep.travel
    bounceOff(ball, vel, worldHit.normal, delta)
    becomeMissed(ball, pos)
    return
  }

  pos.x += seg.x
  pos.y += seg.y
  pos.z += seg.z
  if (ball.flightTime >= CAPTURE.MAX_FLIGHT_TIME) becomeMissed(ball, pos)
}

/**
 * Quanto a bola já subiu no pulinho da absorção, `timer` segundos depois do
 * acerto: sobe `ABSORB_HOP_HEIGHT` em `ABSORB_HOP_TIME`, desacelerando
 * (ease-out), e fica lá.
 */
export function resolveAbsorbHop(timer) {
  const { ABSORB_HOP_HEIGHT, ABSORB_HOP_TIME } = GAME_CONFIG.CAPTURE
  if (!(ABSORB_HOP_TIME > 0)) return ABSORB_HOP_HEIGHT
  const progress = Math.min(1, Math.max(0, timer / ABSORB_HOP_TIME))
  return ABSORB_HOP_HEIGHT * (1 - (1 - progress) * (1 - progress))
}

function becomeMissed(ball, pos) {
  ball.state = 'missed'
  ball.timer = 0
  // Só pra quando não há física (o chão plano onde ela estava).
  ball.floorY = pos.y - GAME_CONFIG.CAPTURE.BALL_RADIUS
}

function shakeBall(entity, ball, rng, events, transitions) {
  const { SHAKE_COUNT, SHAKE_INTERVAL, RESULT_DELAY } = GAME_CONFIG.CAPTURE
  if (!resolveCaptureTarget(entity)) {
    ball.state = 'escaped'
    ball.timer = 0
    return
  }
  if (ball.shakes >= SHAKE_COUNT) {
    if (ball.timer >= RESULT_DELAY) transitions.push({ kind: 'caught', entity })
    return
  }
  if (ball.timer < SHAKE_INTERVAL) return

  ball.timer = 0
  if (rollShake(rng, ball.shakeChance)) {
    ball.shakes += 1
    events?.emit(captureShook({ ball: entity, shake: ball.shakes }))
  } else {
    transitions.push({ kind: 'escaped', entity })
  }
}

/**
 * Física só visual da bola que errou: cai, bate no que estiver no caminho
 * (chão, parede, obstáculo, criatura — o raio do trecho, com a normal da
 * superfície), quica perdendo força (`bounceOff`), rola com atrito e para.
 * Sem física carregada, o chão plano onde ela errou (`floorY`).
 */
function rollMissedBall(entity, ball, pos, vel, delta) {
  if (ball.resting) return
  const { BALL_RADIUS, GRAVITY } = GAME_CONFIG.CAPTURE
  vel.y += GRAVITY * delta

  if (!isPhysicsReady()) {
    pos.x += vel.x * delta
    pos.y += vel.y * delta
    pos.z += vel.z * delta
    const restY = ball.floorY + BALL_RADIUS
    if (pos.y > restY) return
    pos.y = restY
    bounceOff(ball, vel, UP, delta)
    return
  }

  const exclude = {
    excludeColliderHandle:
      resolveOwner(entity)?.get(PhysicsBody)?.colliderHandle,
  }
  const seg = { x: vel.x * delta, y: vel.y * delta, z: vel.z * delta }
  const segLength = Math.hypot(seg.x, seg.y, seg.z)
  let touched = false
  let remaining = segLength
  let dir =
    segLength > 0
      ? { x: seg.x / segLength, y: seg.y / segLength, z: seg.z / segLength }
      : null
  // Colide e desliza: encostou, o resto do trecho segue ao longo da
  // superfície (senão, rolando devagar, a gravidade apontava o caminho pro
  // chão e ela travava).
  for (let step = 0; dir && step < SLIDE_STEPS && remaining > 1e-6; step++) {
    const sweep = sweepBall(pos, dir, remaining, exclude)
    pos.x += dir.x * sweep.travel
    pos.y += dir.y * sweep.travel
    pos.z += dir.z * sweep.travel
    remaining -= sweep.travel
    if (!sweep.hit) break

    const { normal } = sweep.hit
    bounceOff(ball, vel, normal, touched ? 0 : delta)
    touched = true
    const into = dir.x * normal.x + dir.y * normal.y + dir.z * normal.z
    const slide = {
      x: dir.x - normal.x * into,
      y: dir.y - normal.y * into,
      z: dir.z - normal.z * into,
    }
    const slideLength = Math.hypot(slide.x, slide.y, slide.z)
    if (slideLength < 1e-6) break
    dir = {
      x: slide.x / slideLength,
      y: slide.y / slideLength,
      z: slide.z / slideLength,
    }
    remaining *= slideLength
  }
  if (!touched) keepOnFloor(ball, pos, vel, delta, exclude)
}

/**
 * Rolando quase na horizontal, o caminho não "vê" o chão logo abaixo: uma
 * sonda curta pra baixo mantém o centro a um raio dele (e conta como
 * contato).
 */
function keepOnFloor(ball, pos, vel, delta, exclude) {
  const { BALL_RADIUS } = GAME_CONFIG.CAPTURE
  const hit = castRayWithNormal(
    { x: pos.x, y: pos.y + BALL_RADIUS, z: pos.z },
    DOWN,
    BALL_RADIUS * 2 + FLOOR_SNAP,
    exclude,
  )
  if (!hit || hit.normal.y <= FLOOR_NORMAL_Y) return
  const restY = hit.point.y + BALL_RADIUS
  if (pos.y > restY + FLOOR_SNAP) return
  pos.y = Math.max(pos.y, restY)
  bounceOff(ball, vel, hit.normal, delta)
}

/**
 * Bola encostando numa superfície de normal `normal`: a parte da velocidade
 * contra ela volta multiplicada por `RESTITUTION` (forte o bastante — acima
 * de `LANDING_MIN_SPEED` — conta como quique, `landings`; fraca, só
 * assenta), a parte ao longo dela perde `FRICTION` por segundo. Num chão
 * (normal pra cima) e devagar (`REST_SPEED`), para.
 */
function bounceOff(ball, vel, normal, delta) {
  const { RESTITUTION, FRICTION, REST_SPEED, LANDING_MIN_SPEED } =
    GAME_CONFIG.CAPTURE.MISS_PHYSICS
  const into = vel.x * normal.x + vel.y * normal.y + vel.z * normal.z
  if (into < 0) {
    const bounces = -into >= LANDING_MIN_SPEED
    if (bounces) ball.landings += 1
    // Tira a parte contra a superfície e devolve a fração do quique.
    const back = bounces ? -into * RESTITUTION : 0
    vel.x += normal.x * (back - into)
    vel.y += normal.y * (back - into)
    vel.z += normal.z * (back - into)
  }
  const keep = Math.max(0, 1 - FRICTION * delta)
  const along = vel.x * normal.x + vel.y * normal.y + vel.z * normal.z
  vel.x = (vel.x - normal.x * along) * keep + normal.x * along
  vel.y = (vel.y - normal.y * along) * keep + normal.y * along
  vel.z = (vel.z - normal.z * along) * keep + normal.z * along

  const onFloor = normal.y > FLOOR_NORMAL_Y
  if (
    onFloor &&
    Math.abs(along) < 1e-6 &&
    Math.hypot(vel.x, vel.y, vel.z) < REST_SPEED
  ) {
    vel.x = 0
    vel.y = 0
    vel.z = 0
    ball.resting = true
  }
}

/** Altura do terreno embaixo de `pos`; sem física (ou nada embaixo), `fallback`. */
function resolveFloorY(pos, fallback) {
  const hit = castRay(
    { x: pos.x, y: pos.y + GROUND_PROBE_LIFT, z: pos.z },
    DOWN,
    GROUND_PROBE_LIFT + GROUND_PROBE_DEPTH,
    { terrainOnly: true },
  )
  return hit ? hit.point.y : fallback
}

/** O chão embaixo do selvagem: a base da cápsula dele. */
function resolveWildFloorY(wild) {
  const center = wild.get(Position)
  const species = getSpecies(wild.get(WildCreature)?.speciesId)
  const lift = species?.body ? verticalClearance(species.body) : 0
  return center.y - lift
}

function applyTransition(world, events, rng, { kind, entity, wild, velocity }) {
  if (!entity.isAlive()) return

  if (kind === 'destroy') {
    entity.destroy()
    return
  }
  if (kind === 'broke') {
    const pos = entity.get(Position)
    events?.emit(
      captureBallBroke({
        itemId: entity.get(CaptureBall).itemId,
        position: { x: pos.x, y: pos.y, z: pos.z },
      }),
    )
    entity.destroy()
    return
  }
  if (kind === 'hitWild') {
    const floorY = resolveFloorY(entity.get(Position), resolveWildFloorY(wild))
    if (comecarCaptura(world, events, entity, wild, velocity)) {
      entity.set(CaptureBall, { floorY, hitY: entity.get(Position).y })
    }
    return
  }
  if (kind === 'escaped') {
    selvagemEscapou(world, events, entity, rng)
    entity.set(CaptureBall, { state: 'escaped', timer: 0 })
    return
  }
  if (kind === 'caught') {
    const pokemon = capturarSelvagem(world, events, entity)
    entity.set(CaptureBall, {
      state: pokemon ? 'caught' : 'escaped',
      timer: 0,
    })
  }
}
