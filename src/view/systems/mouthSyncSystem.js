import { applyAnimationClip } from '@/core/animation/applyAnimationClip'
import { getVoiceAudioEntry } from '@/view/registry/voiceAudioRegistry'
import { getMouthSyncEntries } from '@/view/registry/mouthSyncRegistry'

/**
 * Toca a animação de boca (`species.clips.cry`) exatamente enquanto o
 * ÁUDIO de vocalização (`sounds.voice`) está tocando de verdade — não um
 * temporizador próprio, lê `audio.isPlaying` direto do registro de voz
 * (`voiceAudioRegistry.js`) pra nunca dessincronizar do som (ver docs/
 * features/023-estado-de-humor-e-piscar-de-olhos.md, seção "Boca
 * sincronizada com o grito").
 *
 * Só escreve nos ossos de `entry.bones` (SUBCONJUNTO já resolvido em
 * `useAnimatedModel.js` — cabeça/queixo/antenas, tipicamente) enquanto o
 * áudio está tocando; parado (ou sem entrada de voz correspondente — ver
 * `getVoiceAudioEntry`, `undefined` cai em "não tocando", no-op gracioso),
 * simplesmente NÃO escreve nada nesses ossos neste frame — quem faz isso
 * de novo é `animationSystem.js` (roda ANTES, na fase presentation, ver
 * `registerSystems.js`) com o clipe normal de idle/walk/run, então o grito
 * "solta" a boca e ela volta a seguir a animação de corpo padrão sozinha,
 * sem esse system precisar reverter nada.
 *
 * Relógio PRÓPRIO (`entry.elapsed`, não o relógio compartilhado de
 * `animationRegistry.js`) — reinicia do zero toda vez que o áudio começa
 * (borda de subida de `isPlaying`, `entry.wasPlaying`), pra sempre tocar o
 * gesto de grito do início, mesmo que dois gritos aconteçam próximos.
 *
 * Vive na view (mexe em osso Three). Fase: presentation, DEPOIS de
 * `animationSystem` (senão este escreveria por cima do overlay no mesmo
 * frame) — sem dependência de ordem estrita com `voiceAudioSystem`
 * (`audio.isPlaying` já reflete o `.play()` chamado em qualquer tick
 * anterior, uma vocalização dura muitos frames).
 */
export function mouthSyncSystem(context) {
  const { delta } = context

  for (const [entity, entry] of getMouthSyncEntries()) {
    const voice = getVoiceAudioEntry(entity)
    const isPlaying = voice?.audio.isPlaying ?? false

    if (isPlaying && !entry.wasPlaying) {
      entry.elapsed = 0
    }
    entry.wasPlaying = isPlaying

    if (!isPlaying) continue

    entry.elapsed += delta
    applyAnimationClip(
      entry.clip,
      entry.bones,
      entry.elapsed,
      entry.clip.speed || 1,
    )
  }
}
