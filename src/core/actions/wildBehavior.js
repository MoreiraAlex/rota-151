import { PathState, Threat, WanderState, WildBehavior } from '../traits'

// Troca de estado recalcula o caminho já no próximo tick (o alvo mudou).
// Objeto completo: `PathState` é trait de objeto — `set` substitui tudo.
function resetPath(entity) {
  entity.set(PathState, {
    waypoints: [],
    waypointIndex: 0,
    repathTimer: 0,
    wasBlocked: false,
    target: null,
  })
}

/**
 * Selvagem passa a perseguir o lado do jogador — QUEM, o
 * `wildBehaviorSystem.js` escolhe todo tick (ameaça, senão proximidade).
 * `provoked`: porque apanhou (usa o limite de perseguição maior,
 * `RETALIATE_LEASH_RADIUS`).
 */
export function perseguirJogador(entity, { provoked }) {
  entity.set(WildBehavior, { state: 'chase', provoked })
  resetPath(entity)
}

/** Selvagem passa a fugir do lado do jogador (de quem estiver mais perto). */
export function fugirDoJogador(entity) {
  entity.set(WildBehavior, { state: 'flee', provoked: false })
  resetPath(entity)
}

/**
 * Selvagem volta a vagar — a partir de ONDE ESTÁ (o `home` do vagar passa
 * a ser aqui), sem voltar andando até onde perseguiu/fugiu. Pausa um
 * instante antes de escolher o próximo destino. A luta acabou: sem alvo e
 * com a tabela de ameaça zerada (`Threat`).
 */
export function voltarAVagar(entity, pos) {
  entity.set(WildBehavior, { state: 'wander', provoked: false, target: null })
  if (entity.has(Threat)) entity.set(Threat, { entries: [] })
  entity.set(WanderState, {
    homeX: pos.x,
    homeZ: pos.z,
    targetX: pos.x,
    targetZ: pos.z,
    chaseTimer: 0,
  })
  resetPath(entity)
}

/**
 * Soma `amount` de ameaça de `attacker` na tabela da selvagem (`Threat`) —
 * quem mais causou dano nela vira o alvo dela (`resolveWildTarget`).
 */
export function registrarAmeaca(entity, attacker, amount) {
  if (attacker == null || !(amount > 0)) return
  const entries = entity.get(Threat)?.entries ?? []
  const existing = entries.find((entry) => entry.entity === attacker)
  const next = existing
    ? entries.map((entry) =>
        entry === existing
          ? { entity: attacker, amount: entry.amount + amount }
          : entry,
      )
    : [...entries, { entity: attacker, amount }]
  if (entity.has(Threat)) entity.set(Threat, { entries: next })
  else entity.add(Threat({ entries: next }))
}
