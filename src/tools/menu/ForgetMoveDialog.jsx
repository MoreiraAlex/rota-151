'use client'

import { useTrait, useWorld } from 'koota/react'
import { getSpecies } from '@/core/data/species'
import { MOVE_SLOTS } from '@/core/data/species/moves'
import { MoveLearnRequest, Party, PartyMoves } from '@/core/traits'
import { adiarAprendizado, aprenderGolpe } from '@/core/actions'
import { formatSpeciesName } from '@/view/shared/statusDisplay'

const SLOT_KEYS = { 1: 'Q', 2: 'E', 3: 'R' }

/**
 * "Esquecer qual golpe?" (docs/features/038-aprendizado-treino-e-dominio-de-
 * golpes.md) — o treino de um golpe terminou com os 3 slots ocupados
 * (`MoveLearnRequest`). Escolher um slot esquece o golpe dele (que guarda
 * parte do treino) e põe o novo no lugar; "Agora não" deixa o golpe pronto
 * pra aprender depois (pelo menu de Treino).
 */
export function ForgetMoveDialog({ trainer }) {
  const world = useWorld()
  const request = useTrait(trainer, MoveLearnRequest)
  const party = useTrait(trainer, Party)
  const partyMoves = useTrait(trainer, PartyMoves)

  const { slot, moveId } = request ?? {}
  const species = slot ? getSpecies(party?.[slot]) : null
  const moves = slot ? partyMoves?.[slot] : null
  if (!moveId || !species || !moves) return null

  const speciesName = formatSpeciesName(species.id)
  const moveName = formatSpeciesName(moveId)

  return (
    <div className="pointer-events-none absolute inset-0 flex items-start justify-center pt-24 font-mono text-white">
      <div className="pointer-events-auto w-96 space-y-3 rounded bg-neutral-900/95 p-4 shadow-lg">
        <p className="text-sm">
          {speciesName} quer aprender <strong>{moveName}</strong>, mas já sabe 3
          golpes. Esquecer qual?
        </p>
        <div className="space-y-2">
          {MOVE_SLOTS.map((moveSlot) => {
            const move = moves.slots[moveSlot]
            return (
              <button
                key={moveSlot}
                type="button"
                className="flex w-full items-center gap-2 rounded bg-white/10 px-3 py-2 text-left text-xs hover:bg-white/20"
                onClick={() =>
                  aprenderGolpe(world, null, trainer, slot, moveId, moveSlot)
                }
              >
                <span className="w-4 text-white/50">{SLOT_KEYS[moveSlot]}</span>
                <span>{move ? formatSpeciesName(move.id) : '—'}</span>
              </button>
            )
          })}
        </div>
        <button
          type="button"
          className="w-full rounded bg-white/5 px-3 py-2 text-xs text-white/70 hover:bg-white/10"
          onClick={() => adiarAprendizado(trainer)}
        >
          Agora não
        </button>
      </div>
    </div>
  )
}
