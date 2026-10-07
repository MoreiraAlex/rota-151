/**
 * Selo de um tipo elemental na wiki (nome na cor do tipo). Lê o nome e a cor
 * do retrato da versão (`data.types.list`), nunca do jogo direto — uma versão
 * congelada mostra os tipos da época. Tipo desconhecido: o id, sem cor.
 */
export function TypeTag({ data, type }) {
  const entry = data.types?.list.find((item) => item.id === type)
  return (
    <span
      className="inline-block rounded px-1.5 py-0.5 text-xs font-semibold uppercase leading-none text-white"
      style={{
        backgroundColor: entry?.color ?? '#888888',
        textShadow: '0 1px 1px rgba(0, 0, 0, 0.5)',
      }}
    >
      {entry?.name ?? type}
    </span>
  )
}

/** Os selos dos tipos de uma criatura, lado a lado (sem tipo: "—"). */
export function TypeTags({ data, types }) {
  if (!types?.length) return '—'
  return (
    <span className="inline-flex flex-wrap gap-1">
      {types.map((type) => (
        <TypeTag key={type} data={data} type={type} />
      ))}
    </span>
  )
}
