// Cor por ataque/skill (`core/data/attacks/<id>/index.js`) — mesmo
// raciocínio de `itemColors.js`/`creatureTints.js`: placeholder cosmético
// pro HUD (`tools/hud/SkillsHud.jsx`, via `SlotPreview`), sem ícone de
// verdade ainda. `'scratch'`/`'punch'` reaproveitam o tom pálido que o
// próprio VFX já usa (`ScratchAttackEffect.jsx`/`PunchAttackEffect.jsx`,
// `HIT_COLOR`/`SCRATCH_COLOR`) — sem "tipo" elemental pra combinar com
// outra cor. As 3 skills novas (docs/features/025-ataque-comum-de-
// criatura.md, "9ª rodada") usam a cor do TIPO (fogo/planta/água), mesmo
// se o tint usado no VFX de verdade for outro (ex.: `ember` tinge de
// branco no VFX — a textura já é colorida —, mas laranja aqui identifica
// melhor a skill de relance no HUD).
export const ATTACK_COLORS = {
  scratch: '#fff3c4',
  punch: '#fff3c4',
  'vine-whip': '#7ee787',
  ember: '#ff7043',
  whirlpool: '#4fc3f7',
}
