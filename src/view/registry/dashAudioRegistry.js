import { createSimpleAudioRegistry } from './createSimpleAudioRegistry'

/**
 * Registro entidade → áudio de dash (ver `core/data/audio/dashSound.js`).
 * `previousAction` (extra do registro) é o último `ActionState.current`
 * visto — `view/systems/dashAudioSystem.js` usa isso pra detectar a
 * BORDA DE SUBIDA de `'dash'` (tocar só no instante em que o dash começa,
 * não todo tick enquanto ele dura).
 */
const registry = createSimpleAudioRegistry()

export function registerDashAudio(entity, audio) {
  registry.register(entity, audio, { previousAction: null })
}

export const unregisterDashAudio = registry.unregister
export const getDashAudioEntry = registry.get
export const getDashAudioEntries = registry.all
