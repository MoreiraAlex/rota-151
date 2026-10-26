/**
 * Revólver d'Água (Water Gun) — skill de dano à distância do Squirtle: um jato
 * de água CANALIZADO em feixe. Ver docs/features/033-skills-de-combate-e-vfx.md
 * (Parte 10) e `../_template/index.js` pro que cada campo significa.
 *
 * Modalidade (pedido do usuário): canalizada como a Brasa (segurar o botão,
 * soltar corta, o canal inteiro vale o dano de um golpe, repartido em ticks),
 * mas em FEIXE (canalizado do grupo de distância, `isBeamAttack`): a cada tick só o PRIMEIRO
 * corpo na linha leva dano (a mesma cápsula do golpe normal, não o cone que
 * pega todo mundo), e a criatura controlada continua mirando com a câmera
 * durante o canal inteiro.
 *
 * Visual: o jato (`visual.channelGroup: 'water-jet'`) sai da boca e segue a
 * mira enquanto o canal durar; a cada tick, o respingo onde o jato bate
 * (`visual.channelHitGroup: 'water-gun-hit'`). Sem efeito de impacto único
 * (`effectGroup: 'none'`). O tiro único de antes continua como o grupo
 * `'water-gun'` (`view/vfx/waterGunVfx.js`), sem uso.
 *
 * Valores de PARTIDA, sem validação em jogo.
 */

export const WATER_GUN_SKILL = {
  id: 'water-gun',
  description:
    'Canalizado: enquanto segura, dispara um jato de água no primeiro inimigo à frente, até {range:m}. Causa dano especial de poder {power}, dividido ao longo do jato; soltar antes encerra o golpe com menos dano.',
  type: 'water',
  group: 'ranged',
  // canal de até `duration`; o jato começa no fim do `attackRangedAltStart`
  duration: 2,
  effectAt: 0.75,
  execution: 'channel',
  damageInterval: 0.25,
  visual: {
    effectGroup: 'none',
    effectVisualDuration: 0,
    channelGroup: 'water-jet',
    channelHitGroup: 'water-gun-hit',
    // cobre a espuma (emissão + vida das partículas)
    channelHitVisualDuration: 1,
    scale: 1.5,
    revealDuration: 0,
    rotationOffset: { x: 0, y: 0, z: 0 },
    positionOffset: { x: 0, y: 0, z: 0 },
  },
  sprite: {
    path: '/assets/sprites/abilities/water-gun.png',
    scale: 1,
  },
  audio: { group: 'water-gun' },
  animation: { clipKey: 'attackRangedAlt' },
  damage: { power: 40, category: 'special' },
}
