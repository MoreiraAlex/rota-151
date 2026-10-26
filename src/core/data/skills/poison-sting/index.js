/**
 * Ferrão Venenoso (Poison Sting) — golpe físico de distância, ver
 * `../_template/index.js` pro que cada campo significa
 * (docs/features/061-revisao-das-skills.md, Weedle).
 *
 * Como na série, o dano tem chance de ENVENENAR o alvo (condição `poison`,
 * `core/data/conditions/poison/`). O Cobblemon não tem o golpe: o ferrão roxo
 * voando até o alvo é nosso e o acerto (respingo e bolhas) é o do Poison Fang
 * (`view/vfx/poisonVfx.js`); som do impacto do tipo.
 */
export const POISON_STING_SKILL = {
  id: 'poison-sting',
  description:
    'Dispara um ferrão no primeiro inimigo à frente, até {range:m}, causando dano físico de poder {power}. Tem {effects.0.chance:%} de chance de envenenar: o alvo perde {effects.0.tick.fraction:%} da vida máxima a cada {effects.0.tick.interval:s}, por {effects.0.duration:s}. Não pega em Pokémon do tipo Veneno.',
  type: 'poison',
  group: 'ranged',
  duration: 1.2,
  effectAt: 0.5,
  effects: [{ type: 'condition', condition: 'poison', chance: 0.3 }],
  visual: {
    effectGroup: 'poison-sting',
    // o ferrão, o respingo e as bolhas (`view/vfx/poisonVfx.js`)
    effectVisualDuration: 1.7,
    scale: 0.6,
    revealDuration: 0,
    rotationOffset: { x: 0, y: 0, z: 0 },
    positionOffset: { x: 0, y: 0, z: 0 },
  },
  audio: { group: 'impact' },
  animation: { clipKey: 'attack' },
  // Físico, poder de referência: o de "Poison Sting" nos jogos originais.
  damage: { power: 15, category: 'physical' },
}
