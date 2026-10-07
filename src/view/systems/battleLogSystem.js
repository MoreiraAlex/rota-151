import { battleLogStore } from '../registry/battleLogStore'
import { formatBattleLogEvent } from '../shared/battleLogFormat'

/**
 * Log de batalha em texto (docs/features/039-tipos-e-combate-classico.md): cada
 * evento de combate de `context.frameEvents` vira linhas
 * (`formatBattleLogEvent`), na ordem em que aconteceu, e vai pro
 * `battleLogStore` — que `tools/hud/BattleLogHud.jsx` mostra. Também conta o
 * tempo sem mensagem pra o log apagar sozinho.
 *
 * Fase: presentation.
 */
export function battleLogSystem(context) {
  const { delta, frameEvents } = context
  const lines = []
  for (const event of frameEvents) {
    lines.push(...formatBattleLogEvent(event))
  }
  if (lines.length > 0) {
    battleLogStore.pushLines(lines)
    return
  }
  battleLogStore.advance(delta)
}
