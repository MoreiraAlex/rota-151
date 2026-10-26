/**
 * Mordida (Bite) — golpe físico corpo a corpo, ver `../_template/index.js`
 * pro que cada campo significa. VFX e som do Bite do Cobblemon: as presas
 * fechando e as faíscas no alvo (`view/vfx/biteVfx.js`) e o som da mordida.
 * Como na série, tem chance de fazer o alvo RECUAR (`core/data/conditions/
 * flinch/`): ele para na hora o que estava fazendo, atordoado por um
 * instante.
 * Tipo Normal, como na Gen 1: a tabela de tipos do jogo é a dela, sem
 * Sombrio (`core/data/types/index.js`).
 */
export const BITE_SKILL = {
  id: 'bite',
  description:
    'Morde com força o primeiro inimigo à frente, até {range:m}, causando dano físico de poder {power}, com {effects.0.chance:%} de chance de fazer ele recuar: para na hora o que estava fazendo.',
  type: 'normal',
  group: 'melee',
  duration: 1.2,
  effectAt: 0.5,
  visual: {
    effectGroup: 'bite',
    // a mordida (0.55 s) e as faíscas (0.15 s depois, 0.35 s de vida)
    effectVisualDuration: 0.6,
    scale: 0.75,
    revealDuration: 0,
    rotationOffset: { x: 0, y: 0, z: 0 },
    positionOffset: { x: 0, y: 0, z: 0 },
  },
  audio: { group: 'bite-target' },
  animation: { clipKey: 'attackAlt' },
  // Físico, poder de referência: o de "Bite" nos jogos originais.
  damage: { power: 60, category: 'physical' },
  // a chance de recuo da série
  effects: [{ type: 'condition', condition: 'flinch', chance: 0.3 }],
}
