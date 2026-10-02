import Link from 'next/link'
import { notFound } from 'next/navigation'
import { VersionSelect } from '@/tools/wiki/components/VersionSelect'
import { WikiNav } from '@/tools/wiki/components/WikiNav'
import { WikiShell } from '@/tools/wiki/components/WikiShell'
import { wikiHref } from '@/tools/wiki/components/WikiLink'
import {
  WIKI_VERSIONS,
  getWikiVersion,
  resolveWikiData,
} from '@/tools/wiki/versions'
import { WIKI_PAGES } from '@/tools/wiki/versions/pages'

export const metadata = {
  title: {
    default: 'Wiki',
    template: '%s | Wiki | Rota 151',
  },
  description:
    'Wiki do Rota 151: como o jogo funciona por dentro — status, dano, energia, criaturas selvagens e mais.',
}

/**
 * Moldura da wiki (docs/features/036-wiki-do-jogo.md) — pública, fora do
 * grupo `(auth)`, sem nada do jogo 3D. Topo com a caixa de versão, menu da
 * versão escolhida ao lado. Conteúdo em `src/tools/wiki/versions/`.
 */
export default function WikiVersionLayout({ children, params }) {
  const version = getWikiVersion(params.version)
  if (!version) notFound()

  const versionOptions = WIKI_VERSIONS.map((entry) => ({
    id: entry.id,
    slugs: WIKI_PAGES[entry.id].listPagePaths(resolveWikiData(entry)),
  }))

  const header = (
    <header className="sticky top-0 z-10 border-b border-border bg-primary text-primary-foreground shadow-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
        <Link href={wikiHref(version.id)} className="flex items-baseline gap-2">
          <span className="text-lg font-bold tracking-tight">Rota 151</span>
          <span className="rounded bg-accent px-1.5 py-0.5 text-xs font-semibold text-accent-foreground">
            Wiki
          </span>
        </Link>
        <div className="flex items-center gap-3">
          <VersionSelect versions={versionOptions} current={version.id} />
          <Link
            href="/"
            className="rounded-md bg-primary-foreground/15 px-3 py-1 text-sm font-medium hover:bg-primary-foreground/25"
          >
            Jogar
          </Link>
        </div>
      </div>
    </header>
  )

  return (
    <div className="min-h-screen bg-background text-foreground">
      <WikiShell
        header={header}
        nav={<WikiNav nav={version.nav} version={version.id} />}
      >
        {children}
      </WikiShell>
    </div>
  )
}
