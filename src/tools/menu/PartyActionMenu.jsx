'use client'

import { useEffect, useState } from 'react'
import { ChevronDown, ChevronUp, X } from 'lucide-react'
import { useQuery, useTrait, useWorld } from 'koota/react'
import { getSpecies } from '@/core/data/species'
import {
  MAX_MASTERY,
  MOVE_SLOTS,
  findEmptyMoveSlot,
  listLearnset,
  resolveMoveStatus,
} from '@/core/data/species/moves'
import {
  Party,
  PartyMoves,
  PartyProgress,
  SummonedCreature,
  Training,
} from '@/core/traits'
import {
  aprenderGolpe,
  fecharMenuDeAcoes,
  iniciarTreino,
  pararTreino,
  pedirAprendizado,
  reordenarGolpes,
  resolveTrainingBlock,
} from '@/core/actions'
import { formatSpeciesName } from '@/view/shared/statusDisplay'
import { formatProgressPercent } from '@/view/shared/formatProgress'

const SLOT_KEYS = { 1: 'Q', 2: 'E', 3: 'R' }

// Por que não dá pra treinar agora (`resolveTrainingBlock`) — texto pro jogador.
const TRAINING_BLOCK_TEXT = {
  'not-summoned': 'Invoque o Pokémon perto de um objeto de treino.',
  fainted: 'Desmaiado — não pode treinar.',
  controlled: 'Volte a controlar o treinador.',
  'in-combat': 'Em combate — termine a luta primeiro.',
  'no-object': 'Leve o Pokémon até um objeto de treino.',
}

// Intervalo (ms) pra reavaliar o que depende da posição (perto do objeto).
const REFRESH_MS = 250

/**
 * Menu de ações treinador↔Pokémon (docs/features/038-aprendizado-treino-e-
 * dominio-de-golpes.md) — aberto ao SEGURAR Q/E/R no modo treinador
 * (`PartyActionMenu.slot`). Duas ações por enquanto:
 *
 * - **Treino** — o learnset inteiro da criatura: golpe bloqueado aparece
 *   como `???`; apto, com a barra de treino e "Treinar" (só perto de um
 *   objeto de treino, fora de combate); pronto, com "Aprender"; aprendido,
 *   com a barra de domínio e "Treinar" enquanto não estiver dominado (o
 *   treino no objeto também sobe o domínio).
 * - **Golpes** — os 3 slots (Q/E/R), com setas pra reordenar.
 *
 * Só lê traits e chama actions do core; quem fecha é o X, o Esc ou travar o
 * ponteiro de novo (`PartyMenus`).
 */
export function PartyActionMenu({ trainer, slot }) {
  const world = useWorld()
  const [tab, setTab] = useState('training')
  const [, setRefresh] = useState(0)

  const party = useTrait(trainer, Party)
  const partyMoves = useTrait(trainer, PartyMoves)
  const progress = useTrait(trainer, PartyProgress)
  const summoned = useQuery(SummonedCreature)
  const creature =
    summoned.find((entity) => entity.get(SummonedCreature)?.slot === slot) ??
    null
  const training = useTrait(creature, Training)

  useEffect(() => {
    const id = setInterval(() => setRefresh((n) => n + 1), REFRESH_MS)
    return () => clearInterval(id)
  }, [])

  const species = getSpecies(party?.[slot])
  const moves = partyMoves?.[slot]
  if (!species || !moves) return null

  const level = progress?.[slot]?.level ?? species.level ?? 1
  const block = resolveTrainingBlock(world, slot)

  return (
    <div className="pointer-events-none absolute inset-0 flex items-start justify-center pt-24 font-mono text-white">
      <div className="pointer-events-auto w-96 space-y-3 rounded bg-neutral-900/95 p-4 shadow-lg">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide">
            {formatSpeciesName(species.id)} · Nv. {level}
          </h2>
          <button
            type="button"
            className="text-white/60 hover:text-white"
            onClick={() => fecharMenuDeAcoes(trainer)}
            aria-label="Fechar"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex gap-2 text-xs">
          <TabButton
            active={tab === 'training'}
            onClick={() => setTab('training')}
          >
            Treino
          </TabButton>
          <TabButton active={tab === 'moves'} onClick={() => setTab('moves')}>
            Golpes
          </TabButton>
        </div>

        {tab === 'training' && (
          <TrainingList
            world={world}
            trainer={trainer}
            slot={slot}
            species={species}
            moves={moves}
            level={level}
            block={block}
            creature={creature}
            trainingMoveId={training?.moveId ?? null}
          />
        )}

        {tab === 'moves' && (
          <MoveSlots
            world={world}
            trainer={trainer}
            slot={slot}
            moves={moves}
          />
        )}
      </div>
    </div>
  )
}

function TrainingList({
  world,
  trainer,
  slot,
  species,
  moves,
  level,
  block,
  creature,
  trainingMoveId,
}) {
  const learnset = listLearnset(species)

  return (
    <div className="space-y-2">
      {block && !trainingMoveId && (
        <p className="text-xs text-amber-300/80">
          {TRAINING_BLOCK_TEXT[block]}
        </p>
      )}
      {learnset.map((entry) => {
        const status = resolveMoveStatus(moves, entry, { level })
        if (status === 'locked') {
          return (
            <MoveRow key={entry.id} name="???" dim>
              <span className="text-[10px] text-white/40">Bloqueado</span>
            </MoveRow>
          )
        }

        const name = formatSpeciesName(entry.id)
        if (status === 'learned' || status === 'mastered') {
          const mastery = moves.slots[findSlotOf(moves, entry.id)].mastery
          const isTraining = trainingMoveId === entry.id
          return (
            <MoveRow key={entry.id} name={name}>
              <Bar
                value={mastery / MAX_MASTERY}
                colorClass="bg-sky-400"
                label={
                  status === 'mastered'
                    ? 'Dominado'
                    : isTraining
                      ? 'Treinando domínio'
                      : 'Domínio'
                }
              />
              {/* Equipado sem domínio total: dá pra treinar o domínio. */}
              {status === 'learned' && isTraining && (
                <ActionButton onClick={() => pararTreino(creature)}>
                  Parar
                </ActionButton>
              )}
              {status === 'learned' && !isTraining && (
                <ActionButton
                  disabled={!!block}
                  onClick={() => iniciarTreino(world, trainer, slot, entry.id)}
                >
                  Treinar
                </ActionButton>
              )}
            </MoveRow>
          )
        }

        const trainingProgress = Math.min(1, moves.training?.[entry.id] ?? 0)
        const isTraining = trainingMoveId === entry.id
        return (
          <MoveRow key={entry.id} name={name}>
            <Bar
              value={trainingProgress}
              colorClass="bg-amber-400"
              label={
                status === 'ready'
                  ? 'Pronto'
                  : isTraining
                    ? 'Em treino'
                    : 'Treino'
              }
            />
            {status === 'ready' && (
              <ActionButton
                onClick={() =>
                  learnReadyMove(world, trainer, slot, moves, entry.id)
                }
              >
                Aprender
              </ActionButton>
            )}
            {status === 'apt' && isTraining && (
              <ActionButton onClick={() => pararTreino(creature)}>
                Parar
              </ActionButton>
            )}
            {status === 'apt' && !isTraining && (
              <ActionButton
                disabled={!!block}
                onClick={() => iniciarTreino(world, trainer, slot, entry.id)}
              >
                Treinar
              </ActionButton>
            )}
          </MoveRow>
        )
      })}
    </div>
  )
}

// Com slot vazio, aprende direto; com os 3 cheios, abre o "esquecer qual?".
function learnReadyMove(world, trainer, slot, moves, moveId) {
  const emptySlot = findEmptyMoveSlot(moves)
  if (emptySlot != null) {
    aprenderGolpe(world, null, trainer, slot, moveId, emptySlot)
    return
  }
  fecharMenuDeAcoes(trainer)
  pedirAprendizado(trainer, slot, moveId)
}

function findSlotOf(moves, moveId) {
  return MOVE_SLOTS.find((moveSlot) => moves.slots[moveSlot]?.id === moveId)
}

function MoveSlots({ world, trainer, slot, moves }) {
  return (
    <div className="space-y-2">
      {MOVE_SLOTS.map((moveSlot, index) => {
        const move = moves.slots[moveSlot]
        return (
          <div
            key={moveSlot}
            className="flex items-center gap-2 rounded bg-white/5 px-2 py-1.5 text-xs"
          >
            <span className="w-4 text-center text-white/50">
              {SLOT_KEYS[moveSlot]}
            </span>
            <span className="flex-1">
              {move ? formatSpeciesName(move.id) : '—'}
            </span>
            {move && (
              <Bar value={move.mastery / MAX_MASTERY} colorClass="bg-sky-400" />
            )}
            <div className="flex flex-col">
              <button
                type="button"
                className="text-white/50 hover:text-white disabled:opacity-20"
                disabled={index === 0}
                onClick={() =>
                  reordenarGolpes(
                    world,
                    trainer,
                    slot,
                    moveSlot,
                    MOVE_SLOTS[index - 1],
                  )
                }
                aria-label="Subir"
              >
                <ChevronUp size={12} />
              </button>
              <button
                type="button"
                className="text-white/50 hover:text-white disabled:opacity-20"
                disabled={index === MOVE_SLOTS.length - 1}
                onClick={() =>
                  reordenarGolpes(
                    world,
                    trainer,
                    slot,
                    moveSlot,
                    MOVE_SLOTS[index + 1],
                  )
                }
                aria-label="Descer"
              >
                <ChevronDown size={12} />
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function MoveRow({ name, dim = false, children }) {
  return (
    <div
      className={`flex items-center gap-2 rounded bg-white/5 px-2 py-1.5 text-xs ${
        dim ? 'text-white/40' : ''
      }`}
    >
      <span className="flex-1 truncate">{name}</span>
      {children}
    </div>
  )
}

function Bar({ value, colorClass, label }) {
  return (
    <div className="flex w-32 flex-col gap-0.5">
      <div className="flex justify-between text-[9px] text-white/50">
        <span>{label}</span>
        <span className="tabular-nums text-white/80">
          {formatProgressPercent(value)}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded bg-white/10">
        <div
          className={`h-full ${colorClass}`}
          style={{ width: `${Math.min(1, Math.max(0, value)) * 100}%` }}
        />
      </div>
    </div>
  )
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      className={`rounded px-2 py-1 ${active ? 'bg-white/20' : 'bg-white/5 hover:bg-white/10'}`}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

function ActionButton({ onClick, disabled = false, children }) {
  return (
    <button
      type="button"
      className="rounded bg-white/10 px-2 py-1 text-[10px] hover:bg-white/20 disabled:opacity-30"
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  )
}
