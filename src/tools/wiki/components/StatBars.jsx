import { STAT_LABELS, formatNumber, formatRange } from '../wikiFormat'
import { COMBAT_STAT_KEYS } from '../speciesEntry'

// Escala visual das barras de status base (o teto clássico de um status
// base de Pokémon) — só desenho, não é regra de jogo.
const BAR_SCALE = 255

/**
 * Status base em barras (estilo Bulbapedia) + a faixa calculada no nível da
 * espécie (`resolveStatRange`, `speciesEntry.js`).
 */
export function StatBars({ range }) {
  const total = COMBAT_STAT_KEYS.reduce(
    (sum, key) => sum + (range.stats[key]?.base ?? 0),
    0,
  )

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="bg-primary text-primary-foreground">
          <tr>
            <th className="px-3 py-2 text-left font-semibold">Status</th>
            <th className="px-3 py-2 text-right font-semibold">Base</th>
            <th className="w-1/2 px-3 py-2" />
            <th className="whitespace-nowrap px-3 py-2 text-right font-semibold">
              Nível {range.level}
            </th>
          </tr>
        </thead>
        <tbody>
          {COMBAT_STAT_KEYS.map((key) => {
            const stat = range.stats[key]
            if (!stat) return null
            return (
              <tr key={key} className="border-t border-border">
                <td className="whitespace-nowrap px-3 py-1.5">
                  {STAT_LABELS[key]}
                </td>
                <td className="px-3 py-1.5 text-right font-semibold tabular-nums">
                  {stat.base}
                </td>
                <td className="px-3 py-1.5">
                  <div className="h-2.5 w-full rounded-full bg-muted">
                    <div
                      className="h-2.5 rounded-full bg-primary"
                      style={{
                        width: `${Math.min(100, (stat.base / BAR_SCALE) * 100)}%`,
                      }}
                    />
                  </div>
                </td>
                <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums">
                  {formatRange(stat.min, stat.max)}
                </td>
              </tr>
            )
          })}
          <tr className="border-t border-border bg-muted/40 font-semibold">
            <td className="px-3 py-1.5">Total</td>
            <td className="px-3 py-1.5 text-right tabular-nums">
              {formatNumber(total)}
            </td>
            <td colSpan={2} />
          </tr>
        </tbody>
      </table>
    </div>
  )
}
