import * as THREE from 'three'
import { EVENT_TYPES } from '@/core/events'
import { GAME_CONFIG } from '@/core/gameConfig'
import { verticalClearance } from '@/core/physics/colliders'
import { CharacterController, Position } from '@/core/traits'
import { damageNumberPool } from '../vfx/damageNumberPool'

const { LIFETIME, CRIT_LIFETIME, HEAD_MARGIN, SPREAD } =
  GAME_CONFIG.FEEDBACK.DAMAGE_NUMBER
// Deslocamento lateral por número seguido: centro, esquerda, direita...
const SPREAD_PATTERN = [0, -1, 1]

const cameraRight = new THREE.Vector3()

/** Texto do número: inteiro, nunca menos que 1 num acerto. */
export function formatDamage(amount) {
  return String(Math.max(1, Math.round(amount)))
}

/**
 * Número de dano: pra cada `attackResolved` com `hit` em
 * `context.frameEvents`, nasce um número logo acima da cabeça do alvo
 * (topo da cápsula + `HEAD_MARGIN`) e vai subindo/sumindo
 * (`DamageNumbersView.jsx` desenha; este system só cuida do pool). Crítico
 * fica mais tempo (`CRIT_LIFETIME`) e ganha outro visual na view.
 * Números seguidos se afastam de lado (`SPREAD`, na direita da câmera)
 * pra golpes rápidos não empilharem.
 *
 * O dano de verdade continua com casas decimais no `Vitals` — só o texto
 * é arredondado (`formatDamage`).
 *
 * Fase: presentation.
 */
export function damageNumberSystem(context) {
  const { delta, frameEvents, camera } = context

  damageNumberPool.advance(delta)

  cameraRight.setFromMatrixColumn(camera.matrixWorld, 0)
  for (const event of frameEvents) {
    if (event.type !== EVENT_TYPES.ATTACK_RESOLVED) continue
    if (event.result !== 'hit') continue
    if (!event.target.has(Position)) continue

    const pos = event.target.get(Position)
    const body = event.target.get(CharacterController)
    const top = pos.y + verticalClearance(body) + HEAD_MARGIN
    const slot = damageNumberPool.spawn({
      position: { x: pos.x, y: top, z: pos.z },
      text: formatDamage(event.damage),
      critical: event.critical,
      lifetime: event.critical ? CRIT_LIFETIME : LIFETIME,
    })

    const side = SPREAD_PATTERN[slot.serial % SPREAD_PATTERN.length] * SPREAD
    slot.x += cameraRight.x * side
    slot.z += cameraRight.z * side
  }
}
