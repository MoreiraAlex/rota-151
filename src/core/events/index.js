export { createEventQueue } from './eventQueue'

export const EVENT_TYPES = {
  ATTACK_RESOLVED: 'attackResolved',
  STAT_STAGE_CHANGED: 'statStageChanged',
  ATTACK_INTERRUPTED: 'attackInterrupted',
  LEECH_SEED_DRAINED: 'leechSeedDrained',
  EXPERIENCE_GAINED: 'experienceGained',
  LEVELED_UP: 'leveledUp',
  ATTACK_FAILED: 'attackFailed',
  ATTACK_USED: 'attackUsed',
  CREATURE_FAINTED: 'creatureFainted',
  BURN_APPLIED: 'burnApplied',
  BURN_DAMAGED: 'burnDamaged',
  MOVE_UNLOCKED: 'moveUnlocked',
  MOVE_READY_TO_LEARN: 'moveReadyToLearn',
  MOVE_LEARNED: 'moveLearned',
  CAPTURE_STARTED: 'captureStarted',
  CAPTURE_SHOOK: 'captureShook',
  POKEMON_CAPTURED: 'pokemonCaptured',
  CAPTURE_ESCAPED: 'captureEscaped',
  CAPTURE_BALL_BROKE: 'captureBallBroke',
  LIGHTNING_STRUCK: 'lightningStruck',
}

/**
 * @typedef {object} AttackResolvedEvent
 * @property {'attackResolved'} type
 * @property {'hit' | 'miss'} result `'miss'` quando ninguém foi atingido OU quando o
 *   sorteio de precisão falhou (`missed`)
 * @property {import('koota').Entity} attacker
 * @property {import('koota').Entity | null} target `null` num miss sem alvo; no miss
 *   por PRECISÃO é o alvo que foi errado
 * @property {boolean} missed o golpe tinha alvo mas o sorteio de precisão errou
 * @property {string} attackId id do ataque (`core/data/skills/<id>`)
 * @property {string} slot `'secondary1-3'` (ou `'training'`)
 * @property {{x:number,y:number,z:number}} origin onde o golpe começou
 * @property {{x:number,y:number,z:number}} impactPoint onde a trajetória terminou
 * @property {{x:number,y:number,z:number} | null} contactPoint onde tocou o alvo (`null` num miss)
 * @property {number} damage dano aplicado (`0` num miss)
 * @property {boolean} critical se o crítico saiu (`false` num miss)
 * @property {boolean} status golpe de STATUS (`damage: 0`, sem dano — ex.: Growl):
 *   conta como acerto pra reação (a selvagem se provoca, o time defende), mas
 *   brilho, congelar de animação e número de dano ignoram
 * @property {boolean} channel tick de um ataque canalizado (`damageMode:
 *   'channel'`) — efeitos de impacto "pesados" (hit stop) ignoram
 * @property {number} channelTick índice do tick no canalizado (`0` = o
 *   primeiro; `0` fora do canal) — o texto de efetividade só sai no primeiro
 * @property {'super' | 'neutral' | 'weak' | 'immune'} effectiveness
 *   efetividade de tipo do golpe de dano no alvo (`core/data/types/`);
 *   `'neutral'` num miss e em golpe de status. `'immune'`: acertou mas não
 *   pegou (sem dano nem efeito) — brilho e hit stop ignoram, o texto é
 *   "Não afeta…"; golpe de status com `immuneTypes` também
 */

/**
 * O instante ativo de um golpe já resolvido, acertando ou não.
 *
 * - Quem emite: `creatureAttackSystem.js`, no instante `effectAt`, depois
 *   de aplicar o dano (o dano em si é estado e não depende do evento).
 * - Quem consome: `view/systems/hitFlashSystem.js` (brilho no alvo),
 *   `view/systems/damageNumberSystem.js` (número de dano),
 *   e `view/systems/hitStopSystem.js` (congela a animação no acerto).
 *   Ponto de encaixe pra reação, knockback, som de acerto e tremor de
 *   câmera.
 * - Drenado uma vez por frame, antes da apresentação; sem consumidor, some.
 *
 * @returns {AttackResolvedEvent}
 */
export function attackResolved({
  attacker,
  target,
  attackId,
  slot,
  origin,
  impactPoint,
  contactPoint,
  damage,
  critical,
  channel = false,
  channelTick = 0,
  status = false,
  missed = false,
  effectiveness = 'neutral',
}) {
  return {
    type: EVENT_TYPES.ATTACK_RESOLVED,
    result: target && !missed ? 'hit' : 'miss',
    missed,
    attacker,
    target: target ?? null,
    attackId,
    slot,
    origin,
    impactPoint,
    contactPoint: contactPoint ?? null,
    damage: damage ?? 0,
    critical: critical ?? false,
    channel,
    channelTick,
    status,
    effectiveness,
  }
}

/**
 * @typedef {object} StatStageChangedEvent
 * @property {'statStageChanged'} type
 * @property {import('koota').Entity} attacker quem lançou o golpe de status
 * @property {import('koota').Entity} target quem teve o atributo alterado
 * @property {string} attackId id do ataque (`core/data/skills/<id>`)
 * @property {'attack' | 'defense' | 'sp_atk' | 'sp_def' | 'accuracy'} stat
 * @property {number} delta quanto o estágio MUDOU de verdade (negativo = baixou;
 *   nunca `0` — um efeito que já estava no limite não emite)
 * @property {number} stage estágio resultante (-6 a +6)
 */

/**
 * Um atributo de uma criatura mudou de estágio (golpe de STATUS, ex.: Growl
 * baixa o ataque do alvo).
 *
 * - Quem emite: `creatureAttackSystem.js`, no instante `effectAt`, depois de
 *   aplicar o efeito (o estágio em si é estado — `StatStages` — e não depende
 *   do evento). Um evento por atributo e por alvo.
 * - Quem consome: `view/systems/damageNumberSystem.js` (texto "Ataque ↓" acima
 *   do alvo) e `view/systems/hitFlashSystem.js` (brilho laranja/verde no
 *   alvo). Drenado uma vez por frame; sem consumidor, some.
 *
 * @returns {StatStageChangedEvent}
 */
export function statStageChanged({
  attacker,
  target,
  attackId,
  stat,
  delta,
  stage,
}) {
  return {
    type: EVENT_TYPES.STAT_STAGE_CHANGED,
    attacker,
    target,
    attackId,
    stat,
    delta,
    stage,
  }
}

/**
 * @typedef {object} AttackInterruptedEvent
 * @property {'attackInterrupted'} type
 * @property {import('koota').Entity} entity quem teve o golpe interrompido
 * @property {string} attackId id do golpe interrompido (`core/data/skills/<id>`)
 * @property {string} slot `'secondary1-3'` (ou `'training'`)
 */

/**
 * Um golpe de STATUS foi interrompido na carga porque quem o lançava levou
 * dano (`isInterruptible`, `core/battle/attackInterrupt.js`). A ação já
 * acabou (estado: `ActionState.current` volta a `null`, o cooldown do slot
 * começa, a stamina gasta não volta).
 *
 * - Quem emite: `creatureAttackSystem.js`, no fim do tick em que o dano
 *   aconteceu. Um evento por golpe interrompido.
 * - Quem consome: `view/systems/damageNumberSystem.js` (texto
 *   "Interrompido!" acima da cabeça). Drenado uma vez por frame; sem
 *   consumidor, some.
 *
 * @returns {AttackInterruptedEvent}
 */
export function attackInterrupted({ entity, attackId, slot }) {
  return { type: EVENT_TYPES.ATTACK_INTERRUPTED, entity, attackId, slot }
}

/**
 * @typedef {object} LeechSeedDrainedEvent
 * @property {'leechSeedDrained'} type
 * @property {import('koota').Entity} target quem tem a semente (perdeu HP)
 * @property {import('koota').Entity | null} source quem plantou (ganhou HP), ou
 *   `null` se já não existe (recolhido, destruído)
 * @property {number} damage HP tirado do alvo
 * @property {number} healed HP que quem plantou de fato recuperou (0 sem
 *   `source`, desmaiado ou já cheio)
 */

/**
 * Uma drenagem do Leech Seed aconteceu (o estado — `Vitals` dos dois — já foi
 * aplicado; o evento é só o aviso).
 *
 * - Quem emite: `leechSeedSystem.js`, a cada `interval` da semente.
 * - Quem consome: `view/systems/damageNumberSystem.js` (número de dano no alvo
 *   e "+N" de cura em quem plantou). Drenado uma vez por frame; sem
 *   consumidor, some. Não provoca reação (não é `attackResolved`) nem
 *   interrompe golpe de status.
 *
 * @returns {LeechSeedDrainedEvent}
 */
export function leechSeedDrained({ target, source, damage, healed }) {
  return {
    type: EVENT_TYPES.LEECH_SEED_DRAINED,
    target,
    source: source ?? null,
    damage,
    healed,
  }
}

/**
 * @typedef {object} ExperienceGainedEvent
 * @property {'experienceGained'} type
 * @property {import('koota').Entity} trainer dono do time
 * @property {import('koota').Entity} pokemon registro (`Pokemon`) que ganhou
 * @property {import('koota').Entity | null} creature a criatura em campo
 *   dele, ou `null` se estava fora de campo
 * @property {number} amount XP ganho (já dividido entre os participantes)
 */

/**
 * Um Pokémon do treinador ganhou XP (o estado — `CreatureLevel` do registro
 * e da criatura em campo — já foi atualizado; o evento é só o aviso).
 *
 * - Quem emite: `ganharExperiencia` (`core/actions/experience.js`) — no
 *   desmaio de uma selvagem (`faintSystem.js`) ou pelo botão de debug.
 * - Quem consome: `view/systems/damageNumberSystem.js` (texto "+N XP" em
 *   cima da criatura em campo). Drenado uma vez por frame; sem consumidor,
 *   some.
 *
 * @returns {ExperienceGainedEvent}
 */
export function experienceGained({ trainer, pokemon, creature, amount }) {
  return {
    type: EVENT_TYPES.EXPERIENCE_GAINED,
    trainer,
    pokemon,
    creature: creature ?? null,
    amount,
  }
}

/**
 * @typedef {object} LeveledUpEvent
 * @property {'leveledUp'} type
 * @property {import('koota').Entity} trainer dono do time
 * @property {import('koota').Entity} pokemon registro (`Pokemon`) que subiu
 * @property {import('koota').Entity | null} creature a criatura em campo
 *   dele, ou `null` se estava fora de campo
 * @property {number} fromLevel nível antes
 * @property {number} level nível novo (pode ter pulado mais de um)
 */

/**
 * Uma criatura do time subiu de nível (status e vida/energia já
 * recalculados por `subirDeNivel`).
 *
 * - Quem emite: `ganharExperiencia` (`core/actions/experience.js`), logo
 *   depois do `experienceGained`. Um evento por ganho, mesmo pulando vários
 *   níveis.
 * - Quem consome: `view/systems/damageNumberSystem.js` (texto "Nível N!") e
 *   `view/systems/hitFlashSystem.js` (brilho na criatura). Drenado uma vez
 *   por frame; sem consumidor, some.
 *
 * @returns {LeveledUpEvent}
 */
export function leveledUp({ trainer, pokemon, creature, fromLevel, level }) {
  return {
    type: EVENT_TYPES.LEVELED_UP,
    trainer,
    pokemon,
    creature: creature ?? null,
    fromLevel,
    level,
  }
}

/**
 * Um golpe que não erra (sem precisão, em si mesmo ou canalizado) FALHOU
 * por falta de domínio (docs/features/038-aprendizado-treino-e-dominio-de-
 * golpes.md) — o efeito não foi aplicado.
 *
 * - Quem emite: `core/battle/attackImpact.js` (golpe em si mesmo) e
 *   `creatureAttackSystem.js` (início de um canalizado).
 * - Quem consome: `view/systems/damageNumberSystem.js` (texto "Falhou!").
 *
 * @returns {{ type: 'attackFailed', entity: import('koota').Entity, attackId: string, slot: string }}
 */
export function attackFailed({ entity, attackId, slot }) {
  return { type: EVENT_TYPES.ATTACK_FAILED, entity, attackId, slot }
}

/**
 * Uma criatura USOU um golpe — o instante `effectAt`, antes de qualquer
 * resultado (falha, acerto, erro): um por lançamento, inclusive no
 * canalizado e no golpe em si mesmo.
 *
 * - Quem emite: `core/battle/attackImpact.js` (`resolveAttackImpact`).
 * - Quem consome: `view/systems/battleLogSystem.js` ("Charmander usou
 *   Ember!"). Drenado uma vez por frame; sem consumidor, some.
 *
 * @returns {{ type: 'attackUsed', entity: import('koota').Entity, attackId: string, slot: string }}
 */
export function attackUsed({ entity, attackId, slot }) {
  return { type: EVENT_TYPES.ATTACK_USED, entity, attackId, slot }
}

/**
 * Uma criatura (selvagem ou do time) chegou a 0 de HP e desmaiou (o estado —
 * `Fainted` — já foi aplicado; o evento é só o aviso).
 *
 * - Quem emite: `core/systems/faintSystem.js`, antes da divisão de XP (o
 *   "desmaiou" vem antes do "ganhou XP").
 * - Quem consome: `view/systems/battleLogSystem.js`. Drenado uma vez por
 *   frame; sem consumidor, some.
 *
 * @returns {{ type: 'creatureFainted', entity: import('koota').Entity, speciesId: string | null }}
 */
export function creatureFainted({ entity, speciesId }) {
  return {
    type: EVENT_TYPES.CREATURE_FAINTED,
    entity,
    speciesId: speciesId ?? null,
  }
}

/**
 * Um Pokémon do treinador ficou APTO pra golpes novos (cumpriu as condições ao
 * subir de nível) — ainda precisa treinar pra aprender.
 *
 * - Quem emite: `ganharExperiencia` (`core/actions/experience.js`).
 * - Quem consome: `view/systems/damageNumberSystem.js` ("Pode aprender X!").
 *
 * @returns {{ type: 'moveUnlocked', trainer: import('koota').Entity, pokemon: import('koota').Entity, creature: import('koota').Entity | null, moveIds: string[] }}
 */
export function moveUnlocked({ trainer, pokemon, creature, moveIds }) {
  return {
    type: EVENT_TYPES.MOVE_UNLOCKED,
    trainer,
    pokemon,
    creature: creature ?? null,
    moveIds,
  }
}

/**
 * O treino de um golpe terminou, mas os 3 slots estão ocupados — o
 * treinador precisa escolher qual esquecer (ou adiar).
 *
 * - Quem emite: `progredirTreino` (`core/actions/moves.js`).
 * - Quem consome: `tools/menu/ForgetMoveDialog.jsx` (via o pedido guardado
 *   em `MoveLearnRequest`), `view/systems/damageNumberSystem.js`.
 *
 * @returns {{ type: 'moveReadyToLearn', trainer: import('koota').Entity, pokemon: import('koota').Entity, creature: import('koota').Entity | null, moveId: string }}
 */
export function moveReadyToLearn({ trainer, pokemon, creature, moveId }) {
  return {
    type: EVENT_TYPES.MOVE_READY_TO_LEARN,
    trainer,
    pokemon,
    creature: creature ?? null,
    moveId,
  }
}

/**
 * Um Pokémon do treinador aprendeu um golpe (e, com os slots cheios, esqueceu
 * `forgottenId`).
 *
 * - Quem emite: `aprenderGolpe` (`core/actions/moves.js`).
 * - Quem consome: `view/systems/damageNumberSystem.js` ("Aprendeu X!").
 *
 * @returns {{ type: 'moveLearned', trainer: import('koota').Entity, pokemon: import('koota').Entity, creature: import('koota').Entity | null, moveId: string, forgottenId: string | null }}
 */
export function moveLearned({
  trainer,
  pokemon,
  creature,
  moveId,
  forgottenId,
}) {
  return {
    type: EVENT_TYPES.MOVE_LEARNED,
    trainer,
    pokemon,
    creature: creature ?? null,
    moveId,
    forgottenId: forgottenId ?? null,
  }
}

/**
 * Uma criatura foi queimada por um golpe (o `Burn` já foi aplicado — o
 * evento é só o aviso). Renovar uma queimadura também emite.
 *
 * - Quem emite: `applyEffectToTarget` (`core/battle/attackStatusEffects.js`).
 * - Quem consome: `view/systems/battleLogSystem.js` ("X foi queimado!").
 *   Drenado uma vez por frame; sem consumidor, some.
 *
 * @returns {{ type: 'burnApplied', target: import('koota').Entity, source: import('koota').Entity | null, attackId: string }}
 */
export function burnApplied({ target, source, attackId }) {
  return {
    type: EVENT_TYPES.BURN_APPLIED,
    target,
    source: source ?? null,
    attackId,
  }
}

/**
 * A queimadura tirou HP (um tick). Como a drenagem da semente, é dano
 * passivo: não provoca reação nem interrompe golpe.
 *
 * - Quem emite: `core/systems/burnSystem.js`.
 * - Quem consome: `view/systems/damageNumberSystem.js` (número no alvo) e
 *   `view/systems/battleLogSystem.js`. Drenado uma vez por frame; sem
 *   consumidor, some.
 *
 * @returns {{ type: 'burnDamaged', target: import('koota').Entity, source: import('koota').Entity | null, damage: number }}
 */
export function burnDamaged({ target, source, damage }) {
  return {
    type: EVENT_TYPES.BURN_DAMAGED,
    target,
    source: source ?? null,
    damage,
  }
}

/**
 * A Pokébola acertou um selvagem e ele entrou nela (o estado — `BeingCaptured`
 * nele, `CaptureTarget` na bola — já foi aplicado).
 *
 * - Quem emite: `comecarCaptura` (`core/actions/capture.js`).
 * - Quem consome: `view/systems/damageNumberSystem.js` ("Pelas costas!") e a
 *   view da bola (luz). Drenado uma vez por frame; sem consumidor, some.
 *
 * @returns {{ type: 'captureStarted', ball: import('koota').Entity, wild: import('koota').Entity, trainer: import('koota').Entity | null, backStrike: boolean }}
 */
export function captureStarted({ ball, wild, trainer, backStrike }) {
  return {
    type: EVENT_TYPES.CAPTURE_STARTED,
    ball,
    wild,
    trainer: trainer ?? null,
    backStrike: !!backStrike,
  }
}

/**
 * A bola balançou (uma balançada que passou no teste).
 *
 * - Quem emite: `captureBallSystem.js`.
 * - Quem consome: a view/som da bola. Sem consumidor, some.
 *
 * @returns {{ type: 'captureShook', ball: import('koota').Entity, shake: number }}
 */
export function captureShook({ ball, shake }) {
  return { type: EVENT_TYPES.CAPTURE_SHOOK, ball, shake }
}

/**
 * Um selvagem foi capturado (o registro já existe e está no destino; o
 * selvagem já foi destruído).
 *
 * - Quem emite: `capturarSelvagem` (`core/actions/capture.js`).
 * - Quem consome: `view/systems/battleLogSystem.js` e
 *   `view/systems/damageNumberSystem.js` ("Capturado!" no ponto da bola).
 *
 * @returns {{ type: 'pokemonCaptured', trainer: import('koota').Entity | null, pokemon: import('koota').Entity, speciesId: string, destination: 'party' | 'inventory' | 'ground', position: {x:number,y:number,z:number} }}
 */
export function pokemonCaptured({
  trainer,
  pokemon,
  speciesId,
  destination,
  position,
}) {
  return {
    type: EVENT_TYPES.POKEMON_CAPTURED,
    trainer: trainer ?? null,
    pokemon,
    speciesId,
    destination,
    position,
  }
}

/**
 * O selvagem escapou da bola (já está de volta na cena, brigando ou fugindo).
 *
 * - Quem emite: `selvagemEscapou` (`core/actions/capture.js`).
 * - Quem consome: `view/systems/battleLogSystem.js` e
 *   `view/systems/damageNumberSystem.js` ("Escapou!").
 *
 * @returns {{ type: 'captureEscaped', wild: import('koota').Entity, speciesId: string | null, reaction: 'fight' | 'flee' }}
 */
export function captureEscaped({ wild, speciesId, reaction }) {
  return {
    type: EVENT_TYPES.CAPTURE_ESCAPED,
    wild,
    speciesId: speciesId ?? null,
    reaction,
  }
}

/**
 * Uma bola que errou quebrou e sumiu (só visual).
 *
 * - Quem emite: `captureBallSystem.js`.
 * - Quem consome: a view (pedaços, som). Sem consumidor, some.
 *
 * @returns {{ type: 'captureBallBroke', itemId: string | null, position: {x:number,y:number,z:number} }}
 */
export function captureBallBroke({ itemId, position }) {
  return {
    type: EVENT_TYPES.CAPTURE_BALL_BROKE,
    itemId: itemId ?? null,
    position,
  }
}

/**
 * Um relâmpago na tempestade onde o jogador está (só visual e som,
 * docs/features/048-dia-noite-e-clima.md). `thunderDelay`: segundos até o
 * trovão; `strength`: força da tempestade agora (0 a 1).
 *
 * - Quem emite: `weatherSystem.js`.
 * - Quem consome: `view/systems/lightningSystem.js` (clarão e trovão).
 *
 * @returns {{ type: 'lightningStruck', thunderDelay: number, strength: number }}
 */
export function lightningStruck({ thunderDelay, strength }) {
  return { type: EVENT_TYPES.LIGHTNING_STRUCK, thunderDelay, strength }
}
