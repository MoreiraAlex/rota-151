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
 * e o resto da contagem segue no registro dela (`StoredFaint`).
 *
 * Donos de escrita: `desmaiar`/`acordar` (`core/actions/faint.js`, entrar/
 * sair) e `faintSystem.js` (contagem).
 */
export const Fainted = trait({
  timeLeft: 0,
  elapsed: 0,
})
