import { comecarTreino } from '../actions/training'
import { findSummonedCreature } from '../actions/pokemon'
import { Fainted, PendingTraining } from '../traits'

/**
 * O treino pedido para um Pokémon que estava na bola (`PendingTraining`,
 * docs/features/067-campo-de-treino-e-avisos-de-nivel.md): assim que a
 * criatura dele nasce (invocada rumo ao boneco pelo `partySummonSystem`),
 * ela começa a treinar (`comecarTreino`) — a apresentação de quem acabou de
 * sair da bola segura o treino até acabar. Desiste se o boneco sumiu, se
 * ela nasceu desmaiada ou se passou `TRAINING.PENDING_TIMEOUT`.
 *
 * Headless. Fase: simulation, antes do `trainingSystem`.
 */
export function pendingTrainingSystem(context) {
  const { world, delta } = context
  const done = []

  for (const pokemon of world.query(PendingTraining)) {
    const pending = pokemon.get(PendingTraining)
    if (!pending.object?.isAlive?.()) {
      done.push(pokemon)
      continue
    }
    const creature = findSummonedCreature(world, pokemon)
    if (creature) {
      if (!creature.has(Fainted)) {
        comecarTreino(creature, pending.moveId, pending.object)
      }
      done.push(pokemon)
      continue
    }
    const timeLeft = pending.timeLeft - delta
    if (timeLeft <= 0) done.push(pokemon)
    else pokemon.set(PendingTraining, { timeLeft })
  }

  // Fora da iteração: tirar o trait muda a query.
  for (const pokemon of done) pokemon.remove(PendingTraining)
}
