import { getItem } from '../data/items'
import { getPlayerSpecies } from '../data/species'
import { GAME_CONFIG } from '../gameConfig'
import {
  resolveAimPoint,
  resolveArcLaunch,
  resolveCameraYaw,
  resolveHandOrigin,
} from '../aim'
import { traceCaptureFlight } from '../battle/captureFlight'
import { isEating } from '../actions/eating'
import {
  CaptureAim,
  CaptureAimStatus,
  CaptureAimTarget,
  HeldItem,
  InputControlled,
  Party,
  PhysicsBody,
  Position,
} from '../traits'

/**
 * Mira da Pokébola (docs/features/043-captura.md): o treinador no controle,
 * com uma Pokébola na mão, segurando o botão direito (`secondaryHeld`) e sem
 * estar comendo, está mirando. A cada tick resolve o ponto de mira (o raio
 * do retículo no enquadramento da mira), o lançamento em arco até ele
 * (`resolveArcLaunch`) e o voo previsto (`traceCaptureFlight`, o mesmo da
 * bola de verdade): onde ela bate, se pega um selvagem e se chega.
 *
 * Escreve `CaptureAim` (todo tick mirando), `CaptureAimStatus` (só quando
 * muda) e `CaptureAimTarget`. O arremesso (`playerActionSystem`) usa a
 * velocidade daqui; a view desenha o arco e a HUD o retículo.
 *
 * Headless. Fase: simulation — depois do `cameraControlSystem` (a órbita
 * deste tick) e antes do `movementSystem` (que vira o corpo pra mira) e do
 * `playerActionSystem` (que arremessa com a mira deste tick).
 */
export function captureAimSystem(context) {
  const { world } = context
  const input = context.input ?? {}
  const THROW = getPlayerSpecies().actions.throw
  const { CAPTURE } = GAME_CONFIG

  const updates = []
  world
    .query(Party, CaptureAim, HeldItem, Position, PhysicsBody)
    .updateEach(([aim, heldItem, pos, body], entity) => {
      const item = heldItem.itemId ? getItem(heldItem.itemId) : null
      const active =
        entity.has(InputControlled) &&
        item?.category === 'pokeball' &&
        !!input.secondaryHeld &&
        !isEating(entity)

      aim.active = active
      if (!active) {
        updates.push({
          entity,
          status: { active: false, onWild: false, inRange: false },
          wild: null,
        })
        return
      }

      // A bola sai da mão virada pra onde a câmera mostra (o corpo vira pra
      // lá enquanto mira).
      const origin = resolveHandOrigin(pos, resolveCameraYaw(world), THROW)
      const aimPoint = resolveAimPoint(world, pos, body.colliderHandle, {
        captureAim: true,
        range: CAPTURE.AIM.RANGE,
      })
      const velocity = resolveArcLaunch(
        origin,
        aimPoint,
        CAPTURE.THROW_SPEED,
        CAPTURE.GRAVITY,
      )
      const flight = traceCaptureFlight(world, origin, velocity, {
        excludeColliderHandle: body.colliderHandle,
        step: CAPTURE.AIM.TRACE_STEP,
      })

      aim.origin = origin
      aim.velocity = velocity
      aim.impact = flight.point
      aim.impactTime = flight.time
      aim.landed = flight.landed
      updates.push({
        entity,
        status: { active: true, onWild: !!flight.wild, inRange: flight.landed },
        wild: flight.wild,
      })
    })

  // Fora do `updateEach`: relações e o resumo pra HUD.
  for (const { entity, status, wild } of updates) {
    const current = entity.get(CaptureAimStatus)
    if (
      !current ||
      current.active !== status.active ||
      current.onWild !== status.onWild ||
      current.inRange !== status.inRange
    ) {
      if (current) entity.set(CaptureAimStatus, status)
      else entity.add(CaptureAimStatus(status))
    }
    const target = entity.targetFor(CaptureAimTarget)
    if (target === wild) continue
    if (wild) entity.add(CaptureAimTarget(wild))
    else entity.remove(CaptureAimTarget('*'))
  }
}
