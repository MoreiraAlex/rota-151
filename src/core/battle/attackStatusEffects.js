import { getSpecies } from '../data/species'
import { isImmuneToStatusSkill, resolveSpeciesTypes } from '../data/types'
import {
  attackInterrupted,
  attackResolved,
  conditionApplied,
  statStageChanged,
} from '../events'
import { isInterruptible } from './attackInterrupt'
import {
  applyStatStageEffect,
  readSpeedStage,
  readStatStages,
} from './statStages'
import { iniciarAtordoamento } from '../actions/hitStun'
import { aplicarCondicao, removerCondicoesPorId } from '../actions/conditions'
import { gameplayRng } from '../rng'
import { resolveAccuracyStage, rollHit } from './accuracy'
import { resolveBodyExtent } from '../physics/capsule'
import { finishAttack, resolveAttackForEntity } from './attackCasting'
import { resolveEntityMoveSet } from './creatureAttack'
import {
  ActionState,
  AttackEffect,
  CharacterController,
  IndividualValues,
  Position,
  Rotation,
  resolveCreatureSpeciesId,
  resolveEntityLevel,
} from '../traits'

/**
 * Aplica os `effects` da skill em cada alvo — `statStage` (estágio de
 * atributo) e `condition` (`aplicarCondicao`; quem conta o tempo é o
 * `conditionSystem`) — e emite os eventos: um `statStageChanged` por atributo que MUDOU de verdade (já no
 * limite = nada) e um `attackResolved` com `status: true` e `damage: 0` por
 * alvo — conta como acerto pra reação (a selvagem se provoca, o time
 * defende), mas brilho, hit stop e número de dano o ignoram. Alvo de um tipo
 * em `attack.immuneTypes` (ex.: Leech Seed em Planta) não recebe nada: só o
 * `attackResolved` com `effectiveness: 'immune'` ("Não afeta…").
 *
 * Devolve os alvos que o golpe ACERTOU (passaram na precisão, imunes
 * inclusive) — o VFX do golpe de alvo único nasce no contato com eles.
 */
export function applyAttackEffects(world, events, context) {
  const { entity, action, attack, targets, origin, impactPoint } = context
  const attackerStages = readStatStages(entity)
  const hits = []

  for (const target of targets) {
    // Precisão: cada alvo do cone tem o PRÓPRIO sorteio (como no Pokémon, um
    // golpe de status também pode errar) — errou, nenhum efeito nele.
    const accuracyStage = resolveAccuracyStage(
      attackerStages,
      readStatStages(target.entity),
    )
    if (!rollHit(attack, accuracyStage, gameplayRng)) {
      events.emit(
        attackResolved({
          attacker: entity,
          target: target.entity,
          attackId: attack.id,
          slot: action.pendingSlot,
          origin,
          impactPoint,
          contactPoint: target.contactPoint,
          damage: 0,
          critical: false,
          status: true,
          missed: true,
        }),
      )
      continue
    }
    hits.push(target)
    if (isImmuneToStatusSkill(attack, resolveSpeciesTypes(target.species))) {
      events.emit(
        attackResolved({
          attacker: entity,
          target: target.entity,
          attackId: attack.id,
          slot: action.pendingSlot,
          origin,
          impactPoint,
          contactPoint: target.contactPoint,
          damage: 0,
          critical: false,
          status: true,
          effectiveness: 'immune',
        }),
      )
      continue
    }
    spawnTargetEffect(world, attack, target.entity)
    applyEffectsToTarget(events, {
      entity,
      attack,
      target,
      slot: action.pendingSlot,
    })
    events.emit(
      attackResolved({
        attacker: entity,
        target: target.entity,
        attackId: attack.id,
        slot: action.pendingSlot,
        origin,
        impactPoint,
        contactPoint: target.contactPoint,
        damage: 0,
        critical: false,
        status: true,
      }),
    )
  }
  return hits
}

/**
 * Os `effects` de um golpe num alvo (ou `effects`, se vier), um por tipo:
 * `condition` (sorteia a chance e aplica — quem conta o tempo é o
 * `conditionSystem`; emite `conditionApplied`), `removeConditions` (tira as
 * condições `conditions` que ele tiver — ex.: o Rapid Spin se soltando do
 * Wrap) e `statStage` (um `statStageChanged` por atributo que MUDOU de
 * verdade).
 */
function applyEffectsToTarget(
  events,
  { entity, attack, target, slot, effects = attack.effects },
) {
  for (const effect of effects ?? []) {
    if (effect?.type === 'removeConditions') {
      removerCondicoesPorId(target.entity, effect.conditions ?? [])
      continue
    }
    const applied = aplicarCondicao(target.entity, entity, effect, gameplayRng)
    if (applied !== null) {
      if (applied) {
        events.emit(
          conditionApplied({
            target: target.entity,
            source: entity,
            attackId: attack.id,
            slot,
            condition: effect.condition,
          }),
        )
      }
      continue
    }
    const change = applyStatStageEffect(target.entity, effect)
    if (!change || change.delta === 0) continue
    events.emit(
      statStageChanged({
        attacker: entity,
        target: target.entity,
        attackId: attack.id,
        ...change,
      }),
    )
  }
}

/**
 * Efeitos SECUNDÁRIOS de um golpe de DANO no alvo que acabou de levar o dano
 * (ex.: a chance de queimar do Ember): o acerto já foi sorteado e já saiu o
 * `attackResolved` do dano, então aqui não tem sorteio de precisão nem evento
 * de acerto a mais — só os efeitos (cada um com a própria chance, se tiver).
 */
export function applySecondaryEffects(
  events,
  { entity, attack, target, slot },
) {
  if (!attack.effects?.length) return
  applyEffectsToTarget(events, { entity, attack, target, slot })
}

/**
 * Aplica os `effects` de um golpe em SI MESMO (`area: 'self'` — ex.: Growth,
 * Focus Energy) no próprio atacante — ou, com `effects`, os efeitos que um
 * golpe de DANO dá em quem usou (`selfEffects`, ex.: o Rapid Spin) —, como
 * num alvo: um `statStageChanged` por
 * atributo que MUDOU (já no limite = nada), com `attacker` e `target` iguais
 * — é o que acende o brilho e o texto "Ataque ↑" nele —, e a condição (ex.:
 * Focado) com o `conditionApplied`. Sem sorteio de precisão (no Pokémon,
 * golpe em si mesmo não erra) e sem `attackResolved`: não houve alvo, então
 * ninguém se provoca nem defende.
 */
export function applySelfEffects(events, { entity, attack, slot, effects }) {
  applyEffectsToTarget(events, {
    entity,
    attack,
    target: { entity },
    slot,
    effects: effects ?? attack.effects,
  })
}

/**
 * Interrompe o golpe de STATUS em carga de cada entidade que levou dano no
 * tick (`isInterruptible`, `core/battle/attackInterrupt.js`): a ação acaba
 * (`finishAttack` — o cooldown do slot começa), a stamina gasta no disparo
 * não volta (decisão do usuário: interromper é punição), a criatura fica
 * ATORDOADA (`iniciarAtordoamento` — a ação `'hit'`, com a animação de hit,
 * sem poder fazer nada pela duração) e sai um `attackInterrupted` pro texto
 * "Interrompido!". Golpe de dano, ou status
 * que já passou do `effectAt`, segue normal.
 */
export function interruptStatusAttacks(events, damaged) {
  for (const entity of damaged) {
    if (!entity.isAlive() || !entity.has(ActionState)) continue
    const action = entity.get(ActionState)
    if (action.current !== 'attack') continue

    const species = getSpecies(resolveCreatureSpeciesId(entity))
    const slot = action.pendingSlot
    const attack = resolveAttackForEntity(
      species,
      slot,
      entity.get(IndividualValues),
      resolveEntityLevel(entity, species),
      resolveEntityMoveSet(entity, species),
      readSpeedStage(entity),
    )
    if (!isInterruptible(action, attack)) continue

    finishAttack(entity, action, attack)
    // e fica atordoada: animação de hit, sem poder fazer nada pela duração
    iniciarAtordoamento(action, species)
    entity.set(ActionState, action)
    events.emit(attackInterrupted({ entity, attackId: attack.id, slot }))
  }
}

/**
 * VFX no corpo de um alvo atingido (`visual.targetEffectGroup` — ex.: a
 * fumaça do Smokescreen, os anéis do Wrap), virado como ele e com o tamanho
 * do corpo dele. Vale no golpe só de efeito e no de dano (`attackImpact.js`).
 */
export function spawnTargetEffect(world, attack, target) {
  if (!attack.visual?.targetEffectGroup || !target.has(Position)) return
  const { x, y, z } = target.get(Position)
  const controller = target.get(CharacterController)
  const extent = controller ? resolveBodyExtent(controller) : null
  world.spawn(
    Position({ x, y, z }),
    Rotation({ y: target.get(Rotation)?.y ?? 0 }),
    AttackEffect({
      lifetime: attack.visual.targetEffectVisualDuration ?? 1,
      radius: attack.radius,
      effectGroup: attack.visual.targetEffectGroup,
      impactType: '',
      visualScale: attack.visual.scale ?? 1,
      length: 0,
      bodyWidth: extent?.width ?? 0,
      bodyLength: extent?.length ?? 0,
      bodyHeight: extent?.height ?? 0,
    }),
  )
}
