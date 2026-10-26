/**
 * Choque do Trovão (Thunder Shock) — golpe especial de distância, um alvo,
 * ver `../_template/index.js` pro que cada campo significa
 * (docs/features/061-revisao-das-skills.md).
 *
 * Como na série, tem chance de PARALISAR (`core/data/conditions/paralysis/`,
 * que aqui atordoa enquanto dura).
 *
 * Visual e som do Thunder Shock do Cobblemon (`view/vfx/thunderShockVfx.js`):
 * carregando, faíscas e raios curtos no corpo de quem usa (`visual.
 * chargeGroup`); no `effectAt`, o raio até o alvo e, no contato, as faíscas,
 * o choque e os estilhaços elétricos; o choque saindo e acertando juntos no
 * acerto (o grupo composto `'thunder-shock'`).
 */
export const THUNDER_SHOCK_SKILL = {
  id: 'thunder-shock',
  description:
    'Dispara um choque elétrico no primeiro inimigo à frente, até {range:m}, causando dano especial de poder {power}, com {effects.0.chance:%} de chance de paralisar por {effects.0.duration:s}.',
  type: 'electric',
  group: 'ranged',
  duration: 1.2,
  effectAt: 0.75,
  effects: [{ type: 'condition', condition: 'paralysis', chance: 0.1 }],
  visual: {
    effectGroup: 'thunder-shock',
    // o raio e o impacto (`view/vfx/thunderShockVfx.js`)
    effectVisualDuration: 0.75,
    chargeGroup: 'thunder-shock-charge',
    scale: 1,
    revealDuration: 0,
    rotationOffset: { x: 0, y: 0, z: 0 },
    positionOffset: { x: 0, y: 0, z: 0 },
  },
  audio: { group: 'thunder-shock' },
  animation: { clipKey: 'attackRangedAlt' },
  // Especial, poder de referência: o de "Thunder Shock" nos jogos originais.
  damage: { power: 40, category: 'special' },
}
