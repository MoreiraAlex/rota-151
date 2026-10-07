import {
  InputControlled,
  OwnedBy,
  Party,
  SummonBall,
  SummonedCreature,
} from '../traits'

/**
 * Leituras de "de quem é" (docs/features/040-dono-da-criatura.md): o core
 * nunca supõe um treinador só no mundo. O dono de uma criatura/esfera é o
 * alvo de `OwnedBy`; o treinador é dono de si mesmo.
 */

/** O treinador de `entity` — ele mesmo (`Party`), o dono (`OwnedBy`) ou `null`. */
export function resolveOwner(entity) {
  if (!entity?.isAlive?.()) return null
  if (entity.has(Party)) return entity
  const owner = entity.targetFor(OwnedBy)
  return owner?.isAlive() ? owner : null
}

/** Se `a` e `b` são do mesmo time (mesmo treinador). */
export function isSameTeam(a, b) {
  const owner = resolveOwner(a)
  return owner != null && owner === resolveOwner(b)
}

/** A criatura em campo do `slot` do `trainer`, ou `null` se está na bola. */
export function findOwnedCreature(world, trainer, slot) {
  if (!trainer) return null
  let found = null
  world
    .query(SummonedCreature, OwnedBy(trainer))
    .readEach(([summoned], entity) => {
      if (summoned.slot === slot) found = entity
    })
  return found
}

/** Se o `trainer` já tem uma esfera em voo pro `slot`. */
export function hasOwnedBallInFlight(world, trainer, slot) {
  if (!trainer) return false
  return world
    .query(SummonBall, OwnedBy(trainer))
    .some((entity) => entity.get(SummonBall).slot === slot)
}

/**
 * Quem o grupo do `trainer` segue: a criatura dele que está sendo pilotada
 * ou, sem nenhuma, o próprio treinador.
 */
export function resolveGroupLeader(world, trainer) {
  if (!trainer) return null
  if (trainer.has(InputControlled)) return trainer
  return (
    world
      .query(SummonedCreature, InputControlled, OwnedBy(trainer))
      .find((entity) => entity.isAlive()) ?? trainer
  )
}

/**
 * O treinador do jogador desta máquina: o dono de quem tem `InputControlled`
 * (ele mesmo ou a criatura dele que está sendo pilotada). É quem recebe o
 * input global (invocar, trocar o controle, menu de ações). `null` sem
 * ninguém no controle.
 */
export function resolveLocalTrainer(world) {
  return resolveOwner(world.queryFirst(InputControlled))
}
