import { AnimationState } from '@/core/traits'
import { getAnimatedBonesEntry } from '@/view/registry/animationRegistry'
import { getFootstepAudioEntries } from '@/view/registry/footstepAudioRegistry'
import { pickRandomVariation } from '@/view/audio/pickRandomVariation'

// 2 batidas por ciclo de locomoção (esquerda/direita) — aproximação que
// funciona igual pra biped e quadrúpede sem saber nada do rig (ver
// docstring da função abaixo).
const BEATS_PER_CYCLE = 2

/**
 * Toca o som de passo no instante certo do ciclo de andar/correr — só pra
 * entidades já registradas em `footstepAudioRegistry.js` (toda entidade com som
 * de passo resolvido, ver `useAnimatedModel.js`/`core/data/audio/
 * footstepGroups.js`; itera o registry direto, sem query ECS pra filtrar
 * de novo).
 *
 * Detecção de batida: `view/registry/animationRegistry.js` já mantém,
 * por entidade, o relógio de animação (`entry.elapsed`) e a frequência do
 * clipe ativo (`entry.clips[id].speed`, mesmo valor que
 * `view/systems/animationSystem.js` usa pra tocar o clipe) — sem
 * conhecer o rig, dá pra aproximar a fase normalizada do ciclo de
 * passada com `phase = (elapsed * speed) mod 1` (0→1, uma volta = um
 * ciclo completo de perna) e dividir em `BEATS_PER_CYCLE` batidas
 * (`Math.floor(phase * BEATS_PER_CYCLE)`) — funciona igual pra bípede
 * (2 pernas) e quadrúpede (marcha em pares) sem dado novo nenhum, e já
 * lida com `AnimationState.direction === -1` (andar de costas/lock-on):
 * `elapsed` decresce nesse caso, mas o módulo normaliza os dois sentidos
 * (`((phase % 1) + 1) % 1`).
 *
 * Toca só na TROCA de batida (`previousBeat`, guardado no registry) —
 * nunca todo frame enquanto andando, senão o som spamaria a cada tick.
 * Fora de `'walk'`/`'run'`, reseta `previousBeat = -1`: reentrar em
 * andar/correr sempre dispara o primeiro passo na hora, em vez de ficar
 * preso comparando contra um beat de um ciclo antigo.
 *
 * Escolhe uma variação aleatória do array (`buffers.walk`/`buffers.run`,
 * populado aos poucos por `useAnimatedModel.js` conforme cada arquivo
 * termina de carregar) — evita o "clique" de tocar sempre o mesmo
 * arquivo. Sem nenhum buffer carregado ainda pro estado atual, no-op
 * silencioso (mesmo fallback gracioso de todo o resto do motor).
 *
 * Vive na view (mexe em nó Three de áudio). Fase: presentation, perto de
 * `animationSystem` (depende do relógio de animação já avançado neste
 * frame).
 */
export function footstepAudioSystem() {
  for (const [entity, entry] of getFootstepAudioEntries()) {
    const anim = entity.get(AnimationState)
    if (anim.id !== 'walk' && anim.id !== 'run') {
      entry.previousBeat = -1
      continue
    }

    const animatedEntry = getAnimatedBonesEntry(entity)
    const clip = animatedEntry?.clips[anim.id]
    if (!animatedEntry || !clip) continue

    const speed = clip.speed || 1
    const rawPhase = (animatedEntry.elapsed * speed) % 1
    const phase = (rawPhase + 1) % 1
    const beat = Math.floor(phase * BEATS_PER_CYCLE)

    if (beat === entry.previousBeat) continue
    entry.previousBeat = beat

    const buffers = entry.buffers[anim.id]
    if (!buffers || buffers.length === 0) continue

    const buffer = pickRandomVariation(buffers)
    if (entry.audio.isPlaying) entry.audio.stop()
    entry.audio.setBuffer(buffer)
    entry.audio.play()
  }
}
