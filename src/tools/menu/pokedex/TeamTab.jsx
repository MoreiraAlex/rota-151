'use client'

import { useState } from 'react'
import { useTrait } from 'koota/react'
import { playerEntity } from '@/core/world/world'
import { getSpecies } from '@/core/data/species'
import { Party, PartyIndividualValues } from '@/core/traits'
import { formatSpeciesName } from '@/view/shared/statusDisplay'
import { StatsScreen } from '../../shared/StatsScreen'

const SLOTS = [
  { key: 'slot1', label: 'Q' },
  { key: 'slot2', label: 'E' },
  { key: 'slot3', label: 'R' },
]

/**
 * Aba "Time" do novo menu da Pokédex — pedido do usuário: "reaproveitar
 * a tela de status anterior organizada em abas por Pokémon do time...
 * integrar essa visualização ao novo menu, mantendo os comportamentos e
 * informações já disponíveis" (ver docs/features/033-*.md). Uma sub-
 * navegação por slot (`Q`/`E`/`R`, mesma tecla física de sempre — ver
 * `tools/hud/PartyHud.jsx`), sempre com detalhes do slot selecionado
 * exibidos via `StatsScreen` (`tools/shared/StatsScreen.jsx`) com
 * `showIndividual={true}` (INDIVIDUAL de verdade — time é sempre uma
 * criatura de verdade, com `IndividualValues` próprio, diferente da aba
 * "Pokémons"/genérica).
 *
 * Lê só `Party`/`PartyIndividualValues` do treinador — mesmos traits
 * que `PartyHud.jsx` já lê, sem duplicar a lógica de resolução de
 * espécie/IV (`getSpecies(party[slot])` + `partyIndividualValues[slot]`
 * é exatamente o par que `resolveCreatureStats`, `core/data/species/
 * stats.js`, já espera).
 */
export function TeamTab() {
  const party = useTrait(playerEntity, Party)
  const partyIndividualValues = useTrait(playerEntity, PartyIndividualValues)
  const [selectedSlot, setSelectedSlot] = useState(
    SLOTS.find((slot) => party?.[slot.key])?.key ?? SLOTS[0].key,
  )

  if (!party) return null

  const species = party[selectedSlot] ? getSpecies(party[selectedSlot]) : null
  const individualValues = partyIndividualValues?.[selectedSlot]

  return (
    <div className="space-y-2">
      <div className="flex gap-1">
        {SLOTS.map(({ key, label }) => {
          const speciesId = party[key]
          return (
            <button
              key={key}
              type="button"
              disabled={!speciesId}
              onClick={() => setSelectedSlot(key)}
              className={`flex-1 rounded px-2 py-1 text-[11px] ${
                selectedSlot === key
                  ? 'bg-white/20 text-white'
                  : speciesId
                    ? 'bg-white/5 text-white/70 hover:bg-white/10'
                    : 'cursor-default bg-black/30 text-white/30'
              }`}
            >
              {label} · {speciesId ? formatSpeciesName(speciesId) : 'vazio'}
            </button>
          )
        })}
      </div>

      {species ? (
        <StatsScreen
          species={species}
          individualValues={individualValues}
          showIndividual
        />
      ) : (
        <p className="p-3 text-xs text-white/50">Slot vazio.</p>
      )}
    </div>
  )
}
