import { createSimpleAudioRegistry } from './createSimpleAudioRegistry'

/**
 * Registro entidade → áudio de recolher (ver `core/data/audio/recallSound.js`).
 * Mesmo caso de `jumpAudioRegistry.js`/`summonAudioRegistry.js` — pulso de
 * UM TICK pronto (`RecallPulse`), sem estado extra.
 */
const registry = createSimpleAudioRegistry()

export const registerRecallAudio = registry.register
export const unregisterRecallAudio = registry.unregister
export const getRecallAudioEntry = registry.get
export const getRecallAudioEntries = registry.all
