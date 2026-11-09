/**
 * Regras de quem segue e ficou para trás (docs/features/064-revisao-da-ia-
 * do-parceiro.md, Parte 1). Puras: o `followLimitSystem.js` lê o mundo e
 * aplica o que elas devolvem.
 */

/**
 * O "preso" deste tick. Tentando seguir e ainda dentro do círculo de
 * `stuckRadius` em volta da âncora → soma o tempo; saiu do círculo, ou não
 * está tentando seguir (parado perto, lutando, numa ação...) → a âncora vem
 * para onde ele está e a conta zera.
 *
 * @returns {{ anchorX: number, anchorZ: number, stuckTime: number }}
 */
export function resolveStuckStep(watch, pos, { isTrying, delta, stuckRadius }) {
  const moved = Math.hypot(pos.x - watch.anchorX, pos.z - watch.anchorZ)
  if (!isTrying || moved > stuckRadius) {
    return { anchorX: pos.x, anchorZ: pos.z, stuckTime: 0 }
  }
  return {
    anchorX: watch.anchorX,
    anchorZ: watch.anchorZ,
    stuckTime: watch.stuckTime + delta,
  }
}

/**
 * Se está longe demais de quem está no controle. Só vale depois de ter
 * chegado perto do grupo uma vez (`joined`): a recém-invocada pode pousar
 * longe. Com a contagem de "longe" já correndo (`counting`), só cancela
 * abaixo do limite menos a folga (`cancelMargin`) — sem ela, andar na borda
 * ligava e desligava o aviso.
 */
export function isTooFar(
  distance,
  { joined, counting, recallDistance, cancelMargin },
) {
  if (!joined) return false
  const limit = counting ? recallDistance - cancelMargin : recallDistance
  return distance > limit
}

/**
 * Se quem segue tem que voltar: `'far'` (longe demais), `'stuck'` (preso há
 * tempo demais) ou `null`. Longe ganha de preso.
 */
export function resolveStrayReason(isFar, stuckTime, { stuckTimeLimit }) {
  if (isFar) return 'far'
  if (stuckTime >= stuckTimeLimit) return 'stuck'
  return null
}

/**
 * A contagem antes de puxar para a bola. Começa em `warningTime` quando
 * aparece um motivo, desce com o tempo enquanto o motivo continua e cancela
 * quando ele some (voltou para perto, desprendeu). `fire`: acabou o tempo —
 * puxar agora.
 *
 * @returns {{ reason: string | null, timeLeft: number, fire: boolean }}
 */
export function resolveRecallCountdown(
  pending,
  timeLeft,
  reason,
  { delta, warningTime },
) {
  if (!reason) return { reason: null, timeLeft: 0, fire: false }
  const left = pending ? timeLeft - delta : warningTime
  return { reason, timeLeft: Math.max(0, left), fire: left <= 0 }
}

/**
 * O aviso de "longe demais do treinador" (sem contagem), com folga para não
 * piscar na borda: liga ao passar de `warnDistance` e só desliga depois de
 * voltar para menos de `resetDistance`.
 */
export function resolveTooFarWarning(
  distance,
  warned,
  { warnDistance, resetDistance },
) {
  if (!warned) return distance > warnDistance
  return distance >= resetDistance
}

/**
 * O tempo que a tela mostra, em degraus de `step` (arredondado para cima):
 * o aviso só muda de valor algumas vezes por segundo, não a cada tick.
 */
export function quantizeTimeLeft(timeLeft, step) {
  if (step <= 0) return timeLeft
  return Math.ceil(timeLeft / step - 1e-9) * step
}
