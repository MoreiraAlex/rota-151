/**
 * Soco — ver `../_template/index.js` pro que cada campo significa e
 * docs/features/025-ataque-comum-de-criatura.md pro histórico. Visual de
 * verdade (`EffCommonHitNormalA` + `HitNormalShockWave`, rips convertidos
 * — ver `PunchAttackEffect.jsx`), atualmente o ataque padrão configurado
 * em toda espécie nova.
 */
export const PUNCH_SKILL = {
  id: 'punch',
  type: 'normal',
  group: 'melee',
  duration: 1.2,
  effectAt: 0.5,
  visual: {
    effectGroup: 'punch',
    effectVisualDuration: 0.35,
    // Multiplicador de tamanho do VFX — ver comentário completo em
    // `../tackle/index.js`. Multiplica as duas malhas (flash + onda de
    // choque) juntas, mantendo a proporção entre elas
    // (`HIT_BASE_SCALE`/`SHOCKWAVE_BASE_SCALE`, `PunchAttackEffect.jsx`).
    scale: 1,
    // Sem reveal — o soco é um estouro instantâneo (flash + onda de
    // choque), não um traço progressivo como o 'tackle'.
    // `PunchAttackEffect.jsx` nem lê este campo.
    revealDuration: 0,
    rotationOffset: { x: 0, y: 0, z: 0 },
    positionOffset: { x: 0, y: 0, z: 0 },
  },
  sprite: {
    path: '/assets/sprites/abilities/punch.png',
    scale: 1,
  },
  audio: {
    group: 'punch',
  },
  animation: {
    clipKey: 'attack',
  },
  // Físico, na faixa de um soco básico dos jogos originais.
  damage: { power: 5, category: 'physical' },
}
