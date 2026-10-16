/**
 * Energia Focada (Focus Energy) — golpe de status em SI MESMO, no formato do
 * `../withdraw` (`area: 'self'`), ver `../_template/index.js` pro que cada
 * campo significa. Entrou na 059 com valores padrão: VFX e som do "atributo
 * subiu" do Growth; o refino fica pra 088. Na série ele aumenta a chance de
 * crítico de quem usa, mas no jogo o crítico tem chance fixa, sem estágio
 * (`rollCriticalMultiplier`, `core/battle/calculateDamage.js`): por enquanto
 * não tem efeito.
 */
export const FOCUS_ENERGY_SKILL = {
  id: 'focus-energy',
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
