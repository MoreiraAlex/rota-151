import { SummonPulse } from '@/core/traits'
import { getSummonAudioEntries } from '@/view/registry/summonAudioRegistry'
import { pickRandomVariation } from '@/view/audio/pickRandomVariation'

/**
 * Toca o som de invocar — só pra entidades já registradas em
 * `summonAudioRegistry.js` (o treinador, se `sounds.summon` resolvido,
 * ver `useAnimatedModel.js`/`core/data/audio/summonSound.js`).
 *
 * Consome o pulso `SummonPulse` (`core/traits/components/party.js`,
 * adicionado por `partySummonSystem.js` exatamente no instante `effectAt`
 * — quando a `SummonedCreature` de fato nasce, não no disparo da ação):
 * se presente, toca uma variação aleatória (`pickRandomVariation`) e
 * REMOVE a tag — é este system quem tira, não `partySummonSystem`, mesmo
 * motivo de `jumpAudioSystem.js`/`Jumped` (a fase `simulation` pode rodar
 * mais de um tick fixo antes da próxima `presentation`). Sem buffer
 * carregado ainda, no-op — mas AINDA remove a tag.
 *
 * Vive na view. Fase: presentation, perto de `dashAudioSystem`/
 * `jumpAudioSystem` (mesma família — sem dependência real de ordem).
 */
export function summonAudioSystem() {
  for (const [entity, entry] of getSummonAudioEntries()) {
    if (!entity.has(SummonPulse)) continue
    entity.remove(SummonPulse)

    if (entry.buffers.length === 0) continue
    if (entry.audio.isPlaying) entry.audio.stop()
    entry.audio.setBuffer(pickRandomVariation(entry.buffers))
    entry.audio.play()
  }
}
