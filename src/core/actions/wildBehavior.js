import { GAME_CONFIG } from '../gameConfig'
import {
  CryPulse,
  PathState,
  Rotation,
  Threat,
  WanderState,
  WildAwareness,
  WildBehavior,
} from '../traits'

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
 * `RETALIATE_LEASH_RADIUS`). Partindo para cima agora (não estava
 * perseguindo), mostra o emote de brava e solta o grito da espécie
 * (`CryPulse`, docs/features/063-revisao-da-ia-selvagem.md).
 */
export function perseguirJogador(entity, { provoked }) {
  const wasChasing = entity.get(WildBehavior).state === 'chase'
  entity.set(WildBehavior, { state: 'chase', provoked })
  resetPath(entity)
  if (wasChasing) return
  if (entity.has(WildAwareness)) {
    entity.set(WildAwareness, {
      state: 'reacted',
      target: null,
      emote: 'angry',
      emoteTimer: GAME_CONFIG.WILD_BEHAVIOR.PERCEPTION.ANGRY_DURATION,
    })
  }
  if (!entity.has(CryPulse)) entity.add(CryPulse)
}

/**
 * Selvagem decide fugir — a fuga clássica (063): corre para longe de
 * `fromPos` (quem estava mais perto; sem ele, para a frente) por
 * `LEAVE_RUN_TIME` com o emote de medo, e o `wildBehaviorSystem.js` tira ela
 * do mapa no fim. Saindo, não é alvo nem capturável.
 */
export function sairDoMapa(entity, pos, fromPos = null) {
  let dirX = fromPos ? pos.x - fromPos.x : 0
  let dirZ = fromPos ? pos.z - fromPos.z : 0
  const length = Math.hypot(dirX, dirZ)
  if (length > 1e-6) {
    dirX /= length
    dirZ /= length
  } else {
    const yaw = entity.get(Rotation)?.y ?? 0
    dirX = Math.sin(yaw)
    dirZ = Math.cos(yaw)
  }
  entity.set(WildBehavior, {
    state: 'leave',
    provoked: false,
    target: null,
    leaveDirX: dirX,
    leaveDirZ: dirZ,
    leaveTimer: GAME_CONFIG.WILD_BEHAVIOR.LEAVE_RUN_TIME,
  })
  if (entity.has(Threat)) entity.set(Threat, { entries: [] })
  if (entity.has(WildAwareness)) {
    entity.set(WildAwareness, {
      state: 'reacted',
      target: null,
      emote: 'fear',
      emoteTimer: 0,
    })
  }
  resetPath(entity)
}

/**
 * Selvagem percebeu `target` (063): para encarando, com a exclamação, até
 * decidir (`PERCEPTION.ALERT_TIME`).
 */
export function perceberJogador(entity, target) {
  entity.set(WildAwareness, {
    state: 'noticed',
    target,
    timer: GAME_CONFIG.WILD_BEHAVIOR.PERCEPTION.ALERT_TIME,
    emote: 'alert',
    emoteTimer: 0,
  })
}

/** Quem ela via sumiu da percepção antes de decidir: volta a não ter visto. */
export function perderInteresse(entity) {
  entity.set(WildAwareness, {
    state: 'unaware',
    target: null,
    timer: 0,
    emote: null,
    emoteTimer: 0,
  })
}

/** A pacífica decidiu ficar: a exclamação some e ela segue vagando. */
export function ficarTranquila(entity) {
  entity.set(WildAwareness, {
    state: 'reacted',
    target: null,
    timer: 0,
    emote: null,
    emoteTimer: 0,
  })
}

/**
 * Ninguém do lado do jogador por perto (`FORGET_RADIUS`): pode perceber de
 * novo.
 */
export function esquecerJogador(entity) {
  entity.set(WildAwareness, { state: 'unaware', target: null, timer: 0 })
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
 * A ameaça perde força com o tempo (Parte 3): cada entrada cai pela metade a
 * cada `THREAT_HALF_LIFE` segundos, e a que fica abaixo de `THREAT_MIN` sai —
 * quem para de bater deixa de ser o topo.
 */
export function decairAmeaca(entity, delta) {
  const { THREAT_HALF_LIFE, THREAT_MIN } = GAME_CONFIG.WILD_BEHAVIOR
  const entries = entity.get(Threat)?.entries
  if (!entries?.length || !(THREAT_HALF_LIFE > 0)) return
  const factor = 0.5 ** (delta / THREAT_HALF_LIFE)
  const next = entries
    .map((entry) => ({ entity: entry.entity, amount: entry.amount * factor }))
    .filter((entry) => entry.amount >= THREAT_MIN)
  entity.set(Threat, { entries: next })
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
