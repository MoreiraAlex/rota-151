import { createSimpleAudioRegistry } from './createSimpleAudioRegistry'

/**
 * Registro entidade → áudio do ataque comum (ver `core/data/audio/
 * attackSound.js`). Mesmo caso de `jumpAudioRegistry.js`/
 * `summonAudioRegistry.js` — já existe um pulso de UM TICK pronto
 * (`AttackPulse`, `core/traits/components/attackEffect.js`), não precisa
 * de estado extra nenhum aqui, só `audio`/`buffers` (default da fábrica).
 */
const registry = createSimpleAudioRegistry()

export const registerAttackAudio = registry.register
export const unregisterAttackAudio = registry.unregister
export const getAttackAudioEntry = registry.get
export const getAttackAudioEntries = registry.all
