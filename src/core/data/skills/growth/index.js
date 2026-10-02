/**
 * Crescimento (Growth) — skill de status em SI MESMO: sobe o Ataque e o
 * Ataque Especial de quem usa em 1 estágio cada (regra da Geração 5 em
 * diante). Ver docs/features/033-skills-de-combate-e-vfx.md e
 * `../_template/index.js` pro que cada campo significa.
 *
 * `area: 'self'` (`isSelfAttack`, `core/battle/channelAttack.js`): sem
 * trajetória e sem alvo — os `effects` vão no próprio atacante no
 * `effectAt`, sem sorteio de precisão e sem provocar ninguém; sem indicador
 * de mira nem aviso no chão. O `AttackEffect` nasce nos PÉS da criatura.
 * `range` não é usado.
 *
 * Os efeitos são os mesmos `statStage` do Growl, com o sinal trocado:
 * renovável, acumula até o limite de estágios.
 *
 * Visual: o "boost" genérico do Cobblemon (`misc/boost.json` →
 * `statup_actor` + `statup_actoraura`), que o mod toca em toda criatura que
 * sobe atributo — o Growth não tem efeito próprio lá. `radius` dá o raio da
 * espiral dos orbes em volta do corpo (`view/vfx/statupVfx.js`).
 *
 * Valores de PARTIDA, sem validação em jogo.
 */
export const GROWTH_SKILL = {
  id: 'growth',
  // o atributo sobe no `effectAt`, durante a `charge` do Bulbasaur
  duration: 3,
  effectAt: 3,
  range: 0,
  castMode: 'instant',
  area: 'self',
  radius: 0.5,
  // Sem dano: só sobe os atributos de quem usou.
  damage: null,
  effects: [
    { type: 'statStage', stat: 'attack', stages: 1, duration: 60 },
    { type: 'statStage', stat: 'sp_atk', stages: 1, duration: 60 },
  ],
  visual: {
    effectGroup: 'statup',
    // cobre os orbes (emissão + vida das partículas)
    effectVisualDuration: 1,
    scale: 0.6,
    revealDuration: 0,
    rotationOffset: { x: 0, y: 0, z: 0 },
    positionOffset: { x: 0, y: 0, z: 0 },
    // CARGA (do disparo até o `effectAt`): orbes verdes girando em volta do
    // corpo e se fechando no centro (`view/vfx/absorbChargeVfx.js`). O anel
    // usa `radius` e `scale` acima.
    chargeGroup: 'absorb',
  },
  sprite: {
    path: '/assets/sprites/abilities/growth.png',
    scale: 1,
  },
  // `chargeGroup`: som em loop enquanto carrega (o `gigadrain_actor` do
  // Cobblemon); `group`: o "atributo subiu" no `effectAt`.
  audio: { group: 'statup', chargeGroup: 'absorb-charge' },
  animation: { clipKey: 'charge' },
}
