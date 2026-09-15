/**
 * Molde de um item. Copia esta pasta inteira pra `<id>/` (ex.: `pokebola/`)
 * — um `index.js` com os dados abaixo. Ver `../pebble/` ou `../potion/`
 * como exemplos completos.
 *
 * `category` decide o que o item faz quando usado (botão `primary`, ver
 * docs/features/011-slots-de-acao.md e a implementação em
 * docs/features/014-arremessar-usar-e-invocar.md). Config de comportamento
 * é opcional e por categoria: `consumable.healAmount` existe porque cura é
 * claramente por item (uma poção melhor cura mais); velocidade de arremesso
 * (`throwable`) ainda é global (`gameConfig.PLAYER_ACTIONS.throw.SPEED`) —
 * vira por item só quando um segundo `throwable` precisar de valor
 * diferente, mesmo caminho já percorrido por `body`/`movement` de espécie.
 */
export const ITEM_TEMPLATE = {
  id: 'nome-em-minusculo',
  // 'throwable' | 'consumable' — sem 'weapon': o treinador não ataca
  // Pokémon nem outro treinador diretamente, não existe essa categoria.
  category: 'consumable',
  // Só pra category: 'consumable'. Omite se a categoria for outra.
  consumable: {
    healAmount: 30,
  },
}
