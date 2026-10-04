export { createEventQueue } from './eventQueue'

export const EVENT_TYPES = {
  ATTACK_RESOLVED: 'attackResolved',
  STAT_STAGE_CHANGED: 'statStageChanged',
  ATTACK_INTERRUPTED: 'attackInterrupted',
  LEECH_SEED_DRAINED: 'leechSeedDrained',
  EXPERIENCE_GAINED: 'experienceGained',
  LEVELED_UP: 'leveledUp',
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
 * @property {string} slot `'primary' | 'secondary1-3'`
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
  status = false,
  missed = false,
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
    status,
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
 * @property {string} slot `'primary' | 'secondary1-3'`
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
 * @property {'slot1' | 'slot2' | 'slot3'} slot criatura do time que ganhou
 * @property {import('koota').Entity | null} creature a criatura em campo
 *   desse slot, ou `null` se estava na bola
 * @property {number} amount XP ganho (já dividido entre os participantes)
 */

/**
 * Uma criatura do time ganhou XP (o estado — `PartyProgress`/`CreatureLevel`
 * — já foi atualizado; o evento é só o aviso).
 *
 * - Quem emite: `ganharExperiencia` (`core/actions/experience.js`) — no
 *   desmaio de uma selvagem (`faintSystem.js`) ou pelo botão de debug.
 * - Quem consome: `view/systems/damageNumberSystem.js` (texto "+N XP" em
 *   cima da criatura em campo). Drenado uma vez por frame; sem consumidor,
 *   some.
 *
 * @returns {ExperienceGainedEvent}
 */
export function experienceGained({ trainer, slot, creature, amount }) {
  return {
    type: EVENT_TYPES.EXPERIENCE_GAINED,
    trainer,
    slot,
    creature: creature ?? null,
    amount,
  }
}

/**
 * @typedef {object} LeveledUpEvent
 * @property {'leveledUp'} type
 * @property {import('koota').Entity} trainer dono do time
 * @property {'slot1' | 'slot2' | 'slot3'} slot criatura do time que subiu
 * @property {import('koota').Entity | null} creature a criatura em campo
 *   desse slot, ou `null` se estava na bola
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
export function leveledUp({ trainer, slot, creature, fromLevel, level }) {
  return {
    type: EVENT_TYPES.LEVELED_UP,
    trainer,
    slot,
    creature: creature ?? null,
    fromLevel,
    level,
  }
}
