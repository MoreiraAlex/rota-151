import * as THREE from 'three'

/**
 * Onde ficam as luzes dos postes (docs/features/069-revisao-do-bioma-
 * cidade.md): o poste é qualquer objeto da cidade cujo modelo tem uma parte
 * que acende à noite (`part.glow`, o vidro). A luz fica no meio dessa parte.
 */

// O meio (no espaço do modelo) das partes que acendem, por modelo; `null`
// sem parte acesa.
const glowCenters = new WeakMap()

/** O meio das partes que acendem do `model` (m do modelo), ou `null`. */
export function glowCenterOf(model) {
  if (!model) return null
  if (glowCenters.has(model)) return glowCenters.get(model)
  const box = new THREE.Box3()
  for (const part of model.parts) {
    if (!part.glow) continue
    part.geometry.computeBoundingBox()
    box.union(part.geometry.boundingBox)
  }
  const center = box.isEmpty() ? null : box.getCenter(new THREE.Vector3())
  glowCenters.set(model, center)
  return center
}

/**
 * Os `count` postes mais perto de `from` (no plano) entre os objetos de
 * `chunks` (`chunk.solids.buildings`), já com o ponto da luz no mundo: o
 * meio do vidro, girado e no tamanho do objeto. Do mais perto ao mais
 * longe.
 *
 * @param {object[]} chunks
 * @param {Record<string, object>} models - `models.lgpe`
 * @param {{ x: number, z: number }} from
 * @param {number} count
 * @returns {{ x: number, y: number, z: number, distance: number }[]}
 */
export function nearestLampLights(chunks, models, from, count) {
  const found = []
  for (const chunk of chunks) {
    for (const building of chunk.solids?.buildings ?? []) {
      const center = glowCenterOf(models[building.model])
      if (!center) continue
      const { scale } = building
      const yaw = building.yaw ?? 0
      const cos = Math.cos(yaw)
      const sin = Math.sin(yaw)
      // O giro em Y do three (o mesmo do `setInstance`).
      const x = building.x + (center.x * cos + center.z * sin) * scale
      const z = building.z + (-center.x * sin + center.z * cos) * scale
      found.push({
        x,
        y: building.y + center.y * scale,
        z,
        distance: Math.hypot(x - from.x, z - from.z),
      })
    }
  }
  return found.sort((a, b) => a.distance - b.distance).slice(0, count)
}

/** O que identifica um poste (a posição da luz dele). */
export const lampKeyOf = ({ x, z }) => `${x.toFixed(2)},${z.toFixed(2)}`

/**
 * Os postes de cada luz (`slots`, uma por luz: `{ lamp, level }`, com
 * `level` de 0 a 1 — o quanto ela está acesa), refeitos para os postes
 * `wanted` (os mais perto): a luz cujo poste segue entre eles fica nele; a
 * que perdeu o poste vai apagando (`target` 0) e só fica livre apagada;
 * as livres pegam os postes que sobraram (`target` 1, acendendo do zero).
 * Não mexe em `slots`.
 *
 * @param {{ lamp: object | null, level: number }[]} slots
 * @param {object[]} wanted - de `nearestLampLights`
 * @returns {{ lamp: object | null, level: number, target: number }[]}
 */
export function assignLampSlots(slots, wanted) {
  const wantedByKey = new Map(wanted.map((lamp) => [lampKeyOf(lamp), lamp]))
  const placed = new Set()
  const next = slots.map((slot) => {
    if (!slot.lamp) return { lamp: null, level: 0, target: 0 }
    const key = lampKeyOf(slot.lamp)
    const lamp = wantedByKey.get(key)
    if (lamp && !placed.has(key)) {
      placed.add(key)
      return { lamp, level: slot.level, target: 1 }
    }
    // Apagada de todo, fica livre.
    if (slot.level <= 0) return { lamp: null, level: 0, target: 0 }
    return { lamp: slot.lamp, level: slot.level, target: 0 }
  })
  const missing = wanted.filter((lamp) => !placed.has(lampKeyOf(lamp)))
  for (const slot of next) {
    if (slot.lamp || missing.length === 0) continue
    slot.lamp = missing.shift()
    slot.level = 0
    slot.target = 1
  }
  return next
}
