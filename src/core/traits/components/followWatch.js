import { trait } from 'koota'

/**
 * Vigia de quem segue (docs/features/064-revisao-da-ia-do-parceiro.md,
 * Parte 1): se ficou longe demais de quem está no controle ou se está
 * preso. Vai na criatura do time e no treinador (que segue quando o
 * controle está numa criatura).
 *
 * - `anchorX` / `anchorZ`: onde ele estava quando começou a contar o
 *   "preso" — sair de um círculo de `FOLLOW_LIMIT.STUCK_RADIUS` em volta
 *   daqui zera a conta.
 * - `stuckTime` (s): quanto tempo tentando seguir sem sair desse círculo.
 * - `joined`: já chegou perto do grupo desde que passou a seguir este
 *   líder — antes disso, a distância não conta (a recém-invocada pode
 *   pousar longe).
 * - `warned`: o aviso de "longe demais do treinador" está ligado (só o
 *   treinador usa).
 * - `pendingReason` / `timeLeft`: a contagem antes de puxar para a bola
 *   (`'far'` / `'stuck'`, ou `null` sem contagem) e quanto falta (s).
 *
 * Dono de escrita: `followLimitSystem.js`.
 */
export const FollowWatch = trait({
  anchorX: 0,
  anchorZ: 0,
  stuckTime: 0,
  joined: false,
  warned: false,
  pendingReason: null,
  timeLeft: 0,
})

/**
 * O aviso na tela de que a criatura vai ser puxada para a bola
 * (docs/features/064-revisao-da-ia-do-parceiro.md, Parte 1). Fica na
 * criatura que VAI voltar — a do time que ficou para trás, ou a controlada
 * quando quem ficou para trás foi o treinador.
 *
 * - `stage`: `'warn'` (a controlada longe do treinador, ou o treinador longe
 *   de quem treina, ainda sem contagem) ou `'recall'` (contando para puxar).
 * - `reason`: `'far'` / `'stuck'` (ela), `'trainerFar'` / `'trainerStuck'`
 *   (o treinador que a seguia) ou `'trainingFar'` (o treinador se afastou de
 *   quem treina num boneco, docs/features/067-campo-de-treino-e-avisos-de-
 *   nivel.md).
 * - `duration` / `timeLeft` (s): a contagem toda e quanto falta, em degraus
 *   de `FEEDBACK.RECALL_WARNING.DISPLAY_STEP` (a tela atualiza poucas vezes
 *   por segundo, não a cada tick).
 *
 * Dono de escrita: `followLimitSystem.js`. Quem lê: `StrayWarningHud.jsx`
 * e a Pokébola piscando da `NameplateView.jsx`.
 */
export const StrayWarning = trait({
  stage: 'warn',
  reason: 'far',
  duration: 0,
  timeLeft: 0,
})

/**
 * Tag: a criatura do time tem que voltar para a bola agora (a contagem
 * acabou). Quem põe é `voltarParaABola` (`core/actions/followLimit.js`);
 * quem atende é o recolher automático do `partySummonSystem.js`, quando o
 * treinador fica livre.
 */
export const StrayRecall = trait()
