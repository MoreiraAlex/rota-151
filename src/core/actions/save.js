import { restorePokemon, restoreTrainer } from '../save'
import { SaveRequested, TrainerReady } from '../traits'
import { darKitInicial } from './startingKit'
import { definirHorario } from './environment'

/**
 * Salvar e carregar (docs/features/044-salvar-o-jogo.md). O core monta e
 * aplica o save (`core/save/`) e PEDE pra salvar (`SaveRequested`); quem
 * fala com o banco é a plataforma (`platform/persistence/`).
 */

/**
 * Prepara o treinador ao entrar no jogo, uma vez só: com `save` (já migrado e
 * validado — `migrateSave`), volta tudo como estava; sem save (primeira
 * entrada), o kit inicial — e já pede um save, pra conta ganhar o dela.
 * Devolve se preparou agora.
 */
export function prepararTreinador(world, trainer, save) {
  if (trainer.has(TrainerReady)) return false
  if (save) aplicarSave(world, trainer, save)
  else {
    darKitInicial(world, trainer)
    pedirSave(trainer)
  }
  trainer.add(TrainerReady)
  return true
}

/**
 * Devolve ao `trainer` (sem nenhum Pokémon ainda) o estado do `save`: itens,
 * item na mão, Pokédex e os Pokémon, cada um no lugar salvo. Em campo não
 * volta ninguém: todos voltam na bola.
 */
export function aplicarSave(world, trainer, save) {
  restoreTrainer(trainer, save.trainer)
  // Sem horário salvo (save antigo), fica o inicial.
  if (save.trainer.worldTime != null) {
    definirHorario(world, save.trainer.worldTime)
  }
  // Time primeiro; o inventário por célula, pra cada um nascer (na primeira
  // célula livre) antes da célula salva de quem vem depois.
  const party = save.pokemon.filter((saved) => saved.location.kind === 'party')
  const inventory = save.pokemon
    .filter((saved) => saved.location.kind === 'inventory')
    .sort((a, b) => a.location.cell - b.location.cell)
  const ordered = [...party, ...inventory]
  for (const saved of ordered) restorePokemon(world, trainer, saved)
}

/** Pede um save do `trainer` (gravado pela plataforma). Não acumula. */
export function pedirSave(trainer) {
  if (!trainer?.isAlive?.() || trainer.has(SaveRequested)) return
  trainer.add(SaveRequested)
}
