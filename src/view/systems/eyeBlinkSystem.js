import { Fainted, Mood } from '@/core/traits'
import { getEyeBlinkEntries } from '@/view/registry/eyeBlinkRegistry'
import { resolveEyeState } from '@/view/shared/eyeState'

function randomRange(min, max) {
  return min + Math.random() * (max - min)
}

// Mesma fórmula que `useAnimatedModel.js` já usa pro `pan` ESTÁTICO — uma
// célula do atlas vira offset de UV a partir do tamanho de uma célula
// (`repeat`) e de qual célula (`pan`, `{x, y}` em unidades de célula).
//
// Sem `needsUpdate`: o `offset` chega no shader pela matriz de UV
// (`texture.matrix`, atualizada pelo renderer a cada frame —
// `matrixAutoUpdate`), não pela imagem. `needsUpdate` reenviava a IMAGEM
// inteira do atlas pra GPU a cada piscada — e, com a imagem compartilhada
// entre as cópias (`clone()`, `useAnimatedModel.js`), a de todo mundo que
// usa o mesmo arquivo. Suspeito do olho do treinador "sumindo" às vezes.
function applyPan(texture, repeat, pan) {
  texture.offset.set((1 - repeat.x) / 2 + pan.x, (1 - repeat.y) / 2 + pan.y)
}

// Aplica a célula `phase` do humor atual em TODAS as unidades da entidade.
function applyPhase(units, mood, phase) {
  for (const unit of units) {
    const state = resolveEyeState(unit.states, mood)
    if (state) applyPan(unit.texture, unit.repeat, state[phase])
  }
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
 * Com mais de uma unidade na mesma entidade (uma textura por olho), o
 * relógio é um só — o da 1ª unidade (`phase`/`timer`/`lastMood`/`blink`
 * dela) — e cada troca vale pra todas: os olhos piscam juntos.
 *
 * Desmaiada (`Fainted`) não pisca: o olho fica parado na célula "aberto"
 * do humor dela (`'faint'`, ver `desmaiar`) e o relógio do piscar para —
 * ao acordar, continua de onde estava.
 *
 * Vive na view (mexe em propriedade de `THREE.Texture`). Fase:
 * presentation, perto de `footstepAudioSystem`/`voiceAudioSystem` (mesma
 * família de "efeito periódico por entidade").
 */
export function eyeBlinkSystem(context) {
  const { delta } = context

  for (const [entity, units] of getEyeBlinkEntries()) {
    if (units.length === 0) continue
    const mood = entity.get(Mood)?.state ?? 'awake'
    const fainted = entity.has(Fainted)
    // Um relógio só por entidade (o da 1ª unidade): com mais de uma
    // textura de olho (o treinador tem uma por olho), todas piscam JUNTAS
    // — cada uma com o próprio relógio sorteado, piscavam separadas.
    const clock = units[0]
    const moodChanged = mood !== clock.lastMood
    clock.lastMood = mood

    if (fainted) {
      if (moodChanged || clock.phase !== 'open') {
        applyPhase(units, mood, 'open')
        clock.phase = 'open'
      }
      continue
    }

    if (moodChanged && clock.phase === 'open') applyPhase(units, mood, 'open')

    clock.timer -= delta
    if (clock.timer > 0) continue

    if (clock.phase === 'open') {
      applyPhase(units, mood, 'closed')
      clock.phase = 'closed'
      clock.timer = clock.blink.closedDuration
    } else {
      applyPhase(units, mood, 'open')
      clock.phase = 'open'
      clock.timer = randomRange(
        clock.blink.minInterval,
        clock.blink.maxInterval,
      )
    }
  }
}
