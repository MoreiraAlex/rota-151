import { partyStrayed } from '../events'
import { StrayRecall, SummonedCreature } from '../traits'

/**
 * A criatura do time vai voltar sozinha para a bola porque ficou para trás
 * (docs/features/064-revisao-da-ia-do-parceiro.md, Parte 1): marca o pedido
 * (`StrayRecall`, atendido pelo recolher automático do
 * `partySummonSystem.js`) e avisa (`partyStrayed`). Já marcada, não faz
 * nada — o aviso sai uma vez só.
 *
 * @param {'far' | 'stuck' | 'trainerFar' | 'trainerStuck'} reason
 */
export function voltarParaABola(events, creature, reason) {
  if (!creature.has(SummonedCreature) || creature.has(StrayRecall)) return
  creature.add(StrayRecall)
  const { speciesId } = creature.get(SummonedCreature)
  events?.emit(partyStrayed({ speciesId, reason }))
}
