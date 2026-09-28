// Humor parecido pra usar quando a espécie não declara o próprio — hoje
// só desmaiada (`'faint'`, `desmaiar` em `core/actions/faint.js`), que
// fica melhor de olho fechado (`'sleeping'`) do que no primeiro estado
// (normalmente aberto).
const MOOD_FALLBACK = { faint: 'sleeping' }

/**
 * Qual estado de olho (`{ open, closed }`) usar pro humor atual (`Mood`),
 * dentro do `eyeStates` da espécie (ver docs/features/023-estado-de-humor-
 * e-piscar-de-olhos.md). A espécie pode não declarar toda chave possível
 * de `Mood.state` (ex.: só `awake`/`sleeping`) — tenta o humor parecido
 * (`MOOD_FALLBACK`) e, sem ele, cai no PRIMEIRO estado declarado em vez
 * de travar sem reagir.
 *
 * Única regra, usada no olho inicial ao carregar o modelo
 * (`useAnimatedModel.js`) e no piscar (`eyeBlinkSystem.js`) — antes eram
 * duas cópias mantidas em sincronia na mão.
 */
export function resolveEyeState(states, mood) {
  return (
    states[mood] ??
    states[MOOD_FALLBACK[mood]] ??
    states[Object.keys(states)[0]]
  )
}
