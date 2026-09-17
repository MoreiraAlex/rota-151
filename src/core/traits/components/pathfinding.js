import { trait } from 'koota'

/**
 * Caminho calculado por `core/pathfinding.js` que uma `SummonedCreature`
 * está seguindo até o treinador — ver `creatureFollowSystem.js`. Trait AoS
 * (schema função, mesmo motivo de `Inventory`: `waypoints` é um array, não
 * um primitivo) — mutação sempre por `get` → objeto novo → `set`, nunca
 * mutar o array em cima do valor de uma query (mesma convenção já usada
 * pra `Inventory` em `playerActionSystem.js`).
 *
 * `waypoints`: pontos de mundo (`{x, z}`) restantes do caminho até o alvo,
 * em ordem, SEM o ponto de partida. `waypointIndex`: qual deles está sendo
 * perseguido agora. `repathTimer`: segundos até o próximo recálculo
 * permitido (throttle — recalcular todo tick é desperdício e deixa a
 * trajetória nervosa); começa em `0`, então a primeira ativação já calcula
 * na hora, sem esperar o intervalo.
 *
 * Dono de escrita: `creatureFollowSystem`, único lugar que calcula/avança
 * caminho.
 */
export const PathState = trait(() => ({
  waypoints: [],
  waypointIndex: 0,
  repathTimer: 0,
}))
