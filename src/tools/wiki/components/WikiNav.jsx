'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { wikiHref } from './WikiLink'
import { useWikiNavigation } from './WikiShell'

function NavLinks({ nav, version, pathname }) {
  return (
    <nav className="space-y-5 text-sm">
      {nav.map((group) => (
        <div key={group.title}>
          <p className="mb-1.5 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {group.title}
          </p>
          <ul className="space-y-0.5">
            {group.links.map((link) => {
              const href = wikiHref(version, link.slug)
              const active = pathname === href
              return (
                <li key={link.slug}>
                  <Link
                    href={href}
                    className={`flex items-center justify-between gap-2 rounded-md px-2 py-1.5 transition-colors ${
                      active
                        ? 'bg-primary font-medium text-primary-foreground'
                        : 'text-foreground/80 hover:bg-muted hover:text-foreground'
                    }`}
                  >
                    <span>{link.label}</span>
                    {link.soon ? (
                      <span
                        className={`rounded px-1.5 text-[10px] font-semibold uppercase ${
                          active
                            ? 'bg-primary-foreground/20'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        em breve
                      </span>
                    ) : null}
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </nav>
  )
}

/**
 * Menu lateral da wiki — o da versão escolhida. Coluna fixa no desktop,
 * recolhível no celular. Cliente pelo destaque da página atual (ou da que
 * está carregando, `useWikiNavigation`).
 */
export function WikiNav({ nav, version }) {
  const currentPath = usePathname()
  const { pendingHref } = useWikiNavigation()
  // marca o destino na hora do clique, sem esperar a página nova chegar
  const pathname = pendingHref?.split('#')[0] ?? currentPath

  return (
    <>
      <details className="rounded-lg border border-border bg-card p-3 md:hidden">
        <summary className="cursor-pointer text-sm font-medium">Menu</summary>
        <div className="mt-3">
          <NavLinks nav={nav} version={version} pathname={pathname} />
        </div>
      </details>
      <div className="hidden md:block">
        <NavLinks nav={nav} version={version} pathname={pathname} />
      </div>
    </>
  )
}
