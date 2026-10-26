/**
 * Picada (Bug Bite) — golpe físico corpo a corpo, ver `../_template/index.js`
 * pro que cada campo significa (docs/features/061-revisao-das-skills.md). Só
 * o dano: comer a fruta do alvo (série) não entra (decisão do usuário).
 *
 * O Cobblemon não tem o golpe: VFX e som são os da mordida do Leech Life, sem
 * a drenagem (`view/vfx/bugBiteVfx.js`) — as presas de inseto fechando e as
 * faíscas no alvo, e o som da mordida.
 */
export const BUG_BITE_SKILL = {
  id: 'bug-bite',
  description:
    'Morde o primeiro inimigo à frente, até {range:m}, causando dano físico de poder {power}.',
  type: 'bug',
  group: 'melee',
  duration: 1.2,
  effectAt: 0.5,
  visual: {
    effectGroup: 'bug-bite',
    // a mordida e as faíscas (`view/vfx/bugBiteVfx.js`)
    effectVisualDuration: 0.7,
    scale: 0.75,
    revealDuration: 0,
    rotationOffset: { x: 0, y: 0, z: 0 },
    positionOffset: { x: 0, y: 0, z: 0 },
  },
  audio: { group: 'bug-bite-target' },
  animation: { clipKey: 'attackAlt' },
  // Físico, poder de referência: o de "Bug Bite" nos jogos originais.
  damage: { power: 60, category: 'physical' },
}
