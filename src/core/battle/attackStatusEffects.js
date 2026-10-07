import { getSpecies } from '../data/species'
import { isImmuneToStatusSkill, resolveSpeciesTypes } from '../data/types'
import {
  attackInterrupted,
  attackResolved,
  burnApplied,
  statStageChanged,
} from '../events'
import { isInterruptible } from './attackInterrupt'
import { applyStatStageEffect, readStatStages } from './statStages'
import { iniciarAtordoamento } from '../actions/hitStun'
import { plantarSemente } from '../actions/leechSeed'
import { queimar } from '../actions/burn'
import { gameplayRng } from '../rng'
import { rollHit } from './accuracy'
import { finishAttack, resolveAttackForEntity } from './attackCasting'
import { resolveEntityMoveSet } from './creatureAttack'
import {
  ActionState,
  AttackEffect,
  IndividualValues,
  Position,
  Rotation,
  resolveCreatureSpeciesId,
  resolveEntityLevel,
} from '../traits'

/**
 * Aplica os `effects` da skill em cada alvo — `statStage` (estágio de
 * atributo) e `leechSeed` (planta a semente, `plantarSemente`; quem drena é o
 * `leechSeedSystem`) — e emite os eventos: um `statStageChanged` por atributo que MUDOU de verdade (já no
 * limite = nada) e um `attackResolved` com `status: true` e `damage: 0` por
 * alvo — conta como acerto pra reação (a selvagem se provoca, o time
 * defende), mas brilho, hit stop e número de dano o ignoram. Alvo de um tipo
 * em `attack.immuneTypes` (ex.: Leech Seed em Planta) não recebe nada: só o
 * `attackResolved` com `effectiveness: 'immune'` ("Não afeta…").
 */
export function applyAttackEffects(world, events, context) {
  const { entity, action, attack, targets, origin, impactPoint } = context
  const accuracyStage = readStatStages(entity).accuracy

  for (const target of targets) {
    // Precisão: cada alvo do cone tem o PRÓPRIO sorteio (como no Pokémon, um
    // golpe de status também pode errar) — errou, nenhum efeito nele.
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
    // VFX no corpo de CADA alvo atingido (ex.: a fumaça do Smokescreen)
    if (attack.visual?.targetEffectGroup && target.entity.has(Position)) {
      const { x, y, z } = target.entity.get(Position)
      world.spawn(
        Position({ x, y, z }),
        Rotation,
        AttackEffect({
          lifetime: attack.visual.targetEffectVisualDuration ?? 1,
          radius: attack.radius,
          effectGroup: attack.visual.targetEffectGroup,
          impactType: '',
          visualScale: attack.visual.scale ?? 1,
          length: 0,
        }),
      )
    }
    applyEffectsToTarget(events, { entity, attack, target })
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
}

/**
 * Os `effects` de um golpe num alvo, um por tipo: `leechSeed` (planta a
 * semente — quem drena é o `leechSeedSystem`), `burn` (sorteia a chance e
 * queima — quem tira HP é o `burnSystem`; emite `burnApplied`) e `statStage`
 * (um `statStageChanged` por atributo que MUDOU de verdade).
 */
function applyEffectsToTarget(events, { entity, attack, target }) {
  for (const effect of attack.effects ?? []) {
    if (plantarSemente(target.entity, entity, effect)) continue
    const burned = queimar(target.entity, entity, effect, gameplayRng)
    if (burned !== null) {
      if (burned) {
        events.emit(
          burnApplied({
            target: target.entity,
            source: entity,
            attackId: attack.id,
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
export function applySecondaryEffects(events, { entity, attack, target }) {
  if (!attack.effects?.length) return
  applyEffectsToTarget(events, { entity, attack, target })
}

/**
 * Aplica os `effects` de um golpe em SI MESMO (`area: 'self'` — ex.: Growth)
 * no próprio atacante: um `statStageChanged` por atributo que MUDOU (já no
 * limite = nada), com `attacker` e `target` iguais — é o que acende o brilho
 * e o texto "Ataque ↑" nele. Sem sorteio de precisão (no Pokémon, golpe em si
 * mesmo não erra) e sem `attackResolved`: não houve alvo, então ninguém se
 * provoca nem defende.
 */
export function applySelfEffects(events, { entity, attack }) {
  for (const effect of attack.effects ?? []) {
    const change = applyStatStageEffect(entity, effect)
    if (!change || change.delta === 0) continue
    events.emit(
      statStageChanged({
        attacker: entity,
        target: entity,
        attackId: attack.id,
        ...change,
      }),
    )
  }
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
    )
    if (!isInterruptible(action, attack)) continue

    finishAttack(entity, action, attack)
    // e fica atordoada: animação de hit, sem poder fazer nada pela duração
    iniciarAtordoamento(action, species)
    entity.set(ActionState, action)
    events.emit(attackInterrupted({ entity, attackId: attack.id, slot }))
  }
}
