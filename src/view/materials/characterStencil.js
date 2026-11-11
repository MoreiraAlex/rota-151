import * as THREE from 'three'

/**
 * O stencil diz o que está na frente em cada pixel (docs/features/066-
 * revisao-dos-biomas.md):
 * - personagem (`CHARACTER_STENCIL`): as criaturas e o treinador marcam
 *   onde aparecem — o aviso de golpe, que passa por cima da grama e dos
 *   arbustos (`overPlants.js`), não desenha ali;
 * - planta (`PLANT_STENCIL`): grama, arbustos e flores — a silhueta de um
 *   personagem escondido só aparece onde quem esconde é planta
 *   (`onlyBehindPlants`);
 * - o resto do cenário (chão, troncos, copas, pedras, prédios) apaga a
 *   marca (`markAsScenery`): atrás dele, nada de silhueta.
 * Cada material que escreve deixa o valor dele onde passa no teste de
 * profundidade — fica o de quem está na frente. Precisa do stencil ligado
 * no canvas e no alvo do pós-processamento.
 */

/** O valor do stencil dos personagens. */
export const CHARACTER_STENCIL = 1
/** O valor do stencil das plantas que o golpe não colide. */
export const PLANT_STENCIL = 2

// O material escreve `value` onde o pixel dele aparece.
function writeStencil(material, value) {
  material.stencilWrite = true
  material.stencilRef = value
  material.stencilWriteMask = 0xff
  material.stencilFuncMask = 0xff
  material.stencilFunc = THREE.AlwaysStencilFunc
  material.stencilFail = THREE.KeepStencilOp
  material.stencilZFail = THREE.KeepStencilOp
  material.stencilZPass = THREE.ReplaceStencilOp
  return material
}

/** Planta: grama, arbustos, flores. */
export const markAsPlant = (material) => writeStencil(material, PLANT_STENCIL)

/** O resto do cenário: apaga a marca onde aparece. */
export const markAsScenery = (material) => writeStencil(material, 0)

/**
 * A silhueta: só desenha onde a planta está na frente, e uma vez por pixel
 * (sobe o valor ao desenhar — a segunda passada no mesmo pixel falha), sem
 * somar a transparência onde partes do corpo se cruzam.
 */
export function onlyBehindPlants(material) {
  material.stencilWrite = true
  material.stencilRef = PLANT_STENCIL
  material.stencilWriteMask = 0xff
  material.stencilFuncMask = 0xff
  material.stencilFunc = THREE.EqualStencilFunc
  material.stencilFail = THREE.KeepStencilOp
  material.stencilZFail = THREE.KeepStencilOp
  material.stencilZPass = THREE.IncrementStencilOp
  return material
}

/** O material marca o stencil onde o pixel dele aparece. */
export const markAsCharacter = (material) =>
  writeStencil(material, CHARACTER_STENCIL)

/** O material não desenha onde há personagem (e não mexe no stencil). */
export function skipCharacters(material) {
  material.stencilWrite = true
  material.stencilRef = CHARACTER_STENCIL
  material.stencilWriteMask = 0x00
  material.stencilFuncMask = 0xff
  material.stencilFunc = THREE.NotEqualStencilFunc
  material.stencilFail = THREE.KeepStencilOp
  material.stencilZFail = THREE.KeepStencilOp
  material.stencilZPass = THREE.KeepStencilOp
  return material
}
