const TONES = {
  missing: {
    label: 'Ainda não existe no jogo',
    className: 'border-accent/60 bg-accent/10',
    badge: 'bg-accent text-accent-foreground',
  },
  soon: {
    label: 'Em breve',
    className: 'border-primary/50 bg-primary/5',
    badge: 'bg-primary text-primary-foreground',
  },
  tip: {
    label: 'Dica',
    className: 'border-border bg-muted/40',
    badge: 'bg-muted-foreground/80 text-background',
  },
}

/**
 * Caixa de aviso. `'missing'`: mecânica que o jogador esperaria e ainda não
 * existe; `'soon'`: assunto que vai entrar na wiki quando estiver definido;
 * `'tip'`: dica prática.
 */
export function Notice({ tone = 'tip', title, children }) {
  const style = TONES[tone] ?? TONES.tip
  return (
    <aside
      className={`my-4 rounded-lg border-l-4 p-4 text-sm ${style.className}`}
    >
      <span
        className={`mb-2 inline-block rounded px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${style.badge}`}
      >
        {title ?? style.label}
      </span>
      <div className="space-y-2 leading-6">{children}</div>
    </aside>
  )
}
