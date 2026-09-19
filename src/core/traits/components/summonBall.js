import { trait } from 'koota'

/**
 * Esfera arremessada ao disparar a ação `'summon'` (ver
 * `partySummonSystem.js`, docs/features/024-esfera-de-invocar.md) —
 * `Position`/`Velocity` (traits já existentes) cuidam de onde está e pra
 * onde vai, mesmo padrão de `Projectile`. `slot`/`speciesId` são
 * CONGELADOS no disparo (não recalculados quando a esfera pousa) — o time
 * do treinador pode mudar enquanto ela está em voo.
 *
 * `maxDistance` é `getPlayerSpecies().party.summonOffset` no instante do
 * disparo — o orçamento total de distância que a esfera pode percorrer
 * antes de "desistir" e pousar de qualquer jeito (ver `summonBallSystem.js`:
 * sem tocar em nada dentro desse alcance, a criatura nasce exatamente onde
 * a esfera parou, respeitando `summonOffset` como distância máxima, não
 * como posição fixa). `traveled` é quanto ela já andou.
 *
 * Dono de escrita: `partySummonSystem` (spawna, no `effectAt` da ação);
 * `summonBallSystem` (integra posição, detecta pouso por raycast varrido,
 * conta `traveled`, spawna a `SummonedCreature` de verdade ao pousar —
 * por toque OU por esgotar `maxDistance` — e destrói a esfera).
 */
export const SummonBall = trait({
  slot: null,
  speciesId: null,
  maxDistance: 0,
  traveled: 0,
})
