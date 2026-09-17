/**
 * Fábrica de registry entidade → áudio com UM array de variações só
 * (`{ audio, buffers, ...extra }`) — mesmo formato que
 * `voiceAudioRegistry.js` já usava (escrito antes desta fábrica existir,
 * não foi migrado pra não mexer em código já funcionando sem necessidade)
 * e que som de dash/pulo também precisam, ver docs/features/019-som-
 * ambiente-e-passos.md. Som de passo (`footstepAudioRegistry.js`)
 * continua com o próprio registry — tem DOIS arrays (`walk`/`run`), não
 * cabe nesse formato genérico.
 *
 * `register(entity, audio, extra)`: `extra` é mesclado na entrada (ex.:
 * `previousAction` pro som de dash rastrear a borda de subida da ação,
 * ver `dashAudioSystem.js`) — cada consumidor guarda o que precisar além
 * de `audio`/`buffers`. `unregister` para o áudio (se estiver tocando) e
 * desconecta, mesmo padrão de sempre.
 */
export function createSimpleAudioRegistry() {
  const entries = new Map()

  function register(entity, audio, extra = {}) {
    entries.set(entity, { audio, buffers: [], ...extra })
  }

  function unregister(entity) {
    const entry = entries.get(entity)
    if (!entry) return
    if (entry.audio.isPlaying) entry.audio.stop()
    entry.audio.disconnect()
    entries.delete(entity)
  }

  function get(entity) {
    return entries.get(entity)
  }

  function all() {
    return entries.entries()
  }

  return { register, unregister, get, all }
}
