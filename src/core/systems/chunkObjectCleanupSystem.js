import { TEST_LEVEL } from '../data/testLevel'
import { removerObjetoSolto } from '../actions/chunks'
import { BallOnGround, DroppedFood, Position, Projectile } from '../traits'

/**
 * Objetos soltos no mundo — comida derrubada, Pokébola fechada no chão e
 * projéteis — somem quando o chunk onde estão descarrega, e não voltam
 * (docs/features/046-sistema-de-chunks.md). Personagens não: congelam
 * (`chunkFreezeSystem`).
 *
 * Headless. Fase: simulation, logo depois do `chunkStreamingSystem` (que
 * acabou de descarregar).
 */
export function chunkObjectCleanupSystem(context) {
  const { world } = context
  const { terrain } = TEST_LEVEL
  const isGone = ({ x, z }) => !terrain.isLoadedAt(x, z)

  const gone = [
    ...world
      .query(DroppedFood, Position)
      .filter((entity) => isGone(entity.get(Position))),
    ...world
      .query(Projectile, Position)
      .filter((entity) => isGone(entity.get(Position))),
    ...world
      .query(BallOnGround)
      .filter((entity) => isGone(entity.get(BallOnGround))),
  ]

  // Fora da iteração: destruir no meio da query mexe nela.
  for (const entity of gone) removerObjetoSolto(entity)
}
