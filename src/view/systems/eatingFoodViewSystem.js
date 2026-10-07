import * as THREE from 'three'
import { verticalClearance } from '@/core/physics/colliders'
import { resolveEatenFraction } from '@/core/actions/eating'
import { GAME_CONFIG } from '@/core/gameConfig'
import { CharacterController, Eating, Position, Rotation } from '@/core/traits'
import { getAnimatedBonesEntry } from '../registry/animationRegistry'
import { getEatingFood, resolveFoodPivot } from '../registry/eatingFoodRegistry'
import { resolveEatFood } from '../eatFoodConfig'
import { setEatStage } from '../itemEatStages'
import {
  bite,
  createFoodMotion,
  shouldBite,
  squashScale,
  stepSquash,
} from '../foodMotion'
import { requestFoodVfx } from '../vfx/foodVfxQueue'

// Esfera (fruta sem modelo): tamanho no fim de comer (fração da inteira) —
// encolhe até aqui conforme a cura vai saindo, e some quando acaba. Fruta
// com modelo troca de pedaço em vez de encolher.
const EATEN_MIN_SCALE = 0.3
// Sem osso pra mirar a âncora de chão: a fruta fica esta distância (m) à
// frente do centro de quem come.
const GROUND_FALLBACK_FORWARD = 0.4
const NO_OFFSET = { x: 0, y: 0, z: 0 }

// Inclinação (rad) da fruta no chão por unidade de `squash` — ela tomba um
// pouco pro lado a cada mordida.
const GROUND_TILT = 0.6
// Altura (m) acima da fruta de onde saem o suco e os farelos da mordida.
const BITE_VFX_LIFT = 0.04

// Vetores/quaternions reaproveitados (sem alocar por frame).
const bonePoint = new THREE.Vector3()
const anchorPoint = new THREE.Vector3()
const handNow = new THREE.Quaternion()
const yawQuat = new THREE.Quaternion()
const tiltQuat = new THREE.Quaternion()
const configQuat = new THREE.Quaternion()
const configEuler = new THREE.Euler()
const UP = new THREE.Vector3(0, 1, 0)
const FORWARD = new THREE.Vector3(0, 0, 1)

/**
 * Posiciona a fruta de quem está comendo (docs/features/042-itens-da-
 * beta.md) pela config da espécie (`species.vfx.eatFood`, ver
 * `core/data/species/_template/`): no ponto médio das mãos (leva à boca) ou
 * no chão embaixo da boca (come do chão), mais o deslocamento `position` no
 * referencial do corpo. Conforme a cura sai (`resolveEatenFraction`), a
 * fruta com modelo troca de pedaço (`item.model.eatStages`) e a esfera
 * encolhe — as duas por cima do `scale` da espécie.
 *
 * Pra não ficar parada: a cada mordida (relógio `vfx.eatFood.biteInterval`
 * da espécie, ou `GAME_CONFIG.FEEDBACK.EAT_FOOD.BITE_INTERVAL`, e quando o
 * pedaço troca) a fruta achata e volta numa mola (`view/foodMotion.js`); a
 * do chão também pula e tomba um pouco; a da mão gira junto com a mão. E
 * cada mordida pede o suco e os farelos (`foodVfxQueue.js`). Por cima disso,
 * a `rotation` da espécie (graus).
 *
 * Fase: presentation, depois do `animationSystem` (os ossos já estão na pose
 * deste frame).
 */
export function eatingFoodViewSystem(context) {
  const { world, delta = 0 } = context
  const feel = GAME_CONFIG.FEEDBACK.EAT_FOOD

  world.query(Eating).readEach(([eating], eater) => {
    const entry = getEatingFood(eater)
    if (!entry?.group) return

    const config = resolveEatFood(eater)
    const inHands = !!config.hands?.length
    const placed = inHands
      ? placeInHands(eater, config.hands)
      : placeOnGround(eater, entry, config.ground)
    if (!placed) {
      entry.group.visible = false
      return
    }
    addBodyOffset(eater, config.position ?? NO_OFFSET)

    const interval = config.biteInterval ?? feel.BITE_INTERVAL
    entry.motion ??= createFoodMotion(interval)
    const { motion } = entry

    const eaten = resolveEatenFraction(eating)
    const stages = entry.model?.stages
    const stage = setEatStage(stages, eaten)
    if (feel.ENABLED && shouldBite(motion, delta, interval, stage)) {
      bite(motion, feel.BITE_SQUASH)
      requestFoodVfx({
        kind: 'bite',
        itemId: eating.itemId,
        position: [anchorPoint.x, anchorPoint.y + BITE_VFX_LIFT, anchorPoint.z],
      })
    }
    stepSquash(motion, delta, feel.BITE_SPRING)

    const shrink = stages?.length ? 1 : 1 - (1 - EATEN_MIN_SCALE) * eaten
    const size = (config.scale ?? 1) * shrink
    const [sx, sy, sz] = squashScale(motion.squash)
    // Gira e aperta no pivô (centro do corpo da fruta), não no grupo de
    // fora — assim a `rotation` é no próprio eixo e não muda a posição.
    const pivot = resolveFoodPivot(entry)
    pivot.scale.set(size * sx, size * sy, size * sz)

    if (inHands) {
      orientWithHand(eater, entry, pivot, config.hands[0])
    } else {
      // No chão: pula quando a mola estica e tomba um pouco pro lado.
      const stretch = Math.max(0, -motion.squash)
      anchorPoint.y += (stretch / feel.BITE_SQUASH) * feel.BITE_HOP
      yawQuat.setFromAxisAngle(UP, motion.yaw)
      tiltQuat.setFromAxisAngle(FORWARD, motion.squash * GROUND_TILT)
      pivot.quaternion.multiplyQuaternions(yawQuat, tiltQuat)
    }

    applyConfigRotation(pivot, config.rotation)
    entry.group.position.copy(anchorPoint)
    entry.group.visible = true
  })
}

/** `rotation` da espécie (graus), em volta dos eixos da própria fruta. */
function applyConfigRotation(group, rotation) {
  if (!rotation) return
  const { degToRad } = THREE.MathUtils
  configEuler.set(
    degToRad(rotation.x ?? 0),
    degToRad(rotation.y ?? 0),
    degToRad(rotation.z ?? 0),
  )
  group.quaternion.multiply(configQuat.setFromEuler(configEuler))
}

/**
 * A fruta na mão gira o quanto a mão girou desde que ela apareceu
 * (`entry.handStart`), partindo de "de frente pra quem come" — assim ela
 * acompanha o movimento sem herdar a orientação arbitrária do osso.
 */
function orientWithHand(eater, entry, pivot, boneName) {
  const bone = findBone(eater, boneName)
  if (!bone) return
  bone.getWorldQuaternion(handNow)
  if (!entry.handStart) {
    entry.handStart = handNow.clone().invert()
    yawQuat.setFromAxisAngle(UP, eater.get(Rotation)?.y ?? 0)
    entry.baseRotation = yawQuat.clone()
  }
  pivot.quaternion
    .copy(handNow)
    .multiply(entry.handStart)
    .multiply(entry.baseRotation)
}

/**
 * Soma o deslocamento `offset` (m) em `anchorPoint`, no referencial do corpo
 * de quem come: `x` à direita, `y` pra cima, `z` pra frente (frente =
 * `(sin, cos)` de `Rotation.y`, mesma convenção do resto do jogo).
 */
function addBodyOffset(eater, offset) {
  const yaw = eater.get(Rotation)?.y ?? 0
  const sin = Math.sin(yaw)
  const cos = Math.cos(yaw)
  anchorPoint.x += offset.z * sin + offset.x * cos
  anchorPoint.y += offset.y
  anchorPoint.z += offset.z * cos - offset.x * sin
}

function findBone(eater, name) {
  return getAnimatedBonesEntry(eater)?.bones[name]?.bone ?? null
}

/** Ponto médio dos ossos das mãos em `anchorPoint`. Sem os ossos, `false`. */
function placeInHands(eater, boneNames) {
  anchorPoint.set(0, 0, 0)
  for (const name of boneNames) {
    const bone = findBone(eater, name)
    if (!bone) return false
    anchorPoint.add(bone.getWorldPosition(bonePoint))
  }
  anchorPoint.divideScalar(boneNames.length)
  return true
}

/**
 * No chão embaixo do osso da boca, em `anchorPoint`. O ponto é fixado no
 * primeiro frame (`entry.groundPoint`), pra a fruta não escorregar com a
 * cabeça. Sem o osso, um pouco à frente do centro.
 */
function placeOnGround(eater, entry, boneName) {
  const pos = eater.get(Position)
  if (!pos) return false

  if (!entry.groundPoint) {
    const bone = boneName ? findBone(eater, boneName) : null
    if (bone) {
      bone.getWorldPosition(bonePoint)
    } else {
      const yaw = eater.get(Rotation)?.y ?? 0
      bonePoint.set(
        pos.x + Math.sin(yaw) * GROUND_FALLBACK_FORWARD,
        0,
        pos.z + Math.cos(yaw) * GROUND_FALLBACK_FORWARD,
      )
    }
    entry.groundPoint = { x: bonePoint.x, z: bonePoint.z }
  }

  // `Position` é o centro da cápsula: o chão fica `verticalClearance` abaixo.
  const body = eater.get(CharacterController)
  const groundY = body ? pos.y - verticalClearance(body) : pos.y
  // A fruta no chão tem a base na origem (`align: 'bottom'`).
  anchorPoint.set(entry.groundPoint.x, groundY, entry.groundPoint.z)
  return true
}
