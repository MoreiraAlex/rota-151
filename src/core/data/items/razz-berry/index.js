/**
 * Fruta Frambo (docs/features/042-itens-da-beta.md) — fruta: cura aos poucos,
 * enquanto quem come está comendo (`core/actions/eating.js`). Ver
 * `../_template/` pra `model` (o modelo vem em pedaços, um por estágio
 * de comida).
 */
export const RAZZ_BERRY = {
  id: 'razz-berry',
  name: 'Fruta Frambo',
  description: 'Uma fruta que restaura um pouco da vida enquanto é comida.',
  category: 'berry',
  sprite: {
    path: 'https://play.pokemonshowdown.com/sprites/itemicons/razz-berry.png',
  },
  model: {
    path: '/assets/models/items/razz-berry.glb',
    texture: {
      path: '/assets/textures/items/razz-berry/default/body.png',
      flipY: false,
    },
    // Maior dimensão do modelo (m).
    size: 0.2,
    // Pedaços da fruta, da inteira à quase acabada — um visível por vez,
    // trocando conforme é comida.
    eatStages: ['fruit_0', 'fruit_1', 'fruit_2'],
  },
  berry: {
    // Cura TOTAL da fruta, espalhada pela `duration`.
    healAmount: 10,
    // Quanto tempo (s) leva pra comer — quem come fica parado esse tempo.
    duration: 10,
  },
}
