import { trait } from 'koota'

/**
 * Menu de ações treinador↔Pokémon (docs/features/038-aprendizado-treino-e-
 * dominio-de-golpes.md): segurar Q/E/R no modo treinador abre o menu da
 * criatura daquele slot. No treinador.
 *
 * - `slot` — slot do time com o menu aberto (`'slot1'..'slot3'`), ou `null`.
 *   Aberto, o input de ação fica bloqueado (`partyActionMenuInputSystem`).
 * - `requests` — contador de pedidos de abertura: a view (`GameHud`) reage à
 *   mudança e mostra o menu (mesmo padrão de `ScanMode.menuOpenRequests`).
 *
 * Donos de escrita: `partyActionMenuInputSystem.js` (abre) e
 * `fecharMenuDeAcoes` (`core/actions/partyActionMenu.js`, fecha).
 */
export const PartyActionMenu = trait({
  slot: null,
  requests: 0,
})

/**
 * Quanto tempo (s) cada tecla de slot (Q/E/R) está segurada no modo treinador,
 * e se o segurar já abriu o menu (`opened` — soltar depois não vira toque).
 *
 * Dono de escrita: `partyActionMenuInputSystem.js`.
 */
export const SlotHold = trait({
  secondary1: 0,
  secondary2: 0,
  secondary3: 0,
  secondary1Opened: false,
  secondary2Opened: false,
  secondary3Opened: false,
})
