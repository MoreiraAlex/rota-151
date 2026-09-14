/**
 * Log de aviso quando um dos 4 botões de ação (`primary`/`secondary1-3` —
 * ver docs/features/011-slots-de-acao.md) é apertado. Não é uma ação de
 * verdade — só existe pra confirmar visualmente (console) que o input está
 * mapeado, já que nenhum system ainda atua nesses botões. Remove (ou troca
 * pelo log da própria ação) quando "Arremessar/usar objeto" ou
 * "Invocar/recolher criatura" passarem a consumir esses pulsos de verdade.
 *
 * Headless. Fase: input, depois do inputSystem.
 */
export function actionSlotsDebugSystem(context) {
  const input = context.input ?? {}

  if (input.primary) console.warn('[slots de ação] primary')
  if (input.secondary1) console.warn('[slots de ação] secondary1')
  if (input.secondary2) console.warn('[slots de ação] secondary2')
  if (input.secondary3) console.warn('[slots de ação] secondary3')
}
