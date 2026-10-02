/**
 * Moldura de uma página da wiki: título, linha de abertura e seções com
 * âncora. O estilo do texto corrido (parágrafo, lista, código) mora na
 * `Section`, então os artigos escrevem HTML simples.
 */
export function Article({ title, lead, children }) {
  return (
    <article className="space-y-8">
      <header className="space-y-2 border-b border-border pb-5">
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        {lead ? (
          <p className="text-lg leading-relaxed text-muted-foreground">
            {lead}
          </p>
        ) : null}
      </header>
      {children}
    </article>
  )
}

export function Section({ id, title, children }) {
  return (
    <section
      id={id}
      className="scroll-mt-20 space-y-3 leading-7 [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[0.85em] [&_li]:my-1 [&_ol]:list-decimal [&_ol]:pl-6 [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-6"
    >
      {title ? (
        <h2 className="border-b border-border/60 pb-1 text-xl font-semibold">
          {id ? (
            <a href={`#${id}`} className="hover:underline">
              {title}
            </a>
          ) : (
            title
          )}
        </h2>
      ) : null}
      {children}
    </section>
  )
}
