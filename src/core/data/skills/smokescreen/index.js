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
  duration: 1.2,
  effectAt: 0.5,
  range: 3,
  aim: 'ranged',
  castMode: 'instant',
  area: 'cone',
  // abertura do cone: `radius / range` (0.5 = ~27° pra cada lado)
  radius: 1.5,
  staminaCost: 3,
  cooldown: 1,
  accuracy: 100,
  // Sem dano: nada "apanha", e `attackResolved` sai com `status: true`.
  damage: null,
  effects: [{ type: 'statStage', stat: 'accuracy', stages: -1, duration: 30 }],
  visual: {
    effectGroup: 'smokescreen',
    // sopro (0.7 s) + a vida da fumaça (até ~1.5 s)
    effectVisualDuration: 2.5,
    targetEffectGroup: 'smokescreen-target',
    // fumaça do alvo: 0.8 s de emissão + vida das partículas (até ~2.1 s)
    targetEffectVisualDuration: 3,
    scale: 1,
    revealDuration: 0,
    rotationOffset: { x: 0, y: 0, z: 0 },
    positionOffset: { x: 0, y: 0, z: 0 },
  },
  audio: { group: 'smokescreen' },
  // o rugido (a espécie precisa da chave `roar`); o Cobblemon usa a animação
  // `spray`, ainda sem equivalente aqui
  animation: { clipKey: 'roar' },
}
