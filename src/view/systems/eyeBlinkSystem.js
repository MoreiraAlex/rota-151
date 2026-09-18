import { Mood } from '@/core/traits'
import { getEyeBlinkEntries } from '@/view/registry/eyeBlinkRegistry'

function randomRange(min, max) {
  return min + Math.random() * (max - min)
}

// Mesma fórmula que `useAnimatedModel.js` já usa pro `pan` ESTÁTICO — uma
// célula do atlas vira offset de UV a partir do tamanho de uma célula
// (`repeat`) e de qual célula (`pan`, `{x, y}` em unidades de célula).
function applyPan(texture, repeat, pan) {
  texture.offset.set((1 - repeat.x) / 2 + pan.x, (1 - repeat.y) / 2 + pan.y)
  texture.needsUpdate = true
}

// Estados declarados por uma espécie (`eyeStates`) podem não incluir toda
// chave possível de `Mood.state` (ex.: espécie só tem `awake`/`sleeping`,
// mas por engano ou config futura `Mood.state` vira `'angry'`) — cai pro
// PRIMEIRO estado declarado em vez de travar sem reagir, mesmo fallback
// gracioso do resto do motor.
function resolveMoodState(states, mood) {
  return states[mood] ?? states[Object.keys(states)[0]]
}

/**
 * Avança o piscar de cada unidade registrada (`eyeBlinkRegistry.js`) —
 * alterna a célula do atlas entre "aberto"/"fechado" do humor ATUAL da
 * entidade (`Mood`, ver docs/features/023-estado-de-humor-e-piscar-de-
 * olhos.md), num ciclo por tempo: fica "aberto" por um intervalo sorteado
 * (`minInterval`-`maxInterval`, de novo a cada ciclo — mesmo raciocínio de
 * `voiceAudioSystem.js`, pra várias criaturas não piscarem em sincronia),
 * pisca "fechado" por `closedDuration` (curto, tipo 0.1-0.15s), volta pra
 * "aberto".
 *
 * Troca de humor NO MEIO de um "aberto" reflete NA HORA (não espera o
 * próximo ciclo) — `lastMood` detecta a troca; enquanto "fechado", só
 * reflete no próximo "aberto" (trocar de humor de olho fechado não faz
 * diferença visível mesmo).
 *
 * Vive na view (mexe em propriedade de `THREE.Texture`). Fase:
 * presentation, perto de `footstepAudioSystem`/`voiceAudioSystem` (mesma
 * família de "efeito periódico por entidade").
 */
export function eyeBlinkSystem(context) {
  const { delta } = context

  for (const [entity, units] of getEyeBlinkEntries()) {
    const mood = entity.get(Mood)?.state ?? 'awake'

    for (const unit of units) {
      const moodChanged = mood !== unit.lastMood
      unit.lastMood = mood

      if (moodChanged && unit.phase === 'open') {
        const state = resolveMoodState(unit.states, mood)
        if (state) applyPan(unit.texture, unit.repeat, state.open)
      }

      unit.timer -= delta
      if (unit.timer > 0) continue

      const state = resolveMoodState(unit.states, mood)
      if (!state) continue

      if (unit.phase === 'open') {
        applyPan(unit.texture, unit.repeat, state.closed)
        unit.phase = 'closed'
        unit.timer = unit.blink.closedDuration
      } else {
        applyPan(unit.texture, unit.repeat, state.open)
        unit.phase = 'open'
        unit.timer = randomRange(unit.blink.minInterval, unit.blink.maxInterval)
      }
    }
  }
}
