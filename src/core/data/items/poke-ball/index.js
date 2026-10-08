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
    // Ajuste na mão do treinador (no espaço do osso da mão): posição (m),
    // giro (graus) e escala — ver `_template/`.
    hand: {
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: 1,
    },
    // Clipes do `.glb` por momento da captura (docs/features/043-captura.md)
    // — ver `_template/`.
    animations: {
      flying: 'spin',
      absorb: 'capture_absorb',
      close: 'close',
      shake: 'capture_wobble',
      caught: 'capture_success',
      escaped: 'capture_fail',
      // Invocar: abrindo depois de pousar; recolher: na mão do treinador.
      summon: 'summon',
      recall: 'recall',
    },
  },
  pokeball: {
    // Multiplica a chance de captura (043).
    captureMultiplier: 1,
    // Cor do feixe de luz da bola (invocar/recolher/captura).
    beamColor: '#ff3b3b',
  },
}
