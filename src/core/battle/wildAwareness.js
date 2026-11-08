import { GAME_CONFIG } from '../gameConfig'
import { findPerceived, isPerceived } from './perception'
import { findNearest } from './combatTargets'
import { rollFlee } from './wildBehavior'

/**
 * O passo da percepção de uma selvagem neste tick
 * (docs/features/063-revisao-da-ia-selvagem.md) — o que ela faz agora, sem
 * mexer em nada (quem aplica é o `wildAwarenessSystem.js`):
 *
 * - `{ type: 'notice', target }` — percebeu `target` (exclamação, para e
 *   encara);
 * - `{ type: 'lose' }` — quem ela via sumiu da percepção antes de decidir;
 * - `{ type: 'wait', timer }` — continua encarando, com o tempo que falta;
 * - `{ type: 'chase' }` — hostil parte para cima (fim do alerta, ou alguém
 *   chegou a `AGGRO_RADIUS` — "perto demais");
 * - `{ type: 'leave', fromPos }` — pacífica foge (some do mapa), sorteada
 *   pela chance da espécie (`rollFlee`) no fim do alerta;
 * - `{ type: 'stay' }` — pacífica fica e volta a vagar;
 * - `{ type: 'forget' }` — já tinha reagido e ninguém está a
 *   `FORGET_RADIUS`: pode perceber de novo;
 * - `null` — nada muda.
 *
 * `step`: `{ awareness, behavior, pos, yaw, candidates, delta, species,
 * rng, isActive }`. `candidates` é o lado do jogador (`[{ entity, pos }]`,
 * `listPlayerSide`); `isActive(entity)` diz se quem ela via ainda está na
 * luta (`isActiveCombatant`). Só decide vagando: perseguindo ou saindo, a
 * percepção já reagiu.
 */
export function resolveAwarenessStep(step) {
  const { awareness, behavior, pos, yaw, candidates, delta } = step
  const { PERCEPTION, AGGRO_RADIUS } = GAME_CONFIG.WILD_BEHAVIOR
  const hostile = behavior.temperament === 'hostile'
  if (behavior.state !== 'wander') return null

  if (awareness.state === 'unaware') {
    const seen = findPerceived(pos, yaw, candidates)
    return seen ? { type: 'notice', target: seen.entity } : null
  }

  if (awareness.state === 'noticed') {
    const target = awareness.target
    const seen = target && candidates.find((c) => c.entity === target)
    if (!seen || !step.isActive(target) || !isPerceived(pos, yaw, seen.pos)) {
      return { type: 'lose' }
    }
    const timer = awareness.timer - delta
    const distance = Math.hypot(seen.pos.x - pos.x, seen.pos.z - pos.z)
    if (hostile) {
      return timer <= 0 || distance <= AGGRO_RADIUS
        ? { type: 'chase' }
        : { type: 'wait', timer }
    }
    if (timer > 0) return { type: 'wait', timer }
    return rollFlee(step.rng, step.species)
      ? { type: 'leave', fromPos: { x: seen.pos.x, z: seen.pos.z } }
      : { type: 'stay' }
  }

  // Já reagiu: a hostil volta para cima de quem chegar perto demais; todos
  // esquecem quando ninguém fica a `FORGET_RADIUS`.
  const nearest = findNearest(pos, candidates)
  if (hostile && nearest && nearest.distance <= AGGRO_RADIUS) {
    return { type: 'chase' }
  }
  if (!nearest || nearest.distance > PERCEPTION.FORGET_RADIUS) {
    return { type: 'forget' }
  }
  return null
}
