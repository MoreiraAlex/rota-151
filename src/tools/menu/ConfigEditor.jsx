import { useState } from 'react'

/**
 * Editor genérico e recursivo de `GAME_CONFIG` (ver
 * docs/features/015-menu-de-pausa-e-configuracoes.md) — não hardcoda campo
 * nenhum: percorre o objeto, um `<input type="number">` por valor numérico
 * (folha), uma seção por objeto aninhado. Cresce sozinho conforme
 * `gameConfig.js` ganha seções novas.
 *
 * Escreve direto no objeto (`GAME_CONFIG` não é congelado — `const` só trava
 * o binding, não o conteúdo); os systems já leem os valores frescos a cada
 * tick (ver decisão da v0.0.15), então a mudança vale no próximo tick, sem
 * precisar recarregar a página. Sem validação/guardrails de valor — é
 * ferramenta de dev, confia em quem está mexendo.
 *
 * `value` é sempre o objeto raiz passado pra dentro; `onChange(path, novo)`
 * escreve o valor lá. Um `forceRerender` no componente pai garante que os
 * inputs (controlados) reflitam o que acabou de ser digitado.
 */
export function ConfigEditor({ value, path = [], onChange }) {
  if (typeof value === 'number') {
    return (
      <label className="flex items-center justify-between gap-2 py-0.5 text-[11px]">
        <span className="text-white/70">{path[path.length - 1]}</span>
        <input
          type="number"
          step="any"
          className="w-24 rounded bg-black/40 px-1 py-0.5 text-right text-white"
          value={value}
          onChange={(event) => {
            const parsed = Number(event.target.value)
            if (!Number.isNaN(parsed)) onChange(path, parsed)
          }}
        />
      </label>
    )
  }

  if (value && typeof value === 'object') {
    return (
      <div className="space-y-1 border-l border-white/10 pl-2">
        {path.length > 0 && (
          <p className="text-[11px] font-semibold uppercase tracking-wide text-white/50">
            {path[path.length - 1]}
          </p>
        )}
        {Object.entries(value).map(([key, child]) => (
          <ConfigEditor
            key={key}
            value={child}
            path={[...path, key]}
            onChange={onChange}
          />
        ))}
      </div>
    )
  }

  return null
}

/**
 * Painel de configurações — usa `ConfigEditor` sobre `GAME_CONFIG` inteiro.
 */
export function ConfigPanel({ gameConfig }) {
  const [, forceRerender] = useState(0)

  const handleChange = (path, newValue) => {
    let target = gameConfig
    for (let i = 0; i < path.length - 1; i++) target = target[path[i]]
    target[path[path.length - 1]] = newValue
    forceRerender((n) => n + 1)
  }

  return (
    <div className="max-h-[60vh] overflow-y-auto pr-2">
      <ConfigEditor value={gameConfig} onChange={handleChange} />
    </div>
  )
}
