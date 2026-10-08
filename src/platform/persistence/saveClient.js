import { migrateSave } from '@/core/save/saveFormat'

/**
 * Adapter de persistência (docs/features/044-salvar-o-jogo.md): fala com a
 * rota `/api/save`. O save que chega passa por `migrateSave` (migra e valida
 * com zod) antes de entrar no jogo. Nenhuma regra de jogo mora aqui.
 *
 * Toda chamada devolve `{ ok: true, ... }` ou `{ ok: false, error }` — sem
 * exceção pra fora, com a mensagem pronta pra mostrar.
 */
export function createSaveClient({
  fetchImpl = (...args) => fetch(...args),
  endpoint = '/api/save',
} = {}) {
  async function request(method, { body, keepalive = false } = {}) {
    try {
      const response = await fetchImpl(endpoint, {
        method,
        keepalive,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body,
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) {
        return { ok: false, error: describeFailure(response.status, data) }
      }
      return { ok: true, data }
    } catch {
      return { ok: false, error: 'Sem conexão com o servidor.' }
    }
  }

  return {
    /** `{ ok, save }` — `save` é `null` na primeira entrada. */
    async load() {
      const result = await request('GET')
      if (!result.ok) return result
      const raw = result.data?.save ?? null
      if (raw == null) return { ok: true, save: null }
      const migrated = migrateSave(raw)
      if (!migrated.ok) return { ok: false, error: migrated.error }
      return { ok: true, save: migrated.save }
    },

    /**
     * Grava o save (`body`: o save já em JSON). `keepalive` deixa o envio
     * terminar com a aba fechando.
     */
    async send(body, { keepalive = false } = {}) {
      const result = await request('PUT', { body, keepalive })
      return result.ok ? { ok: true } : result
    },

    async remove() {
      const result = await request('DELETE')
      return result.ok ? { ok: true } : result
    },
  }
}

function describeFailure(status, data) {
  if (status === 401) return 'Sua sessão expirou. Entre de novo.'
  if (data?.error) return data.error
  return `O servidor não respondeu direito (${status}).`
}
