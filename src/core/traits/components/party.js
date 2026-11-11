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

/**
 * Pedido de invocar o Pokémon do `slot` jogando a bola rumo a um ponto do
 * mundo (`x`, `y`, `z`), em vez da mira da câmera — o treino de golpe chama
 * o Pokémon que está na bola para a frente do boneco (docs/features/067-
 * campo-de-treino-e-avisos-de-nivel.md). Trait do treinador.
 *
 * Donos de escrita: `pedirInvocacao` (`core/actions/training.js`, põe) e
 * `partySummonSystem.js` (tira ao começar a invocar, quando o treinador
 * fica livre, ou ao desistir — o slot não tem mais quem invocar).
 */
export const SummonRequest = trait({ slot: null, x: 0, y: 0, z: 0 })

/**
 * O primeiro toque no atalho de um Pokémon que está treinando
 * (docs/features/067-campo-de-treino-e-avisos-de-nivel.md): avisou que vai
 * cancelar o treino; um segundo toque no mesmo `slot` antes de `timeLeft`
 * (s) acabar recolhe. Trait do treinador.
 *
 * Dono de escrita: `partySummonSystem.js`.
 */
export const RecallConfirm = trait({ slot: null, timeLeft: 0 })
