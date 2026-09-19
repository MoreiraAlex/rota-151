import { trait } from 'koota'

/**
 * Criatura (id de espécie) equipada em cada slot secundário do treinador —
 * `secondary1/2/3` (ver docs/features/011-slots-de-acao.md). Mesmo nível de
 * indireção que `HeldItem.itemId`: guarda o id da espécie, não uma
 * referência de entidade — não existe entidade de criatura nenhuma ainda
 * (invocar/recolher de verdade é feature futura).
 *
 * Começa toda vazia — sem sistema de captura ainda, só o seletor de debug
 * (`DebugPanel`) equipa algo, pra validar o mecanismo (ver
 * docs/features/013-criaturas-de-time.md).
 */
export const Party = trait({
  slot1: null,
  slot2: null,
  slot3: null,
})

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
