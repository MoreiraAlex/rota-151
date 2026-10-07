import {
  ActionState,
  AttackPulse,
  resolveCreatureSpeciesId,
} from '@/core/traits'
import { getSpecies } from '@/core/data/species'
import { resolveEntityAttack } from '@/core/battle/creatureAttack'
import { resolveAttackSoundKey } from '@/core/data/audio/attackSound'
import {
  isAttackCharging,
  isAttackPastEffect,
} from '@/core/battle/attackTelegraph'
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
 * Partes com `delay` > 0 (ex.: o som do ALVO tocando depois do som do
 * atacante) esperam em `entry.pending` e tocam quando o atraso, contado
 * pelo `delta` do frame, zera.
 *
 * Sons em LOOP (`entry.loops`, `resolveAttackLoopSounds`), pela fase de cada
 * um: o de CARGA (`audio.chargeGroup`) toca enquanto a criatura carrega o golpe
 * daquele slot (`isAttackCharging` — do disparo até o `effectAt`, a mesma
 * janela do aviso no chão); o da AÇÃO (`audio.actionGroup`) toca do `effectAt`
 * até a ação daquele slot acabar (`isAttackPastEffect` — cortado no fim da
 * `duration`). Os dois param numa interrupção (a ação some).
 *
 * Vive na view. Fase: presentation, perto de `dashAudioSystem`/
 * `jumpAudioSystem`/`summonAudioSystem` (mesma família — sem dependência
 * real de ordem).
 */
export function attackAudioSystem(context) {
  const delta = context?.delta ?? 0

  for (const [entity, entry] of getAttackAudioEntries()) {
    const playing = resolveLoopingKeys(entity)
    for (const [key, voice] of Object.entries(entry.loops)) {
      if (key === playing[voice.phase]) playLoopVoice(voice)
      else stopLoopVoice(voice)
    }

    if (entity.has(AttackPulse)) {
      const { slot, key } = entity.get(AttackPulse)
      entity.remove(AttackPulse)

      for (const voice of entry.voices[key || slot] ?? []) {
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

/**
 * Chave de som (`resolveAttackSoundKey`) de cada fase de som em loop agora:
 * `action` = o golpe em andamento já passado do `effectAt`, `charge` = o golpe
 * que está CARREGANDO (ou `null`).
 */
function resolveLoopingKeys(entity) {
  const action = entity.has(ActionState) ? entity.get(ActionState) : null
  if (action?.current !== 'attack') return { action: null, charge: null }
  const attack = resolveEntityAttack(
    entity,
    getSpecies(resolveCreatureSpeciesId(entity)),
    action.pendingSlot,
  )
  const key = resolveAttackSoundKey(attack)
  return {
    action: isAttackPastEffect(action, attack) ? key : null,
    charge: isAttackCharging(action, attack) ? key : null,
  }
}

function playLoopVoice({ audio, buffers }) {
  if (audio.isPlaying || buffers.length === 0) return
  audio.setBuffer(pickRandomVariation(buffers))
  audio.setLoop(true)
  audio.play()
}

function stopLoopVoice({ audio }) {
  if (audio.isPlaying) audio.stop()
}
