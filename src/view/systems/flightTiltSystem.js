import { GAME_CONFIG } from '@/core/gameConfig'
import { clamp, wrapAngle } from '@/core/math'
import { FlightStats, Flying, Velocity } from '@/core/traits'
import { getView } from '@/view/registry/viewRegistry'

/**
 * Inclinação do corpo no voo livre (docs/features/060-ajustes-por-
 * especie.md, Parte 2) — só no modelo; a cápsula, a colisão e os golpes não
 * mudam. O dump não tem clipe de curva, então é procedural, por cima de
 * qualquer animação:
 *
 * - **roll**: deita pro lado da curva, proporcional à rapidez do giro
 *   (`ROLL_PER_TURN`, até `MAX_ROLL`) — como avião e pássaro;
 * - **pitch**: levanta o bico subindo e abaixa descendo — o ângulo da
 *   subida × `PITCH_FACTOR` (até `MAX_PITCH`), pesado pela fração da
 *   velocidade de voo que vai no plano: subindo reto (só Espaço) ou
 *   descendo pairado (o teto da stamina) não aponta o bico.
 *
 * Fora do voo volta a zero. Tudo suave (`SMOOTHING`), e o giro é medido no
 * yaw que a tela mostra (o grupo da entidade, depois do `syncTransformSystem`).
 *
 * Aplicado no grupo da entidade (`getView`), cujo centro é o do corpo — o
 * pivô certo — com a ordem 'YXZ': o yaw do `syncTransformSystem` primeiro,
 * depois a inclinação no referencial do pássaro.
 *
 * Fase: presentation, depois do `syncTransformSystem`.
 */

/**
 * Estado por entidade: `{ roll, pitch, yaw }` (o yaw do frame anterior).
 * `Map`, não `WeakMap`: a entidade do koota é um número. Quem sai da query
 * (recolhida, destruída) sai daqui no mesmo frame.
 */
const states = new Map()

/**
 * Próximo `{ roll, pitch }` (rad; no Three: roll é o giro em Z, pitch em X
 * com o sinal trocado — ver o system). `turnRate`: rad/s do yaw (positivo =
 * curva pra esquerda). `vel`: velocidade; `flightSpeed`: a do voo normal.
 */
export function resolveFlightTilt(
  current,
  { flying, turnRate, vel, flightSpeed },
  delta,
  tilt = GAME_CONFIG.FLIGHT.TILT,
) {
  let targetRoll = 0
  let targetPitch = 0
  if (flying) {
    // pra esquerda (yaw subindo), a asa esquerda desce
    targetRoll = clamp(
      -turnRate * tilt.ROLL_PER_TURN,
      -tilt.MAX_ROLL,
      tilt.MAX_ROLL,
    )
    const ahead = Math.hypot(vel.x, vel.z)
    const weight = flightSpeed > 0 ? Math.min(1, ahead / flightSpeed) : 0
    targetPitch = clamp(
      Math.atan2(vel.y, ahead) * tilt.PITCH_FACTOR * weight,
      -tilt.MAX_PITCH,
      tilt.MAX_PITCH,
    )
  }
  const k = 1 - Math.exp(-tilt.SMOOTHING * delta)
  return {
    roll: current.roll + (targetRoll - current.roll) * k,
    pitch: current.pitch + (targetPitch - current.pitch) * k,
  }
}

export function flightTiltSystem(context) {
  const { world, delta } = context
  if (!(delta > 0)) return

  const seen = new Set()
  world.query(FlightStats, Velocity).forEach((entity) => {
    const view = getView(entity)
    if (!view) return
    seen.add(entity)

    const yaw = view.rotation.y
    const state = states.get(entity) ?? { roll: 0, pitch: 0, yaw }
    const turnRate = wrapAngle(yaw - state.yaw) / delta
    const next = resolveFlightTilt(
      state,
      {
        flying: entity.has(Flying),
        turnRate,
        vel: entity.get(Velocity),
        flightSpeed: entity.get(FlightStats).speed,
      },
      delta,
    )
    states.set(entity, { ...next, yaw })

    view.rotation.order = 'YXZ'
    // bico pra cima é giro NEGATIVO em X (o +Z da frente sobe)
    view.rotation.x = -next.pitch
    view.rotation.z = next.roll
  })
  for (const entity of states.keys()) {
    if (!seen.has(entity)) states.delete(entity)
  }
}
