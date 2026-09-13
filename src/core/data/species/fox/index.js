import IDLE_CLIP from './clips/idle.json'
import WALK_CLIP from './clips/walk.json'
import RUN_CLIP from './clips/run.json'

/**
 * Fox (Khronos Sample Assets) — modelo temporário do jogador, não é uma
 * criatura do jogo. Fica no registro de espécies porque o jogador é tratado
 * como mais uma entrada dele (mesmo esquema de model/clips/stats que uma
 * criatura real terá). Sem prefixo numérico de dex — não é um Pokémon.
 *
 * Troque `id`/pasta quando o modelo definitivo do treinador estiver pronto;
 * quem referencia isso é só `PlayerView.jsx`.
 */
export const FOX = {
  id: 'fox',
  dexNumber: null,
  model: {
    path: '/assets/models/fox-debug.glb',
    scale: 0.015,
    position: [0, -0.5, 0],
  },
  clips: {
    idle: IDLE_CLIP,
    walk: WALK_CLIP,
    run: RUN_CLIP,
  },
  stats: {},
  moves: [],
}
