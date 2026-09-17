/**
 * Registro entidade → áudio de passo. Mesmo padrão de `animationRegistry.js`/
 * `viewRegistry.js`: `useAnimatedModel.js` registra no `useEffect` (cria o
 * `THREE.PositionalAudio`, já anexado ao grupo da entidade), desregistra
 * no cleanup; `view/systems/footstepAudioSystem.js` só lê.
 *
 * `buffers.walk`/`buffers.run` começam vazios (`[]`) e são preenchidos IN
 * PLACE (mesmo array, `push`) conforme cada variação termina de carregar
 * (`loadAudioBuffer` é assíncrono) — o system sempre lê o array mais
 * recente sem precisar consultar o registry de novo. `previousBeat` é o
 * estado que o system usa pra detectar a TROCA de fase do ciclo de
 * passada (toca só na transição, não todo frame) — ver docstring de
 * `footstepAudioSystem.js`.
 */
const entries = new Map()

export function registerFootstepAudio(entity, audio) {
  entries.set(entity, {
    audio,
    buffers: { walk: [], run: [] },
    previousBeat: -1,
  })
}

export function unregisterFootstepAudio(entity) {
  const entry = entries.get(entity)
  if (!entry) return
  if (entry.audio.isPlaying) entry.audio.stop()
  entry.audio.disconnect()
  entries.delete(entity)
}

export function getFootstepAudioEntry(entity) {
  return entries.get(entity)
}

/** Todas as entradas registradas — `footstepAudioSystem.js` itera direto
 * (só entidades com som de passo configurado entram aqui, sem precisar de
 * uma query ECS pra filtrar de novo). */
export function getFootstepAudioEntries() {
  return entries.entries()
}
