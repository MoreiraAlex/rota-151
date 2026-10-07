/**
 * Item de teste genérico (consumable) — mesmo propósito de `potion`, só pra
 * ter mais variedade validando o inventário em grade (ver
 * docs/features/017-inventario-em-grade.md). Não é conteúdo de jogo real.
 */
export const ELIXIR = {
  id: 'elixir',
  name: 'Elixir',
  // Texto provisório (docs/features/041-inventario-de-itens-e-pokemon.md).
  description: 'Restaura bastante vida do treinador.',
  category: 'consumable',
  consumable: {
    healAmount: 50,
  },
}
