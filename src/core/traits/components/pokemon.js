import { relation, trait } from 'koota'

/**
 * Registro de um Pokémon (docs/features/041-inventario-de-itens-e-pokemon.md):
 * uma entidade SEM corpo no mundo (sem posição, física ou view) que guarda
 * quem ele é, esteja no time ou no inventário. Junto deste trait o registro
 * tem `IndividualValues`, `CreatureLevel`, `CreatureMoves`, `StoredVitals` e
 * `OwnedBy` (o treinador). Quando é invocado, a `SummonedCreature` nasce com
 * cópias desses dados e aponta de volta pra cá (`SummonedFrom`).
 *
 * Dono de escrita: `criarPokemon` (`core/actions/pokemon.js`), que monta o
 * registro inteiro.
 */
export const Pokemon = trait({
  speciesId: null,
})

/**
 * Vida/energia do Pokémon FORA DE CAMPO (no time ou no inventário):
 * - `vitals: null`: cheio (nunca saiu, ou acabou de ser criado);
 * - cópia do `Vitals` (mesmos campos): como estava ao ser recolhido.
 *
 * Fora de campo continua regenerando pela mesma regra de fora
 * (`regenerateVitals`, `vitalsRegenSystem.js`), exceto desmaiado
 * (`StoredFaint`).
 *
 * Donos de escrita: `applyRecall` (guarda), `vitalsRegenSystem.js`
 * (regenera), `faintSystem.js` (HP de quem acorda fora de campo),
 * `summonBallSystem.js` (devolve e limpa ao invocar) e `subirDeNivel`
 * (máximos novos).
 */
export const StoredVitals = trait({
  vitals: null,
})

/**
 * Pokémon desmaiado FORA DE CAMPO — presença do trait = desmaiado, faltando
 * `timeLeft` s pra reanimar. Não pode ser invocado. Ao zerar, reanima: o
 * trait sai e a vida guardada (`StoredVitals`) vira o HP de quem acorda.
 *
 * Donos de escrita: `applyRecall` (`partySummonSystem.js`, guarda o que
 * falta ao recolher) e `faintSystem.js` (contagem e retirada).
 */
export const StoredFaint = trait({
  timeLeft: 0,
})

/**
 * Os 3 lugares do time: uma relação exclusiva por slot, do TREINADOR pro
 * registro (`Pokemon`). Exclusiva: um Pokémon por slot. Sem nenhuma delas
 * apontando pra ele, o Pokémon está no inventário.
 *
 * Relação no treinador (e não um campo no registro) pra a interface
 * acompanhar a troca de cada slot (`useTarget`).
 *
 * Dono de escrita: `colocarNoTime`/`tirarDoTime` (`core/actions/pokemon.js`).
 */
export const PartySlots = {
  slot1: relation({ exclusive: true }),
  slot2: relation({ exclusive: true }),
  slot3: relation({ exclusive: true }),
}

/**
 * Em que célula da grade do Inventário está este Pokémon. Só existe
 * enquanto ele está no inventário (fora do time); a grade é dividida com os
 * itens (`Inventory.positions`).
 *
 * Donos de escrita: `criarPokemon`, `colocarNoTime`, `tirarDoTime`
 * (`core/actions/pokemon.js`) e as actions de arrumação da grade
 * (`core/actions/inventory.js`).
 */
export const InventoryCell = trait({
  index: 0,
})

/** Ids dos slots do time, na ordem das teclas de invocar. */
export const PARTY_SLOT_IDS = ['slot1', 'slot2', 'slot3']

/**
 * De qual registro (`Pokemon`) veio esta entidade em campo: da
 * `SummonedCreature` e da `SummonBall` em voo pro registro. Exclusiva.
 * É por ela que XP, golpes, desmaio e vida chegam no registro certo, mesmo
 * que ele troque de slot.
 *
 * Dono de escrita: `spawnSummonBall` (`partySummonSystem.js`, na esfera) e
 * `spawnCreature` (`summonBallSystem.js`, na criatura).
 */
export const SummonedFrom = relation({ exclusive: true })
