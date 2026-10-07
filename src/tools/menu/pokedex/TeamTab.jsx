'use client'

import { useState } from 'react'
import { useTrait } from 'koota/react'
import { playerEntity } from '@/core/world/world'
import { getSpecies } from '@/core/data/species'
import {
  CreatureLevel,
  CreatureMoves,
  IndividualValues,
  Pokemon,
} from '@/core/traits'
import { usePartyPokemon } from '@/view/hooks/usePartyPokemon'
import { MAX_MASTERY, MOVE_SLOTS } from '@/core/data/species/moves'
import { formatSpeciesName, TypeBadge } from '@/view/shared/statusDisplay'
import { getSkill } from '@/core/data/skills'
import { resolveSkillType } from '@/core/data/types'
import { formatProgressPercent } from '@/view/shared/formatProgress'
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
 * Lê o registro de cada Pokémon do time (`usePartyPokemon`, docs/features/
 * 041-inventario-de-itens-e-pokemon.md): espécie, IV, nível e golpes.
 */
export function TeamTab() {
  const party = usePartyPokemon(playerEntity)
  const [selectedSlot, setSelectedSlot] = useState(
    SLOTS.find((slot) => party[slot.key])?.key ?? SLOTS[0].key,
  )
  const selected = party[selectedSlot]

  return (
    <div className="space-y-2">
      <div className="flex gap-1">
        {SLOTS.map(({ key, label }) => (
          <SlotButton
            key={key}
            label={label}
            pokemon={party[key]}
            selected={selectedSlot === key}
            onSelect={() => setSelectedSlot(key)}
          />
        ))}
      </div>

      {selected ? (
        <TeamMemberDetails pokemon={selected} />
      ) : (
        <p className="p-3 text-xs text-white/50">Slot vazio.</p>
      )}
    </div>
  )
}

function SlotButton({ label, pokemon, selected, onSelect }) {
  const speciesId = useTrait(pokemon, Pokemon)?.speciesId
  return (
    <button
      type="button"
      disabled={!pokemon}
      onClick={onSelect}
      className={`flex-1 rounded px-2 py-1 text-[11px] ${
        selected
          ? 'bg-white/20 text-white'
          : pokemon
            ? 'bg-white/5 text-white/70 hover:bg-white/10'
            : 'cursor-default bg-black/30 text-white/30'
      }`}
    >
      {label} · {speciesId ? formatSpeciesName(speciesId) : 'vazio'}
    </button>
  )
}

/** Status e golpes do Pokémon selecionado, ao vivo. */
function TeamMemberDetails({ pokemon }) {
  const speciesId = useTrait(pokemon, Pokemon)?.speciesId
  const individualValues = useTrait(pokemon, IndividualValues)
  const progress = useTrait(pokemon, CreatureLevel) ?? null
  const moves = useTrait(pokemon, CreatureMoves)
  const species = speciesId ? getSpecies(speciesId) : null
  if (!species) return null

  return (
    <>
      <StatsScreen
        species={species}
        individualValues={individualValues}
        progress={progress}
        showIndividual
      />
      <MoveList moves={moves} />
    </>
  )
}

const MOVE_KEYS = { 1: 'Q', 2: 'E', 3: 'R' }

/**
 * Golpes da criatura (só leitura) — os 3 slots com o domínio de cada um
 * (docs/features/038-aprendizado-treino-e-dominio-de-golpes.md). Trocar e
 * treinar é pelo menu de ações (segurar a tecla do slot no jogo).
 */
export function MoveList({ moves }) {
  if (!moves) return null
  return (
    <div className="space-y-1 rounded bg-white/5 p-2">
      <h3 className="text-[10px] uppercase tracking-wide text-white/50">
        Golpes
      </h3>
      {MOVE_SLOTS.map((moveSlot) => {
        const move = moves.slots[moveSlot]
        const fraction = move ? move.mastery / MAX_MASTERY : 0
        return (
          <div key={moveSlot} className="flex items-center gap-2 text-[11px]">
            <span className="w-3 text-white/50">{MOVE_KEYS[moveSlot]}</span>
            <span className="flex flex-1 items-center gap-1.5">
              {move ? formatSpeciesName(move.id) : '—'}
              {move && getSkill(move.id) && (
                <TypeBadge type={resolveSkillType(getSkill(move.id))} />
              )}
            </span>
            {move && (
              <>
                <div className="h-1.5 w-24 overflow-hidden rounded bg-white/10">
                  <div
                    className="h-full bg-sky-400"
                    style={{ width: `${fraction * 100}%` }}
                  />
                </div>
                <span className="w-14 text-right tabular-nums text-white/70">
                  {formatProgressPercent(fraction)}
                </span>
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}
