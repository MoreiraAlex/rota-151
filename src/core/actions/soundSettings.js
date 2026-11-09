import { VOLUME_KEYS } from '../data/audio/mixer'
import { MUSIC_FREQUENCIES } from '../data/audio/musicTracks'
import { SoundSettings } from '../traits'

/**
 * Ajustes de som do jogador (docs/features/065-sons-do-mundo.md).
 */

/**
 * Põe o volume `key` (`master` ou um canal) do `trainer` em `value`, preso
 * entre 0 e 1. Chave desconhecida ou valor que não é número não muda nada.
 * Devolve se mudou.
 */
export function definirVolume(trainer, key, value) {
  if (!trainer?.has?.(SoundSettings)) return false
  if (!VOLUME_KEYS.includes(key) || !Number.isFinite(value)) return false
  const volume = Math.min(1, Math.max(0, value))
  const current = trainer.get(SoundSettings)
  if (current[key] === volume) return false
  trainer.set(SoundSettings, { ...current, [key]: volume })
  return true
}

/**
 * Põe a frequência da música do `trainer` em `frequency` (uma de
 * `MUSIC_FREQUENCIES`). Valor desconhecido não muda nada. Devolve se mudou.
 */
export function definirFrequenciaDaMusica(trainer, frequency) {
  if (!trainer?.has?.(SoundSettings)) return false
  if (!Object.hasOwn(MUSIC_FREQUENCIES, frequency)) return false
  const current = trainer.get(SoundSettings)
  if (current.musicFrequency === frequency) return false
  trainer.set(SoundSettings, { ...current, musicFrequency: frequency })
  return true
}
