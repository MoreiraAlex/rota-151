import { snapshotSave } from '@/core/save'
import { SaveRequested } from '@/core/traits'

/**
 * Save automático (docs/features/044-salvar-o-jogo.md): o core pede
 * (`SaveRequested` no treinador — por tempo ou depois de uma captura) e este
 * adapter grava pelo `client` (`createSaveClient`):
 *
 * - monta o save fora do passo do jogo (microtask depois do pedido), tira o
 *   pedido e só envia se mudou desde o último envio que deu certo;
 * - um envio por vez — pedido no meio de um envio vira um envio a mais no fim;
 * - ao esconder ou fechar a aba, envia na hora com `keepalive`;
 * - envio que falha tenta de novo no próximo pedido; `onStatusChange`
 *   avisa (`{ ok: false, error }` / `{ ok: true }`).
 */
export function createAutosave({
  world,
  trainer,
  client,
  onStatusChange = () => {},
  windowTarget = globalThis.window,
  documentTarget = globalThis.document,
}) {
  let lastSent = null
  let sending = false
  let sendAgain = false
  let scheduled = false
  let unsubscribe = null

  function takeSnapshot() {
    if (trainer.has(SaveRequested)) trainer.remove(SaveRequested)
    return JSON.stringify(snapshotSave(world, trainer))
  }

  async function flush() {
    scheduled = false
    if (sending) {
      sendAgain = true
      return
    }
    const body = takeSnapshot()
    if (body === lastSent) return

    sending = true
    const result = await client.send(body)
    sending = false
    if (result.ok) lastSent = body
    onStatusChange(result.ok ? { ok: true } : result)

    if (sendAgain) {
      sendAgain = false
      await flush()
    }
  }

  function request() {
    if (scheduled) return
    scheduled = true
    queueMicrotask(flush)
  }

  function flushOnLeave() {
    const body = takeSnapshot()
    // Sem esperar a resposta (a aba pode estar fechando): `lastSent` não
    // muda, então o próximo pedido reenvia se este não chegou.
    if (body !== lastSent) client.send(body, { keepalive: true })
  }

  const onVisibilityChange = () => {
    if (documentTarget?.visibilityState === 'hidden') flushOnLeave()
  }

  return {
    start() {
      unsubscribe = world.onAdd(SaveRequested, (entity) => {
        if (entity === trainer) request()
      })
      if (trainer.has(SaveRequested)) request()
      windowTarget?.addEventListener('pagehide', flushOnLeave)
      documentTarget?.addEventListener('visibilitychange', onVisibilityChange)
    },
    stop() {
      unsubscribe?.()
      unsubscribe = null
      windowTarget?.removeEventListener('pagehide', flushOnLeave)
      documentTarget?.removeEventListener(
        'visibilitychange',
        onVisibilityChange,
      )
    },
    /** Grava agora (se mudou) — devolve quando terminar. */
    flush,
  }
}
