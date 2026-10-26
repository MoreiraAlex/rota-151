/**
 * Enrolar (Wrap) — golpe físico corpo a corpo, ver `../_template/index.js`
 * pro que cada campo significa (docs/features/061-revisao-das-skills.md).
 *
 * Como na série, prende o alvo: a condição PRESO (`core/data/conditions/
 * bound/`) — ele não sai do lugar (andar, correr, voar, dash e arrancada),
 * mas pode girar e atacar, e perde HP aos poucos; acaba só pelo tempo
 * (decisões do usuário). Na série prende sempre que acerta.
 *
 * O Cobblemon não tem o golpe: no acerto, os anéis apertando em volta do
 * corpo do alvo (`targetEffectGroup: 'wrap-target'`, `view/vfx/wrapVfx.js`);
 * enquanto estiver Preso, os anéis ficam no corpo (o `visual.body` da
 * condição). Som: o acerto do Infestation, que também prende.
 */
export const WRAP_SKILL = {
  id: 'wrap',
  description:
    'Enrola o primeiro inimigo à frente, até {range:m}, causando dano físico de poder {power} e prendendo ele por {effects.0.duration:s}: preso, não sai do lugar e perde {effects.0.tick.fraction:%} do HP a cada {effects.0.tick.interval:s}, mas ainda pode atacar.',
  type: 'normal',
  group: 'melee',
  accuracy: 90,
  duration: 1.2,
  effectAt: 0.5,
  // prende sempre que acerta (`core/data/conditions/bound/`)
  effects: [{ type: 'condition', condition: 'bound' }],
  visual: {
    // sem impacto no ponto de contato: os anéis nascem no corpo do alvo
    effectGroup: 'none',
    effectVisualDuration: 0,
    targetEffectGroup: 'wrap-target',
    // os anéis apertando (`view/vfx/wrapVfx.js`)
    targetEffectVisualDuration: 1.2,
    scale: 1,
    revealDuration: 0,
    rotationOffset: { x: 0, y: 0, z: 0 },
    positionOffset: { x: 0, y: 0, z: 0 },
  },
  audio: { group: 'wrap-target' },
  animation: { clipKey: 'attack' },
  // Físico, poder de referência: o de "Wrap" nos jogos originais.
  damage: { power: 15, category: 'physical' },
}
