import { listOwnedPokemon } from '../actions/pokemon'
import { WorldClock } from '../traits'
import { SAVE_VERSION } from './saveFormat'
import { serializePokemon } from './pokemonSave'
import { serializeTrainer } from './trainerSave'

export {
  SAVE_VERSION,
  saveSchema,
  migrateSave,
  validateSave,
} from './saveFormat'
export { serializePokemon, restorePokemon } from './pokemonSave'
export { serializeTrainer, restoreTrainer } from './trainerSave'

/**
 * O save inteiro do `trainer` (docs/features/044-salvar-o-jogo.md): versão,
 * treinador e todos os Pokémon dele (time e inventário). Só lê o mundo.
 */
export function snapshotSave(world, trainer) {
  return {
    version: SAVE_VERSION,
    trainer: {
      ...serializeTrainer(trainer),
      // O horário é do mundo, mas enquanto o jogo é offline ele vai no save
      // do treinador (docs/features/048-dia-noite-e-clima.md).
      worldTime: world.has(WorldClock) ? world.get(WorldClock).time : null,
    },
    pokemon: listOwnedPokemon(world, trainer)
      .map((pokemon) => serializePokemon(world, trainer, pokemon))
      .filter(Boolean),
  }
}
