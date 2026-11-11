import { resolveLocalTrainer } from '@/core/actions/owner'
import { EVENT_TYPES } from '@/core/events'
import { GAME_CONFIG } from '@/core/gameConfig'
import { noticeStore } from '../registry/noticeStore'
import {
  formatCombatantName,
  formatMoveName,
  formatPartyName,
} from '../shared/battleLogFormat'

const { LEVEL_UP_COLOR, MOVE_NOTICE_COLOR, STRAYED_COLOR } =
  GAME_CONFIG.FEEDBACK

/**
 * O aviso de um evento de progresso do treinador desta máquina, ou `null`:
 * subiu de nível (`leveledUp`), golpe novo apto (`moveUnlocked`) — aparece
 * mesmo com o Pokémon na bola — e o aviso de que recolher quem treina vai
 * parar o treino (`trainingRecallWarned`, só pela janela do segundo toque).
 */
export function resolveNotice(event) {
  if (event.type === EVENT_TYPES.LEVELED_UP) {
    return {
      kind: 'level',
      title: `${formatPartyName(event)} subiu para o nível ${event.level}!`,
      color: LEVEL_UP_COLOR,
    }
  }
  if (event.type === EVENT_TYPES.MOVE_UNLOCKED) {
    const moves = event.moveIds.map(formatMoveName).join(', ')
    return {
      kind: 'move',
      title: `${formatPartyName(event)} pode aprender ${moves}!`,
      detail: 'Treine num campo de treino de uma cidade.',
      color: MOVE_NOTICE_COLOR,
    }
  }
  if (event.type === EVENT_TYPES.TRAINING_RECALL_WARNED) {
    return {
      kind: 'warn',
      title: `${formatCombatantName(event.creature)} está treinando`,
      detail: 'Toque de novo para recolher — o treino vai parar.',
      color: STRAYED_COLOR,
      duration: GAME_CONFIG.MOVES.TRAINING.RECALL_CONFIRM_TIME,
    }
  }
  return null
}

/**
 * Avisos no canto da tela (docs/features/067-campo-de-treino-e-avisos-de-
 * nivel.md): cada evento de progresso do treinador desta máquina vira um
 * aviso (`resolveNotice`) no `noticeStore`, que `tools/hud/NoticeHud.jsx`
 * mostra; também conta o tempo pra eles saírem.
 *
 * Fase: presentation (lê `context.frameEvents`).
 */
export function noticeSystem(context) {
  const { world, delta } = context
  let trainer
  for (const event of context.frameEvents ?? []) {
    const notice = resolveNotice(event)
    if (!notice) continue
    trainer ??= resolveLocalTrainer(world)
    if (!trainer || event.trainer !== trainer) continue
    noticeStore.push(notice)
  }
  noticeStore.advance(delta)
}
