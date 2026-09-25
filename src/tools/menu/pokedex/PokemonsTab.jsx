'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import { useTrait } from 'koota/react'
import { playerEntity } from '@/core/world/world'
import { listSpecies } from '@/core/data/species'
import { PokedexEntries } from '@/core/traits'
import { formatSpeciesName } from '@/view/shared/statusDisplay'
import { CREATURE_TINTS } from '@/view/creatureTints'
import { StatsScreen } from '../../shared/StatsScreen'

// 151 Pokémon da 1ª geração (pedido do usuário, ver docs/features/033-
// *.md) — a grade tem sempre 151 SLOTS fixos, um por `dexNumber`, mesmo
// que hoje só `bulbasaur`/`charmander`/`squirtle` (dexNumber 1/4/7)
// tenham dado de verdade no registro (`core/data/species/index.js`).
// Slot sem espécie no registro é indistinguível de "espécie existe mas
// não foi escaneada ainda" — os dois mostram só "?" — então não precisa
// de uma lista estática com os 151 nomes/números só pra preencher os
// slots vazios (evita duplicar dado que não existe em lugar nenhum do
// projeto ainda).
const POKEDEX_SIZE = 151

/**
 * Aba "Pokémons" do novo menu da Pokédex — grade dos 151 + painel
 * lateral com detalhes GENÉRICOS da espécie selecionada (pedido do
 * usuário: ver docs/features/033-*.md). `PokedexEntries`
 * (`core/traits/components/pokedexEntries.js`) é a única fonte de
 * "o que já foi escaneado" — nunca duplica esse controle em estado
 * local.
 *
 * Um slot só é selecionável se já escaneado (`scannedIds.includes`);
 * clicar num "?" não faz nada (`onSelect` nem é chamado, `disabled`
 * no botão). O painel lateral usa `StatsScreen` com
 * `showIndividual={false}` — pedido do usuário: "remover as colunas
 * de IV, EV, status individual, a linha de Energy e a de CP... exibir
 * apenas as informações gerais e atributos base da espécie" — sem
 * criar nenhuma lógica de cálculo nova, `resolveCreatureStats`
 * (`core/data/species/stats.js`) já resolve os valores base sozinho
 * quando `individualValues` não é passado.
 */
export function PokemonsTab() {
  const entries = useTrait(playerEntity, PokedexEntries)
  const scannedIds = entries?.speciesIds ?? []
  const byDexNumber = useSpeciesByDexNumber()
  const [selectedId, setSelectedId] = useState(null)

  const selectedSpecies =
    (selectedId &&
      scannedIds.includes(selectedId) &&
      findSpeciesById(byDexNumber, selectedId)) ||
    null

  return (
    <div className="flex h-full gap-2">
      <div className="grid grid-cols-10 content-start gap-1 overflow-y-auto pr-1">
        {Array.from({ length: POKEDEX_SIZE }, (_, i) => i + 1).map(
          (dexNumber) => {
            const species = byDexNumber.get(dexNumber)
            const scanned = !!species && scannedIds.includes(species.id)
            return (
              <PokedexSlot
                key={dexNumber}
                dexNumber={dexNumber}
                species={species}
                scanned={scanned}
                selected={scanned && species.id === selectedId}
                onSelect={() => scanned && setSelectedId(species.id)}
              />
            )
          },
        )}
      </div>

      <div className="w-72 overflow-y-auto border-l border-white/10 pl-3">
        {selectedSpecies ? (
          <StatsScreen species={selectedSpecies} showIndividual={false} vertical/>
        ) : (
          <p className="text-xs text-white/50">
            Selecione um Pokémon já escaneado pra ver os detalhes.
          </p>
        )}
      </div>
    </div>
  )
}

function useSpeciesByDexNumber() {
  return useMemo(() => {
    const byDexNumber = new Map()
    for (const species of listSpecies()) {
      if (species.dexNumber != null) byDexNumber.set(species.dexNumber, species)
    }
    return byDexNumber
  }, [])
}

function findSpeciesById(byDexNumber, speciesId) {
  for (const species of byDexNumber.values()) {
    if (species.id === speciesId) return species
  }
  return null
}

function PokedexSlot({ dexNumber, species, scanned, selected, onSelect }) {
  return (
    <button
      type="button"
      disabled={!scanned}
      onClick={onSelect}
      title={scanned ? formatSpeciesName(species.id) : `#${dexNumber}`}
      className={`flex h-10 w-10 flex-col items-center justify-center rounded border text-[8px] ${
        selected
          ? 'border-sky-400 bg-sky-400/20'
          : scanned
            ? 'cursor-pointer border-white/20 bg-white/5 hover:bg-white/10'
            : 'cursor-default border-white/5 bg-black/30 text-white/30'
      }`}
    >
      {scanned ? (
        <PokedexSlotSprite species={species} />
      ) : (
        <span className="text-sm">?</span>
      )}
      <span className="text-white/40">
        {String(dexNumber).padStart(3, '0')}
      </span>
    </button>
  )
}

/** Sprite pequeno do slot escaneado — mesmo fallback de cor sólida
 * (`CREATURE_TINTS`) que `SpritePortrait` usa (`view/shared/
 * statusDisplay.jsx`), sem o anel de XP (não faz sentido numa grade de
 * 151 ícones pequenos). */
function PokedexSlotSprite({ species }) {
  const path = species.sprite?.path

  if (!path) {
    return (
      <div
        className="h-6 w-6 rounded-full"
        style={{ backgroundColor: CREATURE_TINTS[species.id] ?? '#999999' }}
      />
    )
  }

  return (
    <Image
      src={path}
      alt=""
      width={24}
      height={24}
      className="h-6 w-6 object-cover"
      style={{ transform: `scale(${species.sprite?.scale ?? 1})` }}
    />
  )
}
