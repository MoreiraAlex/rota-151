import { trait } from 'koota'

/**
 * Criatura DESMAIADA — presença do trait = desmaiada (chegou a 0 de HP).
 * Enquanto isso fica largada no chão: intangível (collider desligado —
 * ninguém esbarra, mira nem acerta), não anda, não ataca, não regenera e
 * toca o estado de animação `'faint'` (`core/data/animationStates.js`).
 *
 * `timeLeft` (s) conta até acordar (`GAME_CONFIG.FAINT.DURATION_MINUTES`);
 * `elapsed` (s) é há quanto tempo desmaiou — a do time é recolhida pelo
 * treinador quando passa de `PARTY_RECALL_DELAY` (`partySummonSystem.js`),
 * e o resto da contagem segue no treinador (`PartyFaint`).
 *
 * Donos de escrita: `desmaiar`/`acordar` (`core/actions/faint.js`, entrar/
 * sair) e `faintSystem.js` (contagem).
 */
export const Fainted = trait({
  timeLeft: 0,
  elapsed: 0,
})

/**
 * Desmaio das criaturas do time POR SLOT, no treinador — a criatura
 * recolhida deixa de existir como entidade (`applyRecall`), então a
 * contagem pra reanimar continua aqui. Mesmo formato de
 * `PartyIndividualValues` (um valor por slot):
 * - `null`: não está desmaiada;
 * - `{ timeLeft }`: desmaiada, faltando `timeLeft` s — não pode ser
 *   invocada. Ao zerar, reanima na bola: volta a `null` e a vida guardada
 *   (`PartyVitals`) vira o HP de quem acorda (`faintSystem.js`).
 *
 * Donos de escrita: `applyRecall` (`partySummonSystem.js`, guarda o que
 * falta ao recolher), `faintSystem.js` (contagem) e `equiparCriatura`
 * (limpa ao trocar a criatura do slot).
 */
export const PartyFaint = trait({
  slot1: null,
  slot2: null,
  slot3: null,
})
