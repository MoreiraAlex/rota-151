/**
 * O que cada um dos 4 botões de ação (`primary`, `secondary1-3` — ver
 * docs/features/011-slots-de-acao.md) significa, por tipo de entidade
 * jogável (`species.kind`, resolvido via `resolveSpeciesKind`). Puro dado:
 * só documenta a intenção, nenhum system lê isso ainda. Cada feature futura
 * que atuar num botão (arremessar/usar item em `primary`, invocar/recolher
 * criatura nos `secondaryN`) consome esses rótulos em vez de reinventar o
 * mapeamento.
 */
const TRAINER_ACTION_SLOTS = {
  primary: 'useHeldItem',
  secondary1: 'partySlot1',
  secondary2: 'partySlot2',
  secondary3: 'partySlot3',
}

// 'pokemon' (ver docs/features/025-ataque-comum-de-criatura.md): `primary`
// e `secondary1-3` (Q/E/R) já resolvem de verdade
// (`creatureAttackSystem.js` + `attacks.<slot>` por espécie, referenciando
// `core/data/attacks/`) — desde a 9ª rodada, quando as 3 primeiras skills
// (`vine-whip`/`ember`/`whirlpool`) ganharam conteúdo. Os rótulos aqui são
// PAPÉIS genéricos ("1º/2º/3º slot de skill configurável"), não um id
// fixo — cada espécie referencia o que quiser (ou nada) em
// `attacks.secondary1-3`; `stats`/`moves` da espécie continuam vazios
// (sem dano ainda — ver docs/features/018-troca-de-controle-treinador-
// criatura.md).
const CREATURE_ACTION_SLOTS = {
  primary: 'attack',
  secondary1: 'skill1',
  secondary2: 'skill2',
  secondary3: 'skill3',
}

export function resolveActionSlots(kind) {
  if (kind === 'trainer') return TRAINER_ACTION_SLOTS
  if (kind === 'pokemon') return CREATURE_ACTION_SLOTS
  return null
}
