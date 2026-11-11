import { resolveLocalTrainer } from '@/core/actions/owner'
import { UI_SOUNDS } from '@/core/data/audio/uiSounds'
import { EVENT_TYPES } from '@/core/events'
import { playUiSound } from '../audio/uiSounds'

/**
 * Sons de aviso da progressão do time (docs/features/067-campo-de-treino-e-
 * avisos-de-nivel.md): subir de nível (`leveledUp`) e golpe novo apto
 * (`moveUnlocked`), só do treinador desta máquina — tocam mesmo com o
 * Pokémon na bola. No mesmo frame, o de golpe novo espera o de nível
 * terminar (`delayAfterLevelUp`); vários do mesmo tipo tocam uma vez só.
 *
 * Fase: presentation (lê `context.frameEvents`).
 */
export function levelNoticeAudioSystem(context) {
  const { world } = context
  let leveledUp = false
  let moveUnlocked = false
  let trainer

  for (const event of context.frameEvents ?? []) {
    const isLevel = event.type === EVENT_TYPES.LEVELED_UP
    const isMove = event.type === EVENT_TYPES.MOVE_UNLOCKED
    if (!isLevel && !isMove) continue
    trainer ??= resolveLocalTrainer(world)
    if (!trainer || event.trainer !== trainer) continue
    if (isLevel) leveledUp = true
    if (isMove) moveUnlocked = true
  }

  if (leveledUp) playUiSound(UI_SOUNDS.levelUp)
  if (moveUnlocked) {
    const sound = UI_SOUNDS.moveUnlocked
    playUiSound(sound, leveledUp ? sound.delayAfterLevelUp : 0)
  }
}
