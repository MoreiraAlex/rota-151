/**
 * Registro entidade → áudio de vocalização periódica ("voz", ver
 * core/data/audio/voiceSound.js). Mesmo padrão de `footstepAudioRegistry.js`/
 * `animationRegistry.js`: `useAnimatedModel.js` registra no `useEffect`
 * (cria o `THREE.PositionalAudio`, já anexado ao grupo da entidade),
 * desregistra no cleanup; `view/systems/voiceAudioSystem.js` só lê.
 *
 * `buffers` começa vazio (`[]`) e é preenchido IN PLACE (`push`) conforme
 * cada variação termina de carregar (`loadAudioBuffer` é assíncrono) — o
 * system sempre lê o array mais recente sem precisar consultar o
 * registry de novo. `timer` conta em segundos até a PRÓXIMA vocalização
 * (sorteado de novo a cada vez, ver docstring de `voiceAudioSystem.js`).
 *
 * `immediate` (pedido explícito do usuário: uma criatura invocada já
 * vocaliza na hora, recolher não precisa de nada especial) começa o
 * `timer` em `0` em vez de sorteado — `voiceAudioSystem.js` já tem a
 * lógica de "toca assim que houver buffer carregado", então zerar o
 * timer de saída basta pra reaproveitar o mecanismo inteiro sem código
 * extra: a criatura vocaliza assim que a primeira variação terminar de
 * carregar, não espera um intervalo aleatório primeiro. Sem `immediate`
 * (ex.: o treinador, que nunca é "invocado"), o primeiro timer continua
 * sorteado normalmente, pra não vocalizar sozinho ao entrar no jogo.
 */
const entries = new Map()

export function registerVoiceAudio(
  entity,
  audio,
  { minInterval, maxInterval, immediate = false },
) {
  entries.set(entity, {
    audio,
    buffers: [],
    minInterval,
    maxInterval,
    timer: immediate
      ? 0
      : minInterval + Math.random() * (maxInterval - minInterval),
  })
}

export function unregisterVoiceAudio(entity) {
  const entry = entries.get(entity)
  if (!entry) return
  if (entry.audio.isPlaying) entry.audio.stop()
  entry.audio.disconnect()
  entries.delete(entity)
}

export function getVoiceAudioEntry(entity) {
  return entries.get(entity)
}

/** Todas as entradas registradas — `voiceAudioSystem.js` itera direto (só
 * entidades com som de voz configurado entram aqui, sem precisar de uma
 * query ECS pra filtrar de novo). */
export function getVoiceAudioEntries() {
  return entries.entries()
}
