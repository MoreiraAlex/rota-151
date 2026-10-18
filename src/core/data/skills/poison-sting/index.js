/**
 * Ferrão Venenoso (Poison Sting) — golpe físico corpo a corpo, ver
 * `../_template/index.js` pro que cada campo significa. Entrou na 059 com
 * valores padrão: forma do `../tackle`, VFX e som do impacto genérico do tipo
 * (`'impact'`); o refino fica pra 090. A chance de envenenar da série fica
 * de fora até o jogo ter envenenamento.
 */
export const POISON_STING_SKILL = {
  id: 'poison-sting',
  type: 'poison',
  duration: 0.5,
  effectAt: 0.25,
  range: 1.4,
  aim: 'melee',
  castMode: 'instant',
  radius: 0.3,
  visual: {
    effectGroup: 'impact',
    effectVisualDuration: 0.6,
    scale: 0.6,
    revealDuration: 0.2,
    rotationOffset: { x: 0, y: 0, z: 0 },
    positionOffset: { x: 0, y: 0, z: 0 },
  },
  audio: { group: 'impact' },
  animation: { clipKey: 'attackAlt' },
  // Físico, poder de referência: o de "Poison Sting" nos jogos originais.
  damage: { power: 15, category: 'physical' },
}
