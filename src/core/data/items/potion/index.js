/**
 * Item de teste genérico (consumable) — valida o mecanismo de item (registro,
 * `HeldItem`, seletor de debug) e a ação de usar (ver
 * docs/features/014-arremessar-usar-e-invocar.md), não é conteúdo de jogo
 * de verdade.
 */
export const POTION = {
  id: 'potion',
  category: 'consumable',
  consumable: {
    // HP curado ao usar (soma direto, não é %).
    healAmount: 30,
  },
}
