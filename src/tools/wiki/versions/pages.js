import * as V0_0_36 from './v0-0-36/pages'
import * as V0_0_37 from './v0-0-37/pages'

/**
 * Páginas de cada versão da wiki, pelo id da versão (`versions/index.js`).
 * Separado do registro de versões porque importa os componentes.
 */
export const WIKI_PAGES = {
  '0.0.37': V0_0_37,
  '0.0.36': V0_0_36,
}
