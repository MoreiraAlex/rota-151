import { resolveLocalTrainer } from '@/core/actions/owner'
import { GAME_CONFIG } from '@/core/gameConfig'
import { Position, TrainingObject } from '@/core/traits'
import { noticeStore } from '../registry/noticeStore'

// Já mostrou a dica nesta sessão (estado de tela).
let shown = false

/** O `trainer` está perto de um boneco de treino (onde pode mandar treinar)? */
function isTrainerNearDummy(world, trainer) {
  const { START_RADIUS } = GAME_CONFIG.MOVES.TRAINING
  const pos = trainer.get(Position)
  if (!pos) return false
  return world.query(TrainingObject, Position).some((dummy) => {
    const dummyPos = dummy.get(Position)
    const { radius } = dummy.get(TrainingObject)
    return (
      Math.hypot(dummyPos.x - pos.x, dummyPos.z - pos.z) - radius <=
      START_RADIUS
    )
  })
}

/**
 * A dica do campo de treino (docs/features/067-campo-de-treino-e-avisos-de-
 * nivel.md): na primeira vez na sessão em que o treinador chega perto de um
 * boneco de treino, um aviso diz como treinar.
 *
 * Fase: presentation.
 */
export function trainingFieldHintSystem(context) {
  if (shown) return
  const { world } = context
  const trainer = resolveLocalTrainer(world)
  if (!trainer || !isTrainerNearDummy(world, trainer)) return
  shown = true
  noticeStore.push({
    kind: 'hint',
    title: 'Campo de treino',
    detail:
      'Segure o atalho de um Pokémon do time e escolha Treino: ele vem até um boneco e treina o golpe.',
    color: GAME_CONFIG.FEEDBACK.MOVE_NOTICE_COLOR,
  })
}
