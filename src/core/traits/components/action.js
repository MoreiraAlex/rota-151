import { trait } from 'koota'

/**
 * Ação disparada por input, em andamento ou não — dash, e no futuro
 * arremesso, uso de item, invocar/recolher criatura. Diferente de
 * AnimationState (que só descreve o que renderizar), ActionState é o que
 * decide se a entidade está "livre" ou ocupada, e por quanto tempo ainda.
 *
 * `current` é o id da ação em andamento (ex.: 'dash') ou `null` quando livre
 * — uma entidade só pode estar em uma ação por vez. `elapsed` conta o tempo
 * desde que a ação começou. `dirX`/`dirZ` travam a direção no instante do
 * disparo, para ações que movem a entidade por um tempo (dash); ações sem
 * direção própria simplesmente não tocam nesses campos.
 *
 * Dono de escrita: playerActionSystem.
 * Leem: animationStateSystem (repassa `current` pra tabela de prioridade).
 */
export const ActionState = trait({
  current: null,
  elapsed: 0,
  dirX: 0,
  dirZ: 0,
})
