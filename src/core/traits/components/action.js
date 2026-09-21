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
 * `pendingSlot` guarda QUAL slot a ação em andamento diz respeito, com
 * significado diferente por ação (mesmo campo reaproveitado, não um por
 * ação — igual a `dirX/dirY/dirZ`):
 * - invocar/recolher (`partySummonSystem.js`): slot do `Party`
 *   (`'slot1' | 'slot2' | 'slot3'`), já que o efeito de verdade (spawnar
 *   ou destruir a `SummonedCreature`) só acontece depois, no instante de
 *   `EFFECT_AT`, não no disparo.
 * - ataque/skill de criatura (`creatureAttackSystem.js`, desde a 9ª
 *   rodada de docs/features/025-ataque-comum-de-criatura.md): qual botão
 *   disparou (`'primary' | 'secondary1' | 'secondary2' | 'secondary3'`,
 *   mesmos rótulos de `species.attacks.<slot>`) — precisa disso porque
 *   `current` some diz "attack" pras duas fontes (mouse e Q/E/R), sem
 *   dizer QUAL ataque resolver durante o progresso (`effectAt`/
 *   `duration`); sem o slot, `creatureAttackSystem` não saberia se deve
 *   reler `attacks.primary` ou `attacks.secondary1` no meio do gesto.
 *
 * `null` quando não há ação relevante em andamento.
 *
 * Cooldown de ataque/skill (por slot, não um campo único aqui) mora em
 * `AttackCooldowns` (`core/traits/components/attackEffect.js`), separado
 * de propósito — corre em paralelo a QUALQUER ação (`current` que for),
 * não só enquanto `current === 'attack'`, então não faz sentido dividir
 * `ActionState` (que descreve só a ação ATUAL) com 4 campos que ficam
 * ativos o tempo todo.
 *
 * Dono de escrita: `playerActionSystem` (dash/arremesso/uso),
 * `partySummonSystem` (invocar/recolher), `creatureAttackSystem`
 * (ataque/skill).
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
