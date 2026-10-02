import { trait } from 'koota'

/**
 * Caminho calculado por `core/pathfinding.js` que um personagem está
 * seguindo — a criatura do time até quem está no controle
 * (`creatureFollowSystem.js`) ou a selvagem vagando/perseguindo/fugindo
 * (`steerTowards`, `core/steering.js`). Trait AoS
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
 * (com `grid.clone()`, milhares de alocações) a cada tick
 * em vez de uma vez por episódio de bloqueio (achado no code review desta
 * feature).
 *
 * `target`: o destino FINAL (`{x, z}`) que a navegação está usando — o
 * ponto de onde `waypoints` foi calculado (onde vagar, quem perseguir, pra
 * onde fugir, quem seguir). `null` quando não está navegando rumo a nada
 * (caminho zerado, ou a do time só desviando de alguém). Só informativo —
 * o debug (`PathfindingDebugView.jsx`) desenha isso em vez de adivinhar o
 * alvo (adivinhar "quem está no controle" fazia a linha da selvagem
 * vagando apontar pro jogador entre um recálculo e outro).
 *
 * `gait`, `resting` e `separating`: só do `creatureFollowSystem` — a
 * marcha do tick anterior (`'stop'`/`'walk'`/`'run'`, ver
 * `resolveFollowGait`), se está descansando a energia (`resolveResting`,
 * `core/battle/aiEnergy.js`) e se, parada, está se afastando de alguém
 * perto demais. São a memória da histerese: sem elas a decisão era
 * refeita do zero todo tick e oscilava no limiar. `gait` começa em `'walk'` (decide só pela
 * distância no primeiro tick, como antes).
 *
 * Donos de escrita: `creatureFollowSystem` e `steerTowards` (calculam/
 * avançam o caminho) e as actions de `core/actions/wildBehavior.js`
 * (zeram ao trocar de estado).
 */
export const PathState = trait(() => ({
  waypoints: [],
  waypointIndex: 0,
  repathTimer: 0,
  wasBlocked: false,
  target: null,
  gait: 'walk',
  resting: false,
  separating: false,
}))
