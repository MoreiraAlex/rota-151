import { getVoiceAudioEntries } from '@/view/registry/voiceAudioRegistry'
import { pickRandomVariation } from '@/view/audio/pickRandomVariation'

/**
 * Toca a vocalização periódica de cada entidade já registrada em
 * `view/registry/voiceAudioRegistry.js` (toda entidade com `sounds.voice`
 * resolvido, ver `useAnimatedModel.js`/`core/data/audio/voiceSound.js`;
 * itera o registry direto, sem query ECS pra filtrar de novo).
 *
 * Diferente do som de passo (sincronizado com a fase do ciclo de andar/
 * correr), este é puramente por TEMPO: `entry.timer` conta em segundos
 * até a próxima vocalização, decrescido a cada frame por `delta`. Ao
 * chegar em zero (e já ter pelo menos 1 buffer carregado), toca uma
 * variação aleatória de `entry.buffers` e sorteia um novo `timer` entre
 * `minInterval`/`maxInterval` — cada vocalização tem um intervalo
 * diferente, não um período fixo, pra várias entidades no mesmo grupo
 * não soarem em coro sincronizado.
 *
 * O timer só conta ENQUANTO a entidade não está com uma vocalização em
 * andamento (`!audio.isPlaying`) — deixa a vocalização atual terminar
 * naturalmente em vez de cortar no meio, e o intervalo até a próxima só
 * começa a valer depois que a anterior já acabou.
 *
 * Vive na view (mexe em nó Three de áudio). Fase: presentation, perto de
 * `footstepAudioSystem` (mesma família — sem dependência de ordem real
 * entre os dois).
 */
export function voiceAudioSystem(context) {
  const { delta } = context

  for (const [, entry] of getVoiceAudioEntries()) {
    if (entry.audio.isPlaying) continue

    entry.timer -= delta
    if (entry.timer > 0) continue

    if (entry.buffers.length === 0) continue
    const buffer = pickRandomVariation(entry.buffers)
    entry.audio.setBuffer(buffer)
    entry.audio.play()

    entry.timer =
      entry.minInterval +
      Math.random() * (entry.maxInterval - entry.minInterval)
  }
}
