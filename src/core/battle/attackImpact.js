import { verticalClearance } from '../physics/colliders'
import { registrarParticipante } from '../actions/experience'
import { readConditionModifiers } from '../actions/conditions'
import { resolveDamageAmount } from './calculateDamage'
import { startMultiHit } from './multiHit'
import { applySpeedPower } from './speedPower'
import {
  applyPowerMultiplier,
  resolveRecentDamageMultiplier,
} from './recentDamageBoost'
import { combatWeatherAt } from '../weather/combatWeather'
import { resolveSkillType } from '../data/types'
import {
  isAreaAttack,
  isChannelAttack,
  isCircleAttack,
  isConeAttack,
  isSelfAttack,
} from './channelAttack'
import {
  resolveAttackAreaStart,
  resolveAttackOrigin,
  resolveAttackReach,
  resolveFootElevation,
} from './attackGeometry'
import { readStatStages } from './statStages'
import { resolveAccuracyStage, rollAttackFails, rollHit } from './accuracy'
import { gameplayRng } from '../rng'
import { attackFailed, attackResolved, attackUsed } from '../events'
import { resolveAttackSoundKey } from '../data/audio/attackSound'
import { resolveAttackPath } from './attackTrajectory'
import {
  resolveAreaTargets,
  resolveAttackTarget,
  resolveEffectTargets,
  resolveEntityTriggerEdge,
} from './attackTargets'
import { resolveEffectRotation } from './attackEffectPlacement'
import {
  applyAttackEffects,
  applySecondaryEffects,
  applySelfEffects,
  spawnTargetEffect,
} from './attackStatusEffects'
import {
  AttackEffect,
  AttackPath,
  AttackPulse,
  CryPulse,
  DEFAULT_ATTACK_EFFECT_GROUP,
  Position,
  Rotation,
  Vitals,
  applyDamage,
} from '../traits'

// Os pés de quem usa (onde nasce o VFX do golpe em si mesmo e do círculo).
function resolveFeetPoint(pos, controller) {
  return { x: pos.x, y: pos.y - verticalClearance(controller), z: pos.z }
}

/**
 * O dano do golpe único em cada alvo de `targets` (a cápsula: um; a área:
 * todos dentro): cada um tem o PRÓPRIO sorteio de precisão (regra do Pokémon,
 * `core/battle/accuracy.js` — mais provável errar com a precisão do atacante
 * baixa, Smokescreen), leva a fórmula de dano e emite o `attackResolved`
 * dele; o efeito secundário (ex.: a chance de queimar do Ember) vai em quem
 * levou o dano, sem sortear precisão de novo. Sem alvo nenhum, um
 * `attackResolved` sem alvo ("Mas não acertou ninguém!"). Devolve os pontos
 * de contato de quem foi acertado (onde o VFX nasce); os de quem levou o
 * poder maior (`recentDamageBoost.js`, o Assurance) entram também em
 * `boostedPoints`, e quem foi acertado de verdade (sem errar nem ser imune),
 * em `landedTargets`.
 */
function damageTargets(world, events, context) {
  const {
    entity,
    action,
    attack,
    pos,
    damaged,
    origin,
    impactPoint,
    targets,
    boostedPoints,
    landedTargets,
  } = context
  const attackerStages = readStatStages(entity)
  // Clima onde está quem ataca (docs/features/048-*.md).
  const weather = combatWeatherAt(world, pos)
  const hitPoints = []
  const resolved = (target, fields) =>
    events.emit(
      attackResolved({
        attacker: entity,
        target: target?.entity,
        attackId: attack.id,
        slot: action.pendingSlot,
        origin,
        impactPoint,
        contactPoint: target?.contactPoint,
        ...fields,
      }),
    )

  if (!targets.length) {
    resolved(null, {
      damage: 0,
      critical: false,
      missed: false,
      effectiveness: 'neutral',
    })
    return hitPoints
  }

  for (const target of targets) {
    const missed = !rollHit(
      attack,
      resolveAccuracyStage(attackerStages, readStatStages(target.entity)),
      gameplayRng,
    )
    // lido ANTES do dano deste golpe, que reinicia o tempo desde o último
    const multiplier = missed
      ? 1
      : resolveRecentDamageMultiplier(attack.damage, target.vitals)
    const { amount, critical, effectiveness, power } = missed
      ? { amount: 0, critical: false, effectiveness: 'neutral', power: 0 }
      : damageTarget(
          attack,
          context,
          target,
          attackerStages,
          weather,
          multiplier,
        )
    // imune: acertou, mas não pegou — sem dano, efeito nem participação
    const landed = !missed && effectiveness !== 'immune'
    // Golpe de vários acertos (Fury Attack): o primeiro acerto num alvo único
    // sorteia quantos vêm e agenda os seguintes nele (`multiHit.js`).
    const hitCount =
      landed && attack.multiHit && !isAreaAttack(attack)
        ? startMultiHit(action, attack, target, gameplayRng)
        : 1
    if (landed) {
      landedTargets?.add(target.entity)
      damaged.add(target.entity)
      // quem acertou entra na divisão do XP se ela desmaiar
      registrarParticipante(world, entity, target.entity)
    }
    const boosted = landed && multiplier > 1
    if (!missed && target.contactPoint) {
      hitPoints.push(target.contactPoint)
      if (boosted) boostedPoints?.add(target.contactPoint)
    }
    // Impacto resolvido (acertou ou não) — efeitos de acerto (brilho no
    // alvo, número de dano, hit stop, reação, SFX) consomem isto, nunca
    // leem o `Vitals`.
    resolved(target, {
      damage: amount,
      critical,
      missed,
      effectiveness,
      boosted,
      hitCount,
      power,
    })
    if (landed) {
      // o efeito no corpo do alvo (ex.: os anéis do Wrap)
      spawnTargetEffect(world, attack, target.entity)
      applySecondaryEffects(events, {
        entity,
        attack,
        target,
        slot: action.pendingSlot,
      })
    }
  }
  return hitPoints
}

/**
 * Fórmula de dano + `applyDamage` num alvo resolvido. Alvo imune ao tipo do
 * golpe (docs/features/039-tipos-e-combate-classico.md): nada é aplicado.
 * Exportada pros acertos seguintes do golpe de vários acertos (`multiHit.js`).
 */
export function damageTarget(
  attack,
  attacker,
  target,
  attackerStages,
  weather,
  multiplier,
) {
  // o poder deste alvo: × o bônus de quem apanhou há pouco (Assurance) e pela
  // Velocidade de cada um (Electro Ball)
  const damage = applySpeedPower(
    applyPowerMultiplier(attack.damage, multiplier),
    attacker,
    target,
  )
  const { amount, critical, effectiveness } = resolveDamageAmount({
    attackerSpecies: attacker.species,
    attackerIndividualValues: attacker.individualValues,
    attackerLevel: attacker.level,
    defenderSpecies: target.species,
    defenderIndividualValues: target.individualValues,
    defenderLevel: target.level,
    damage,
    attackType: resolveSkillType(attack),
    // estágios de atributo (golpes de status): o do atacante e o do alvo
    attackerStages,
    defenderStages: readStatStages(target.entity),
    attackerModifiers: readConditionModifiers(attacker.entity),
    weather,
    rng: gameplayRng,
  })
  const power = damage.power
  if (effectiveness === 'immune') {
    return { amount: 0, critical, effectiveness, power }
  }
  target.entity.set(
    Vitals,
    applyDamage(target.vitals, amount, target.vitals.hpRegenDelayAfterDamage),
  )
  return { amount, critical, effectiveness, power }
}

/**
 * O instante do golpe (`effectAt`) de um ataque em andamento: resolve a
 * trajetória, aplica dano/efeitos (golpe normal, só de efeito ou em si mesmo),
 * nasce o VFX e marca os pulsos de som/grito. O canalizado não passa por aqui
 * pro dano (os ticks são do `applyChannelTick`), só pelo visual e pelo som.
 * Ver a docstring de `creatureAttackSystem` ("Dano", "Som do impacto").
 *
 * Golpe que não erra (`isNeverMissAttack`) com domínio baixo pode FALHAR
 * (docs/features/038-aprendizado-treino-e-dominio-de-golpes.md): nada é
 * aplicado nem nasce, só o evento `attackFailed`. Devolve `{ failed }` — o
 * canalizado que falhou acaba ali (`creatureAttackSystem`).
 */
export function resolveAttackImpact(world, events, context) {
  const { entity, action, attack, pos, controller, physicsBody, targetSide } =
    context
  const channel = isChannelAttack(attack)

  events.emit(
    attackUsed({ entity, attackId: attack.id, slot: action.pendingSlot }),
  )
  if (rollAttackFails(attack, gameplayRng)) {
    events.emit(
      attackFailed({ entity, attackId: attack.id, slot: action.pendingSlot }),
    )
    return { failed: true }
  }

  // Trajetória do golpe: da origem (centro do corpo + `positionOffset` do
  // golpe, `resolveAttackOrigin`) até o `range` contado da borda do trigger
  // de quem ataca (`resolveAttackReach`), na direção travada no disparo
  // (`action.dirX/dirZ`), acompanhando o terreno e parando em parede/
  // desnível (`resolveAttackImpactPoint`, `attackTrajectory.js`).
  const direction = { x: action.dirX, y: action.dirY, z: action.dirZ }
  const origin = resolveAttackOrigin(pos, direction, attack)
  const edge = resolveEntityTriggerEdge(entity, direction)
  const reach = resolveAttackReach(attack, edge)
  // Só terreno/estrutura param a trajetória: criatura no caminho não — quem
  // decide o acerto é o trigger dela (`hitTrigger.js`, docs/features/061-*).
  const path = resolveAttackPath(
    origin,
    direction,
    reach,
    physicsBody.colliderHandle,
    { terrainOnly: true },
  )
  const impactPoint = path[path.length - 1]
  // A ÁREA do golpe (o acerto e o aviso no chão) começa na borda do trigger
  // de quem ataca — igual pra todo golpe; o VFX continua saindo da origem.
  const areaStart = resolveAttackAreaStart(
    pos,
    direction,
    edge,
    origin,
    impactPoint,
    attack,
  )
  // Onde o VFX nasce: no ponto de CONTATO quando o golpe acerta
  // alguém no meio do caminho, no fim da trajetória quando erra —
  // antes nascia sempre no fim, "atrás" do alvo, e o acerto
  // parecia acidental. Golpe de área com dano: um por alvo atingido.
  let effectPoints = [impactPoint]
  // os pontos de quem levou o poder maior e quem foi acertado de verdade
  // (`damageTargets`, `applyAttackEffects`)
  const boostedPoints = new Set()
  const landedTargets = new Set()

  // Golpe em SI MESMO (`area: 'self'` — ex.: Growth): os efeitos vão
  // no atacante e o VFX nasce nos pés dele, não na trajetória.
  if (isSelfAttack(attack)) {
    applySelfEffects(events, { entity, attack, slot: action.pendingSlot })
    effectPoints = [resolveFeetPoint(pos, controller)]
  } else if (attack.damage && !channel) {
    // Dano — ver a docstring de `creatureAttackSystem` ("Dano"). `attack.damage: null`
    // (ataque ainda sem poder/categoria configurado) é um no-op
    // gracioso, sem procurar alvo nenhum. A cápsula pega o primeiro corpo
    // no caminho; a área (cone, círculo), todos dentro dela.
    const attackerElevation = resolveFootElevation(pos, controller)
    const area = isAreaAttack(attack)
    const targets = area
      ? resolveAreaTargets(world, attack, {
          areaStart,
          direction,
          impactPoint,
          edge,
          attackerElevation,
          targetSide,
        })
      : [
          resolveAttackTarget(
            world,
            areaStart,
            impactPoint,
            attack.radius,
            attackerElevation,
            targetSide,
          ),
        ].filter(Boolean)
    const hitPoints = damageTargets(world, events, {
      ...context,
      attack,
      origin,
      impactPoint,
      targets,
      boostedPoints,
      landedTargets,
    })
    if (area) {
      // ninguém dentro: o cone ainda mostra o golpe no fim; o círculo, nada
      effectPoints =
        hitPoints.length || isCircleAttack(attack) ? hitPoints : [impactPoint]
    } else if (hitPoints[0]) {
      effectPoints = [hitPoints[0]]
    }
  } else if (attack.effects?.length && !channel) {
    // Golpe SÓ de efeito (sem dano — ex.: Growl): acha os alvos (área
    // ou primeiro corpo) e aplica os efeitos neles.
    const hits = applyAttackEffects(world, events, {
      entity,
      action,
      attack,
      targets: resolveEffectTargets(world, {
        attack,
        areaStart,
        direction,
        impactPoint,
        edge,
        pos,
        controller,
        physicsBody,
        targetSide,
      }),
      origin,
      impactPoint,
    })
    // quem passou na precisão (os imunes também contam aqui)
    for (const hit of hits) landedTargets.add(hit.entity)
    // Alvo único (ex.: Leech Seed): como no golpe de dano, o VFX nasce no
    // contato com quem acertou; errou, no fim da trajetória. O cone (Growl)
    // continua desenhado até o fim; o círculo, nos pés de quem usa.
    if (isCircleAttack(attack)) {
      effectPoints = [resolveFeetPoint(pos, controller)]
    } else if (!isConeAttack(attack) && hits[0]?.contactPoint) {
      effectPoints = [hits[0].contactPoint]
    }
  }
  // O que um golpe que não é em si mesmo dá a quem usou (`selfEffects` — ex.:
  // o Rapid Spin sobe a Velocidade e solta do Wrap): só quando ACERTA alguém
  // (errou ou o alvo é imune: nada), como na série.
  if (
    attack.selfEffects?.length &&
    !isSelfAttack(attack) &&
    landedTargets.size > 0
  ) {
    applySelfEffects(events, {
      entity,
      attack,
      slot: action.pendingSlot,
      effects: attack.selfEffects,
    })
  }

  // `effectGroup: 'none'` = golpe sem efeito visual de impacto (ex.: Growl,
  // que só baixa atributo e é mostrado por texto + tremor no alvo).
  if (attack.visual.effectGroup !== 'none') {
    // Virado na direção do golpe, na horizontal: a altura do caminho (numa
    // rampa, subindo até o alvo) vem do perfil do terreno (`AttackPath`), que
    // as partículas seguem.
    const effectRotation = resolveEffectRotation(
      { x: direction.x, y: 0, z: direction.z },
      attack.visual.rotationOffset,
    )
    for (const effectPoint of effectPoints) {
      const effect = spawnImpactEffect(world, attack, {
        point: effectPoint,
        rotation: effectRotation,
        origin,
        // o acerto com o poder maior (Assurance) sai maior
        scale: boostedPoints.has(effectPoint)
          ? (attack.visual.boostedScale ?? 1)
          : 1,
      })
      if (!isSelfAttack(attack)) effect.add(AttackPath({ points: path }))
    }
  }
  // Som do impacto (ver a docstring de `creatureAttackSystem`, "Som do impacto") —
  // pulso de um tick na CRIATURA (não no `AttackEffect`),
  // consumido por `attackAudioSystem.js`. Sem `attack.audio`
  // resolvendo nada, o pulso simplesmente não tem ouvinte nenhum
  // (`useAnimatedModel.js` só registra o nó de áudio se
  // `resolveAttackSound` resolver algo) — no-op gracioso, mesmo
  // espírito de sempre.
  markAttackPulse(entity, action, attack)
  // `audio.cry`: a criatura VOCALIZA agora (o grito dela, com a boca
  // sincronizada) — pulso consumido por `voiceAudioSystem.js`.
  if (attack.audio?.cry && !entity.has(CryPulse)) {
    entity.add(CryPulse)
  }
  return { failed: false }
}

/**
 * O VFX de impacto do golpe num ponto (`AttackEffect`), virado em
 * `rotation`; `scale` multiplica o `visual.scale` do golpe. Devolve a
 * entidade do efeito (quem chama pode somar o `AttackPath`).
 */
export function spawnImpactEffect(
  world,
  attack,
  { point, rotation, origin, scale = 1 },
) {
  return world.spawn(
    Position(point),
    Rotation(rotation),
    AttackEffect({
      lifetime: attack.visual.effectVisualDuration,
      radius: attack.radius,
      effectGroup: attack.visual.effectGroup ?? DEFAULT_ATTACK_EFFECT_GROUP,
      revealDuration: attack.visual.revealDuration ?? 0,
      impactType: attack.visual.impactType ?? attack.type ?? '',
      visualScale: (attack.visual.scale ?? 1) * scale,
      // da origem do golpe (com o `positionOffset`) até onde o VFX nasce, no
      // chão — um VFX que sai da criatura (Brasa) precisa saber o quanto andar
      length: Math.hypot(point.x - origin.x, point.z - origin.z),
    }),
  )
}

/**
 * Pulso do som do impacto na criatura (`AttackPulse`). `slot`: qual ataque
 * disparou (cada um tem o seu som). Se o pulso anterior ainda não foi
 * consumido, só troca o slot.
 */
export function markAttackPulse(entity, action, attack) {
  const pulse = {
    slot: action.pendingSlot,
    key: resolveAttackSoundKey(attack) ?? '',
  }
  if (entity.has(AttackPulse)) {
    entity.set(AttackPulse, pulse)
  } else {
    entity.add(AttackPulse(pulse))
  }
}
