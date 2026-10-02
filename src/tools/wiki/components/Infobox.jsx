/**
 * Caixa lateral de resumo (o "infobox" da Bulbapedia): título, imagem
 * opcional e pares rótulo/valor.
 */
export function Infobox({ title, subtitle, image, rows }) {
  return (
    <aside className="w-full overflow-hidden rounded-xl border-2 border-primary bg-card md:w-72 md:shrink-0">
      <div className="bg-primary px-4 py-2 text-center text-primary-foreground">
        <p className="text-lg font-bold">{title}</p>
        {subtitle ? <p className="text-xs opacity-90">{subtitle}</p> : null}
      </div>
      {image ? (
        <div className="flex justify-center bg-muted/40 py-4">{image}</div>
      ) : null}
      <dl className="divide-y divide-border text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-3 px-4 py-1.5">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="text-right font-medium">{value}</dd>
          </div>
        ))}
      </dl>
    </aside>
  )
}
