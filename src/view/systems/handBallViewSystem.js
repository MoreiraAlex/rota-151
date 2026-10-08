import { getItem, resolveItemAnimations } from '@/core/data/items'
import { PLAYER_SPECIES_ID, getPlayerSpecies } from '@/core/data/species'
import { findOwnedCreature } from '@/core/actions/owner'
import {
  findPartyPokemon,
  resolvePokemonBallId,
  resolvePokemonOf,
} from '@/core/actions/pokemon'
import { ActionState, Party } from '@/core/traits'
import { getAnimatedBonesEntry } from '@/view/registry/animationRegistry'
import { HAND_BONE_BY_SPECIES } from '@/view/handBoneBySpecies'
import { listHandBalls } from '../registry/handBallRegistry'
import { playBallClip } from '../ballClipPlayer'

// O gesto em andamento: qual ação, qual bola e quantas já começaram (cada
// recolher recomeça o clipe). Estado de tela.
const gesture = { action: null, itemId: null, count: 0 }

/**
 * A Pokébola do Pokémon na mão do treinador (docs/features/043-captura.md):
 *
 * - invocando: a bola dele, fechada, até soltar (`summon.effectAt` — aí ela
 *   vira a `SummonBall` voando);
 * - recolhendo: a bola dele o gesto inteiro, tocando o clipe `recall` do
 *   `.glb` (aparece, abre, puxa, fecha) encaixado em `recall.duration`.
 *
 * A bola é a do Pokémon do slot (`Pokemon.ballId`), lida no começo do gesto
 * (no recolher, a criatura some no meio). Fora disso, todas escondidas.
 *
 * Fase: presentation, depois do `animationSystem` (a pose deste frame).
 */
export function handBallViewSystem(context) {
  const { world, delta = 0 } = context
  const balls = listHandBalls()
  const trainer = world.queryFirst(Party, ActionState)
  const action = trainer?.get(ActionState)
  const { summon, recall } = getPlayerSpecies().actions

  const current =
    action?.current === 'recall' ||
    (action?.current === 'summon' && action.elapsed < summon.effectAt)
      ? action.current
      : null
  if (current !== gesture.action) {
    gesture.action = current
    gesture.count += 1
    gesture.itemId = current
      ? resolveGestureBall(world, trainer, action.pendingSlot)
      : null
  }

  const bone = current ? resolveHandBone(trainer) : null
  for (const [itemId, entry] of balls) {
    const group = entry.group
    if (!group) continue
    const shown = !!bone && itemId === gesture.itemId
    group.visible = shown
    if (!shown) {
      playBallClip(entry, null)
      continue
    }

    const clips = resolveItemAnimations(getItem(itemId))
    playBallClip(
      entry,
      current === 'recall' && clips?.recall
        ? {
            key: `recall-${gesture.count}`,
            name: clips.recall,
            loop: false,
            fitTo: recall.duration,
          }
        : null,
    )
    entry.mixer?.update(delta)
    bone.updateWorldMatrix(true, false)
    bone.getWorldPosition(group.position)
    bone.getWorldQuaternion(group.quaternion)
  }
}

/** A bola do Pokémon do gesto: a da criatura em campo, ou a do slot. */
function resolveGestureBall(world, trainer, slot) {
  const creature = slot ? findOwnedCreature(world, trainer, slot) : null
  const pokemon = resolvePokemonOf(creature) ?? findPartyPokemon(trainer, slot)
  return resolvePokemonBallId(pokemon)
}

function resolveHandBone(trainer) {
  const name = HAND_BONE_BY_SPECIES[PLAYER_SPECIES_ID]
  if (!name) return null
  return getAnimatedBonesEntry(trainer)?.bones[name]?.bone ?? null
}
