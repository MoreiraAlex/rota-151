/**
 * Cortina de Fumaça (Smokescreen) — skill de STATUS que baixa a PRECISÃO dos
 * inimigos no cone à frente (mesma forma e mesmo molde do `growl`, ver
 * `../growl/index.js`). Quem está com a precisão baixa passa a ERRAR golpes no
 * sorteio de acerto (`core/battle/accuracy.js`): -1 estágio = ×3/4, então um
 * golpe de 100% acerta 75% das vezes. Ver docs/features/
 * 033-skills-de-combate-e-vfx.md.
 *
 * `accuracy: 100`: o próprio Smokescreen também passa pelo sorteio (errar se o
 * lançador estiver com a precisão baixa). Visual: sopro e nuvem ao longo do
 * cone (`effectGroup: 'smokescreen'`) e a fumaça que engole cada alvo atingido
 * (`targetEffectGroup`), do Cobblemon (`view/vfx/smokescreenVfx.js`); sons do
 * atacante e do alvo (`audio.group: 'smokescreen'`).
 *
 * Valores de PARTIDA, sem validação em jogo.
 */
export const SMOKESCREEN_SKILL = {
  id: 'smokescreen',
  description:
    'Solta uma nuvem de fumaça em leque à frente. Todos os inimigos dentro dela têm a Precisão reduzida em {effects.0.stages:abs} nível por {effects.0.duration:s} e passam a errar mais golpes. Usar de novo acumula a redução e renova o tempo.',
  type: 'normal',
  group: 'cone',
  duration: 2,
  effectAt: 0.5,
  accuracy: 100,
  execution: 'instant',
  // Sem dano: nada "apanha", e `attackResolved` sai com `status: true`.
  damage: null,
  effects: [{ type: 'statStage', stat: 'accuracy', stages: -1, duration: 30 }],
  visual: {
    effectGroup: 'smokescreen',
    // sopro + a vida da fumaça (`view/vfx/smokescreenVfx.js`)
    effectVisualDuration: 1,
    targetEffectGroup: 'smokescreen-target',
    // fumaça do alvo: emissão + vida das partículas
    targetEffectVisualDuration: 3,
    scale: 1.5,
    revealDuration: 0,
    rotationOffset: { x: 0, y: 0, z: 0 },
    positionOffset: { x: 0, y: 0, z: 0 },
  },
  sprite: {
    path: '/assets/sprites/abilities/smokescreen.png',
    scale: 1,
  },
  audio: { group: 'smokescreen' },
  // o rugido (a espécie precisa da chave `roar`); o Cobblemon usa a animação
  // `spray`, ainda sem equivalente aqui
  animation: { clipKey: 'roar' },
}
