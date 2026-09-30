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
 * Detecção de batida: `animationSystem.js` escreve, por entidade, a fase
 * normalizada do clipe exibido (`entry.cyclePhase`, 0→1, uma volta = um
 * ciclo completo de perna) — do relógio procedural (`elapsed * speed`) ou
 * do tempo da animação embutida no `.glb` (`action.time / duration`), o
 * que estiver tocando. Sem conhecer o rig, divide em `BEATS_PER_CYCLE`
 * batidas (`Math.floor(phase * BEATS_PER_CYCLE)`) — funciona igual pra
 * bípede (2 pernas) e quadrúpede (marcha em pares), e já lida com
 * `AnimationState.direction === -1` (a fase continua em [0, 1)). Usa o
 * estado EXIBIDO (`entry.stateId`), não o lógico — enquanto o `end` de uma
 * sequência toca (levantar do desmaio), não é passo ainda.
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
 *
 * `entity.get(AnimationState)` pode devolver `undefined` — a entidade
 * pode já ter sido destruída no ECS (ex.: `applyRecall`,
 * `partySummonSystem.js`, roda na fase `simulation`, SÍNCRONA e ANTES da
 * `presentation` no mesmo frame) enquanto o registry ainda não foi
 * desregistrado: quem desregistra é o cleanup do `useEffect` em
 * `useAnimatedModel.js`, disparado quando `CreatureView` desmonta — e
 * isso só acontece no próximo commit do REACT, depois deste mesmo
 * `useFrame` já ter rodado simulation+presentation inteiros (bug real,
 * relatado jogando: "Cannot read properties of undefined (reading
 * 'id')" ao recolher uma criatura). Sem `anim`, trata como "não está
 * andando/correndo" — mesmo fallback gracioso de sempre, resolve sozinho
 * assim que o registry for limpo no frame seguinte.
 */
export function footstepAudioSystem() {
  for (const [entity, entry] of getFootstepAudioEntries()) {
    const anim = entity.get(AnimationState)
    const animatedEntry = anim && getAnimatedBonesEntry(entity)
    const stateId = animatedEntry?.stateId
    if (stateId !== 'walk' && stateId !== 'run') {
      entry.previousBeat = -1
      continue
    }

    const phase = animatedEntry.cyclePhase
    if (phase === null) continue
    const beat = Math.floor(phase * BEATS_PER_CYCLE)

    if (beat === entry.previousBeat) continue
    entry.previousBeat = beat

    const buffers = entry.buffers[stateId]
    if (!buffers || buffers.length === 0) continue

    const buffer = pickRandomVariation(buffers)
    if (entry.audio.isPlaying) entry.audio.stop()
    entry.audio.setBuffer(buffer)
    entry.audio.play()
  }
}
