import { trait } from 'koota'

/**
 * Marca uma entidade como a criatura invocada de um slot do `Party` do
 * treinador (ver docs/features/014-arremessar-usar-e-invocar.md) — `slot`
 * é `'slot1' | 'slot2' | 'slot3'`, usado por `partySummonSystem` pra achar
 * "a criatura deste slot" de novo na hora de recolher (só uma por slot).
 *
 * `speciesId` guarda a espécie de `core/data/species` no instante da
 * invocação (não busca de volta em `Party` — o time do treinador pode
 * mudar enquanto a criatura está fora, sem afetar quem já foi invocado).
 * `CreatureView` (view) usa isso pra saber qual modelo renderizar.
 *
 * Dono de escrita: `partySummonSystem` (cria/destrói a entidade);
 * `creatureFollowSystem`/`CreatureView` só leem.
 */
export const SummonedCreature = trait({
  slot: null,
  speciesId: null,
})
