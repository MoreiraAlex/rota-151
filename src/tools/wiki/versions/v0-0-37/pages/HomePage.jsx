import Link from 'next/link'
import { Section } from '@/tools/wiki/components/Article'
import { wikiHref } from '@/tools/wiki/components/WikiLink'
import { WIKI_V0_0_37 } from '../meta'

export function HomePage({ version }) {
  const groups = WIKI_V0_0_37.nav.filter((group) =>
    group.links.some((link) => link.slug !== ''),
  )

  return (
    <>
      <Section>
        <p>
          Aqui você entende como o Rota 151 funciona por dentro: de onde vêm os
          status das criaturas, como o dano é calculado, quanto custa cada golpe
          como as criaturas sobem de nível e como as selvagens se comportam.
        </p>
        <p>
          Os números mostrados são os do jogo nesta versão. O jogo ainda está em
          desenvolvimento e as regras mudam com o tempo: use a caixa{' '}
          <strong>Versão do jogo</strong>, no topo, pra ver como cada coisa
          funcionava em versões anteriores.
        </p>
      </Section>

      {groups.map((group) => (
        <Section key={group.title} title={group.title}>
          <div className="grid gap-3 sm:grid-cols-2">
            {group.links
              .filter((link) => link.slug !== '')
              .map((link) => (
                <Link
                  key={link.slug}
                  href={wikiHref(version, link.slug)}
                  className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3 font-medium transition-colors hover:border-primary hover:bg-muted/40"
                >
                  <span className="text-primary">{link.label}</span>
                  {link.soon ? (
                    <span className="rounded bg-muted px-1.5 text-[10px] font-semibold uppercase text-muted-foreground">
                      em breve
                    </span>
                  ) : null}
                </Link>
              ))}
          </div>
        </Section>
      ))}
    </>
  )
}
