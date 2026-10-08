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
    // Animações da Poké Bola (docs/features/043-captura.md): o esqueleto
    // dela é montado em volta de `top`/`bottom` deste modelo, que vem
    // deitado (Z pra cima) — `rig.rotation` (graus) endireita. Ver
    // `_template/`.
    clipsFrom: 'poke-ball',
    rig: { rotation: { x: -90, y: 0, z: 0 } },
  },
  pokeball: {
    captureMultiplier: 2,
    // Cor do feixe de luz da bola (invocar/recolher/captura).
    beamColor: '#ffd23b',
  },
}
