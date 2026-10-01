import * as THREE from 'three'
import { EVENT_TYPES } from '@/core/events'
import { GAME_CONFIG } from '@/core/gameConfig'
import { getView } from '../registry/viewRegistry'
import { resolveFeedbackColor, resolveSide } from '../vfx/feedbackColors'

const { DURATION, INTENSITY } = GAME_CONFIG.FEEDBACK.HIT_FLASH

// hex → THREE.Color (a mesma cor se repete a cada brilho — não aloca de novo)
const colorCache = new Map()
function colorOf(hex) {
  let color = colorCache.get(hex)
  if (!color) {
    color = new THREE.Color(hex)
    colorCache.set(hex, color)
  }
  return color
}

// Quando mais de um acontecimento acende o MESMO alvo no mesmo frame, o de
// maior prioridade manda: dano > status negativo > status positivo.
const PRIORITY = { damage: 3, debuff: 2, buff: 1 }

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

function startFlash(entity, color) {
  const active = activeFlashes.get(entity)
  // Acerto durante um flash: só reinicia o tempo (e troca a cor do brilho) —
  // nunca recaptura a cor "base" já acesa, senão o modelo ficaria preso
  // brilhando.
  if (active) {
    active.remaining = DURATION
    active.color = color
    return
  }

  const root = getView(entity)
  if (!root) return

  activeFlashes.set(entity, {
    remaining: DURATION,
    color,
    slots: collectFlashSlots(entity, root),
  })
}

function applyFlash(slots, strength, color) {
  for (const { material, baseEmissive, baseIntensity } of slots) {
    material.emissive.copy(baseEmissive).lerp(color, strength)
    material.emissiveIntensity =
      baseIntensity + (INTENSITY - baseIntensity) * strength
  }
}

/**
 * Retorno visual de acerto: o modelo de quem foi atingido acende
 * (`material.emissive`) e apaga ao longo de `HIT_FLASH.DURATION`. A COR diz o
 * que aconteceu e de que lado (`GAME_CONFIG.FEEDBACK.FEEDBACK_COLORS`):
 * - tomou dano (`attackResolved` com `hit`, sem `status`): vermelho no
 *   oponente, rosa no aliado (o treinador e as criaturas do time);
 * - atributo baixou (`statStageChanged`, `delta < 0`): laranja / violeta;
 * - atributo subiu (`delta > 0`): verde / ciano.
 * Dano ganha de status quando os dois chegam juntos no mesmo alvo. Padrão
 * comum de jogo de ação ("hit flash"): deixa claro QUEM foi atingido, de QUE
 * jeito e QUANDO, sem esconder a textura. Consome `context.frameEvents`
 * (`core/events/`, drenado uma vez por frame pelo `GameLoop.jsx`) — não lê
 * `Vitals`, então regenerar/curar HP nunca dispara flash. Estado do flash é
 * só da view (tempo restante, cor e cor original), nada no ECS.
 * Fase: presentation.
 */
export function hitFlashSystem(context) {
  const { delta, frameEvents } = context

  // alvo → tipo do acontecimento mais forte deste frame
  const pending = new Map()
  const consider = (target, kind) => {
    const current = pending.get(target)
    if (!current || PRIORITY[kind] > PRIORITY[current]) {
      pending.set(target, kind)
    }
  }

  for (const event of frameEvents) {
    if (event.type === EVENT_TYPES.STAT_STAGE_CHANGED) {
      consider(event.target, event.delta < 0 ? 'debuff' : 'buff')
      continue
    }
    if (event.type !== EVENT_TYPES.ATTACK_RESOLVED) continue
    if (event.result !== 'hit') continue
    // golpe de status (sem dano): quem acende é o statStageChanged
    if (event.status) continue
    consider(event.target, 'damage')
  }

  for (const [target, kind] of pending) {
    startFlash(target, colorOf(resolveFeedbackColor(kind, resolveSide(target))))
  }

  for (const [entity, flash] of activeFlashes) {
    flash.remaining -= delta
    const strength = Math.max(0, flash.remaining / DURATION)
    applyFlash(flash.slots, strength, flash.color)
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
