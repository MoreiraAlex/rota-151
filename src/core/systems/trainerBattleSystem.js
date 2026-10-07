import { resolveMoveSpeed } from '../actions/movementSpeed'
import { tentarCorrer } from '../actions/stamina'
import { resolveGroupLeader } from '../actions/owner'
import { faceMovement, resolveIncomingAttack } from '../battle/aiMovement'
import {
  findNearest,
  isActiveCombatant,
  listWildsFightingParty,
} from '../battle/combatTargets'
import { GAME_CONFIG } from '../gameConfig'
import { lerpAngle } from '../math'
import { steerTowards } from '../steering'
import {
  CharacterController,
  MovementStats,
  OwnedBy,
  Party,
  Position,
  Rotation,
  SummonedCreature,
  TrainerBehavior,
  Velocity,
  Vitals,
  WildBehavior,
} from '../traits'

function horizontalDistance(a, b) {
  return Math.hypot(b.x - a.x, b.z - a.z)
}

/** O golpe vindo no treinador que acontece primeiro, ou `null`. */
function findIncoming(pos, bodyRadius, wilds) {
  let soonest = null
  for (const wild of wilds) {
    const incoming = resolveIncomingAttack(
      wild.entity,
      wild.pos,
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
 * Um ponto está na zona segura: a pelo menos `SAFE_MIN_DISTANCE` de toda
 * selvagem na luta e no máximo `SAFE_MAX_DISTANCE` da criatura controlada.
 */
function isInSafeZone(point, leaderPos, wilds) {
  const { SAFE_MIN_DISTANCE, SAFE_MAX_DISTANCE } = GAME_CONFIG.TRAINER_BATTLE
  if (horizontalDistance(point, leaderPos) > SAFE_MAX_DISTANCE) return false
  return wilds.every(
    (wild) => horizontalDistance(point, wild.pos) >= SAFE_MIN_DISTANCE,
  )
}

/**
 * Ponto seguro novo: `SAFE_DISTANCE` atrás da criatura controlada, do lado
 * oposto à selvagem mais perto dela.
 */
function resolveSafePoint(leaderPos, wilds) {
  const { SAFE_DISTANCE } = GAME_CONFIG.TRAINER_BATTLE
  const threat = findNearest(leaderPos, wilds)
  const awayX = leaderPos.x - threat.pos.x
  const awayZ = leaderPos.z - threat.pos.z
  const length = Math.hypot(awayX, awayZ) || 1
  return {
    x: leaderPos.x + (awayX / length) * SAFE_DISTANCE,
    z: leaderPos.z + (awayZ / length) * SAFE_DISTANCE,
  }
}

/** Criaturas do `trainer` em campo, ativas, fora o próprio treinador. */
function listTeam(world, trainer) {
  const team = []
  world
    .query(SummonedCreature, Position, OwnedBy(trainer))
    .forEach((entity) => {
      if (isActiveCombatant(entity)) {
        team.push({ entity, pos: entity.get(Position) })
      }
    })
  return team
}

/**
 * O TREINADOR numa luta quando NÃO está no controle — o jogador pilota uma
 * criatura (docs/features/034-ia-de-batalha.md, Parte 4). Hoje ele só seguia
 * a criatura e ficava no meio da luta, apanhando. Com alguma selvagem lutando
 * com o grupo (`listWildsFightingParty`), por tick, a primeira que valer:
 *
 * 1. **Desvio** (`'dodge'`) — dentro do aviso vermelho de um golpe
 *    (`resolveIncomingAttack`, a mesma área da IA): sai pro lado correndo. Sem
 *    sorteio — ele não luta, só se protege.
 * 2. **Foge pro time** (`'toTeam'`) — uma selvagem está mirando nele (ele era
 *    o único no raio dela): corre pra perto da criatura do time mais perto
 *    (`TEAM_STOP_DISTANCE`), puxando a selvagem pra quem luta.
 * 3. **Posição segura** (`'safe'`) — já na zona segura (`isInSafeZone`: longe
 *    de toda selvagem, perto o bastante da criatura controlada), fica parado
 *    encarando a luta. Fora dela, vai pra `SAFE_DISTANCE` atrás da criatura
 *    controlada, do lado oposto à selvagem mais perto dela — ponto escolhido
 *    UMA vez e guardado (`TrainerBehavior.safeX/Z`) até CHEGAR nele (só é
 *    trocado se o próprio ponto sair da zona); recalcular todo tick fazia ele
 *    girar junto com a selvagem rodeando a criatura, e parar ao reentrar na
 *    zona fazia ele dar meia-volta na borda dela. Anda, e corre só com
 *    selvagem a `DANGER_DISTANCE` dele.
 *
 * Sem luta, ou no controle: `'follow'` — o `creatureFollowSystem` segue como
 * sempre. Correr paga energia (`tentarCorrer`), a velocidade cai com a vida
 * (`resolveMoveSpeed`).
 *
 * Headless. Fase: simulation, depois do `partyBehaviorSystem` e antes do
 * `creatureFollowSystem` (que pula o treinador fora de `'follow'`).
 */
export function trainerBattleSystem(context) {
  const { world, delta } = context
  const { ARRIVE_DISTANCE, DANGER_DISTANCE, TEAM_STOP_DISTANCE } =
    GAME_CONFIG.TRAINER_BATTLE

  // `PathState` de propósito FORA da query: o `steerTowards` grava com
  // `entity.set`, e trait listada na query ativa não persiste a escrita (o
  // caminho do treinador ficava congelado no debug e o `findPath` rodava
  // todo tick). Mesma ressalva do `creatureFollowSystem`.
  world
    .query(
      Party,
      TrainerBehavior,
      Position,
      Rotation,
      Velocity,
      MovementStats,
      Vitals,
    )
    // `Party` é tag (sem dados): não entra no array do `updateEach`.
    .updateEach(([trainer, pos, rot, vel, stats, vitals], entity) => {
      // Tudo do grupo DESTE treinador: quem ele segue, as selvagens brigando
      // com o time dele e as criaturas dele.
      const leader = resolveGroupLeader(world, entity)
      const wilds = listWildsFightingParty(world, entity)
      if (leader === entity || wilds.length === 0) {
        trainer.state = 'follow'
        // Ponto de uma luta que acabou não vale pra próxima.
        trainer.hasSafePoint = false
        return
      }

      const moving = { pos, rot, vel, stats }
      const run = () =>
        resolveMoveSpeed(stats, vitals, tentarCorrer(vitals, delta))
      const nearestWild = findNearest(pos, wilds)
      const face = (target) => {
        rot.y = lerpAngle(
          rot.y,
          Math.atan2(target.x - pos.x, target.z - pos.z),
          stats.turnSpeed * delta,
        )
      }

      // 1. Desvio.
      const bodyRadius = entity.get(CharacterController)?.capsuleRadius ?? 0
      const incoming = findIncoming(pos, bodyRadius, wilds)
      if (incoming) {
        const speed = run()
        vel.x = incoming.dodgeX * speed
        vel.z = incoming.dodgeZ * speed
        faceMovement(rot, stats, incoming.dodgeX, incoming.dodgeZ, delta)
        trainer.state = 'dodge'
        return
      }

      // 2. Mirado por uma selvagem: corre pro time.
      const hunted = wilds.some(
        (wild) => wild.entity.get(WildBehavior).target === entity,
      )
      const ally = findNearest(pos, listTeam(world, entity))
      if (hunted && ally) {
        if (ally.distance > TEAM_STOP_DISTANCE) {
          steerTowards(entity, moving, ally.pos, run(), delta)
        } else {
          vel.x = 0
          vel.z = 0
          face(nearestWild.pos)
        }
        trainer.state = 'toTeam'
        return
      }

      // 3. Posição segura (zona com folga). Parado: fica enquanto estiver na
      // zona. Indo pro ponto: vai até CHEGAR — parar só por ter voltado à
      // zona fazia ele dar meia-volta na borda dela (a selvagem rodeando
      // entra e sai dos `SAFE_MIN_DISTANCE`) e girar no lugar.
      const leaderPos = leader.get(Position)
      trainer.state = 'safe'
      const stop = () => {
        trainer.hasSafePoint = false
        vel.x = 0
        vel.z = 0
        face(nearestWild.pos)
      }
      if (!trainer.hasSafePoint && isInSafeZone(pos, leaderPos, wilds)) {
        stop()
        return
      }
      const stored = { x: trainer.safeX, z: trainer.safeZ }
      if (!trainer.hasSafePoint || !isInSafeZone(stored, leaderPos, wilds)) {
        const point = resolveSafePoint(leaderPos, wilds)
        trainer.hasSafePoint = true
        trainer.safeX = point.x
        trainer.safeZ = point.z
      }
      const safe = { x: trainer.safeX, z: trainer.safeZ }
      if (horizontalDistance(pos, safe) <= ARRIVE_DISTANCE) {
        stop()
        return
      }
      const speed =
        nearestWild.distance <= DANGER_DISTANCE
          ? run()
          : resolveMoveSpeed(stats, vitals, false)
      steerTowards(entity, moving, safe, speed, delta)
    })
}
