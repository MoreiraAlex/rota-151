import { ActionState } from '@/core/traits'
import { getDashAudioEntries } from '@/view/registry/dashAudioRegistry'
import { pickRandomVariation } from '@/view/audio/pickRandomVariation'

/**
 * Toca o som de dash no instante em que a ação começa — só pra entidades
 * já registradas em `dashAudioRegistry.js` (toda entidade com som de dash
 * resolvido, ver `useAnimatedModel.js`/`core/data/audio/dashSound.js`).
 *
 * `ActionState.current` fica `'dash'` durante toda a DURAÇÃO da ação
 * (`GAME_CONFIG.PLAYER_ACTIONS.dash.DURATION`, ~0.25s — vários ticks) —
 * detecta a BORDA DE SUBIDA (`previousAction` guardado no registro, mesmo
 * princípio de `previousBeat` em `footstepAudioSystem.js`) pra tocar só
 * uma vez por dash, não todo tick enquanto a ação dura.
 *
 * Escolhe uma variação aleatória (`pickRandomVariation`) a cada disparo.
 * Sem buffer carregado ainda, no-op silencioso.
 *
 * Vive na view. Fase: presentation, perto de `footstepAudioSystem`/
 * `voiceAudioSystem` (mesma família — sem dependência real de ordem).
 *
 * `entity.get(ActionState)` pode devolver `undefined` — a entidade pode
 * já ter sido destruída no ECS (ex.: recolhida) antes do registry ser
 * desregistrado (isso só acontece quando `CreatureView` desmonta, no
 * próximo commit do React — ver docstring de `footstepAudioSystem.js`
 * pro mesmo bug relatado jogando). `?.current` cai em `undefined`, que
 * nunca bate com `'dash'` — no-op gracioso, resolve sozinho no frame
 * seguinte quando o registry for limpo de verdade.
 */
export function dashAudioSystem() {
  for (const [entity, entry] of getDashAudioEntries()) {
    const current = entity.get(ActionState)?.current
    const justStarted = current === 'dash' && entry.previousAction !== 'dash'
    entry.previousAction = current
    if (!justStarted) continue

    if (entry.buffers.length === 0) continue
    if (entry.audio.isPlaying) entry.audio.stop()
    entry.audio.setBuffer(pickRandomVariation(entry.buffers))
    entry.audio.play()
  }
}
