import {
  avancarDash,
  iniciarDash,
  isDashReady,
  travarRecargaDoDash,
} from '../actions/dash'
import { resolveMoveSpeed } from '../actions/movementSpeed'
import { resolveDashCost, tentarCorrer } from '../actions/stamina'
import { getSpecies } from '../data/species'
import { GAME_CONFIG } from '../gameConfig'
import { lerpAngle, wrapAngle } from '../math'
import { gameplayRng } from '../rng'
import { steerTowards } from '../steering'
import {
  ActionState,
  AiMovement,
  CharacterController,
  Grounded,
  IndividualValues,
  PartyBehavior,
  Position,
  WildBehavior,
  resolveCreatureSpeciesId,
  resolveEntityLevel,
} from '../traits'
import { resolveAttackForEntity } from './attackCasting'
import { isInsideAttackCone } from './attackGeometry'
import { resolveAttackHitTime } from './attackTelegraph'
import { isConeAttack, isSelfAttack } from './channelAttack'
import { isActiveCombatant } from './combatTargets'

/**
 * Se `pos` (corpo de raio `bodyRadius`) está dentro da área do golpe que
 * `attacker` está CARREGANDO agora — a mesma forma do aviso no chão (cone, ou
 * a cápsula do golpe normal/feixe), da posição do atacante na direção travada
 * (`ActionState.dir*`). Devolve `{ attacker, elapsed, timeLeft, exitDistance,
 * dodgeX, dodgeZ }` — quanto falta pro golpe acontecer, quanto ela precisa
 * andar de lado pra sair, e pra que lado (perpendicular à direção do golpe,
 * o lado em que ela já está) — ou `null`.
 */
export function resolveIncomingAttack(attacker, attackerPos, pos, bodyRadius) {
  const action = attacker.get(ActionState)
  if (!action || action.current !== 'attack') return null
  const speciesId = resolveCreatureSpeciesId(attacker)
  if (!speciesId) return null
  const species = getSpecies(speciesId)
  const attack = resolveAttackForEntity(
    species,
    action.pendingSlot,
    attacker.get(IndividualValues),
    resolveEntityLevel(attacker, species),
  )
  if (!attack || isSelfAttack(attack)) return null
  const hitAt = resolveAttackHitTime(action, attack)
  if (hitAt === null || action.elapsed >= hitAt) return null

  const dirLength = Math.hypot(action.dirX, action.dirZ)
  if (dirLength < 1e-6) return null
  const dx = action.dirX / dirLength
  const dz = action.dirZ / dirLength
  const px = pos.x - attackerPos.x
  const pz = pos.z - attackerPos.z
  const along = px * dx + pz * dz
  const across = px * dz - pz * dx

  let halfWidth
  if (isConeAttack(attack)) {
    const cone = {
      length: attack.range,
      range: attack.range,
      radius: attack.radius,
    }
    if (
      !isInsideAttackCone(attackerPos, { x: dx, z: dz }, cone, pos, bodyRadius)
    ) {
      return null
    }
    const slope = attack.range > 0 ? attack.radius / attack.range : 0
    halfWidth = slope * Math.min(Math.max(along, 0), attack.range)
  } else {
    // Cápsula: do atacante até o fim do `range`, grossura `radius`.
    const t = Math.min(Math.max(along, 0), attack.range)
    const gap = Math.hypot(px - dx * t, pz - dz * t)
    if (gap > attack.radius + bodyRadius) return null
    halfWidth = attack.radius
  }

  const side = across >= 0 ? 1 : -1
  return {
    attacker,
    elapsed: action.elapsed,
    timeLeft: hitAt - action.elapsed,
    exitDistance: Math.max(0, halfWidth + bodyRadius - Math.abs(across)),
    // Perpendicular à direção do golpe, pro lado em que ela já está:
    // (dz, -dx) tem `across` positivo.
    dodgeX: dz * side,
    dodgeZ: -dx * side,
  }
}

/** O golpe vindo nela que acontece primeiro, entre os `enemies`, ou `null`. */
function findIncomingAttack(pos, bodyRadius, enemies) {
  let soonest = null
  for (const enemy of enemies) {
    const incoming = resolveIncomingAttack(
      enemy.entity,
      enemy.pos,
      pos,
      bodyRadius,
    )
    if (incoming && (!soonest || incoming.timeLeft < soonest.timeLeft)) {
      soonest = incoming
    }
  }
  return soonest
}

/**
 * Pode dar dash agora: sem descansar, no chão, ação livre, fora da recarga do
 * dash (`isDashReady` — a mesma do jogador, 035) e, depois de pagar, sobrando
 * a reserva de energia da IA (`AI_ENERGY.SKILL_RESERVE_FRACTION` — dash gasta
 * energia como golpe).
 */
function canDash(entity, vitals, resting) {
  const { SKILL_RESERVE_FRACTION } = GAME_CONFIG.AI_ENERGY
  if (resting || !isDashReady(entity)) return false
  if (!entity.has(Grounded)) return false
  if (entity.get(ActionState).current !== null) return false
  return (
    vitals.stamina - resolveDashCost(vitals) >=
    SKILL_RESERVE_FRACTION * vitals.maxStamina
  )
}

/**
 * Gira o corpo (suave, `turnSpeed`) pra direção em que ele está se movendo.
 * Dash e desvio mexem só na velocidade; sem isto o corpo ficava virado pro
 * alvo (ou de costas) e o movimento parecia deslizar/teleportar.
 */
export function faceMovement(rot, stats, dirX, dirZ, delta) {
  if (Math.hypot(dirX, dirZ) < 1e-6) return
  rot.y = lerpAngle(rot.y, Math.atan2(dirX, dirZ), stats.turnSpeed * delta)
}

// `entity.get` de trait de valores devolve uma CÓPIA: o que muda aqui volta
// com `entity.set` (`ActionState` e `AiMovement` não estão na query de quem
// chama).
function startAiDash(entity, vitals, moving, dirX, dirZ, delta) {
  const action = entity.get(ActionState)
  iniciarDash(action, vitals, dirX, dirZ)
  avancarDash(action, moving.vel, 0, 0)
  entity.set(ActionState, action)
  travarRecargaDoDash(entity)
  faceMovement(moving.rot, moving.stats, dirX, dirZ, delta)
}

/**
 * Avança o dash da IA em andamento (sai parada — o movimento decide depois),
 * girando o corpo pra direção do dash. `moving`: `{ rot, vel, stats }`.
 */
export function advanceAiDash(entity, moving, delta) {
  const action = entity.get(ActionState)
  avancarDash(action, moving.vel, delta, 0)
  entity.set(ActionState, action)
  faceMovement(moving.rot, moving.stats, action.dirX, action.dirZ, delta)
}

/**
 * Movimento da IA na luta (selvagem perseguindo, criatura do time lutando),
 * por tick — a primeira regra que valer:
 *
 * 1. **Desvio** — um inimigo está carregando um golpe e ela está dentro da
 *    área (`resolveIncomingAttack`). Sorteia UMA vez por golpe se reage
 *    (`DODGE_CHANCE`) e só reage depois de `DODGE_REACTION_TIME` de carga.
 *    Sai pro lado correndo; se correndo não dá tempo, de dash (se puder).
 *    Desviando ou de dash, o corpo gira pra onde está indo (`faceMovement`).
 * 2. **Recuo** — golpe planejado à distância (`aim: 'ranged'`) e o alvo mais
 *    perto que `KEEP_DISTANCE_MIN` do alcance dele: anda pra longe.
 * 3. **Aproximação** — fora do `stopDistance`: corre até lá; ainda longe
 *    demais (`DASH_CLOSE_DISTANCE` além dele), de dash.
 * 4. **Rodear** — no alcance esperando (`waiting`: intervalo entre golpes ou
 *    nada pronto): anda em volta do alvo, virada pra onde anda, trocando de
 *    sentido de tempos em tempos. Sem esperar: para e encara — `'aim'`
 *    enquanto ainda está virando (mais que `AIM_TOLERANCE`), `null` virada;
 *    quem chama só pede o golpe fora do `'aim'`.
 *
 * Descansando (`resting`): não desvia, não corre nem dá dash — só anda.
 * Correr e dash gastam energia (`tentarCorrer`, `iniciarDash`).
 *
 * `fight`: `{ pos, rot, vel, stats, vitals, target, plan, stopDistance,
 * enemies, resting, waiting, delta }`. Devolve o `mode` (também gravado em
 * `AiMovement.mode`).
 */
export function moveInFight(entity, fight, rng = gameplayRng) {
  const movement = entity.get(AiMovement)
  const mode = decideFightMove(entity, movement, fight, rng)
  movement.mode = mode
  entity.set(AiMovement, movement)
  return mode
}

function decideFightMove(entity, movement, fight, rng) {
  const { pos, rot, vel, stats, vitals, target, plan, stopDistance } = fight
  const { enemies, resting, waiting, delta } = fight
  const config = GAME_CONFIG.AI_MOVEMENT

  const targetPos = target.get(Position)
  const toX = targetPos.x - pos.x
  const toZ = targetPos.z - pos.z
  const distance = Math.hypot(toX, toZ)
  const ux = distance > 1e-6 ? toX / distance : 0
  const uz = distance > 1e-6 ? toZ / distance : 1
  const moving = { pos, rot, vel, stats }
  const runOrWalk = () =>
    resolveMoveSpeed(stats, vitals, !resting && tentarCorrer(vitals, delta))
  const faceTarget = () => {
    rot.y = lerpAngle(rot.y, Math.atan2(ux, uz), stats.turnSpeed * delta)
  }

  // 1. Desvio.
  const bodyRadius = entity.get(CharacterController)?.capsuleRadius ?? 0
  const incoming = resting ? null : findIncomingAttack(pos, bodyRadius, enemies)
  if (!incoming) {
    movement.dodgeAttacker = null
    movement.dodgeReact = false
  } else {
    if (movement.dodgeAttacker !== incoming.attacker) {
      movement.dodgeAttacker = incoming.attacker
      movement.dodgeReact = rng() < config.DODGE_CHANCE
    }
    if (movement.dodgeReact && incoming.elapsed >= config.DODGE_REACTION_TIME) {
      const runTime =
        incoming.exitDistance / resolveMoveSpeed(stats, vitals, true)
      if (runTime > incoming.timeLeft && canDash(entity, vitals, resting)) {
        startAiDash(
          entity,
          vitals,
          moving,
          incoming.dodgeX,
          incoming.dodgeZ,
          delta,
        )
        return 'dash'
      }
      const speed = runOrWalk()
      vel.x = incoming.dodgeX * speed
      vel.z = incoming.dodgeZ * speed
      faceMovement(rot, stats, incoming.dodgeX, incoming.dodgeZ, delta)
      return 'dodge'
    }
  }

  // 2. Recuo.
  const ranged = plan?.attack.aim === 'ranged' && Number.isFinite(plan.reach)
  if (ranged && distance < config.KEEP_DISTANCE_MIN * plan.reach) {
    const away = {
      x: pos.x - ux * config.RETREAT_STEP,
      z: pos.z - uz * config.RETREAT_STEP,
    }
    steerTowards(entity, moving, away, runOrWalk(), delta)
    return 'retreat'
  }

  // 3. Aproximação.
  if (distance > stopDistance) {
    if (
      distance - stopDistance > config.DASH_CLOSE_DISTANCE &&
      canDash(entity, vitals, resting)
    ) {
      startAiDash(entity, vitals, moving, ux, uz, delta)
      return 'dash'
    }
    steerTowards(entity, moving, targetPos, runOrWalk(), delta)
    return 'approach'
  }

  // 4. Rodear (esperando) ou parar e encarar (o golpe sai agora). Ainda
  // virando pro alvo: `'aim'` — quem chama só pede o golpe depois, senão o
  // disparo travaria o corpo de uma vez (`attackCasting`) vindo de lado.
  if (!waiting) {
    vel.x = 0
    vel.z = 0
    faceTarget()
    const facingError = Math.abs(wrapAngle(Math.atan2(ux, uz) - rot.y))
    return facingError > config.AIM_TOLERANCE ? 'aim' : null
  }
  movement.strafeTimer -= delta
  if (movement.strafeTimer <= 0) {
    movement.strafeSign = -movement.strafeSign
    movement.strafeTimer =
      config.STRAFE_SWITCH_MIN +
      rng() * (config.STRAFE_SWITCH_MAX - config.STRAFE_SWITCH_MIN)
  }
  const speed =
    resolveMoveSpeed(stats, vitals, false) * config.STRAFE_SPEED_FACTOR
  // De lado (perpendicular ao alvo) + uma correção radial pra não ir se
  // afastando (andar na tangente abre o círculo) nem sair do alcance.
  const desired = Number.isFinite(stopDistance)
    ? stopDistance * config.STRAFE_DISTANCE_FRACTION
    : distance
  const radial = Math.max(-speed, Math.min(speed, (distance - desired) * 2))
  vel.x = -uz * movement.strafeSign * speed + ux * radial
  vel.z = ux * movement.strafeSign * speed + uz * radial
  faceMovement(rot, stats, vel.x, vel.z, delta)
  return 'strafe'
}

/**
 * Alvo da IA desta criatura agora (selvagem perseguindo / criatura do time
 * lutando), ou `null` — o feixe da IA segue ele durante o canal.
 */
export function resolveAiTarget(entity) {
  const target =
    entity.get(WildBehavior)?.target ?? entity.get(PartyBehavior)?.target
  return isActiveCombatant(target) ? target : null
}

/**
 * Reaponta o feixe da IA (`ActionState.dir*`) pro alvo, girando no máximo
 * `BEAM_TURN_SPEED` rad/s — acompanha, mas dá pra escapar correndo de lado.
 * Devolve o novo ângulo (yaw) da direção.
 */
export function steerAiBeam(action, pos, targetPos, delta) {
  const current = Math.atan2(action.dirX, action.dirZ)
  const wanted = Math.atan2(targetPos.x - pos.x, targetPos.z - pos.z)
  let diff = wanted - current
  diff = Math.atan2(Math.sin(diff), Math.cos(diff))
  const maxStep = GAME_CONFIG.AI_MOVEMENT.BEAM_TURN_SPEED * delta
  const yaw = current + Math.max(-maxStep, Math.min(maxStep, diff))
  action.dirX = Math.sin(yaw)
  action.dirY = 0
  action.dirZ = Math.cos(yaw)
  return yaw
}
