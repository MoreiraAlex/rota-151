import { afterEach, describe, expect, it, vi } from 'vitest'
import { givePokemon, makeWorld } from '@/test/makeWorld'
import { fakeEventTarget } from '@/test/fakeEventTarget'
import { pedirSave } from '@/core/actions/save'
import { SaveRequested } from '@/core/traits'
import { createAutosave } from './autosave'

// Save automático (docs/features/044-salvar-o-jogo.md): grava o que o core
// pede, só se mudou, um envio por vez.
const worlds = []
afterEach(() => {
  while (worlds.length) worlds.pop().destroy()
})

const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

function setup({ send } = {}) {
  const { world, player } = makeWorld()
  worlds.push(world)
  const client = { send: vi.fn(send ?? (async () => ({ ok: true }))) }
  const windowTarget = fakeEventTarget()
  const documentTarget = fakeEventTarget({ visibilityState: 'visible' })
  const onStatusChange = vi.fn()
  const autosave = createAutosave({
    world,
    trainer: player,
    client,
    onStatusChange,
    windowTarget,
    documentTarget,
  })
  return {
    world,
    player,
    client,
    windowTarget,
    documentTarget,
    onStatusChange,
    autosave,
  }
}

describe('createAutosave', () => {
  it('um pedido do core vira um envio, e o pedido sai', async () => {
    const { player, client, autosave } = setup()
    autosave.start()

    pedirSave(player)
    await settle()

    expect(client.send).toHaveBeenCalledTimes(1)
    expect(JSON.parse(client.send.mock.calls[0][0]).version).toEqual(
      expect.any(Number),
    )
    expect(player.has(SaveRequested)).toBe(false)
  })

  it('não envia de novo sem mudança', async () => {
    const { player, client, autosave } = setup()
    autosave.start()

    pedirSave(player)
    await settle()
    pedirSave(player)
    await settle()

    expect(client.send).toHaveBeenCalledTimes(1)
  })

  it('envia de novo quando algo mudou', async () => {
    const { world, player, client, autosave } = setup()
    autosave.start()
    pedirSave(player)
    await settle()

    givePokemon(world, player, 'charmander')
    pedirSave(player)
    await settle()

    expect(client.send).toHaveBeenCalledTimes(2)
  })

  it('falhou: avisa e tenta de novo no próximo pedido', async () => {
    let fail = true
    const { player, client, onStatusChange, autosave } = setup({
      send: async () => (fail ? { ok: false, error: 'erro' } : { ok: true }),
    })
    autosave.start()

    pedirSave(player)
    await settle()
    expect(onStatusChange).toHaveBeenLastCalledWith({
      ok: false,
      error: 'erro',
    })

    fail = false
    pedirSave(player)
    await settle()
    expect(client.send).toHaveBeenCalledTimes(2)
    expect(onStatusChange).toHaveBeenLastCalledWith({ ok: true })
  })

  it('pedido no meio de um envio vira um envio a mais no fim', async () => {
    let release
    const { world, player, client, autosave } = setup({
      send: () =>
        new Promise((resolve) => {
          release = () => resolve({ ok: true })
        }),
    })
    autosave.start()
    pedirSave(player)
    await settle()

    givePokemon(world, player, 'charmander')
    pedirSave(player)
    await settle()
    expect(client.send).toHaveBeenCalledTimes(1)

    release()
    await settle()
    expect(client.send).toHaveBeenCalledTimes(2)
  })

  it('ao esconder a aba envia na hora, com keepalive', () => {
    const { client, documentTarget, autosave } = setup()
    autosave.start()

    documentTarget.visibilityState = 'hidden'
    documentTarget.dispatch('visibilitychange')

    expect(client.send).toHaveBeenCalledWith(expect.any(String), {
      keepalive: true,
    })
  })

  it('parado, não grava nem escuta a aba', async () => {
    const { player, client, windowTarget, documentTarget, autosave } = setup()
    autosave.start()
    autosave.stop()

    pedirSave(player)
    await settle()

    expect(client.send).not.toHaveBeenCalled()
    expect(windowTarget.count('pagehide')).toBe(0)
    expect(documentTarget.count('visibilitychange')).toBe(0)
  })
})
