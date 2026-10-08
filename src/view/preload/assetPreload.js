import { listItems } from '@/core/data/items'
import { listSkills } from '@/core/data/skills'
import { listSpecies } from '@/core/data/species'
import { GAME_CONFIG } from '@/core/gameConfig'

/**
 * Listas de assets e o pré-carregamento de imagens (docs/features/044-salvar-
 * o-jogo.md) — puro (sem drei), pra testar. Quem usa é
 * `preloadGameAssets.js`.
 */

// Referência pras imagens não serem coletadas antes de terminar.
const retained = new Set()

/** Os caminhos de sprite de itens, espécies e golpes, sem repetição. */
export function listSpritePaths({
  items = listItems(),
  species = listSpecies(),
  skills = listSkills(),
} = {}) {
  const paths = [...items, ...species, ...skills]
    .map((entry) => entry?.sprite?.path)
    .filter(Boolean)
  return [...new Set(paths)]
}

/** Os modelos `.glb` de espécies e itens, sem repetição. */
export function listModelPaths({
  items = listItems(),
  species = listSpecies(),
} = {}) {
  const paths = [...items, ...species]
    .map((entry) => entry?.model?.path)
    .filter(Boolean)
  return [...new Set(paths)]
}

/**
 * Baixa as imagens de `paths`. Resolve quando todas terminam (carregou ou
 * falhou — falha não trava a entrada) ou ao passar `timeout` segundos.
 * `onEach` é chamado a cada uma que termina (barra de progresso).
 */
export function preloadImages(
  paths,
  {
    createImage = () => new Image(),
    timeout = GAME_CONFIG.LOADING.SPRITE_TIMEOUT,
    setTimer = (fn, ms) => setTimeout(fn, ms),
    onEach = () => {},
  } = {},
) {
  const loads = paths.map(
    (path) =>
      new Promise((resolve) => {
        const image = createImage()
        retained.add(image)
        const done = () => {
          retained.delete(image)
          onEach()
          resolve()
        }
        image.onload = done
        image.onerror = done
        image.src = path
      }),
  )
  const deadline = new Promise((resolve) => setTimer(resolve, timeout * 1000))
  return Promise.race([Promise.all(loads), deadline])
}
