import { TEST_LEVEL } from '../data/testLevel'
import { Position, TrainingObject } from '../traits'

/**
 * Cria uma entidade (`TrainingObject` + `Position`) por objeto de treino do
 * nível (`TEST_LEVEL.trainingObjects`) — UMA VEZ, no início do jogo, como o
 * `wildCreatureSpawnSystem`. A colisão e o mesh vêm do mesmo dado, como
 * obstáculo comum (`core/data/testLevel.js`); a entidade existe só pra ser
 * consultada por proximidade (`findNearbyTrainingObject`,
 * `core/actions/training.js`). Ver docs/features/038-aprendizado-treino-e-
 * dominio-de-golpes.md.
 *
 * Headless. Fase: simulation.
 */
export function trainingObjectSpawnSystem(context, level = TEST_LEVEL) {
  const { world } = context
  if (world.queryFirst(TrainingObject)) return

  for (const { id, kind, position, size } of level.trainingObjects ?? []) {
    const [x, y, z] = position
    world.spawn(
      Position({ x, y, z }),
      TrainingObject({ id, kind, radius: Math.max(size[0], size[2]) / 2 }),
    )
  }
}
