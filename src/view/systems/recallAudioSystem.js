import { RecallPulse } from '@/core/traits'
import { getRecallAudioEntries } from '@/view/registry/recallAudioRegistry'
import { pickRandomVariation } from '@/view/audio/pickRandomVariation'

/**
 * Toca o som de recolher — mesmo mecanismo de `summonAudioSystem.js`, só
 * que consumindo `RecallPulse` em vez de `SummonPulse` (adicionado no
 * `effectAt` de `recall` — quando a `SummonedCreature` é de fato
 * destruída).
 *
 * Vive na view. Fase: presentation, perto de `summonAudioSystem` (mesma
 * família — sem dependência real de ordem).
 */
export function recallAudioSystem() {
  for (const [entity, entry] of getRecallAudioEntries()) {
    if (!entity.has(RecallPulse)) continue
    entity.remove(RecallPulse)

    if (entry.buffers.length === 0) continue
    if (entry.audio.isPlaying) entry.audio.stop()
    entry.audio.setBuffer(pickRandomVariation(entry.buffers))
    entry.audio.play()
  }
}
