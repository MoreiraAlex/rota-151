/**
 * Tabela da wiki. `head`: rótulos das colunas; `rows`: linhas (arrays de
 * células, texto ou elemento). `align`: `'right'` por coluna, opcional.
 */
export function DataTable({ head, rows, align = [], caption }) {
  return (
    <div className="my-4 overflow-x-auto rounded-lg border border-border">
      <table className="w-full border-collapse text-sm">
        {caption ? (
          <caption className="caption-bottom border-t border-border bg-muted/40 px-3 py-1.5 text-left text-xs text-muted-foreground">
            {caption}
          </caption>
        ) : null}
        <thead className="bg-primary text-primary-foreground">
          <tr>
            {head.map((label, index) => (
              <th
                key={index}
                className={`whitespace-nowrap px-3 py-2 font-semibold ${
                  align[index] === 'right' ? 'text-right' : 'text-left'
                }`}
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr
              key={rowIndex}
              className="border-t border-border odd:bg-card even:bg-muted/30"
            >
              {row.map((cell, index) => (
                <td
                  key={index}
                  className={`px-3 py-1.5 align-top ${
                    align[index] === 'right' ? 'text-right tabular-nums' : ''
                  }`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
