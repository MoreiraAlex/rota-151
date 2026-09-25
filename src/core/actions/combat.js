import { GAME_CONFIG } from '../gameConfig'
import { CombatMode, Mood } from '../traits'

/**
 * Coloca a criatura em modo combate (ou renova, se já estiver): o tempo
 * pra sair volta pro máximo (`COMBAT_MODE_TIMEOUT`). Só na ENTRADA o olho
 * vira `'angry'` — renovar não mexe no `Mood`, então quem trocou o humor
 * na mão (ex.: `DebugPanel`) no meio do combate não é sobrescrito a cada
 * golpe.
 */
export function entrarEmCombate(entity) {
  const timeLeft = GAME_CONFIG.BATTLE.COMBAT_MODE_TIMEOUT
  if (entity.has(CombatMode)) {
    entity.set(CombatMode, { timeLeft })
    return
  }

  entity.add(CombatMode({ timeLeft }))
  entity.set(Mood, { state: 'angry' })
}

/** Tira a criatura do modo combate e volta o olho pra `'awake'`. */
export function sairDeCombate(entity) {
  entity.remove(CombatMode)
  entity.set(Mood, { state: 'awake' })
}
