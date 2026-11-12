import { GAME_CONFIG } from '../gameConfig'
import {
  entrarNoPredio,
  garantirColisaoDaSala,
  sairDoPredio,
} from '../actions/interior'
import { InteriorTransition, Party } from '../traits'

/**
 * Passar por uma porta (docs/features/068-interior-dos-predios.md): a tela
 * escurece (`INTERIOR.FADE_OUT`), no escuro o treinador troca de lugar
 * (`entrarNoPredio`/`sairDoPredio`) e a tela clareia (`INTERIOR.FADE_IN`).
 * Enquanto isso o `inputSystem` segura o treinador parado.
 *
 * O tempo corre no próprio objeto do `InteriorTransition`; só a troca de
 * fase avisa quem assina (a HUD do escuro).
 *
 * Também cria a colisão da sala de quem carregou o jogo lá dentro
 * (`garantirColisaoDaSala`).
 *
 * Headless. Fase: simulation, logo depois do `interactionSystem` (que
 * começa a transição) e antes do movimento e da física (a troca de lugar
 * vale já neste passo).
 */
export function interiorSystem(context) {
  const { world, delta } = context
  if (!world.has(InteriorTransition)) return
  // Carregou o jogo dentro de um prédio: a sala ganha colisão assim que a
  // física fica pronta (antes do treinador cair).
  const trainer = world.queryFirst(Party)
  if (trainer) garantirColisaoDaSala(trainer)
  const transition = world.get(InteriorTransition)
  if (!transition.phase) return
  transition.elapsed += delta

  const { FADE_OUT, FADE_IN } = GAME_CONFIG.INTERIOR
  if (transition.phase === 'out' && transition.elapsed >= FADE_OUT) {
    if (trainer && transition.action === 'enter') {
      entrarNoPredio(world, trainer, transition.door)
    } else if (trainer && transition.action === 'exit') {
      sairDoPredio(world, trainer)
    }
    world.set(InteriorTransition, { ...transition, phase: 'in', elapsed: 0 })
    return
  }
  if (transition.phase === 'in' && transition.elapsed >= FADE_IN) {
    world.set(InteriorTransition, {
      phase: null,
      elapsed: 0,
      action: null,
      interiorId: null,
      door: null,
    })
  }
}
