import * as THREE from 'three'
import { STANDING_TREE_KINDS, specOf } from '@/core/vegetation/solidPlacement'
import { vegetationEntryOf } from '@/core/vegetation/vegetationEntry'
import { terrainColorAt } from './terrainGeometry'

/**
 * Malha do relevo distante (docs/features/051-montanha.md) a partir da grade
 * do core (`core/terrain/farTerrain.js`): um vértice por ponto da grade, a
 * cor da paleta dos biomas pela altura e pela inclinação (a mesma conta do
 * chão de perto, `terrainColorAt`), o tom da copa onde há mata (não há
 * árvores longe) e a água por cima do que fica abaixo dela.
 */

const scratch = new THREE.Color()
const mixed = new THREE.Color()
const canopy = new THREE.Color()

// Pesos do brilho (os mesmos do toon, toonMaterial.js).
const LUMA = [0.2126, 0.7152, 0.0722]
const lumaOf = (color) =>
  color.r * LUMA[0] + color.g * LUMA[1] + color.b * LUMA[2]

/**
 * A tinta do bioma (`tint: { color, amount }`) na cor da copa, como no
 * toon: o tom puxa para o da tinta, com o brilho da copa.
 */
function recolor(color, tint) {
  if (!(tint?.amount > 0)) return color
  const hue = new THREE.Color(tint.color)
  const recolored = hue.multiplyScalar(
    lumaOf(color) / Math.max(lumaOf(hue), 1e-3),
  )
  return color.lerp(recolored, tint.amount)
}

/**
 * O que a copa das árvores de um bioma cobre do chão: para cada espécie
 * de árvore com folha, quanto ela ocupa (a `density`, só nas manchas
 * dela com `patches`, rareando nas clareiras com `place: 'shade'`), a
 * altura em que ela some (`maxHeight`) e a cor da copa (a da espécie,
 * `LEAF_COLOR`, com a tinta do bioma, `tint`). Só as que nascem no bioma
 * (`vegetationEntryOf`).
 */
function canopyOf(biome, solids) {
  const clearing = biome.clearings?.amount ?? 0
  return STANDING_TREE_KINDS.map((kind) => vegetationEntryOf(biome, kind))
    .filter(Boolean)
    .map((entry) => {
      const leafColor = specOf(entry.kind, solids)?.LEAF_COLOR
      if (!leafColor) return null
      const patches = entry.patches?.amount ?? 1
      const open = entry.place === 'shade' ? 1 - clearing : 1
      return {
        cover: entry.density * patches * open,
        maxHeight: entry.maxHeight ?? Infinity,
        color: recolor(new THREE.Color(leafColor), entry.tint),
      }
    })
    .filter(Boolean)
}

/**
 * Quanto a copa cobre (0 a 1) a uma altura acima da água e a cor dela
 * (média das folhas pelo quanto cada espécie cobre), em `target`.
 */
function canopyAt(trees, heightAboveWater, altitudeFade, target) {
  target.setRGB(0, 0, 0)
  let cover = 0
  for (const tree of trees) {
    const fade = THREE.MathUtils.clamp(
      (tree.maxHeight - heightAboveWater) / altitudeFade,
      0,
      1,
    )
    const share = tree.cover * fade
    if (share <= 0) continue
    cover += share
    target.r += tree.color.r * share
    target.g += tree.color.g * share
    target.b += tree.color.b * share
  }
  if (cover > 0) target.multiplyScalar(1 / cover)
  return Math.min(cover, 1)
}

// Cor de um vértice: a de cada bioma pelo peso dele ali — chão da paleta,
// copa por cima.
function vertexColorAt(grid, index, biomes, heightAboveWater, normalY, look) {
  const { biomeCount, biomeWeights } = grid
  mixed.setRGB(0, 0, 0)
  for (let biome = 0; biome < biomeCount; biome++) {
    const weight = biomeWeights[index * biomeCount + biome] / 255
    if (weight <= 0) continue
    const { palette, trees } = biomes[biome]
    terrainColorAt(palette, heightAboveWater, normalY, scratch)
    const cover = canopyAt(trees, heightAboveWater, look.altitudeFade, canopy)
    scratch.lerp(canopy, cover * look.canopyStrength)
    mixed.r += scratch.r * weight
    mixed.g += scratch.g * weight
    mixed.b += scratch.b * weight
  }
  return mixed.multiplyScalar(look.brightness)
}

/**
 * Geometria da grade distante (posições, normais e cores por vértice).
 *
 * @param {import('@/core/terrain/farTerrain').FarTerrainGrid} grid
 * @param {object[]} biomeList - os biomas da receita (na ordem dos pesos)
 * @param {object} look
 * @param {number} look.waterLevel
 * @param {number} look.sink - quanto a malha fica abaixo do relevo (m)
 * @param {number} look.canopyStrength
 * @param {number} look.brightness
 * @param {number} look.altitudeFade - `VEGETATION_ALTITUDE.FADE`
 * @param {object} look.solids - `solidParams()` (cor da folha por espécie)
 * @param {{ shallow: string, deep: string, depth: number }} look.water -
 *   cores da água e a profundidade (m) em que ela fica na cor funda
 */
export function buildFarTerrainGeometry(grid, biomeList, look) {
  const { side, cell, minX, minZ, heights } = grid
  const count = side * side
  const biomes = biomeList.map((biome) => ({
    palette: biome.palette,
    trees: canopyOf(biome, look.solids),
  }))
  const shallow = new THREE.Color(look.water.shallow)
  const deep = new THREE.Color(look.water.deep)
  const surface = (index) => Math.max(heights[index], look.waterLevel)
  const at = (ix, iz) =>
    surface(
      Math.min(side - 1, Math.max(0, iz)) * side +
        Math.min(side - 1, Math.max(0, ix)),
    )

  const positions = new Float32Array(count * 3)
  const normals = new Float32Array(count * 3)
  const colors = new Float32Array(count * 3)
  for (let iz = 0; iz < side; iz++) {
    for (let ix = 0; ix < side; ix++) {
      const index = iz * side + ix
      positions[index * 3] = minX + ix * cell
      positions[index * 3 + 1] = surface(index) - look.sink
      positions[index * 3 + 2] = minZ + iz * cell
      const alongX = (at(ix + 1, iz) - at(ix - 1, iz)) / 2
      const alongZ = (at(ix, iz + 1) - at(ix, iz - 1)) / 2
      const length = Math.hypot(alongX, cell, alongZ)
      normals[index * 3] = -alongX / length
      normals[index * 3 + 1] = cell / length
      normals[index * 3 + 2] = -alongZ / length

      const depth = look.waterLevel - heights[index]
      const color =
        depth > 0
          ? scratch
              .copy(shallow)
              .lerp(deep, Math.min(depth / look.water.depth, 1))
          : vertexColorAt(
              grid,
              index,
              biomes,
              heights[index] - look.waterLevel,
              cell / length,
              look,
            )
      color.toArray(colors, index * 3)
    }
  }

  const indices = new Uint32Array((side - 1) * (side - 1) * 6)
  let cursor = 0
  for (let iz = 0; iz < side - 1; iz++) {
    for (let ix = 0; ix < side - 1; ix++) {
      const a = iz * side + ix
      const b = a + 1
      const c = a + side
      const d = c + 1
      // Faces para cima (sentido anti-horário visto de cima).
      indices.set([a, c, b, b, c, d], cursor)
      cursor += 6
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3))
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geometry.setIndex(new THREE.BufferAttribute(indices, 1))
  geometry.computeBoundingSphere()
  return geometry
}
