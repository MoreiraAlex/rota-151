/**
 * Pokébola melhor que a `poke-ball` (docs/features/042-itens-da-beta.md).
 * Ver `../poke-ball/`.
 */
export const GREAT_BALL = {
  id: 'great-ball',
  name: 'Grande Bola',
  description: 'Uma bola com mais chance de captura que a Poké Bola.',
  category: 'pokeball',
  sprite: {
    path: 'https://play.pokemonshowdown.com/sprites/itemicons/great-ball.png',
  },
  model: {
    path: '/assets/models/items/great-ball.glb',
    texture: {
      path: '/assets/textures/items/great-ball/default/body.png',
      flipY: false,
    },
    // Maior dimensão do modelo (m).
    size: 0.15,
  },
  pokeball: {
    captureMultiplier: 1.5,
  },
}
