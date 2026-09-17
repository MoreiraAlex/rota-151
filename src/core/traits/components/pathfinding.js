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
 * na hora, sem esperar o intervalo. `wasBlocked`: se `MovementBlocked`
 * (`characterPhysicsSystem.js`) já estava presente no tick anterior — usado
 * só pra detectar a BORDA DE SUBIDA (ficou travada agora, não já estava),
 * disparando um recálculo imediato uma vez só; sem isso, `repathTimer`
 * seria forçado a `0` TODO tick enquanto a tag persiste, refazendo o A*
 * (com `grid.clone()`, ~7 mil alocações pra uma grade de 60×60) até 60x/s
 * em vez de uma vez por episódio de bloqueio (achado no code review desta
 * feature).
 *
 * Dono de escrita: `creatureFollowSystem`, único lugar que calcula/avança
 * caminho.
 */
export const PathState = trait(() => ({
  waypoints: [],
  waypointIndex: 0,
  repathTimer: 0,
  wasBlocked: false,
}))
