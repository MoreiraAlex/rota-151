import { OwnedBy, SummonedCreature } from '@/core/traits'

// A tecla de cada slot do time — a mesma do `PartyHud.jsx`.
const PARTY_SLOT_KEYS = { slot1: 'Q', slot2: 'E', slot3: 'R' }

/**
 * Se `entity` é uma criatura do time do `localTrainer` (docs/features/064-
 * revisao-da-ia-do-parceiro.md, Parte 4), a tecla do slot dela (Q/E/R);
 * senão `null` — a selvagem, o treinador e a criatura de outro treinador
 * não ganham a marca de "seu". `summoned` é o `SummonedCreature` já lido
 * (reativo, na view); sem ele, lê da entidade.
 */
export function resolveMineSlotKey(
  entity,
  localTrainer,
  summoned = entity?.get?.(SummonedCreature),
) {
  if (!summoned || !localTrainer) return null
  if (entity.targetFor(OwnedBy) !== localTrainer) return null
  return PARTY_SLOT_KEYS[summoned.slot] ?? null
}
