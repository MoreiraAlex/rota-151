import { resolveSkill } from '../data/skills'
import {
  MAX_MASTERY,
  normalizeMoveReference,
  resolveSpeciesMoveReference,
} from '../data/species/moves'
import { Training, resolveEntityMoves } from '../traits'

/**
 * Slot interno do golpe EM TREINO (`Training`, docs/features/038-aprendizado-
 * treino-e-dominio-de-golpes.md) — não tem botão: só o `trainingSystem`
 * dispara por ele.
 */
export const TRAINING_SLOT = 'training'

/**
 * Qual ataque o `slot` dispara — o ponto único que HUDs, mira, som, alvos, IA
 * e `creatureAttackSystem` consultam. Só golpes — não existe ataque básico
 * (docs/features/039-tipos-e-combate-classico.md, Parte 5: como nos clássicos):
 * - `'secondary1-3'` (Q/E/R) → o golpe daquele slot no `moveSet` da criatura
 *   (`resolveEntityMoveSet`), com os `overrides` que a espécie declara pra
 *   ele (`resolveSpeciesMoveReference`). Sem `moveSet` (wiki, previews), o
 *   kit da espécie (`species.skills`);
 * - `'training'` → o golpe em treino (só existe no `moveSet`).
 *
 * `null` quando não há nada nesse slot — quem chama trata como "sem ataque
 * aqui", sem quebrar.
 */
export function resolveCreatureAttack(species, slot, moveSet) {
  if (!species) return null
  if (!moveSet) return resolveSkill(species.skills?.[skillNumber(slot)])
  const move = resolveSlotMove(species, slot, moveSet)
  if (!move) return null
  return resolveSkill(resolveSpeciesMoveReference(species, move.id))
}

/**
 * `{ id, mastery }` do golpe no `slot` (`'secondary1-3'` ou `'training'`), ou
 * `null`. Sem `moveSet`, o kit da espécie, dominado.
 */
export function resolveSlotMove(species, slot, moveSet) {
  const key = slot === TRAINING_SLOT ? TRAINING_SLOT : skillNumber(slot)
  if (key == null) return null
  if (moveSet) return moveSet[key] ?? null
  if (key === TRAINING_SLOT) return null

  const reference = normalizeMoveReference(species?.skills?.[key])
  return reference ? { id: reference.id, mastery: MAX_MASTERY } : null
}

/**
 * Golpes de uma entidade por slot — `{ 1, 2, 3, training? }`, cada um
 * `{ id, mastery }` ou `null`: os slots de `CreatureMoves` (ou o kit da
 * espécie, `resolveEntityMoves`) e, treinando, o golpe em treino — com o
 * domínio dele se estiver equipado (treino de domínio), senão o mínimo.
 */
export function resolveEntityMoveSet(entity, species) {
  const moveSet = { ...resolveEntityMoves(entity, species).slots }
  const moveId = entity?.has?.(Training) ? entity.get(Training).moveId : null
  if (moveId) {
    // Golpe equipado (treino de domínio): com o domínio dele; senão, mínimo.
    const equipped = Object.values(moveSet).find((move) => move?.id === moveId)
    moveSet[TRAINING_SLOT] = { id: moveId, mastery: equipped?.mastery ?? 0 }
  }
  return moveSet
}

/**
 * Atalho pra quem tem a entidade (view, som): `resolveCreatureAttack` com os
 * golpes DELA.
 */
export function resolveEntityAttack(entity, species, slot) {
  return resolveCreatureAttack(
    species,
    slot,
    resolveEntityMoveSet(entity, species),
  )
}

const SKILL_SLOT_PREFIX = 'secondary'

/** `'secondary2'` → `2` (slot de golpe); outro slot → `null`. */
function skillNumber(slot) {
  if (typeof slot !== 'string' || !slot.startsWith(SKILL_SLOT_PREFIX)) {
    return null
  }
  return Number(slot.slice(SKILL_SLOT_PREFIX.length))
}
