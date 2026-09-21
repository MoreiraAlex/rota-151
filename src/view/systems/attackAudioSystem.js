import { AttackPulse } from '@/core/traits'
import { getAttackAudioEntries } from '@/view/registry/attackAudioRegistry'
import { pickRandomVariation } from '@/view/audio/pickRandomVariation'

/**
 * Toca o som do ataque comum — só pra entidades já registradas em
 * `attackAudioRegistry.js` (toda criatura com som de ataque resolvido,
 * ver `useAnimatedModel.js`/`core/data/audio/attackSound.js`).
 *
 * Consome o pulso `AttackPulse` (`core/traits/components/attackEffect.js`,
 * adicionado por `creatureAttackSystem.js` exatamente no instante
 * `effectAt` — o momento do impacto, mesmo instante em que o VFX
 * `AttackEffect` nasce): se presente, toca uma variação aleatória
 * (`pickRandomVariation`) e REMOVE a tag — é este system quem tira, não
 * `creatureAttackSystem`, mesmo motivo de `jumpAudioSystem.js`/
 * `summonAudioSystem.js` (a fase `simulation` pode rodar mais de um tick
 * fixo antes da próxima `presentation`). Sem buffer carregado ainda,
 * no-op — mas AINDA remove a tag.
 *
 * Vive na view. Fase: presentation, perto de `dashAudioSystem`/
 * `jumpAudioSystem`/`summonAudioSystem` (mesma família — sem dependência
 * real de ordem).
 */
export function attackAudioSystem() {
  for (const [entity, entry] of getAttackAudioEntries()) {
    if (!entity.has(AttackPulse)) continue
    entity.remove(AttackPulse)

    if (entry.buffers.length === 0) continue
    if (entry.audio.isPlaying) entry.audio.stop()
    entry.audio.setBuffer(pickRandomVariation(entry.buffers))
    entry.audio.play()
  }
}
