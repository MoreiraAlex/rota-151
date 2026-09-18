import { trait } from 'koota'

/**
 * Estado de "vagar sozinho" de uma `WildCreature` — ver `wildWanderSystem.js`.
 * Só primitivos (SoA normal, ao contrário de `PathState`, que guarda um
 * array e por isso precisa ser lido/escrito por fora da query — ver
 * docstring de lá).
 *
 * `homeX`/`homeZ`: posição de spawn — o destino sorteado nunca fica mais
 * longe dela que `GAME_CONFIG.WILD_WANDER.RADIUS`, pra cada criatura vagar
 * por uma área local em vez de atravessar o mapa inteiro.
 *
 * `targetX`/`targetZ`: destino atual sendo perseguido.
 *
 * `pauseTimer`: segundos restantes parada antes de sortear o próximo
 * destino (some da imersão se toda criatura andar sem parar nunca).
 *
 * `chaseTimer`: segundos perseguindo o destino atual sem chegar — trava de
 * segurança: se um destino sorteado cair num lugar praticamente
 * inalcançável (ex.: dentro de uma reentrância que o pathfinding não prevê,
 * mesmo caso de `MovementBlocked` em `creatureFollowSystem.js`), a criatura
 * não fica empurrando pra sempre contra o mesmo obstáculo — passado
 * `MAX_CHASE_TIME`, desiste e sorteia outro destino, mesmo sem ter chegado.
 *
 * Dono de escrita: `wildWanderSystem`, único lugar que decide/avança o
 * destino.
 */
export const WanderState = trait({
  homeX: 0,
  homeZ: 0,
  targetX: 0,
  targetZ: 0,
  pauseTimer: 0,
  chaseTimer: 0,
})
