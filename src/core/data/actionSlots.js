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

// 'pokemon': `secondary1-3` (Q/E/R) são os golpes da criatura
// (`creatureAttackSystem.js`, o golpe de cada slot no `moveSet` dela). Não há
// ataque básico (docs/features/039-tipos-e-combate-classico.md, Parte 5): `primary`
// (clique) só confirma o golpe aberto no indicador (`castMode: 'confirm'`).
const CREATURE_ACTION_SLOTS = {
  primary: 'confirmAim',
  secondary1: 'skill1',
  secondary2: 'skill2',
  secondary3: 'skill3',
}

export function resolveActionSlots(kind) {
  if (kind === 'trainer') return TRAINER_ACTION_SLOTS
  if (kind === 'pokemon') return CREATURE_ACTION_SLOTS
  return null
}
