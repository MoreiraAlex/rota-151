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
 * `animationSpeed` — pedido do usuário: "antes de colocar o sistema de
 * speed [stat], a gente não consegue vincular as ações direto ao tempo
 * da animação?". Antes, cada clipe de AÇÃO (não cíclico —
 * `isOneShotAnimationState`, `core/data/animationStates.js`) tinha um
 * `speed` PRÓPRIO, autorado à mão no JSON do clipe (`clips/<id>.json`),
 * que precisava bater com `1/duration` — dois números independentes,
 * fácil de desalinhar (achado um caso real: `boy`/`clips/throw.json`
 * tinha `speed: 1.8`, mas `actions.throw.duration` era `0.3` — pediria
 * `speed: 3.33` — e nem o COMENTÁRIO ao lado do `duration` batia com
 * nenhum dos dois, `2.5`). Agora `duration` (já a única fonte de
 * verdade de "quanto tempo a ação trava a entidade", configurada em
 * a skill/`actions.<id>`) é também a ÚNICA fonte da
 * velocidade de playback: quem DISPARA a ação (`playerActionSystem`/
 * `partySummonSystem`/`creatureAttackSystem`, os mesmos donos de
 * escrita de `current`/`elapsed` abaixo) grava `1 / duration` aqui, no
 * mesmo instante em que já resolve a config daquela ação — sem
 * recalcular nada, sem editar um segundo arquivo. `animationSystem.js`
 * (view) lê daqui pra estados `oneShot`, em vez do `speed` do clipe —
 * o gesto inteiro sempre toca por completo (a curva é periódica, um
 * ciclo = o gesto todo), só comprimido/esticado pra caber exatamente
 * em `duration` segundos, não importa o valor. Default `1` (nenhuma
 * ação em andamento, ou ação sem `duration` configurada).
 *
 * `animationFrames` — quantos frames do clipe EMBUTIDO (`.glb`) a ação
 * toca, a partir do início (`null` = todos). Pra cortar um final que não
 * serve: o trecho que sobra é que é esticado pra caber em `duration`.
 * Hoje só o ataque usa (`skills[N].overrides.animationFrames`):
 * `creatureAttackSystem` grava no disparo e volta pra `null` ao fim da
 * ação. Lê: `animationSystem.js` (view).
 *
 * `animationKey` — chave de animação do ataque em andamento
 * (`animation.clipKey` da definição: `'attack'`, `'attackRanged'`...),
 * `null` fora de ataque. `creatureAttackSystem` grava no disparo e volta
 * pra `null` no fim; `animationSystem.js` (view) toca essa chave no lugar
 * da `'attack'` quando a espécie a tiver (docs/features/033-skills-de-combate-e-vfx.md).
 *
 * `channelWeights`/`channelTick` — só em ataque CANALIZADO
 * (`damageMode: 'channel'`): as frações do dano total, uma por tick,
 * sorteadas no disparo (`rollChannelWeights`, somam 1), e o índice do
 * próximo tick. `null`/`0` fora disso. Dono: `creatureAttackSystem`.
 *
 * `channelEffectTargets` — só em ataque CANALIZADO: quem já sorteou o efeito
 * secundário do golpe neste lançamento (ex.: a chance de queimar), pra cada
 * alvo sortear uma vez só (`applyChannelTick`). Lista transitória de
 * entidades, zerada no disparo e no fim. `null` fora disso.
 *
 * `pendingSlot` guarda QUAL slot a ação em andamento diz respeito, com
 * significado diferente por ação (mesmo campo reaproveitado, não um por
 * ação — igual a `dirX/dirY/dirZ`):
 * - invocar/recolher (`partySummonSystem.js`): slot do `Party`
 *   (`'slot1' | 'slot2' | 'slot3'`), já que o efeito de verdade (spawnar
 *   ou destruir a `SummonedCreature`) só acontece depois, no instante de
 *   `EFFECT_AT`, não no disparo.
 * - golpe de criatura (`creatureAttackSystem.js`): qual slot disparou
 *   (`'secondary1' | 'secondary2' | 'secondary3'`, ou `'training'`) —
 *   `current` só diz "attack", sem dizer QUAL golpe resolver durante o
 *   progresso (`effectAt`/`duration`).
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
 * (ataque/skill), `creatureAppealSystem` (apresentação ao ser invocada —
 * o valor inicial vem do spawn em `summonBallSystem`).
 * Leem: `animationStateSystem` (repassa `current` pra tabela de prioridade).
 */
export const ActionState = trait({
  current: null,
  elapsed: 0,
  animationSpeed: 1,
  animationFrames: null,
  animationKey: null,
  channelWeights: null,
  channelTick: 0,
  channelEffectTargets: null,
  dirX: 0,
  dirY: 0,
  dirZ: 0,
  pendingSlot: null,
})
