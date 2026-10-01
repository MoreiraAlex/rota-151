/**
 * Rosnado (Growl) — a primeira skill de STATUS: não causa dano, baixa o
 * ataque dos inimigos. Ver docs/features/033-skills-de-combate-e-vfx.md e
 * `../_template/index.js` pro que cada campo significa.
 *
 * O que separa uma skill de status de uma de dano é o `damage: null` (sem
 * dano, nenhum alvo "apanha") e a seção `effects`: lista do que o golpe MUDA
 * no alvo. Hoje o único tipo é `statStage` — soma `stages` ao estágio do
 * `stat` (-6 a +6, convenção do Pokémon: -1 = ×2/3 no atributo) e o efeito
 * DURA `duration` segundos, renovado ao usar de novo. Acumula: dois rosnados
 * seguidos = -2.
 *
 * `area: 'cone'`: atinge TODOS os inimigos dentro do cone à frente (a mesma
 * forma do canalizado, com indicador e aviso em cone), não só o primeiro.
 * `visual.effectGroup: 'growl'`: ondas sonoras em arco saindo da boca até a
 * ponta do cone (`view/vfx/growlVfx.js`); o feedback no alvo é o brilho, o texto
 * "Ataque ↓" e o indicador na HUD, mais o grito da criatura (`audio.cry`, a voz
 * dela tocando com a boca sincronizada).
 *
 * Valores de PARTIDA, sem validação em jogo.
 */
export const GROWL_SKILL = {
  id: 'growl',
  duration: 1.2,
  effectAt: 0.5,
  range: 3,
  aim: 'ranged',
  castMode: 'instant',
  area: 'cone',
  // abertura do cone: `radius / range` (0.5 = ~27° pra cada lado)
  radius: 1.5,
  staminaCost: 2,
  cooldown: 1,
  // Sem dano: nada "apanha", e `attackResolved` sai com `status: true`.
  damage: null,
  effects: [{ type: 'statStage', stat: 'attack', stages: -1, duration: 60 }],
  visual: {
    effectGroup: 'growl',
    // cobre a última das 3 ondas (`view/vfx/growlVfx.js`)
    effectVisualDuration: 1,
    scale: 1,
    revealDuration: 0,
    rotationOffset: { x: 0, y: 0, z: 0 },
    positionOffset: { x: 0, y: 0, z: 0 },
  },
  sprite: {
    path: '/assets/sprites/abilities/growl.png',
    scale: 1,
  },
  audio: { group: null, cry: true },
  animation: { clipKey: 'roar' },
}
