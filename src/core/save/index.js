import { listOwnedPokemon } from '../actions/pokemon'
import { WorldClock } from '../traits'
import { SAVE_VERSION } from './saveFormat'
import { serializePokemon } from './pokemonSave'
import { serializeTrainer } from './trainerSave'
import { serializeWorldItems } from './worldItemsSave'

export {
  SAVE_VERSION,
  saveSchema,
  migrateSave,
  validateSave,
} from './saveFormat'
export { serializePokemon, restorePokemon } from './pokemonSave'
export { serializeTrainer, restoreTrainer } from './trainerSave'
export { serializeWorldItems, restoreWorldItems } from './worldItemsSave'

/**
 * O save inteiro do `trainer` (docs/features/044-salvar-o-jogo.md): versão,
 * treinador, todos os Pokémon dele (time e inventário) e os itens do mundo
 * que ele mexeu (docs/features/055-itens-no-mundo.md — do mundo, mas
 * enquanto o jogo é offline vão no save dele). Só lê o mundo.
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
    worldItems: serializeWorldItems(world),
  }
}
