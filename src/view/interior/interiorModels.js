import * as THREE from 'three'

/**
 * Os arquivos das salas por dentro dos prédios (docs/features/068-interior-
 * dos-predios.md), no formato dos modelos do LGPE da vegetação
 * (`lgpeModels.js`) — gerados por `scripts/lgpe/pack-lgpe.js` com
 * `scripts/lgpe/interiors.json`.
 */
export const INTERIOR_DIR = '/assets/interiors/lgpe'
export const INTERIOR_MANIFEST_PATH = `${INTERIOR_DIR}/manifest.json`

export const interiorModelPath = (id) => `${INTERIOR_DIR}/props/${id}.glb`
export const interiorTexturePath = (name) =>
  `${INTERIOR_DIR}/textures/${name}.png`

/**
 * Vidro e brilho no chão (`blend` no manifesto): misturados com o que está
 * atrás — `'add'` somando luz, `'alpha'` pelo alfa da textura — e sem
 * escrever profundidade (não escondem o que vem depois). Opaco: nada.
 */
export function applyInteriorBlend(material, entry) {
  if (!entry.blend) return
  material.transparent = true
  material.depthWrite = false
  if (entry.blend === 'add') material.blending = THREE.AdditiveBlending
  material.needsUpdate = true
}

// O vazio escuro em volta da sala (o fundo do diorama): não faz sombra
// dentro dela.
const BACKDROP_MATERIAL = /^bm_combg/

/** Se a parte da sala faz sombra: as opacas, menos o fundo. */
export function castsInteriorShadow(part, entry) {
  return !entry.blend && !BACKDROP_MATERIAL.test(part.materialName)
}
