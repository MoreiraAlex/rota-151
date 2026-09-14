/**
 * Molde de um item. Copia esta pasta inteira pra `<id>/` (ex.: `pokebola/`)
 * — um `index.js` com os dados abaixo. Ver `../pebble/` ou `../potion/`
 * como exemplos completos.
 *
 * `category` decide o que o item faz quando usado (botão `primary`, ver
 * docs/features/011-slots-de-acao.md) — isso ainda não é resolvido por
 * nenhum system (ver docs/features/012-mecanismo-de-item.md). Config de
 * comportamento (velocidade de arremesso, quantidade de cura, etc.) não tem
 * formato fechado ainda — entra junto da feature que implementar esse
 * comportamento, sem precisar migrar nada.
 */
export const ITEM_TEMPLATE = {
  id: 'nome-em-minusculo',
  // 'throwable' | 'consumable' — sem 'weapon': o treinador não ataca
  // Pokémon nem outro treinador diretamente, não existe essa categoria.
  category: 'throwable',
}
