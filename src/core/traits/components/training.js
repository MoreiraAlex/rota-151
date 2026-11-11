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
 * - `object` — entidade do boneco de treino (`TrainingObject`).
 * - `wait` — segundos até a próxima repetição.
 * - `resting` — sem energia, esperando recuperar.
 * - `repeating` — uma repetição (o golpe) em andamento.
 * - `elapsed` — segundos treinando no objeto desde a última repetição
 *   creditada (o treino conta tempo, `resolveTrainingHours`).
 * - `waiting` — no lugar, parada esperando a próxima repetição (energia,
 *   pausa ou recarga) — toca a animação de descanso (`rest`).
 * - `arrived` — chegou ao lugar do treino (o ponto fixo na frente do
 *   boneco, `resolveTrainingSpot`); sai dele se for empurrada além de
 *   `TRAINING.SPOT_LEAVE` e volta andando.
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
  arrived: false,
})

/**
 * Treino pedido para um Pokémon que estava na bola (docs/features/067-
 * campo-de-treino-e-avisos-de-nivel.md): o treinador o invoca rumo ao
 * boneco (`SummonRequest`) e, quando a criatura nasce, ela começa a treinar
 * `moveId` em `object` (já reservado — outro Pokémon não pega). Trait do
 * registro (`Pokemon`). `timeLeft`: quanto tempo (s) ainda espera a criatura
 * aparecer; zerou, desiste.
 *
 * Donos de escrita: `iniciarTreino` (põe) e `pendingTrainingSystem.js`
 * (passa para a criatura ou desiste).
 */
export const PendingTraining = trait({
  moveId: null,
  object: null,
  timeLeft: 0,
})

/**
 * Boneco de treino de um campo de treino das cidades (docs/features/067-
 * campo-de-treino-e-avisos-de-nivel.md), um por boneco dos sólidos do chunk
 * carregado (`TRAINING_DUMMY_KIND`, core/town/townPlan.js) — nasce e sai com
 * o chunk (`carregarBonecosDoChunk`/`descarregarBonecosDoChunk`). Só perto
 * de um deles a criatura pode treinar, um Pokémon por boneco.
 *
 * - `id` — o chunk e a posição do boneco nele.
 * - `chunkKey` — o chunk dele.
 * - `radius` — o alcance do colisor no chão: a criatura para na borda, não
 *   no centro.
 * - `model`, `yaw`, `scale` — como a view desenha o boneco (o modelo do
 *   pacote, o giro e o tamanho, os mesmos do sólido do chunk).
 * - `front` — para onde o boneco olha (rad, a entrada do campo): o lugar do
 *   treino fica desse lado (`resolveTrainingSpot`).
 */
export const TrainingObject = trait({
  id: '',
  chunkKey: '',
  radius: 0,
  model: '',
  yaw: 0,
  scale: 1,
  front: 0,
})

/**
 * Os chunks cujos bonecos de treino já viraram entidade (`loaded`, chaves)
 * e a revisão do conjunto de chunks vista por último. Trait do mundo.
 *
 * Dono de escrita: `trainingObjectStreamingSystem` e as actions de
 * carregar/descarregar (`core/actions/training.js`).
 */
export const TrainingObjectChunks = trait(() => ({
  loaded: new Set(),
  revision: -1,
}))
