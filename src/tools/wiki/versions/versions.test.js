import { describe, expect, it } from 'vitest'
import {
  LATEST_WIKI_VERSION,
  WIKI_VERSIONS,
  getWikiVersion,
  isLatestWikiVersion,
  listNavSlugs,
  resolveWikiData,
} from '.'

describe('versões da wiki', () => {
  it('ids únicos, e a mais nova é a primeira da lista', () => {
    const ids = WIKI_VERSIONS.map((version) => version.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(LATEST_WIKI_VERSION).toBe(WIKI_VERSIONS[0])
    expect(isLatestWikiVersion(WIKI_VERSIONS[0])).toBe(true)
  })

  it('só a mais nova lê o jogo ao vivo; as anteriores estão congeladas', () => {
    for (const version of WIKI_VERSIONS.slice(1)) {
      expect(version.data, version.id).toBeTruthy()
    }
    expect(LATEST_WIKI_VERSION.data).toBeNull()
  })

  it('toda versão resolve os próprios números', () => {
    for (const version of WIKI_VERSIONS) {
      const data = resolveWikiData(version)
      expect(data.species.length, version.id).toBeGreaterThan(0)
    }
  })

  it('menu sem endereço repetido e com a página inicial', () => {
    for (const version of WIKI_VERSIONS) {
      const slugs = listNavSlugs(version)
      expect(new Set(slugs).size, version.id).toBe(slugs.length)
      expect(slugs).toContain('')
    }
  })

  it('getWikiVersion acha pelo id e devolve null pra desconhecida', () => {
    for (const version of WIKI_VERSIONS) {
      expect(getWikiVersion(version.id)).toBe(version)
    }
    expect(getWikiVersion('nao-existe')).toBeNull()
  })
})
