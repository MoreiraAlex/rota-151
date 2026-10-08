import { getItem } from '@/core/data/items'
import { PLAYER_SPECIES_ID, getPlayerSpecies } from '@/core/data/species'
import { getAnimatedBonesEntry } from '@/view/registry/animationRegistry'
import { HAND_BONE_BY_SPECIES } from '@/view/handBoneBySpecies'
import { getHeldItemView } from '@/view/registry/heldItemRegistry'
import {
  ActionState,
  CaptureAim,
  HeldItem,
  InputControlled,
} from '@/core/traits'

/**
 * Põe o item na mão do jogador (`HeldItemView.jsx` — o modelo do próprio
 * item) no osso da mão, a cada frame: copia a posição e o giro do osso no
 * mundo (sem a escala dele — o modelo já vem no tamanho do item, em metros).
 *
 * Quando aparece:
 * - `throwable`: sempre que equipado;
 * - Pokébola: só mirando (docs/features/043-captura.md) — e no gesto de
 *   arremesso, até soltar.
 * Nos dois, some no instante em que solta (`throw.effectAt`, quando o
 * objeto de verdade nasce voando).
 *
 * Fase: presentation, depois do `animationSystem` (a pose deste frame).
 */
export function heldItemViewSystem(context) {
  const { world } = context
  const view = getHeldItemView()
  if (!view?.group) return
  const { group } = view

  const handBoneName = HAND_BONE_BY_SPECIES[PLAYER_SPECIES_ID]
  const entity = world.queryFirst(InputControlled, HeldItem, ActionState)
  const item = entity?.get(HeldItem).itemId
    ? getItem(entity.get(HeldItem).itemId)
    : null
  const bone = handBoneName
    ? getAnimatedBonesEntry(entity)?.bones[handBoneName]?.bone
    : null

  if (!entity || !item || !bone || !shouldShow(entity, item)) {
    group.visible = false
    return
  }

  bone.updateWorldMatrix(true, false)
  bone.getWorldPosition(group.position)
  bone.getWorldQuaternion(group.quaternion)
  group.visible = true
}

function shouldShow(entity, item) {
  const action = entity.get(ActionState)
  // Invocando/recolhendo, a mão está com a Pokébola do Pokémon
  // (`handBallViewSystem.js`).
  if (action.current === 'summon' || action.current === 'recall') return false
  const throwing = action.current === 'throw'
  const released =
    throwing && action.elapsed >= getPlayerSpecies().actions.throw.effectAt
  if (released) return false
  if (item.category === 'throwable') return true
  if (item.category === 'pokeball') {
    return !!entity.get(CaptureAim)?.active || throwing
  }
  return false
}
