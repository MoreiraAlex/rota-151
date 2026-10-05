import { MoveLearnRequest, PartyActionMenu } from '../traits'

/**
 * Menu de ações treinador↔Pokémon (docs/features/038-aprendizado-treino-e-
 * dominio-de-golpes.md). Quem abre é o `partyActionMenuInputSystem` (segurar
 * Q/E/R); a view fecha por aqui.
 */

/** Abre o menu da criatura do `slot` (e conta um pedido pra view reagir). */
export function abrirMenuDeAcoes(trainer, slot) {
  const menu = trainer.get(PartyActionMenu)
  trainer.set(PartyActionMenu, { slot, requests: (menu?.requests ?? 0) + 1 })
}

/** Fecha o menu de ações. */
export function fecharMenuDeAcoes(trainer) {
  trainer.set(PartyActionMenu, { slot: null })
}

/**
 * Alguma tela treinador↔Pokémon aberta agora (menu de ações ou "esquecer
 * qual golpe?")? Enquanto sim, o input de ação do jogo fica bloqueado.
 */
export function isPartyMenuOpen(trainer) {
  if (trainer?.get(PartyActionMenu)?.slot) return true
  return !!trainer?.get(MoveLearnRequest)?.moveId
}
