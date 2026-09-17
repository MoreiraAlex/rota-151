import { createSimpleAudioRegistry } from './createSimpleAudioRegistry'

/**
 * Registro entidade → áudio de pulo (ver `core/data/audio/jumpSound.js`).
 * Diferente de `dashAudioRegistry.js` (que precisa rastrear a borda de
 * subida de `ActionState.current`), pulo já tem um pulso de UM TICK
 * pronto (`Jumped`, `core/traits/components/physics.js`) — não precisa
 * de estado extra nenhum aqui, só `audio`/`buffers` (default da fábrica).
 */
const registry = createSimpleAudioRegistry()

export const registerJumpAudio = registry.register
export const unregisterJumpAudio = registry.unregister
export const getJumpAudioEntry = registry.get
export const getJumpAudioEntries = registry.all
