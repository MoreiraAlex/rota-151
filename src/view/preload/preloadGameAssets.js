import { useGLTF } from '@react-three/drei'
import { listModelPaths, listSpritePaths, preloadImages } from './assetPreload'

/**
 * Pré-carregamento na tela de "Carregando…" (docs/features/044-salvar-o-
 * jogo.md): os sprites (inventário, Pokédex, golpes) e os modelos `.glb` das
 * espécies e dos itens começam a baixar antes do jogo aparecer.
 *
 * - Sprites: espera todos (ou `GAME_CONFIG.LOADING.SPRITE_TIMEOUT`, pra um
 *   servidor lento de fora não segurar a entrada). Ficam no cache do
 *   navegador — o `<Image>` dos menus usa a mesma URL (`images.unoptimized`
 *   no `next.config.mjs`).
 * - Modelos: só dispara (`useGLTF.preload`, mesmo cache do `useGLTF`); quem
 *   espera por eles é a cena (`SceneReady`).
 */

const SPRITES_LABEL = 'Baixando imagens…'

/**
 * Dispara os modelos e espera os sprites, contando cada sprite no `progress`
 * (`view/loading/loadingProgress.js`); os modelos o three.js conta.
 */
export function preloadGameAssets(progress) {
  for (const path of listModelPaths()) useGLTF.preload(path)
  const sprites = listSpritePaths()
  progress?.add(SPRITES_LABEL, sprites.length)
  return preloadImages(sprites, {
    onEach: () => progress?.complete(SPRITES_LABEL),
  })
}
