import { GAME_CONFIG } from '../gameConfig'
import { resolveDashCost } from './stamina'

/**
 * Velocidade do dash em `elapsed` segundos: `SPEED` constante e, nos
 * últimos `EASE_OUT_TIME` segundos (no máximo metade de `DURATION`), desce
 * suave (smoothstep) até `exitSpeed` — chega EXATAMENTE nela no fim, então
 * a passagem pro `movementSystem` não tem salto de velocidade. Pedido do
 * usuário: a queda brusca de 12 m/s pra 0-4 m/s num tick, no fim do dash,
 * dava sensação de freio de mão.
 */
export function resolveDashSpeed(dash, elapsed, exitSpeed) {
  const ease = Math.min(dash.EASE_OUT_TIME ?? 0, dash.DURATION / 2)
  const easeStart = dash.DURATION - ease
  if (ease <= 0 || elapsed <= easeStart) return dash.SPEED

  const t = Math.min(1, (elapsed - easeStart) / ease)
  const smooth = t * t * (3 - 2 * t)
  return dash.SPEED + (exitSpeed - dash.SPEED) * smooth
}

/**
 * Começa um dash na direção horizontal (`dirX`, `dirZ`, unitária): trava a
 * ação, paga o custo (`resolveDashCost`: `STAMINA_COST` × vida baixa) e
 * reinicia o atraso da regeneração. Regra única do jogador (`playerActionSystem.js`) e da IA (`core/battle/aiMovement.js`)
 * — quem chama confere antes se pode (chão, energia, ação livre).
 */
export function iniciarDash(action, vitals, dirX, dirZ) {
  const DASH = GAME_CONFIG.PLAYER_ACTIONS.dash
  action.current = 'dash'
  action.elapsed = 0
  // Ver docstring de `ActionState.animationSpeed` — o clipe de dash toca
  // nesta velocidade em vez de um `speed` fixo no JSON do clipe.
  action.animationSpeed = DASH.DURATION > 0 ? 1 / DASH.DURATION : 1
  action.dirX = dirX
  action.dirZ = dirZ
  vitals.stamina -= resolveDashCost(vitals)
  vitals.staminaRegenDelay = vitals.staminaRegenDelayAfterUse
}

/**
 * Avança um dash em andamento: velocidade na direção travada
 * (`resolveDashSpeed`) e, no tick do fim, já a de saída (`exitSpeed`) e a
 * ação livre.
 */
export function avancarDash(action, vel, delta, exitSpeed) {
  const DASH = GAME_CONFIG.PLAYER_ACTIONS.dash
  action.elapsed += delta
  const done = action.elapsed >= DASH.DURATION
  const speed = done
    ? exitSpeed
    : resolveDashSpeed(DASH, action.elapsed, exitSpeed)
  vel.x = action.dirX * speed
  vel.z = action.dirZ * speed
  if (done) action.current = null
}
