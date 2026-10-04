import { verticalClearance } from '../physics/colliders'
import { registrarParticipante } from '../actions/experience'
import { resolveDamageAmount } from './calculateDamage'
import { isChannelAttack, isSelfAttack } from './channelAttack'
import { resolveAttackOrigin, resolveFootElevation } from './attackGeometry'
import { readStatStages } from './statStages'
import { rollHit } from './accuracy'
import { gameplayRng } from '../rng'
import { attackResolved } from '../events'
import { resolveAttackImpactPoint } from './attackTrajectory'
import { resolveAttackTarget, resolveEffectTargets } from './attackTargets'
import { resolveEffectPlacement } from './attackEffectPlacement'
import { applyAttackEffects, applySelfEffects } from './attackStatusEffects'
import {
  AttackEffect,
  AttackPulse,
  CryPulse,
  DEFAULT_ATTACK_EFFECT_GROUP,
  Position,
  Rotation,
  Vitals,
  applyDamage,
} from '../traits'

/** Fórmula de dano + `applyDamage` num alvo resolvido. */
function damageTarget(attack, attacker, target, attackerStages) {
  const { amount, critical } = resolveDamageAmount({
    attackerSpecies: attacker.species,
    attackerIndividualValues: attacker.individualValues,
    attackerLevel: attacker.level,
    defenderSpecies: target.species,
    defenderIndividualValues: target.individualValues,
    defenderLevel: target.level,
    damage: attack.damage,
    // estágios de atributo (golpes de status): o do atacante e o do alvo
    attackerStages,
    defenderStages: readStatStages(target.entity),
    rng: gameplayRng,
  })
  target.entity.set(
    Vitals,
    applyDamage(target.vitals, amount, target.vitals.hpRegenDelayAfterDamage),
  )
  return { amount, critical }
}

/**
 * O instante do golpe (`effectAt`) de um ataque em andamento: resolve a
 * trajetória, aplica dano/efeitos (golpe normal, só de efeito ou em si mesmo),
 * nasce o VFX e marca os pulsos de som/grito. O canalizado não passa por aqui
 * pro dano (os ticks são do `applyChannelTick`), só pelo visual e pelo som.
 * Ver a docstring de `creatureAttackSystem` ("Dano", "Som do impacto").
 */
export function resolveAttackImpact(world, events, context) {
  const {
    entity,
    action,
    species,
    attack,
    pos,
    controller,
    physicsBody,
    targetSide,
    damaged,
  } = context
  const channel = isChannelAttack(attack)

  // Trajetória do golpe: da origem (centro do corpo + altura
  // opcional da espécie, `resolveAttackOrigin`) por `range` metros
  // na horizontal travada no disparo (`action.dirX/dirZ`),
  // acompanhando o terreno e parando em parede/desnível
  // (`resolveAttackImpactPoint`, `attackTrajectory.js`).
  const origin = resolveAttackOrigin(pos, species?.body?.attackOriginHeight)
  const direction = { x: action.dirX, y: action.dirY, z: action.dirZ }
  const impactPoint = resolveAttackImpactPoint(
    origin,
    direction,
    attack.range,
    physicsBody.colliderHandle,
  )
  const { effectStart, effectRotation } = resolveEffectPlacement(
    origin,
    direction,
    impactPoint,
    attack.visual,
  )

  // Onde o VFX nasce: no ponto de CONTATO quando o golpe acerta
  // alguém no meio do caminho, no fim da trajetória quando erra —
  // antes nascia sempre no fim, "atrás" do alvo, e o acerto
  // parecia acidental.
  let effectPoint = impactPoint

  // Golpe em SI MESMO (`area: 'self'` — ex.: Growth): os efeitos vão
  // no atacante e o VFX nasce nos pés dele, não na trajetória.
  if (isSelfAttack(attack)) {
    applySelfEffects(events, { entity, attack })
    effectPoint = {
      x: pos.x,
      y: pos.y - verticalClearance(controller),
      z: pos.z,
    }
  } else if (attack.damage && !channel) {
    // Dano — ver a docstring de `creatureAttackSystem` ("Dano"). `attack.damage: null`
    // (ataque ainda sem poder/categoria configurado) é um no-op
    // gracioso, sem procurar alvo nenhum.
    const target = resolveAttackTarget(
      world,
      origin,
      impactPoint,
      attack.radius,
      resolveFootElevation(pos, controller),
      targetSide,
    )
    // Sorteio de PRECISÃO (regra do Pokémon, `core/battle/accuracy.js`):
    // o alvo estava na forma, mas o golpe pode errar — mais provável
    // com a precisão do atacante baixa (Smokescreen). Errou: sem dano,
    // e o efeito visual cai no fim da trajetória, não no corpo.
    const attackerStages = readStatStages(entity)
    const missed =
      !!target && !rollHit(attack, attackerStages.accuracy, gameplayRng)
    const { amount, critical } =
      target && !missed
        ? damageTarget(attack, context, target, attackerStages)
        : { amount: 0, critical: false }
    if (target && !missed) {
      damaged.add(target.entity)
      // quem acertou entra na divisão do XP se ela desmaiar
      registrarParticipante(world, entity, target.entity)
    }
    if (target?.contactPoint && !missed) {
      effectPoint = target.contactPoint
    }

    // Impacto resolvido (acertou ou não) — efeitos de acerto
    // (brilho no alvo, número de dano, e no futuro hit stop/
    // reação/SFX/câmera) consomem isto, nunca leem o `Vitals`.
    events.emit(
      attackResolved({
        attacker: entity,
        target: target?.entity,
        attackId: attack.id,
        slot: action.pendingSlot,
        origin,
        impactPoint,
        contactPoint: target?.contactPoint,
        damage: amount,
        critical,
        missed,
      }),
    )
    // golpe com dano E efeito (ex.: dano + baixar defesa): o efeito
    // vai no alvo que levou o dano
    if (target && !missed && attack.effects?.length) {
      applyAttackEffects(world, events, {
        entity,
        action,
        attack,
        targets: [target],
        origin,
        impactPoint,
      })
    }
  } else if (attack.effects?.length && !channel) {
    // Golpe SÓ de efeito (sem dano — ex.: Growl): acha os alvos (cone
    // ou primeiro corpo) e aplica os efeitos neles.
    applyAttackEffects(world, events, {
      entity,
      action,
      attack,
      targets: resolveEffectTargets(world, {
        attack,
        origin,
        direction,
        impactPoint,
        pos,
        controller,
        physicsBody,
        targetSide,
      }),
      origin,
      impactPoint,
    })
  }

  // `effectGroup: 'none'` = golpe sem efeito visual de impacto (ex.: Growl,
  // que só baixa atributo e é mostrado por texto + tremor no alvo).
  if (attack.visual.effectGroup !== 'none') {
    world.spawn(
      Position(effectPoint),
      Rotation(effectRotation),
      AttackEffect({
        lifetime: attack.visual.effectVisualDuration,
        radius: attack.radius,
        effectGroup: attack.visual.effectGroup ?? DEFAULT_ATTACK_EFFECT_GROUP,
        revealDuration: attack.visual.revealDuration ?? 0,
        impactType: attack.visual.impactType ?? attack.damage?.type ?? '',
        visualScale: attack.visual.scale ?? 1,
        // da PARTIDA do golpe (origem + `positionOffset`) até onde o VFX
        // nasce — um VFX que sai da criatura (Brasa) precisa saber o
        // quanto andar
        length: Math.hypot(
          effectPoint.x - effectStart.x,
          effectPoint.y - effectStart.y,
          effectPoint.z - effectStart.z,
        ),
      }),
    )
  }
  // Som do impacto (ver a docstring de `creatureAttackSystem`, "Som do impacto") —
  // pulso de um tick na CRIATURA (não no `AttackEffect`),
  // consumido por `attackAudioSystem.js`. Sem `attack.audio`
  // resolvendo nada, o pulso simplesmente não tem ouvinte nenhum
  // (`useAnimatedModel.js` só registra o nó de áudio se
  // `resolveAttackSound` resolver algo) — no-op gracioso, mesmo
  // espírito de sempre.
  // `slot`: qual ataque disparou (cada um tem o seu som). Se o pulso
  // anterior ainda não foi consumido, só troca o slot.
  if (entity.has(AttackPulse)) {
    entity.set(AttackPulse, { slot: action.pendingSlot })
  } else {
    entity.add(AttackPulse({ slot: action.pendingSlot }))
  }
  // `audio.cry`: a criatura VOCALIZA agora (o grito dela, com a boca
  // sincronizada) — pulso consumido por `voiceAudioSystem.js`.
  if (attack.audio?.cry && !entity.has(CryPulse)) {
    entity.add(CryPulse)
  }
}
