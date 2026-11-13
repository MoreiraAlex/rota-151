import { GAME_CONFIG } from '@/core/gameConfig'
import { TEST_LEVEL } from '@/core/data/testLevel'
import { OrbitCamera } from '@/core/traits'
import { LAB_CAMERAS } from '@/tools/biomeLab/labWorld'

/**
 * O que o laboratório da cidade (docs/features/069-revisao-do-bioma-
 * cidade.md) faz no mundo do jogo: ligar a cidade montada à mão no lugar
 * da primeira cidade e pôr a câmera numa posição pronta. Ferramenta, fora
 * do loop do jogo.
 */

// A cidade que o lab monta (`core/data/cityLayouts/`).
export const LAB_LAYOUT = 'viridian'

// Até onde (m) a câmera se afasta no lab: a cidade inteira de cima.
export const LAB_MAX_DISTANCE = 90

/**
 * As câmeras prontas: as do laboratório de biomas e a de cima, para ler a
 * planta da cidade.
 */
export const CITY_LAB_CAMERAS = {
  ...LAB_CAMERAS,
  planta: {
    label: 'De cima (planta)',
    pitch: GAME_CONFIG.CAMERA.MAX_PITCH,
    distance: LAB_MAX_DISTANCE,
  },
}

/**
 * Liga a cidade do lab no lugar da primeira cidade (no jogo ela já é a
 * mesma; o mundo tem que ser refeito depois) e deixa a câmera se afastar
 * até ver ela toda.
 */
export function ligarCidadeDoLab() {
  GAME_CONFIG.CITIES.FIRST_TOWN.LAYOUT = LAB_LAYOUT
  GAME_CONFIG.CAMERA.MAX_DISTANCE = Math.max(
    GAME_CONFIG.CAMERA.MAX_DISTANCE,
    LAB_MAX_DISTANCE,
  )
}

/** A cidade montada à mão no mundo agora (ou `null`). */
export function cidadeDoLab() {
  const fixedTown = TEST_LEVEL.terrain.fixedTown?.() ?? null
  return fixedTown?.layout ? fixedTown : null
}

/** Põe a câmera do jogo (`cameraEntity`) numa das prontas. */
export function aplicarCameraDaCidade(cameraEntity, id) {
  const preset = CITY_LAB_CAMERAS[id]
  if (!preset || !cameraEntity.has(OrbitCamera)) return
  cameraEntity.set(OrbitCamera, {
    ...cameraEntity.get(OrbitCamera),
    pitch: preset.pitch,
    distance: preset.distance,
  })
}
