/**
 * Enrolar (Wrap) — golpe físico corpo a corpo, ver `../_template/index.js`
 * pro que cada campo significa. Entrou na 059 com valores padrão: forma, VFX
 * e som do `../tackle`; o refino fica pra 088. Na série ele prende o alvo e
 * causa dano por alguns turnos; o jogo ainda não tem esse efeito, então por
 * enquanto é só o golpe.
 */
export const WRAP_SKILL = {
  id: 'wrap',
  type: 'normal',
  accuracy: 90,
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
  // Físico, poder de referência: o de "Wrap" nos jogos originais.
  damage: { power: 15, category: 'physical' },
}
