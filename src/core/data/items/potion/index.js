/**
 * Poção (docs/features/042-itens-da-beta.md) — cura na hora: o treinador
 * usa em si com o item na mão, ou na criatura invocada pelo menu de ações.
 */
export const POTION = {
  id: 'potion',
  name: 'Poção',
  description: 'Restaura um pouco da vida.',
  category: 'consumable',
  sprite: {
    path: 'https://play.pokemonshowdown.com/sprites/itemicons/potion.png',
  },
  consumable: {
    // HP curado ao usar (soma direto, não é %).
    healAmount: 20,
  },
}
