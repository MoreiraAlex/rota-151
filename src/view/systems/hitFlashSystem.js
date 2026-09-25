import * as THREE from 'three'
import { EVENT_TYPES } from '@/core/events'
import { GAME_CONFIG } from '@/core/gameConfig'
import { getView } from '../registry/viewRegistry'

const { DURATION, COLOR, INTENSITY } = GAME_CONFIG.FEEDBACK.HIT_FLASH
const FLASH_COLOR = new THREE.Color(COLOR)

// entity → { remaining, slots: [{ material, baseEmissive, baseIntensity }] }
const activeFlashes = new Map()
// entity → Set<Material> clonados por este system (dono do `.dispose()`).
const ownedMaterials = new Map()

/**
 * Garante materiais PRÓPRIOS da entidade antes de mexer no brilho:
 * `SkeletonUtils.clone` (`useAnimatedModel.js`) reusa o material entre
 * todas as instâncias do mesmo `.glb` — sem clonar, o flash acenderia
 * toda criatura da mesma espécie. Clona uma vez por entidade (no primeiro
 * acerto) e guarda o clone pra descartar quando a entidade sair de cena.
 */
function collectFlashSlots(entity, root) {
  let owned = ownedMaterials.get(entity)
  if (!owned) {
    owned = new Set()
    ownedMaterials.set(entity, owned)
  }

  const slots = []
  root.traverse((child) => {
    if (!child.isMesh) return

    const isArray = Array.isArray(child.material)
    const materials = (isArray ? child.material : [child.material]).map(
      (material) => {
        if (owned.has(material)) return material
        const clone = material.clone()
        owned.add(clone)
        return clone
      },
    )
    child.material = isArray ? materials : materials[0]

    for (const material of materials) {
      if (!material.emissive) continue
      slots.push({
        material,
        baseEmissive: material.emissive.clone(),
        baseIntensity: material.emissiveIntensity,
      })
    }
  })
  return slots
}

function startFlash(entity) {
  const active = activeFlashes.get(entity)
  // Acerto durante um flash: só reinicia o tempo — nunca recaptura a cor
  // "base" já acesa, senão o modelo ficaria preso brilhando.
  if (active) {
    active.remaining = DURATION
    return
  }

  const root = getView(entity)
  if (!root) return

  activeFlashes.set(entity, {
    remaining: DURATION,
    slots: collectFlashSlots(entity, root),
  })
}

function applyFlash(slots, strength) {
  for (const { material, baseEmissive, baseIntensity } of slots) {
    material.emissive.copy(baseEmissive).lerp(FLASH_COLOR, strength)
    material.emissiveIntensity =
      baseIntensity + (INTENSITY - baseIntensity) * strength
  }
}

/**
 * Retorno visual de acerto: o modelo de quem tomou dano acende
 * (`material.emissive`) e apaga ao longo de `HIT_FLASH.DURATION` —
 * `GAME_CONFIG.FEEDBACK.HIT_FLASH`. Padrão comum de jogo de ação ("hit
 * flash"): deixa claro QUEM foi atingido e QUANDO, sem esconder a textura.
 *
 * Consome `attackResolved` com `result: 'hit'` de `context.frameEvents`
 * (`core/events/`, drenado uma vez por frame pelo `GameLoop.jsx`) — não
 * lê `Vitals`, então regenerar/curar HP nunca dispara flash. Estado do
 * flash é só da view (tempo restante e cor original), nada no ECS.
 *
 * Fase: presentation.
 */
export function hitFlashSystem(context) {
  const { delta, frameEvents } = context

  for (const event of frameEvents) {
    if (event.type !== EVENT_TYPES.ATTACK_RESOLVED) continue
    if (event.result !== 'hit') continue
    startFlash(event.target)
  }

  for (const [entity, flash] of activeFlashes) {
    flash.remaining -= delta
    const strength = Math.max(0, flash.remaining / DURATION)
    applyFlash(flash.slots, strength)
    if (flash.remaining <= 0) activeFlashes.delete(entity)
  }

  // Entidade saiu de cena (recolhida/destruída): descarta os materiais que
  // este system clonou — `view/registry/viewRegistry.js` deixa de ter ela.
  for (const [entity, owned] of ownedMaterials) {
    if (getView(entity)) continue
    for (const material of owned) material.dispose()
    ownedMaterials.delete(entity)
    activeFlashes.delete(entity)
  }
}
