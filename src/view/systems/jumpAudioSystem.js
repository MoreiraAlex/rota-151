import { Jumped } from '@/core/traits'
import { getJumpAudioEntries } from '@/view/registry/jumpAudioRegistry'
import { pickRandomVariation } from '@/view/audio/pickRandomVariation'

/**
 * Toca o som de pulo — só pra entidades já registradas em
 * `jumpAudioRegistry.js` (toda entidade com som de pulo resolvido, ver
 * `useAnimatedModel.js`/`core/data/audio/jumpSound.js`).
 *
 * Consome o pulso `Jumped` (`core/traits/components/physics.js`,
 * adicionado por `characterPhysicsSystem.js` exatamente no tick do pulo
 * de verdade): se presente, toca uma variação aleatória
 * (`pickRandomVariation`) e REMOVE a tag — é este system quem tira, não
 * `characterPhysicsSystem` (ver docstring do trait pro motivo: a fase
 * `simulation` pode rodar mais de um tick fixo antes da próxima
 * `presentation`, e limpar cedo demais podia apagar o pulso antes daqui
 * chegar a vê-lo). Sem buffer carregado ainda, no-op — mas AINDA remove a
 * tag (senão o pulo "atrasado" tocaria depois, fora de hora, assim que um
 * buffer chegasse).
 *
 * Vive na view. Fase: presentation, perto de `footstepAudioSystem`/
 * `voiceAudioSystem`/`dashAudioSystem` (mesma família — sem dependência
 * real de ordem).
 */
export function jumpAudioSystem() {
  for (const [entity, entry] of getJumpAudioEntries()) {
    if (!entity.has(Jumped)) continue
    entity.remove(Jumped)

    if (entry.buffers.length === 0) continue
    if (entry.audio.isPlaying) entry.audio.stop()
    entry.audio.setBuffer(pickRandomVariation(entry.buffers))
    entry.audio.play()
  }
}
