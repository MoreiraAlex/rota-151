/**
 * Ataque Rápido (Quick Attack) — golpe físico corpo a corpo com ARRANCADA,
 * ver `../_template/index.js` pro que cada campo significa
 * (docs/features/061-revisao-das-skills.md, Rattata).
 *
 * A prioridade da série vira, no tempo real, um golpe que sai rápido (o
 * acerto bem antes do Tackle) e que corre até o alvo: a arrancada começa no
 * `effectAt` e o acerto vem quando ela chega (`lunge`,
 * `core/battle/attackLunge.js`) — alcança mais longe que o corpo a corpo,
 * parando ao encostar no primeiro alvo no caminho.
 *
 * VFX e som do Quick Attack do Cobblemon: as linhas de velocidade e a poeira
 * da arrancada (`visual.lungeGroup`, o efeito do dash), o clarão e as
 * faíscas no acerto (`effectGroup`), o som da arrancada (`audio.lungeGroup`)
 * e o do acerto.
 */
export const QUICK_ATTACK_SKILL = {
  id: 'quick-attack',
  description:
    'Dispara num piscar de olhos contra o primeiro inimigo à frente: corre até {lunge.distance:m} na direção dele e acerta quando chega, até {range:m} de onde parou, com dano físico de poder {power}. Sai bem mais rápido que um golpe comum.',
  type: 'normal',
  group: 'melee',
  duration: 1,
  effectAt: 0.4,
  lunge: { distance: 1.4, duration: 0.2 },
  visual: {
    effectGroup: 'quick-attack',
    // o clarão e as faíscas (`view/vfx/tackleVfx.js`)
    effectVisualDuration: 0.6,
    // a arrancada: as linhas de velocidade e a poeira do dash
    lungeGroup: 'quick-attack',
    scale: 0.6,
    revealDuration: 0,
    rotationOffset: { x: 0, y: 0, z: 0 },
    positionOffset: { x: 0, y: 0, z: 0 },
  },
  audio: { group: 'quick-attack-target', lungeGroup: 'quick-attack-actor' },
  animation: { clipKey: 'attackAlt' },
  // Físico, poder de referência: o de "Quick Attack" nos jogos originais.
  damage: { power: 40, category: 'physical' },
}
