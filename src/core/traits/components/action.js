import { trait } from 'koota'

/**
 * Ação disparada por input, em andamento ou não — dash, arremesso, uso de
 * item (`playerActionSystem.js`), invocar/recolher criatura
 * (`partySummonSystem.js`, ver docs/features/017-locomocao-e-
 * recolhimento-de-criaturas.md). Diferente de AnimationState (que só
 * descreve o que renderizar), ActionState é o que decide se a entidade
 * está "livre" ou ocupada, e por quanto tempo ainda.
 *
 * `current` é o id da ação em andamento (ex.: 'dash') ou `null` quando
 * livre — uma entidade só pode estar em uma ação por vez, e as DUAS
 * fontes que escrevem aqui (`playerActionSystem`/`partySummonSystem`)
 * respeitam isso mutuamente: cada uma só inicia uma ação nova quando
 * `current` já está `null`, então dash/arremesso/uso e invocar/recolher
 * nunca se sobrepõem, mesmo vindo de dois systems diferentes.
 *
 * `elapsed` conta o tempo desde que a ação começou. `dirX`/`dirY`/`dirZ`
 * travam algo calculado no instante do disparo — o significado exato
 * varia por ação, não é sempre "direção unitária": pro dash é mesmo uma
 * direção unitária (multiplicada por `DASH.SPEED` a cada tick); pro
 * arremesso, desde docs/features/016-mira-e-arremesso.md, já é a
 * **velocidade de lançamento resolvida** (reta até o ponto de mira, já
 * com `THROW.SPEED` embutido — ver `resolveThrowLaunch`, em
 * `playerActionSystem.js`), pronta pra virar a `Velocity` do projétil sem
 * multiplicar por nada; pra invocar, `dirX`/`dirZ` guardam a direção
 * (unitária, da câmera) travada no disparo, usada só depois — no instante
 * de efeito — pra calcular onde a criatura nasce (ver `partySummonSystem.js`).
 * Ações sem uso pra isso simplesmente não tocam nesses campos.
 *
 * `pendingSlot` é específico de invocar/recolher — qual slot do `Party`
 * (`'slot1' | 'slot2' | 'slot3'`) a ação em andamento diz respeito, já que
 * o efeito de verdade (spawnar ou destruir a `SummonedCreature`) só
 * acontece depois, no instante de `EFFECT_AT`, não no disparo. `null`
 * quando não há invocação/recolhimento em andamento.
 *
 * Dono de escrita: `playerActionSystem` (dash/arremesso/uso),
 * `partySummonSystem` (invocar/recolher).
 * Leem: `animationStateSystem` (repassa `current` pra tabela de prioridade).
 */
export const ActionState = trait({
  current: null,
  elapsed: 0,
  dirX: 0,
  dirY: 0,
  dirZ: 0,
  pendingSlot: null,
})
