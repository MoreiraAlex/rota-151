/**
 * A melhor Pokébola da beta (docs/features/042-itens-da-beta.md). Ver
 * `../poke-ball/`.
 */
export const ULTRA_BALL = {
  id: 'ultra-ball',
  name: 'Ultra Bola',
  description: 'Uma bola com muita chance de captura.',
  category: 'pokeball',
  sprite: {
    path: 'https://play.pokemonshowdown.com/sprites/itemicons/ultra-ball.png',
  },
  model: {
    path: '/assets/models/items/ultra-ball.glb',
    texture: {
      path: '/assets/textures/items/ultra-ball/default/body.png',
      flipY: false,
    },
    // Maior dimensão do modelo (m).
    size: 0.15,
  },
  pokeball: {
    captureMultiplier: 2,
  },
}
