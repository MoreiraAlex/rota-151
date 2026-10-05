import { trait } from 'koota'

/**
 * Criatura do time TREINANDO um golpe (docs/features/038-aprendizado-treino-
 * e-dominio-de-golpes.md) — pra aprender (golpe apto) ou pra dominar (golpe
 * equipado): anda até o objeto de treino e repete o golpe sozinha, gastando
 * energia.
 * Enquanto tiver isto, o comportamento de time (`partyBehaviorSystem`) não
 * age nela. O golpe sai pelo slot interno `'training'` (`TRAINING_SLOT`,
 * `core/battle/creatureAttack.js`) — com o domínio que o golpe já tem se
 * estiver equipado (treino de domínio), senão o mínimo.
 *
 * - `moveId` — golpe em treino.
 * - `object` — entidade do objeto de treino (`TrainingObject`).
 * - `wait` — segundos até a próxima repetição.
 * - `resting` — sem energia, esperando recuperar.
 * - `repeating` — uma repetição (o golpe) em andamento.
 * - `elapsed` — segundos treinando no objeto desde a última repetição
 *   creditada (o treino conta tempo, `resolveTrainingHours`).
 * - `waiting` — no alcance, parada esperando a próxima repetição (energia,
 *   pausa ou recarga) — toca a animação de descanso (`rest`).
 *
 * Donos de escrita: `iniciarTreino`/`pararTreino` (`core/actions/training.js`)
 * e `trainingSystem.js`.
 */
export const Training = trait({
  moveId: null,
  object: null,
  wait: 0,
  resting: false,
  repeating: false,
  waiting: false,
  elapsed: 0,
})

/**
 * Objeto de treino fixo do mapa (tronco, pedra, boneco), criado a partir de
 * `TEST_LEVEL.trainingObjects` por `trainingObjectSpawnSystem.js`. Só perto
 * de um deles a criatura pode treinar.
 */
export const TrainingObject = trait({
  id: '',
  kind: 'log',
  // metade do maior lado horizontal — a criatura para na borda, não no centro
  radius: 0,
})
