/**
 * Bando Duplo (Double Team) — golpe de status em SI MESMO, ver
 * `../_template/index.js` pro que cada campo significa
 * (docs/features/061-revisao-das-skills.md).
 *
 * Como na série, sobe a EVASÃO de quem usa (estágio, acumula — decisão do
 * usuário): os golpes contra ele erram mais (`resolveAccuracyStage`,
 * `core/battle/accuracy.js` — a precisão de quem ataca menos a evasão do
 * alvo).
 *
 * Visual: as linhas de velocidade pros lados do Double Team do Cobblemon
 * (`view/vfx/doubleTeamVfx.js`) e os VULTOS — cópias translúcidas do modelo
 * saindo dos dois lados e piscando (`visual.afterimages`,
 * `view/systems/afterimageSystem.js`; o Cobblemon não tem). Som do Cobblemon.
 */
export const DOUBLE_TEAM_SKILL = {
  id: 'double-team',
  description:
    'Se move tão rápido que deixa cópias de si dos dois lados. A Evasão sobe {effects.0.stages} nível por {effects.0.duration:s}: os golpes contra ele erram mais. Usar de novo acumula e renova o tempo.',
  type: 'normal',
  group: 'self',
  duration: 1.25,
  effectAt: 1,
  damage: null,
  effects: [{ type: 'statStage', stat: 'evasion', stages: 1, duration: 15 }],
  visual: {
    effectGroup: 'double-team',
    // as linhas (`view/vfx/doubleTeamVfx.js`)
    effectVisualDuration: 0.75,
    // os vultos dos dois lados (`view/systems/afterimageSystem.js`)
    afterimages: {
      count: 4,
      spread: 0.35,
      duration: 0.8,
      opacity: 0.45,
      flicker: 6,
    },
    scale: 1,
    revealDuration: 0,
    rotationOffset: { x: 0, y: 0, z: 0 },
    positionOffset: { x: 0, y: 0, z: 0 },
  },
  audio: { group: 'double-team-actor' },
  animation: { clipKey: 'roar' },
}
