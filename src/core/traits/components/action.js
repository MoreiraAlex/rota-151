import { trait } from 'koota'

/**
 * Ação disparada por input, em andamento ou não — dash, e no futuro
 * arremesso, uso de item, invocar/recolher criatura. Diferente de
 * AnimationState (que só descreve o que renderizar), ActionState é o que
 * decide se a entidade está "livre" ou ocupada, e por quanto tempo ainda.
 *
 * `current` é o id da ação em andamento (ex.: 'dash') ou `null` quando livre
 * — uma entidade só pode estar em uma ação por vez. `elapsed` conta o tempo
 * desde que a ação começou. `dirX`/`dirY`/`dirZ` travam algo calculado no
 * instante do disparo — o significado exato varia por ação, não é sempre
 * "direção unitária": pro dash é mesmo uma direção unitária (multiplicada
 * por `DASH.SPEED` a cada tick); pro arremesso, desde
 * docs/features/016-mira-e-arremesso.md, já é a **velocidade de
 * lançamento resolvida** (reta até o ponto de mira, já com `THROW.SPEED`
 * embutido — ver `resolveThrowLaunch`, em `playerActionSystem.js`), pronta
 * pra virar a `Velocity` do projétil sem multiplicar por nada. Ações sem
 * isso simplesmente não tocam nesses campos.
 *
 * Dono de escrita: playerActionSystem.
 * Leem: animationStateSystem (repassa `current` pra tabela de prioridade).
 */
export const ActionState = trait({
  current: null,
  elapsed: 0,
  dirX: 0,
  dirY: 0,
  dirZ: 0,
})
