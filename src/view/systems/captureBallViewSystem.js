import * as THREE from 'three'
import { GAME_CONFIG } from '@/core/gameConfig'
import { resolveOwner } from '@/core/actions/owner'
import { getItem, resolveItemAnimations } from '@/core/data/items'
import { CaptureBall, Position, Velocity } from '@/core/traits'
import { getCaptureBall } from '../registry/captureBallRegistry'
import { playBallClip } from '../ballClipPlayer'
import {
  resolveBallClip,
  resolveClickScale,
  resolveGlowScale,
  resolveStarOffset,
  resolveVanishScale,
  resolveWobbleAngle,
} from '../captureBallMotion'

// Fração do tempo do "Capturado!" em que acontece o clique.
const CLICK_SHARE = 0.25

const axis = new THREE.Vector3()
const roll = new THREE.Quaternion()
const starColor = new THREE.Color()
const breakColor = new THREE.Color()

/**
 * Anima a Pokébola de captura (docs/features/043-captura.md) pela fase dela
 * (`CaptureBall.state`), com os parâmetros de
 * `GAME_CONFIG.FEEDBACK.CAPTURE_BALL` e a matemática de
 * `captureBallMotion.js`:
 *
 * Onde a bola tem clipe no `.glb` (`item.model.animations` — hoje a Poké
 * Bola), ele faz o movimento daquela fase (`resolveBallClip`, encaixado no
 * tempo da fase); o procedural abaixo fica pra fase sem clipe:
 *
 * - voo: gira pra frente, em volta do eixo deitado perpendicular ao voo;
 * - absorção: em pé, virada pra quem arremessou, com o brilho crescendo e
 *   sumindo;
 * - balançando: a cada balançada nova (`shakes` subiu), inclina de lado e
 *   volta;
 * - capturado: o clique e as estrelinhas; some no fim;
 * - escapou: estoura (encolhe com um clarão);
 * - errou: rola pela velocidade e, no fim, quebra em pedaços.
 *
 * Fase: presentation.
 */
export function captureBallViewSystem(context) {
  const { world, delta = 0 } = context
  const BALL = GAME_CONFIG.FEEDBACK.CAPTURE_BALL
  const { CAPTURE } = GAME_CONFIG

  world
    .query(CaptureBall, Position, Velocity)
    .readEach(([ball, pos, vel], entity) => {
      const entry = getCaptureBall(entity)
      const spin = entry?.spinRef.current
      const glow = entry?.glowRef.current
      const sparks = entry?.sparksRef.current
      if (!spin || !glow || !sparks) return

      let scale = 1
      let glowScale = 0
      hideSparks(sparks)

      // Clipe do `.glb` pra esta fase (`item.model.animations`); onde tem,
      // ele faz o movimento e o procedural daquela parte sai.
      const plan = resolveBallClip(
        ball.state,
        ball.shakes,
        resolveItemAnimations(getItem(ball.itemId)),
        CAPTURE,
      )
      const clipPlaying = playBallClip(entry, plan)
      entry.mixer?.update(delta)

      if (ball.state === 'missed') {
        rollBall(spin, vel, BALL.SPIN_SPEED, delta, false)
      } else if (ball.state === 'flying') {
        if (clipPlaying) spin.rotation.set(0, Math.atan2(vel.x, vel.z), 0)
        else rollBall(spin, vel, BALL.SPIN_SPEED, delta, true)
      } else {
        faceThrower(entry, entity, pos)
        const tilt = advanceWobble(entry, ball, delta, BALL)
        const shakeClip = clipPlaying && ball.state === 'shaking'
        spin.rotation.set(0, entry.yaw, shakeClip ? 0 : tilt, 'YXZ')
      }

      if (ball.state === 'absorbing') {
        glowScale = resolveGlowScale(
          ball.timer / CAPTURE.ABSORB_DURATION,
          BALL.GLOW_MAX_SCALE,
        )
      } else if (ball.state === 'caught') {
        const progress = ball.timer / CAPTURE.CAUGHT_LINGER
        const click = clipPlaying
          ? 1
          : resolveClickScale(progress / CLICK_SHARE, BALL.CLICK_SQUASH)
        scale =
          click *
          resolveVanishScale(
            ball.timer,
            CAPTURE.CAUGHT_LINGER,
            BALL.POP_DURATION,
          )
        // Com as partículas do Cobblemon ligadas, as estrelinhas são delas
        // (`PokeballVfxView`); estas ficam de reserva.
        if (!GAME_CONFIG.FEEDBACK.POKEBALL_VFX.ENABLED) {
          showSparks(
            sparks,
            BALL.STAR_COUNT,
            progress,
            BALL.STAR_DISTANCE,
            starColor.set(BALL.STAR_COLOR),
          )
        }
      } else if (ball.state === 'escaped') {
        // Com o clipe de escape, a bola abre pelo clipe e só some no fim;
        // sem ele, estoura logo.
        scale = clipPlaying
          ? resolveVanishScale(
              ball.timer,
              CAPTURE.CAUGHT_LINGER,
              BALL.POP_DURATION,
            )
          : resolveVanishScale(ball.timer, BALL.POP_DURATION, BALL.POP_DURATION)
        glowScale = resolveGlowScale(
          ball.timer / BALL.POP_DURATION,
          BALL.GLOW_MAX_SCALE / 2,
        )
      } else if (ball.state === 'missed') {
        scale = resolveVanishScale(
          ball.timer,
          CAPTURE.MISS_LIFETIME,
          BALL.BREAK_DURATION,
        )
        const breakStart = CAPTURE.MISS_LIFETIME - BALL.BREAK_DURATION
        if (ball.timer >= breakStart && BALL.BREAK_DURATION > 0) {
          showSparks(
            sparks,
            BALL.BREAK_PIECES,
            (ball.timer - breakStart) / BALL.BREAK_DURATION,
            BALL.STAR_DISTANCE,
            breakColor.set(BALL.BREAK_COLOR),
          )
        }
      }

      spin.scale.setScalar(Math.max(scale, 1e-4))
      glow.visible = glowScale > 0
      glow.scale.setScalar(Math.max(glowScale, 1e-4))
    })
}

/** Gira a bola como se rolasse pela velocidade (no ar, `spinSpeed` voltas/s). */
function rollBall(spin, vel, spinSpeed, delta, airborne) {
  const speed = Math.hypot(vel.x, vel.z)
  if (speed < 1e-4) return
  axis.set(vel.z / speed, 0, -vel.x / speed)
  const radius = GAME_CONFIG.CAPTURE.BALL_RADIUS
  const angle = airborne
    ? spinSpeed * Math.PI * 2 * delta
    : (speed * delta) / radius
  roll.setFromAxisAngle(axis, angle)
  spin.quaternion.premultiply(roll)
}

/** Na primeira vez parada, guarda o giro pra encarar quem arremessou. */
function faceThrower(entry, entity, pos) {
  if (entry.yaw != null) return
  const thrower = resolveOwner(entity)?.get?.(Position)
  entry.yaw = thrower ? Math.atan2(thrower.x - pos.x, thrower.z - pos.z) : 0
}

/** Começa uma balançada a cada uma nova e devolve a inclinação de agora. */
function advanceWobble(entry, ball, delta, BALL) {
  if (ball.shakes > entry.lastShakes) {
    entry.lastShakes = ball.shakes
    entry.wobbleTime = 0
  }
  entry.wobbleTime += delta
  return resolveWobbleAngle(entry.wobbleTime, {
    angle: BALL.WOBBLE_ANGLE,
    cycles: BALL.WOBBLE_CYCLES,
    duration: BALL.WOBBLE_DURATION,
  })
}

function hideSparks(sparks) {
  for (const spark of sparks.children) spark.visible = false
}

function showSparks(sparks, count, progress, distance, color) {
  const shown = Math.min(count, sparks.children.length)
  for (let index = 0; index < shown; index++) {
    const spark = sparks.children[index]
    const offset = resolveStarOffset(index, shown, progress, distance)
    spark.visible = offset.scale > 0
    spark.position.set(offset.x, offset.y, offset.z)
    spark.scale.setScalar(Math.max(offset.scale, 1e-4))
    spark.material.color.copy(color)
  }
}
