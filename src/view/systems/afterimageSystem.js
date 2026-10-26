import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { EVENT_TYPES } from '@/core/events'
import { getSpecies } from '@/core/data/species'
import { resolveEntityAttack } from '@/core/battle/creatureAttack'
import { resolveCreatureSpeciesId } from '@/core/traits'
import { getView } from '../registry/viewRegistry'
import { isOutline } from '../materials/toonMaterial'

/**
 * VULTOS do golpe (`visual.afterimages`, ex.: o Double Team — docs/features/
 * 061-revisao-das-skills.md): no instante do golpe (`attackUsed`), cópias
 * translúcidas do modelo de quem usa, na pose daquele instante, saem dos dois
 * lados, piscam e somem — o "bando" de cópias. Só visual: nada no ECS.
 *
 * `visual.afterimages`: `{ count, spread, duration, opacity, flicker }` —
 * quantos vultos (alternando direita e esquerda, cada par mais longe),
 * quanto o mais próximo se afasta (m), quanto duram (s), a opacidade no
 * começo e quantas piscadas por segundo.
 *
 * Cada vulto é um `SkeletonUtils.clone` do modelo (os ossos copiam a pose de
 * agora e ficam parados), com materiais próprios transparentes — descartados
 * quando o vulto some. A geometria é a mesma do modelo (não descarta). Entra
 * na cena como irmão do modelo (`getView(entity).parent`).
 * Fase: presentation.
 */

// Quanto do caminho o vulto leva pra chegar no lugar (fração da vida).
const SLIDE = 0.25

/**
 * Deslocamento de lado (m, + = à direita de quem usa) de cada um dos `count`
 * vultos: direita, esquerda, direita mais longe...
 */
export function resolveAfterimageOffsets(count, spread) {
  return Array.from({ length: count }, (_, index) => {
    const side = index % 2 === 0 ? 1 : -1
    return side * spread * (Math.floor(index / 2) + 1)
  })
}

/**
 * Opacidade do vulto em `t` (0-1 da vida): sai do corpo deslizando, pisca
 * (`flicker` vezes por segundo, ligado/desligado) e apaga no fim.
 */
export function resolveAfterimageOpacity(t, { opacity, flicker, duration }) {
  if (t >= 1) return 0
  const fade = 1 - t
  const blink = flicker > 0 ? Math.floor(t * duration * flicker * 2) % 2 : 0
  return blink === 1 ? 0 : opacity * fade
}

/** Quanto do deslocamento o vulto já andou em `t` (0-1 da vida). */
export function resolveAfterimageSlide(t) {
  const x = Math.min(t / SLIDE, 1)
  return 1 - (1 - x) * (1 - x)
}

// vultos vivos: { root, materials, offset, start, elapsed, spec }
const live = []

function spawnAfterimages(entity, spec) {
  const view = getView(entity)
  if (!view?.parent) return
  for (const offset of resolveAfterimageOffsets(spec.count, spec.spread)) {
    const root = cloneSkeleton(view)
    const materials = []
    root.traverse((child) => {
      if (!child.isMesh) return
      // o contorno do toon fica de fora: o vulto é só a silhueta clara
      if (isOutline(child)) {
        child.visible = false
        return
      }
      const list = Array.isArray(child.material)
        ? child.material
        : [child.material]
      const clones = list.map((material) => {
        const clone = material.clone()
        clone.transparent = true
        clone.depthWrite = false
        clone.opacity = 0
        materials.push(clone)
        return clone
      })
      child.material = Array.isArray(child.material) ? clones : clones[0]
      child.castShadow = false
    })
    root.position.copy(view.position)
    root.quaternion.copy(view.quaternion)
    root.scale.copy(view.scale)
    view.parent.add(root)
    live.push({
      root,
      materials,
      offset,
      start: view.position.clone(),
      // a direita de quem usa, no plano do chão
      rightX: Math.cos(view.rotation.y),
      rightZ: -Math.sin(view.rotation.y),
      elapsed: 0,
      spec,
    })
  }
}

function removeAt(index) {
  const image = live[index]
  image.root.parent?.remove(image.root)
  for (const material of image.materials) material.dispose()
  live.splice(index, 1)
}

export function afterimageSystem(context) {
  const { delta, frameEvents } = context

  for (const event of frameEvents) {
    if (event.type !== EVENT_TYPES.ATTACK_USED) continue
    const entity = event.entity
    if (!entity?.isAlive?.()) continue
    const species = getSpecies(resolveCreatureSpeciesId(entity))
    const attack = species
      ? resolveEntityAttack(entity, species, event.slot)
      : null
    const spec = attack?.visual?.afterimages
    if (spec?.count > 0) spawnAfterimages(entity, spec)
  }

  for (let i = live.length - 1; i >= 0; i--) {
    const image = live[i]
    image.elapsed += delta
    const t = image.elapsed / image.spec.duration
    if (t >= 1 || !image.root.parent) {
      removeAt(i)
      continue
    }
    const side = image.offset * resolveAfterimageSlide(t)
    image.root.position.set(
      image.start.x + image.rightX * side,
      image.start.y,
      image.start.z + image.rightZ * side,
    )
    const opacity = resolveAfterimageOpacity(t, image.spec)
    for (const material of image.materials) material.opacity = opacity
    image.root.visible = opacity > 0
  }
}
