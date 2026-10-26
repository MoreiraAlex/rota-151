/**
 * Ataque de Fúria (Fury Attack) — golpe físico corpo a corpo de VÁRIOS
 * acertos, ver `../_template/index.js` pro que cada campo significa
 * (docs/features/061-revisao-das-skills.md).
 *
 * Como na série, acerta de 2 a 5 vezes seguidas (`multiHit`,
 * `core/battle/multiHit.js`): só o primeiro acerto sorteia a precisão; os
 * seguintes vão no mesmo alvo, cada um com o próprio dano, crítico, número,
 * VFX, som e sorteio de efeito secundário. O custo e a IA contam o `power`
 * vezes a média de acertos (`resolveExpectedHits`).
 *
 * O Cobblemon não tem o golpe: cada acerto é uma bicada curta feita com o
 * corte e as faíscas do `../peck` (`view/vfx/furyAttackVfx.js`), num ângulo
 * e num ponto sorteados, e o impacto genérico do tipo (escolha do usuário,
 * entre os candidatos). A animação é a de ataque da espécie, uma vez.
 */
export const FURY_ATTACK_SKILL = {
  id: 'fury-attack',
  description:
    'Bica o primeiro inimigo à frente, até {range:m}, de {multiHit.counts.0} a {multiHit.counts.3} vezes seguidas, cada bicada com dano físico de poder {power}. Só a primeira pode errar.',
  type: 'normal',
  group: 'melee',
  accuracy: 85,
  duration: 1.2,
  effectAt: 0.5,
  // acertos possíveis e o peso de cada um no sorteio (os da série) e o
  // intervalo entre um acerto e o seguinte
  multiHit: { counts: [2, 3, 4, 5], weights: [35, 35, 15, 15], interval: 0.15 },
  visual: {
    effectGroup: 'fury-attack',
    // o corte e as faíscas de UMA bicada (`view/vfx/furyAttackVfx.js`)
    effectVisualDuration: 0.3,
    scale: 0.5,
    revealDuration: 0,
    rotationOffset: { x: 0, y: 0, z: 0 },
    positionOffset: { x: 0, y: 0, z: 0 },
  },
  audio: { group: 'impact' },
  animation: { clipKey: 'attack' },
  // Físico, poder de referência: o de "Fury Attack" nos jogos originais
  // (um acerto).
  damage: { power: 15, category: 'physical' },
}
