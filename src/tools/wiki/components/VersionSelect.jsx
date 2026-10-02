'use client'

import { usePathname } from 'next/navigation'
import { wikiHref } from './WikiLink'
import { useWikiNavigation } from './WikiShell'

/**
 * Caixa de versão do topo. Trocar de versão mantém a página aberta quando ela
 * existe na outra versão; senão, vai pro início dela.
 *
 * `versions`: `[{ id, slugs }]` (mais nova primeiro); `slugs` = páginas que
 * a versão tem.
 */
export function VersionSelect({ versions, current }) {
  const { navigate } = useWikiNavigation()
  const pathname = usePathname()
  const prefix = wikiHref(current)
  const slug = pathname.startsWith(`${prefix}/`)
    ? pathname.slice(prefix.length + 1)
    : ''

  function selectVersion(id) {
    const target = versions.find((version) => version.id === id)
    navigate(wikiHref(id, target?.slugs.includes(slug) ? slug : ''))
  }

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="hidden opacity-80 sm:inline">Versão do jogo</span>
      <select
        value={current}
        onChange={(event) => selectVersion(event.target.value)}
        className="rounded-md border border-primary-foreground/30 bg-primary-foreground/15 px-2 py-1 font-medium text-primary-foreground focus:outline-none focus:ring-2 focus:ring-accent [&>option]:text-foreground"
      >
        {versions.map((version, index) => (
          <option key={version.id} value={version.id}>
            {version.id}
            {index === 0 ? ' (atual)' : ''}
          </option>
        ))}
      </select>
    </label>
  )
}
