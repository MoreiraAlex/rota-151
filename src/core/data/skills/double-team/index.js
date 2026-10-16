/**
 * Bando Duplo (Double Team) — golpe de status em SI MESMO, no formato do
 * `../withdraw` (`area: 'self'`), ver `../_template/index.js` pro que cada
 * campo significa. Entrou na 059 com valores padrão: VFX e som do "atributo
 * subiu" do Growth; o refino fica pra 088. Na série ele sobe a Evasão de quem
 * usa, mas o jogo ainda não tem estágio de Evasão (`STAT_STAGE_KEYS`,
 * `core/battle/statStages.js`): por enquanto não tem efeito.
 */
export const DOUBLE_TEAM_SKILL = {
  id: 'double-team',
  type: 'normal',
  duration: 1,
  effectAt: 0.5,
  range: 0,
  castMode: 'instant',
  area: 'self',
  radius: 0.5,
  damage: null,
  effects: [],
  visual: {
    effectGroup: 'statup',
    effectVisualDuration: 1,
    scale: 0.6,
    revealDuration: 0,
    rotationOffset: { x: 0, y: 0, z: 0 },
    positionOffset: { x: 0, y: 0, z: 0 },
  },
  audio: { group: 'statup' },
  animation: { clipKey: 'roar' },
}
