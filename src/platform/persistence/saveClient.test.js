import { describe, expect, it, vi } from 'vitest'
import { SAVE_VERSION } from '@/core/save/saveFormat'
import { createSaveClient } from './saveClient'

// Adapter da rota `/api/save` (docs/features/044-salvar-o-jogo.md).
const VALID_SAVE = {
  version: SAVE_VERSION,
  trainer: {
    heldItemId: null,
    inventory: { counts: {}, positions: {} },
    pokedex: { speciesIds: [], history: [] },
  },
  pokemon: [],
}

function respond(status, data) {
  return vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
  }))
}

describe('createSaveClient', () => {
  it('load: sem save, devolve null', async () => {
    const client = createSaveClient({
      fetchImpl: respond(200, { save: null }),
    })
    expect(await client.load()).toEqual({ ok: true, save: null })
  })

  it('load: save válido passa pela validação', async () => {
    const client = createSaveClient({
      fetchImpl: respond(200, { save: VALID_SAVE }),
    })
    expect(await client.load()).toEqual({ ok: true, save: VALID_SAVE })
  })

  it('load: save inválido vira erro', async () => {
    const client = createSaveClient({
      fetchImpl: respond(200, { save: { version: SAVE_VERSION } }),
    })
    const result = await client.load()
    expect(result.ok).toBe(false)
    expect(result.error).toEqual(expect.any(String))
  })

  it('sessão expirada e falha de rede viram erro com mensagem', async () => {
    const expired = createSaveClient({ fetchImpl: respond(401, null) })
    const offline = createSaveClient({
      fetchImpl: vi.fn(async () => {
        throw new TypeError('fetch failed')
      }),
    })

    for (const client of [expired, offline]) {
      const result = await client.load()
      expect(result.ok).toBe(false)
      expect(result.error).toEqual(expect.any(String))
    }
  })

  it('send: PUT com o corpo e o keepalive', async () => {
    const fetchImpl = respond(200, { ok: true })
    const client = createSaveClient({ fetchImpl })

    expect(await client.send('{}', { keepalive: true })).toEqual({ ok: true })
    expect(fetchImpl).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ method: 'PUT', body: '{}', keepalive: true }),
    )
  })

  it('send: erro do servidor vem com a mensagem dele', async () => {
    const client = createSaveClient({
      fetchImpl: respond(409, { error: 'recusado' }),
    })
    expect(await client.send('{}')).toEqual({ ok: false, error: 'recusado' })
  })
})
