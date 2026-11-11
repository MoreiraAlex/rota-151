import { trait } from 'koota'

/**
 * A criatura do time em campo subiu de nível e vai comemorar (a ação
 * `'happy'`, docs/features/067-campo-de-treino-e-avisos-de-nivel.md) assim
 * que estiver livre — o nível costuma subir no meio do golpe do nocaute.
 * `timeLeft`: quanto tempo (s) ainda espera ficar livre; zerou, desiste.
 *
 * Donos de escrita: `pedirComemoracao` (põe), `creatureCelebrationSystem`
 * (conta e tira ao começar) e `pararComemoracao` (tira ao ser cortada) —
 * `core/actions/celebration.js`.
 */
export const PendingCelebration = trait({ timeLeft: 0 })
