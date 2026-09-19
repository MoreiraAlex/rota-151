import { createSimpleAudioRegistry } from './createSimpleAudioRegistry'

/**
 * Registro entidade → áudio de invocar (ver `core/data/audio/summonSound.js`).
 * Mesmo caso de `jumpAudioRegistry.js` — já existe um pulso de UM TICK
 * pronto (`SummonPulse`, `core/traits/components/party.js`), não precisa
 * de estado extra nenhum aqui, só `audio`/`buffers` (default da fábrica).
 */
const registry = createSimpleAudioRegistry()

export const registerSummonAudio = registry.register
export const unregisterSummonAudio = registry.unregister
export const getSummonAudioEntry = registry.get
export const getSummonAudioEntries = registry.all
