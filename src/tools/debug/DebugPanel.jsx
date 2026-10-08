'use client'

import { useState } from 'react'

import { useTrait, useTag, useQuery, useQueryFirst } from 'koota/react'
import { playerEntity, cameraEntity, world } from '@/core/world/world'
import { getItem, listItems } from '@/core/data/items'
import { getSpecies } from '@/core/data/species'
import {
  desequiparMao,
  equiparNaMao,
  ganharExperiencia,
  progredirTreino,
  somarDominio,
} from '@/core/actions'
import {
  MOVE_SLOTS,
  listLearnset,
  resolveMoveStatus,
} from '@/core/data/species/moves'
import { GAME_CONFIG } from '@/core/gameConfig'
import {
  Position,
  Velocity,
  AnimationState,
  Grounded,
  OrbitCamera,
  CharacterController,
  InputControlled,
  Mood,
  MovementStats,
  PathState,
  Vitals,
  HeldItem,
  CreatureLevel,
  CreatureMoves,
  Pokemon,
  Projectile,
  SummonBall,
  SummonedCreature,
  applyDamage,
} from '@/core/traits'
import { usePartyPokemon } from '@/view/hooks/usePartyPokemon'

const MOOD_OPTIONS = ['awake', 'sleeping', 'angry', 'faint']

const DEBUG_DAMAGE_AMOUNT = 20

/**
 * Painel de texto com estado ao vivo de quem está no controle + câmera +
 * config relevante pra tunar. Lê via hooks do koota (fora do Canvas — o
 * WorldProvider cobre a página inteira). Ferramenta de debug: só monta
 * quando o toggle está ligado (ver src/app/(auth)/page.js), nunca
 * requisito de gameplay.
 *
 * Posição/velocidade/animação/chão/cápsula/movimento/vitals seguem quem
 * tem `InputControlled` AGORA (`useQueryFirst`, mesma técnica headless de
 * achar "quem está sendo pilotado" — ver docs/features/018-troca-de-
 * controle-treinador-criatura.md), não mais fixo em `playerEntity`: depois
 * de trocar de controle pra uma criatura, esse é o corpo que de fato
 * importa debugar (inclusive vitals — pular/dashar controlando uma
 * criatura drena A STAMINA DELA, não a do treinador, ver
 * `characterPhysicsSystem.js`/`playerActionSystem.js`). `heldItem`/`party`
 * continuam fixos no treinador (`playerEntity`) de propósito — são dados
 * PRÓPRIOS dele (`Party`/item de arremesso equipado), fazem sentido editar
 * não importa quem está sendo pilotado no momento.
 */
export function DebugPanel() {
  const controlled = useQueryFirst(InputControlled, Position)
  const position = useTrait(controlled, Position)
  const velocity = useTrait(controlled, Velocity)
  const anim = useTrait(controlled, AnimationState)
  const grounded = useTag(controlled, Grounded)
  const orbit = useTrait(cameraEntity, OrbitCamera)
  const body = useTrait(controlled, CharacterController)
  const movement = useTrait(controlled, MovementStats)
  const vitals = useTrait(controlled, Vitals)
  const mood = useTrait(controlled, Mood)
  const controlledCreature = useTrait(controlled, SummonedCreature)
  const heldItem = useTrait(playerEntity, HeldItem)
  const party = usePartyPokemon(playerEntity)
  const playerPath = useTrait(playerEntity, PathState)
  const projectiles = useQuery(Projectile, Position)
  const summonBalls = useQuery(SummonBall, Position)
  const summoned = useQuery(SummonedCreature, Position)

  if (
    !controlled ||
    !position ||
    !velocity ||
    !anim ||
    !orbit ||
    !body ||
    !movement ||
    !vitals ||
    !mood ||
    !heldItem ||
    !party
  ) {
    return null
  }

  const item = heldItem.itemId ? getItem(heldItem.itemId) : null
  const isBot = controlled === playerEntity

  const speed = Math.hypot(velocity.x, velocity.z)
  const capsuleHeight = 2 * (body.capsuleRadius + body.capsuleHalfHeight)

  return (
    <div className="pointer-events-none absolute bottom-4 left-4 space-y-1 rounded bg-black/70 p-3 font-mono text-xs text-white">
      <p className="text-white/60">
        controlando:{' '}
        {isBot
          ? 'treinador'
          : `${controlledCreature?.speciesId} (${controlledCreature?.slot})`}
      </p>
      {/* Humor (docs/features/023-estado-de-humor-e-piscar-de-olhos.md) —
          sem IA nenhuma decidindo isso ainda, só este seletor pra testar.
          Só tem efeito visível numa espécie com `eyeStates` configurado
          (hoje só Bulbasaur) — controlando o treinador ou outra espécie, é
          inofensivo (`Mood` existe em todo mundo, só nada lê pra ele). */}
      <select
        className="pointer-events-auto rounded bg-black/60 px-1 py-0.5 text-[10px] text-white"
        value={mood.state}
        onChange={(event) => {
          controlled.set(Mood, { state: event.target.value })
        }}
      >
        {MOOD_OPTIONS.map((state) => (
          <option key={state} value={state}>
            humor: {state}
          </option>
        ))}
      </select>
      <p>
        pos: {position.x.toFixed(2)}, {position.y.toFixed(2)},{' '}
        {position.z.toFixed(2)}
      </p>
      <p>
        speed: {speed.toFixed(2)} u/s · {grounded ? 'no chão' : 'no ar'}
      </p>
      <p>anim: {anim.id}</p>
      <p>
        câmera: yaw {orbit.yaw.toFixed(2)} · pitch {orbit.pitch.toFixed(2)} ·
        dist {orbit.distance.toFixed(1)}
      </p>
      <hr className="border-white/20" />
      <p>
        cápsula: r={body.capsuleRadius} h={body.capsuleHalfHeight} (altura total{' '}
        {capsuleHeight.toFixed(2)})
      </p>
      <p>
        walk/run: {movement.walkSpeed}/{movement.runSpeed} u/s
      </p>
      <hr className="border-white/20" />
      <VitalsBar
        label="hp"
        value={vitals.hp}
        max={vitals.maxHp}
        color="bg-red-500"
      />
      <p className="text-[10px] text-white/60">
        {vitals.hp.toFixed(0)}/{vitals.maxHp} · regen{' '}
        {vitals.hpRegenDelay > 0
          ? `pausado (${vitals.hpRegenDelay.toFixed(1)}s)`
          : `${vitals.hpRegenPercent}%/s`}
      </p>
      <VitalsBar
        label="stamina"
        value={vitals.stamina}
        max={vitals.maxStamina}
        color="bg-yellow-400"
      />
      <p className="text-[10px] text-white/60">
        {vitals.stamina.toFixed(0)}/{vitals.maxStamina} · regen{' '}
        {vitals.staminaRegenDelay > 0
          ? `pausado (${vitals.staminaRegenDelay.toFixed(1)}s)`
          : `${vitals.staminaRegenPercent}%/s`}
      </p>
      <button
        type="button"
        className="pointer-events-auto mt-1 rounded bg-red-900 px-2 py-1 text-[10px] hover:bg-red-800"
        onClick={() => {
          const current = controlled.get(Vitals)
          controlled.set(
            Vitals,
            applyDamage(
              current,
              DEBUG_DAMAGE_AMOUNT,
              current.hpRegenDelayAfterDamage,
            ),
          )
        }}
      >
        tomar {DEBUG_DAMAGE_AMOUNT} de dano (debug)
      </button>
      <hr className="border-white/20" />
      <p>item em mãos: {item ? `${item.id} (${item.category})` : 'nenhum'}</p>
      {/* Alcance de scan (docs/features/033-*.md) — pedido do usuário:
          "colocar essa linha de alcance no debug, pra eu poder
          analisar". Mesma cadeia de fallback que `scannerModeSystem.js`
          usa de verdade (`item.scanner?.range ?? GAME_CONFIG.SCANNER.
          RANGE`), só pra EXIBIR — item de categoria `scanner` só. */}
      {item?.category === 'scanner' && (
        <p className="text-[10px] text-white/60">
          alcance do scan: {item.scanner?.range ?? GAME_CONFIG.SCANNER.RANGE}m
        </p>
      )}
      <select
        className="pointer-events-auto rounded bg-black/60 px-1 py-0.5 text-[10px] text-white"
        value={heldItem.itemId ?? ''}
        onChange={(event) => {
          // Pelas actions, pra grade do Inventário acompanhar a mão. Item que
          // o jogador não tem ainda vai pra mão direto (teste de item).
          const itemId = event.target.value || null
          desequiparMao(world, playerEntity)
          if (!itemId || equiparNaMao(world, playerEntity, itemId)) return
          playerEntity.set(HeldItem, { itemId })
        }}
      >
        <option value="">nenhum</option>
        {listItems().map((candidate) => (
          <option key={candidate.id} value={candidate.id}>
            {candidate.id} ({candidate.category})
          </option>
        ))}
      </select>
      {/* Variante da mira da Pokébola (docs/features/043-captura.md) — pro
          usuário comparar as duas jogando. */}
      <CaptureAimModeSelect />
      <hr className="border-white/20" />
      {/* O time se monta pelo Inventário (docs/features/041-inventario-de-
          itens-e-pokemon.md); aqui só os botões de teste por slot. */}
      {['slot1', 'slot2', 'slot3'].map((slot) => (
        <div key={slot}>
          <PartySlotExperience slot={slot} pokemon={party[slot]} />
          <PartySlotMoves pokemon={party[slot]} />
        </div>
      ))}
      <hr className="border-white/20" />
      <p>projéteis ativos: {projectiles.length}</p>
      {projectiles.map((entity) => {
        const p = entity.get(Position)
        const hit = entity.get(Projectile).hit
        return (
          <p key={entity} className="text-[10px] text-white/60">
            {hit ? 'atingiu em' : 'voando'}: {p.x.toFixed(1)}, {p.y.toFixed(1)},{' '}
            {p.z.toFixed(1)}
          </p>
        )
      })}
      <p>esferas de invocar em voo: {summonBalls.length}</p>
      {summonBalls.map((entity) => {
        const p = entity.get(Position)
        return (
          <p key={entity} className="text-[10px] text-white/60">
            voando: {p.x.toFixed(1)}, {p.y.toFixed(1)}, {p.z.toFixed(1)}
          </p>
        )
      })}
      <p>
        criaturas de fora:{' '}
        {summoned.length === 0
          ? 'nenhuma'
          : summoned
              .map((entity) => entity.get(SummonedCreature).slot)
              .join(', ')}
      </p>
      {/* Só quem está SEGUINDO tem path de verdade (ver creatureFollowSystem.js
          — pula quem tem InputControlled) — a criatura controlada agora não
          aparece aqui (o PathState dela ficou parado no último valor de
          antes da troca, mostrar seria enganoso), e o treinador aparece
          quando ele é quem virou o bot (docs/features/018-troca-de-
          controle-treinador-criatura.md). */}
      {!isBot && playerPath && (
        <PathStatusRow label="treinador (bot)" pathState={playerPath} />
      )}
      {summoned
        .filter((entity) => entity !== controlled)
        .map((entity) => (
          <PathStatusRow
            key={entity}
            label={entity.get(SummonedCreature).slot}
            pathState={entity.get(PathState)}
          />
        ))}
    </div>
  )
}

/** Uma linha de status de caminho (waypoints restantes + recálculo) — usada
 * tanto pro treinador virando bot quanto pra cada criatura invocada que
 * não seja quem está sendo controlado agora (ver DebugPanel acima). */
const CAPTURE_AIM_MODES = [
  { value: 'arc', label: 'arco + círculo' },
  { value: 'reticle', label: 'só retículo (Arceus)' },
]

function CaptureAimModeSelect() {
  const [mode, setMode] = useState(GAME_CONFIG.CAPTURE.AIM.MODE)
  return (
    <select
      className="pointer-events-auto rounded bg-black/60 px-1 py-0.5 text-[10px] text-white"
      value={mode}
      onChange={(event) => {
        GAME_CONFIG.CAPTURE.AIM.MODE = event.target.value
        setMode(event.target.value)
      }}
    >
      {CAPTURE_AIM_MODES.map((option) => (
        <option key={option.value} value={option.value}>
          mira da Pokébola: {option.label}
        </option>
      ))}
    </select>
  )
}

function PathStatusRow({ label, pathState }) {
  const { waypoints, waypointIndex, repathTimer } = pathState
  const remaining = waypoints.length - waypointIndex
  return (
    <p className="text-[10px] text-white/60">
      {label} · path:{' '}
      {remaining > 0 ? `${remaining} waypoint(s)` : 'direto (sem desvio)'}
      {' · '}
      recalc em {Math.max(0, repathTimer).toFixed(2)}s
    </p>
  )
}

/**
 * Nível/XP de um slot do time + botão "+XP" (`ganharExperiencia`, mesma
 * action do desmaio de uma selvagem) — pra testar a subida de nível sem
 * caçar selvagem (docs/features/037-experiencia-e-nivel.md). Sem a fila de
 * eventos do loop aqui, então sem o texto flutuante: só o estado muda.
 */
function PartySlotExperience({ slot, pokemon }) {
  const speciesId = useTrait(pokemon, Pokemon)?.speciesId
  const progress = useTrait(pokemon, CreatureLevel)
  if (!progress) return null
  return (
    <div className="flex items-center gap-2 text-[10px] text-white/60">
      <span>
        {slot} {speciesId}: nv {progress.level} · {progress.xp} xp
      </span>
      <button
        type="button"
        className="pointer-events-auto rounded bg-sky-900 px-1.5 py-0.5 hover:bg-sky-800"
        onClick={() => {
          ganharExperiencia(
            world,
            null,
            pokemon,
            GAME_CONFIG.EXPERIENCE.DEBUG_XP_AMOUNT,
          )
        }}
      >
        +{GAME_CONFIG.EXPERIENCE.DEBUG_XP_AMOUNT} xp
      </button>
    </div>
  )
}

/**
 * Golpes de um slot do time (docs/features/038-aprendizado-treino-e-dominio-
 * de-golpes.md) + botões de debug: "+treino" soma progresso no primeiro golpe
 * APTO (ou pronto), "+domínio" soma domínio nos 3 slots — pra testar o ciclo
 * sem treinar nem lutar. Sem a fila de eventos do loop (como o "+XP").
 */
function PartySlotMoves({ pokemon }) {
  const moves = useTrait(pokemon, CreatureMoves)
  const speciesId = useTrait(pokemon, Pokemon)?.speciesId
  const level = useTrait(pokemon, CreatureLevel)?.level ?? 1
  if (!moves || !speciesId) return null

  const apt = listLearnset(getSpecies(speciesId)).find(
    (entry) => resolveMoveStatus(moves, entry, { level }) === 'apt',
  )
  const summary = MOVE_SLOTS.map((moveSlot) => {
    const move = moves.slots[moveSlot]
    return move ? `${move.id} ${Math.round(move.mastery * 100)}%` : '—'
  }).join(' · ')
  const training = Object.entries(moves.training)
    .map(([id, progress]) => `${id} ${Math.round(progress * 100)}%`)
    .join(' · ')

  return (
    <div className="space-y-0.5 text-[10px] text-white/60">
      <div>{summary}</div>
      {training && <div className="text-amber-300/70">treino: {training}</div>}
      <div className="flex gap-1">
        <button
          type="button"
          disabled={!apt}
          className="pointer-events-auto rounded bg-amber-900 px-1.5 py-0.5 hover:bg-amber-800 disabled:opacity-30"
          onClick={() =>
            progredirTreino(
              world,
              null,
              pokemon,
              apt.id,
              GAME_CONFIG.MOVES.TRAINING.DEBUG_PROGRESS,
            )
          }
        >
          +treino{apt ? ` (${apt.id})` : ''}
        </button>
        <button
          type="button"
          className="pointer-events-auto rounded bg-sky-900 px-1.5 py-0.5 hover:bg-sky-800"
          onClick={() => {
            for (const moveSlot of MOVE_SLOTS) {
              somarDominio(
                world,
                pokemon,
                moveSlot,
                GAME_CONFIG.MOVES.DEBUG_MASTERY,
              )
            }
          }}
        >
          +domínio
        </button>
      </div>
    </div>
  )
}

/** Barra fininha de progresso, sem dependência nenhuma — só pra visualizar
 * HP/stamina no `DebugPanel` de relance. */
function VitalsBar({ label, value, max, color }) {
  const percent = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0
  return (
    <div className="flex items-center gap-2">
      <span className="w-14 shrink-0">{label}</span>
      <div className="h-2 flex-1 overflow-hidden rounded bg-white/15">
        <div className={`h-full ${color}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  )
}
