/**
 * Olhar Penetrante (Leer) — golpe de status em cone que baixa a DEFESA dos
 * alvos, o mesmo efeito do `../tail-whip`, ver `../_template/index.js` pro que
 * cada campo significa (docs/features/061-revisao-das-skills.md).
 *
 * Visual e som do Leer do Cobblemon: o brilho nos olhos de quem usa (um em
 * cada olho), no `effectAt` (`visual.actionGroup: 'leer'`,
 * `view/vfx/leerVfx.js`), e o som do `scaryface` junto. O meio dos olhos é o
 * `visual.positionOffset` (a partir do centro do corpo, no referencial de
 * quem olha) e a distância entre eles acompanha o `visual.scale`: o daqui é o do Spearow, a
 * primeira espécie revisada; as outras trocam pelo override. O feedback no
 * alvo é o brilho, o texto "Defesa ↓" e o indicador na HUD.
 */
export const LEER_SKILL = {
  id: 'leer',
  description:
    'Encara com um olhar penetrante os inimigos no leque à frente. Todos dentro dele têm a Defesa reduzida em {effects.0.stages:abs} nível por {effects.0.duration:s}. Usar de novo acumula a redução e renova o tempo.',
  type: 'normal',
  group: 'cone',
  accuracy: 100,
  duration: 1.2,
  effectAt: 0.5,
  // Sem dano: nada "apanha", e `attackResolved` sai com `status: true`.
  damage: null,
  effects: [{ type: 'statStage', stat: 'defense', stages: -1, duration: 60 }],
  visual: {
    // sem visual de impacto: o efeito é o da AÇÃO (`actionGroup`)
    effectGroup: 'none',
    effectVisualDuration: 0,
    // o brilho nos olhos, preso à criatura (`view/vfx/leerVfx.js`)
    actionGroup: 'leer',
    scale: 1,
    revealDuration: 0,
    rotationOffset: { x: 0, y: 0, z: 0 },
    positionOffset: { x: 0, y: 0.15, z: 0.1 },
  },
  audio: { group: 'leer-actor' },
  animation: { clipKey: 'roar' },
}
