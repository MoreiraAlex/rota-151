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

// 'pokemon': quando existir espécie desse kind, os mesmos 4 botões passam a
// significar golpe/ataque em vez de item/time — primary = ataque básico,
// secondary1-3 = os 3 golpes ativos. Sem conteúdo de golpe/habilidade
// definido ainda (`stats`/`moves` da espécie continuam vazios), não há o que
// resolver de verdade — fica só descrito aqui até essa peça existir.

export function resolveActionSlots(kind) {
  if (kind === 'trainer') return TRAINER_ACTION_SLOTS
  return null
}
