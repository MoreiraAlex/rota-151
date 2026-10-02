import { buildWikiData } from '../wikiData'
import { WIKI_V0_0_36 } from './v0-0-36/meta'

/**
 * Versões da wiki, da mais nova pra mais antiga — a caixa de versão do topo
 * lista estas. Só a mais nova lê os números do jogo ao vivo; as anteriores
 * mostram o retrato congelado delas (`data`).
 *
 * Nova versão da wiki (quando uma mecânica mudar e precisar entrar):
 * 1) congela a atual: `npm run wiki:freeze -- <versão atual>` e aponta o
 *    `data` do `meta.js` dela pro `data.json` gerado;
 * 2) copia a pasta dela pra `v<nova>/`, troca o `id`, volta `data` pra
 *    `null` e edita só o que mudou;
 * 3) adiciona a nova no começo desta lista e em `pages.js`.
 */
export const WIKI_VERSIONS = [WIKI_V0_0_36]

export const LATEST_WIKI_VERSION = WIKI_VERSIONS[0]

export function getWikiVersion(id) {
  return WIKI_VERSIONS.find((version) => version.id === id) ?? null
}

export function isLatestWikiVersion(version) {
  return version?.id === LATEST_WIKI_VERSION.id
}

let liveData = null

/** Números da versão: congelados, ou lidos do jogo (só a mais nova). */
export function resolveWikiData(version) {
  if (version.data) return version.data
  liveData ??= buildWikiData()
  return liveData
}

/** Todos os endereços de página da versão (`''` = início). */
export function listNavSlugs(version) {
  return version.nav.flatMap((group) => group.links.map((link) => link.slug))
}
