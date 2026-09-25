'use client'

import { useEffect, useState } from 'react'
import { useTrait } from 'koota/react'
import { playerEntity } from '@/core/world/world'
import { getSpecies } from '@/core/data/species'
import { ScanHistory } from '@/core/traits'
import { formatSpeciesName } from '@/view/shared/statusDisplay'
import { StatsScreen } from '../../shared/StatsScreen'

/**
 * Aba "Histórico" do novo menu da Pokédex — pedido do usuário: "exibirá
 * o histórico dos últimos 10 pokémon escaneados... ao selecionar um
 * registro, exibir os detalhes em um painel lateral, reutilizando a
 * visualização de stats atual, mantendo as informações INDIVIDUAIS" (ver
 * docs/features/033-*.md). `ScanHistory` (`core/traits/components/
 * scanHistory.js`) já guarda os snapshots (`{id, speciesId,
 * individualValues, level}`, mais recente primeiro, já cortado em 10) —
 * esta aba só LISTA e SELECIONA, sem lógica própria de histórico.
 *
 * `initialEntryId` (opcional) — pedido do usuário, seção 4: ao concluir
 * um scan, o menu abre sozinho já nesta aba com o registro recém-
 * escaneado selecionado. Quem decide ISSO é `src/app/(auth)/page.js`
 * (fora desta aba); aqui só reage à prop.
 */
export function HistoryTab({ initialEntryId = null }) {
  const history = useTrait(playerEntity, ScanHistory)
  const entries = history?.entries ?? []
  const [selectedEntryId, setSelectedEntryId] = useState(
    initialEntryId ?? entries[0]?.id ?? null,
  )

  useEffect(() => {
    if (initialEntryId != null) setSelectedEntryId(initialEntryId)
  }, [initialEntryId])

  const selectedEntry =
    entries.find((entry) => entry.id === selectedEntryId) ?? null
  const selectedSpecies = selectedEntry
    ? getSpecies(selectedEntry.speciesId)
    : null

  return (
    <div className="flex h-full gap-3">
      <div className="h-full w-40 shrink-0 space-y-1 overflow-y-auto">
        {entries.length === 0 ? (
          <p className="text-xs text-white/50">Nenhum scan ainda.</p>
        ) : (
          entries.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => setSelectedEntryId(entry.id)}
              className={`w-full rounded px-2 py-1 text-left text-[11px] ${
                selectedEntryId === entry.id
                  ? 'bg-white/20 text-white'
                  : 'bg-white/5 text-white/70 hover:bg-white/10'
              }`}
            >
              {formatSpeciesName(entry.speciesId)}
            </button>
          ))
        )}
      </div>

      <div className="min-w-0 flex-1 border-l border-white/10 pl-3">
        {selectedSpecies ? (
          <StatsScreen
            species={selectedSpecies}
            individualValues={selectedEntry.individualValues}
            showIndividual
          />
        ) : (
          <p className="text-xs text-white/50">
            Selecione um registro do histórico pra ver os detalhes.
          </p>
        )}
      </div>
    </div>
  )
}
