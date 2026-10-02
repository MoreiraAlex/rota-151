/** Conta escrita em português, em destaque. */
export function Formula({ children }) {
  return (
    <div className="my-4 overflow-x-auto rounded-lg border border-border bg-card px-4 py-3 text-sm leading-7 text-card-foreground">
      {children}
    </div>
  )
}
