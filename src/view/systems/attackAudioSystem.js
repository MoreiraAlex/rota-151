import {
  ActionState,
  AttackPulse,
  resolveCreatureSpeciesId,
} from '@/core/traits'
import { getSpecies } from '@/core/data/species'
import { resolveCreatureAttack } from '@/core/battle/creatureAttack'
import { isAttackCharging } from '@/core/battle/attackTelegraph'
import { getAttackAudioEntries } from '@/view/registry/attackAudioRegistry'
import { pickRandomVariation } from '@/view/audio/pickRandomVariation'

/**
 * Toca o(s) som(ns) do ataque que a criatura disparou — só pra entidades já
 * registradas em `attackAudioRegistry.js` (toda criatura com som de ataque
 * resolvido em algum slot, ver `useAnimatedModel.js`/`core/data/audio/
 * attackSound.js`).
 *
 * Consome o pulso `AttackPulse` (`core/traits/components/attackEffect.js`,
 * adicionado por `creatureAttackSystem.js` exatamente no instante
 * `effectAt` — o momento do impacto, mesmo instante em que o VFX
 * `AttackEffect` nasce, com o `slot` do ataque que disparou): toca as
 * partes do som DAQUELE slot e REMOVE a tag — é este system quem tira, não
 * `creatureAttackSystem`, mesmo motivo de `jumpAudioSystem.js`/
 * `summonAudioSystem.js` (a fase `simulation` pode rodar mais de um tick
 * fixo antes da próxima `presentation`). Cada parte toca uma variação
 * aleatória (`pickRandomVariation`); sem buffer carregado ainda, no-op — mas
 * AINDA remove a tag.
 *
 * Partes com `delay` > 0 (ex.: o som do ALVO da Brasa, 0.5 s depois do som
 * do atacante) esperam em `entry.pending` e tocam quando o atraso, contado
 * pelo `delta` do frame, zera.
 *
 * Som de CARGA (`entry.charge`, `audio.chargeGroup` da skill): toca em
 * LOOP enquanto a criatura carrega o golpe daquele slot (`isAttackCharging` —
 * do disparo até o `effectAt`, a mesma janela do aviso no chão) e para quando
 * a carga acaba, no efeito ou numa interrupção (a ação some).
 *
 * Vive na view. Fase: presentation, perto de `dashAudioSystem`/
 * `jumpAudioSystem`/`summonAudioSystem` (mesma família — sem dependência
 * real de ordem).
 */
export function attackAudioSystem(context) {
  const delta = context?.delta ?? 0

  for (const [entity, entry] of getAttackAudioEntries()) {
    const chargingSlot = resolveChargingSlot(entity)
    for (const [slot, voice] of Object.entries(entry.charge)) {
      if (slot === chargingSlot) playChargeVoice(voice)
      else stopChargeVoice(voice)
    }

    if (entity.has(AttackPulse)) {
      const { slot } = entity.get(AttackPulse)
      entity.remove(AttackPulse)

      for (const voice of entry.voices[slot] ?? []) {
        if (voice.delay > 0) {
          entry.pending.push({ voice, remaining: voice.delay })
        } else {
          playVoice(voice)
        }
      }
    }

    for (let i = entry.pending.length - 1; i >= 0; i--) {
      const waiting = entry.pending[i]
      waiting.remaining -= delta
      if (waiting.remaining > 0) continue
      entry.pending.splice(i, 1)
      playVoice(waiting.voice)
    }
  }
}

function playVoice({ audio, buffers }) {
  if (buffers.length === 0) return
  if (audio.isPlaying) audio.stop()
  audio.setBuffer(pickRandomVariation(buffers))
  audio.play()
}

/** Slot do golpe que a criatura está CARREGANDO agora, ou `null`. */
function resolveChargingSlot(entity) {
  const action = entity.has(ActionState) ? entity.get(ActionState) : null
  if (action?.current !== 'attack') return null
  const attack = resolveCreatureAttack(
    getSpecies(resolveCreatureSpeciesId(entity)),
    action.pendingSlot,
  )
  return isAttackCharging(action, attack) ? action.pendingSlot : null
}

function playChargeVoice({ audio, buffers }) {
  if (audio.isPlaying || buffers.length === 0) return
  audio.setBuffer(pickRandomVariation(buffers))
  audio.setLoop(true)
  audio.play()
}

function stopChargeVoice({ audio }) {
  if (audio.isPlaying) audio.stop()
}
