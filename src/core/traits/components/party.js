import { trait } from 'koota'

/**
 * Marca o TREINADOR: a entidade que tem um time. Os Pokémon do time e do
 * inventário são registros próprios (`Pokemon`, `core/traits/components/
 * pokemon.js`), ligados a ele por `OwnedBy`; os 3 lugares do time são as
 * relações `PartySlots` (docs/features/041-inventario-de-itens-e-pokemon.md).
 */
export const Party = trait()

/**
 * Pulso de UM TICK — presente no exato tick em que uma `SummonedCreature`
 * de verdade nasce (`applySummon`, `partySummonSystem.js`, no instante
 * `effectAt` da ação `summon`, não no disparo/`beginSummon` — o efeito
 * sonoro deve coincidir com a criatura aparecendo de verdade, não com o
 * treinador começando o gesto). Mesmo princípio de `Jumped`
 * (`core/traits/components/physics.js`): quem ADICIONA (`partySummonSystem.js`)
 * NUNCA remove — a fase `simulation` pode rodar mais de um tick fixo antes
 * da próxima `presentation`, e limpar cedo demais podia apagar o pulso
 * antes de `view/systems/summonAudioSystem.js` chegar a vê-lo. É esse
 * system quem remove, depois de consumir.
 */
export const SummonPulse = trait()

/**
 * Mesma ideia de `SummonPulse`, pro instante em que uma `SummonedCreature`
 * é de fato destruída (`applyRecall`, no `effectAt` da ação `recall`) —
 * ver `view/systems/recallAudioSystem.js`.
 */
export const RecallPulse = trait()
