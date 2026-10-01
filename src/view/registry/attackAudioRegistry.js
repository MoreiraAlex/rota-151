/**
 * Registro entidade → sons de ataque da criatura (ver `core/data/audio/
 * attackSound.js`). Diferente dos outros registros de áudio
 * (`createSimpleAudioRegistry.js`: um nó por entidade), uma criatura pode ter
 * VÁRIOS sons de ataque: um conjunto por slot (`primary`, `secondary1-3`) e,
 * em cada slot, uma ou mais PARTES (ex.: Brasa toca o som do atacante e,
 * depois, o do alvo) — cada parte é uma "voz" com o próprio nó de áudio,
 * porque duas partes podem se sobrepor no tempo e um nó só toca um buffer
 * por vez.
 *
 * Entrada: `{ voices, pending, charge }`.
 * - `voices`: `{ [slot]: [{ audio, delay, buffers }] }` — `audio` é o
 *   `THREE.PositionalAudio`, `delay` os segundos depois do impacto em que
 *   toca, `buffers` as variações já carregadas (preenchido IN PLACE conforme
 *   cada uma termina de carregar).
 * - `pending`: sons já disparados e esperando o atraso, `[{ voice,
 *   remaining }]` — estado do `attackAudioSystem.js`.
 * - `charge`: `{ [slot]: { audio, buffers } }` — o som de CARGA do slot
 *   (`resolveAttackChargeSounds`), em loop enquanto o golpe carrega; nó
 *   próprio, porque toca junto com os outros.
 */
const entries = new Map()

export function registerAttackAudio(entity, voices, charge = {}) {
  entries.set(entity, { voices, pending: [], charge })
}

export function unregisterAttackAudio(entity) {
  const entry = entries.get(entity)
  if (!entry) return
  const allVoices = [
    ...Object.values(entry.voices).flat(),
    ...Object.values(entry.charge),
  ]
  for (const { audio } of allVoices) {
    if (audio.isPlaying) audio.stop()
    audio.disconnect()
  }
  entries.delete(entity)
}

export function getAttackAudioEntry(entity) {
  return entries.get(entity)
}

export function getAttackAudioEntries() {
  return entries.entries()
}
