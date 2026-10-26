/**
 * Dragon Breath — golpe especial à distância, ver `../_template/index.js` pro
 * que cada campo significa. VFX próprio, traduzido do Cobblemon (o sopro
 * cor de dragão e a explosão no alvo, `view/vfx/dragonBreathVfx.js`); o som
 * ainda é o da Brasa (`../ember`). Como na série, tem chance de PARALISAR
 * (`core/data/conditions/paralysis/`, que aqui atordoa enquanto dura) — no
 * canal, cada alvo sorteia uma vez por uso.
 */
export const DRAGON_BREATH_SKILL = {
  id: 'dragon-breath',
  description:
    'Solta um sopro de energia dracônica em leque à frente, até {range:m}. Todos os inimigos dentro dele levam dano especial de poder {power}, com {effects.0.chance:%} de chance de ficarem paralisados por {effects.0.duration:s}.',
  type: 'dragon',
  group: 'cone',
  duration: 2,
  effectAt: 0.95,
  damageInterval: 0.25,
  visual: {
    effectGroup: 'dragon-breath',
    // o sopro (1 s) + a vida das últimas partículas
    effectVisualDuration: 2,
    scale: 1,
    revealDuration: 0,
    rotationOffset: { x: 0, y: 0, z: 0 },
    positionOffset: { x: 0, y: 0, z: 0 },
  },
  audio: { group: 'smokescreen' },
  animation: { clipKey: 'attackRangedAlt' },
  // Especial, poder de referência: o de "Dragon Breath" nos jogos originais.
  damage: { power: 60, category: 'special' },
  // a chance de paralisar da série
  effects: [{ type: 'condition', condition: 'paralysis', chance: 0.3 }],
}
