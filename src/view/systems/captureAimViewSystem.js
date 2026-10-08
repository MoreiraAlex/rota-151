import * as THREE from 'three'
import { GAME_CONFIG } from '@/core/gameConfig'
import { verticalClearance } from '@/core/physics/colliders'
import {
  CaptureAim,
  CaptureAimTarget,
  CharacterController,
  Party,
  Position,
} from '@/core/traits'
import { getCaptureAimView } from '../registry/captureAimRegistry'

// Folga (m) do círculo acima do chão, pra não brigar com ele.
const RING_LIFT = 0.03
// Folga (m) do círculo em volta do corpo do selvagem.
const RING_BODY_MARGIN = 0.12

const matrix = new THREE.Matrix4()
const color = new THREE.Color()

/**
 * Desenha o arco da mira da Pokébola (docs/features/043-captura.md) no modo
 * `'arc'`: os pontinhos seguem o voo previsto pelo `captureAimSystem`
 * (`origin + velocity·t + ½·g·t²` até `impactTime`) e o círculo fica onde a
 * bola bate — em volta dos pés do selvagem quando ela pega um
 * (`CaptureAimTarget`). Cor pela situação: pegando um selvagem, normal ou
 * fora do alcance (`FEEDBACK.AIM_*`). Sem mira, no modo `'reticle'` ou sem
 * a vista montada, esconde tudo.
 *
 * Fase: presentation.
 */
export function captureAimViewSystem(context) {
  const { world } = context
  const view = getCaptureAimView()
  if (!view?.dots || !view.ring) return

  const trainer = world.queryFirst(Party, CaptureAim)
  const aim = trainer?.get(CaptureAim)
  const { AIM } = GAME_CONFIG.CAPTURE
  if (!aim?.active || AIM.MODE !== 'arc') {
    view.dots.visible = false
    view.ring.visible = false
    return
  }

  const wild = trainer.targetFor(CaptureAimTarget)
  const { FEEDBACK } = GAME_CONFIG
  color.set(
    wild
      ? FEEDBACK.AIM_TARGET_COLOR
      : aim.landed
        ? FEEDBACK.AIM_COLOR
        : FEEDBACK.AIM_OUT_OF_RANGE_COLOR,
  )

  drawArc(view.dots, aim, GAME_CONFIG.CAPTURE.GRAVITY)
  view.dots.material.color.copy(color)
  view.dots.visible = true

  if (!aim.landed) {
    view.ring.visible = false
    return
  }
  placeRing(view.ring, aim, wild, AIM.RING_RADIUS)
  view.ring.material.color.copy(color)
  view.ring.visible = true
}

function drawArc(dots, aim, gravity) {
  const count = dots.count
  const { origin, velocity, impactTime } = aim
  for (let index = 0; index < count; index++) {
    const t = (impactTime * (index + 1)) / count
    matrix.makeTranslation(
      origin.x + velocity.x * t,
      origin.y + velocity.y * t + 0.5 * gravity * t * t,
      origin.z + velocity.z * t,
    )
    dots.setMatrixAt(index, matrix)
  }
  dots.instanceMatrix.needsUpdate = true
}

function placeRing(ring, aim, wild, radius) {
  const center = wild?.get(Position)
  const body = wild?.get(CharacterController)
  if (center && body) {
    ring.position.set(
      center.x,
      center.y - verticalClearance(body) + RING_LIFT,
      center.z,
    )
    ring.scale.setScalar(body.capsuleRadius + RING_BODY_MARGIN)
    return
  }
  ring.position.set(aim.impact.x, aim.impact.y + RING_LIFT, aim.impact.z)
  ring.scale.setScalar(radius)
}
