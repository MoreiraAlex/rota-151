/**
 * Fruta Nanab (docs/features/042-itens-da-beta.md) — fruta: cura aos poucos,
 * enquanto quem come está comendo (`core/actions/eating.js`). Ver
 * `../_template/` pra `model` (o modelo vem em pedaços, um por estágio
 * de comida).
 */
export const NANAB_BERRY = {
  id: 'nanab-berry',
  name: 'Fruta Nanab',
  description:
    'Uma fruta que restaura uma boa parte da vida enquanto é comida.',
  category: 'berry',
  sprite: {
    path: 'https://play.pokemonshowdown.com/sprites/itemicons/nanab-berry.png',
  },
  model: {
    path: '/assets/models/items/nanab-berry.glb',
    texture: {
      path: '/assets/textures/items/nanab-berry/default/body.png',
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
    healAmount: 20,
    // Quanto tempo (s) leva pra comer — quem come fica parado esse tempo.
    duration: 3,
  },
}
