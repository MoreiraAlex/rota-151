'use client'

import { createContext, useContext, useState, useTransition } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { PageSkeleton } from './PageSkeleton'

const WikiNavigationContext = createContext({
  pendingHref: null,
  navigate: () => {},
})

/** Navegação da wiki com retorno imediato (`navigate`, `pendingHref`). */
export function useWikiNavigation() {
  return useContext(WikiNavigationContext)
}

function isPlainClick(event) {
  return (
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey &&
    !event.defaultPrevented
  )
}

/**
 * Área da wiki (menu + conteúdo). Todo clique num link interno da wiki vira
 * uma navegação em transição: o conteúdo troca NA HORA por uma página falsa
 * (`PageSkeleton`) e o menu já marca o destino, até a página nova chegar — sem
 * isso a tela parece congelada enquanto ela carrega (no `next dev`, a primeira
 * visita ainda compila a rota). Links pra fora da wiki, com tecla modificadora
 * ou só de âncora na mesma página seguem o comportamento normal.
 */
export function WikiShell({ header, nav, children }) {
  const router = useRouter()
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()
  const [pendingHref, setPendingHref] = useState(null)

  function navigate(href) {
    setPendingHref(href)
    startTransition(() => router.push(href))
  }

  function interceptLinks(event) {
    const anchor = event.target.closest?.('a[href]')
    if (!anchor || !isPlainClick(event) || anchor.target === '_blank') return

    const url = new URL(anchor.href, window.location.href)
    if (url.origin !== window.location.origin) return
    if (!url.pathname.startsWith('/wiki')) return
    if (url.pathname === pathname) return

    event.preventDefault()
    navigate(`${url.pathname}${url.search}${url.hash}`)
  }

  const loading = isPending ? pendingHref : null

  return (
    <WikiNavigationContext.Provider value={{ pendingHref: loading, navigate }}>
      <div onClickCapture={interceptLinks}>
        {header}
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 md:grid-cols-[230px_minmax(0,1fr)] md:gap-10">
          <aside className="md:sticky md:top-20 md:max-h-[calc(100vh-6rem)] md:overflow-y-auto">
            {nav}
          </aside>
          <main className="min-w-0 pb-16">
            {loading ? <PageSkeleton /> : children}
          </main>
        </div>
      </div>
    </WikiNavigationContext.Provider>
  )
}
