'use client'

import { useTrait } from 'koota/react'
import { playerEntity } from '@/core/world/world'
import { SoundSettings } from '@/core/traits'
import {
  definirFrequenciaDaMusica,
  definirVolume,
  pedirSave,
} from '@/core/actions'
import { VOLUME_KEYS } from '@/core/data/audio/mixer'
import { MUSIC_FREQUENCIES } from '@/core/data/audio/musicTracks'

const LABELS = {
  master: 'Geral',
  music: 'Música',
  ambient: 'Ambiente',
  effects: 'Efeitos',
}

const FREQUENCY_LABELS = {
  rare: 'Pouca',
  normal: 'Normal',
  always: 'Sempre',
}

const PERCENT = 100

/**
 * Tela "Som" do menu de pausa (docs/features/065-sons-do-mundo.md): um
 * controle deslizante pro volume geral e um por canal, e a frequência da
 * música (quanto silêncio entre uma música e a próxima). Arrastar já muda
 * o som; soltar (ou escolher a frequência) pede um save, pra ficar na
 * conta.
 */
export function SoundSettingsPanel() {
  const settings = useTrait(playerEntity, SoundSettings)
  if (!settings) return null

  const save = () => pedirSave(playerEntity)

  return (
    <div className="space-y-3 text-xs">
      {VOLUME_KEYS.map((key) => {
        const percent = Math.round(settings[key] * PERCENT)
        return (
          <label key={key} className="block">
            <span className="flex justify-between text-white/80">
              <span>{LABELS[key]}</span>
              <span className="tabular-nums text-white/60">{percent}%</span>
            </span>
            <input
              type="range"
              min={0}
              max={PERCENT}
              step={1}
              value={percent}
              className="mt-1 w-full accent-white"
              onChange={(event) =>
                definirVolume(
                  playerEntity,
                  key,
                  Number(event.target.value) / PERCENT,
                )
              }
              onPointerUp={save}
              onKeyUp={save}
            />
          </label>
        )
      })}

      <div>
        <span className="text-white/80">Frequência da música</span>
        <div className="mt-1 grid grid-cols-3 gap-1">
          {Object.keys(MUSIC_FREQUENCIES).map((frequency) => (
            <button
              key={frequency}
              type="button"
              className={`rounded px-2 py-1 ${
                settings.musicFrequency === frequency
                  ? 'bg-white text-neutral-900'
                  : 'bg-white/10 text-white/80 hover:bg-white/20'
              }`}
              onClick={() => {
                if (definirFrequenciaDaMusica(playerEntity, frequency)) save()
              }}
            >
              {FREQUENCY_LABELS[frequency]}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
