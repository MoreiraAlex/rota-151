/**
 * Pokébola básica (docs/features/042-itens-da-beta.md). Só catálogo por
 * enquanto: usar não faz nada — a captura é a 043, que lê
 * `pokeball.captureMultiplier`.
 */
export const POKE_BALL = {
  id: 'poke-ball',
  name: 'Poké Bola',
  description: 'Uma bola para capturar Pokémon selvagens.',
  category: 'pokeball',
  sprite: {
    path: 'https://play.pokemonshowdown.com/sprites/itemicons/poke-ball.png',
  },
  model: {
    path: '/assets/models/items/poke-ball.glb',
    texture: {
      path: '/assets/textures/items/poke-ball/default/body.png',
      flipY: false,
    },
    // Maior dimensão do modelo (m).
    size: 0.15,
  },
  pokeball: {
    // Multiplica a chance de captura (043).
    captureMultiplier: 1,
  },
}
