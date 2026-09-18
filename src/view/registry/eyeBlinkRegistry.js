/**
 * Registro entidade → lista de "unidades de piscar" (uma por entrada de
 * `species.model.texture[materialIndex]` que declarar `eyeStates` — ver
 * docs/features/023-estado-de-humor-e-piscar-de-olhos.md). Mesmo padrão de
 * `viewRegistry.js`/`footstepAudioRegistry.js`: `useAnimatedModel.js`
 * registra no `useEffect` (uma unidade por textura de olho carregada com
 * múltiplos estados), desregistra no cleanup; `view/systems/
 * eyeBlinkSystem.js` só lê/mexe.
 *
 * Cada unidade guarda:
 * - `texture`: o `THREE.Texture` já aplicado no material (mutar
 *   `.offset`/`.needsUpdate` nela reflete na hora, sem precisar re-clonar
 *   material nenhum).
 * - `repeat`: `{x, y}` já resolvido (tamanho de UMA célula do atlas) —
 *   usado pra converter `pan` (célula "aberto"/"fechado") em `offset` de
 *   verdade, mesma fórmula que `useAnimatedModel.js` já usa pro `pan`
 *   estático.
 * - `states`: o `eyeStates` da espécie (`{ [mood]: { open, closed } }`).
 * - `blink`: `{ minInterval, maxInterval, closedDuration }`.
 * - `phase`: `'open' | 'closed'` — fase atual do ciclo de piscar.
 * - `timer`: segundos até o próximo evento (trocar de fase).
 * - `lastMood`: humor no tick anterior — detecta troca pra reaplicar a
 *   célula "aberto" na hora, sem esperar o próximo ciclo (ver
 *   `eyeBlinkSystem.js`).
 */
const entries = new Map()

export function registerEyeBlink(entity, units) {
  entries.set(entity, units)
}

export function unregisterEyeBlink(entity) {
  entries.delete(entity)
}

export function getEyeBlinkUnits(entity) {
  return entries.get(entity)
}

/** Todas as entradas registradas — `eyeBlinkSystem.js` itera direto (só
 * entidades com olho de múltiplos estados configurado entram aqui). */
export function getEyeBlinkEntries() {
  return entries.entries()
}
