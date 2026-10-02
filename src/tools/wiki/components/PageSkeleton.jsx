function Bar({ className }) {
  return <div className={`rounded bg-muted ${className}`} />
}

/**
 * Página falsa (placeholders) mostrada enquanto a próxima página da wiki
 * carrega — título, abertura, duas seções de texto e uma tabela.
 */
export function PageSkeleton() {
  return (
    <div
      className="animate-pulse space-y-8"
      role="status"
      aria-label="Carregando página"
    >
      <div className="space-y-3 border-b border-border pb-5">
        <Bar className="h-8 w-1/2" />
        <Bar className="h-4 w-4/5" />
      </div>
      {[0, 1].map((section) => (
        <div key={section} className="space-y-3">
          <Bar className="h-6 w-1/3" />
          <Bar className="h-4 w-full" />
          <Bar className="h-4 w-11/12" />
          <Bar className="h-4 w-3/4" />
        </div>
      ))}
      <div className="overflow-hidden rounded-lg border border-border">
        <div className="h-9 bg-primary/30" />
        {[0, 1, 2, 3].map((row) => (
          <div
            key={row}
            className="flex gap-4 border-t border-border px-3 py-2.5"
          >
            <Bar className="h-4 w-1/4" />
            <Bar className="h-4 w-1/6" />
            <Bar className="h-4 w-1/6" />
            <Bar className="h-4 w-1/5" />
          </div>
        ))}
      </div>
    </div>
  )
}
