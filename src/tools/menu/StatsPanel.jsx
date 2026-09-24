'use client'

import { useState } from 'react'
import { useTrait } from 'koota/react'
import { playerEntity } from '@/core/world/world'
import { getSpecies } from '@/core/data/species'
import { Party } from '@/core/traits'
import {
  formatSpeciesName,
  resolveXpPercent,
  SpritePortrait,
} from '@/view/shared/statusDisplay'

const PARTY_SLOTS = ['slot1', 'slot2', 'slot3']

// Mesmas chaves de `species.stats` (`core/data/species/stats.js`) —
// legenda em português só pra exibição, a chave/dado em si não muda.
// `hp`/`energy` não têm `base`/`iv`/`ev` (não são "status de combate" no
// sentido de IV/EV — são o que alimenta `Vitals`, ver `core/traits/
// components/vitals.js`), por isso a tabela abaixo trata os dois campos
// como opcionais (`stat?.base ?? '-'`) em vez de assumir que existem.
const STAT_LABELS = {
  hp: 'Vida',
  energy: 'Energia',
  attack: 'Ataque',
  defense: 'Defesa',
  sp_atk: 'At. especial',
  sp_def: 'Def. especial',
  speed: 'Velocidade',
}

// Radar (hexágono clássico de status de Pokémon) — só os SEIS status de
// COMBATE, na ordem/convenção usual (sentido horário a partir do topo:
// HP, ATK, DEF, SpA, SpD, SPD). `energy` fica de fora de propósito —
// não é um dos seis status "de combate" clássicos, é o substituto da
// stamina (ver docstring completa mais abaixo).
const RADAR_KEYS = ['hp', 'attack', 'defense', 'sp_atk', 'sp_def', 'speed']
const RADAR_SHORT_LABELS = {
  hp: 'HP',
  attack: 'ATK',
  defense: 'DEF',
  sp_atk: 'SpA',
  sp_def: 'SpD',
  speed: 'SPD',
}

/**
 * Janela de status das criaturas do time — pedido do usuário: "quero
 * uma janela que exiba os status do pokemon, por hora pode separar por
 * abas para cada pokemon que tenho equipado". Uma aba por slot do time
 * (`Party.slot1-3`) que tenha uma espécie EQUIPADA (não precisa estar
 * invocada — é dado ESTÁTICO da espécie, sempre disponível, mesmo
 * critério gracioso de `PartyHud.jsx`); slot vazio nem vira aba.
 *
 * Subtela do `PauseMenu.jsx` (mesmo padrão de `InventoryPanel.jsx`) —
 * aberta pela tecla `P` (`src/app/(auth)/page.js`, mesma técnica de
 * `KeyI` pro Inventário) ou pelo botão "Status" no menu principal.
 *
 * `species.stats` ainda não tem formato fechado em toda espécie (ver
 * `core/data/species/_template/index.js` — "o sistema de batalha ainda
 * não foi desenhado") — hoje só algumas espécies migraram (`boy`/
 * `bulbasaur`/`charmander`); as demais ainda têm `stats: {}` ou
 * incompleto. Sem dado, a aba mostra uma mensagem em vez de tabela/
 * radar vazios — mesmo fallback gracioso de toda outra config opcional
 * deste projeto.
 *
 * Retrato (`SpritePortrait`, `view/shared/statusDisplay.jsx` — mesmo
 * componente de `StatusHud.jsx`/`PartyHud.jsx`) + CP (lido DIRETO de
 * `species.stats.cp`, calculado e guardado na própria espécie — ver
 * `calculateCP`, `core/data/species/stats.js`).
 *
 * **Radar dos seis status (rodada seguinte)** — pedido do usuário:
 * "na tela de status, quero um radar chart para os atributos". SVG à
 * mão (sem lib nova) — hexágono com os SEIS status de combate
 * (`RADAR_KEYS`, sem `energy`, que não é um deles). Escala DINÂMICA
 * por criatura (`maxValue = maior status dela × 1.15`, não um teto
 * fixo de "jogo de Pokémon de verdade") — o sistema de batalha ainda
 * não tem um teto real definido (níveis muito baixos ainda, status na
 * casa de 10-20), então um teto fixo alto deixaria o hexágono minúsculo
 * pra qualquer criatura atual; a troca é que o formato não é
 * comparável em ABSOLUTO entre duas criaturas diferentes lado a lado
 * (só a forma RELATIVA de cada uma, olhada uma de cada vez, que já é o
 * ponto principal de um radar de status).
 *
 * **Estilo "Pokédex" (mesma rodada)** — pedido do usuário: "esse menu
 * vai ser a pokedex no futuro, consegue deixar mais no estilo?".
 * Moldura vermelha + tira de "luzes" no topo (referência direta ao
 * dispositivo clássico) só AQUI (não em `PauseMenu.jsx`/`MenuView` —
 * essa moldura é compartilhada com Inventário/Configurações, que não
 * pediram nada disso). Não verificado visualmente (sandbox sem
 * navegador) — é um primeiro passo, fácil de ajustar depois de ver em
 * jogo.
 */
export function StatsPanel() {
  const party = useTrait(playerEntity, Party)
  const equipped = PARTY_SLOTS.map((slot) => ({
    slot,
    speciesId: party?.[slot],
  })).filter((entry) => entry.speciesId)

  const [activeSlot, setActiveSlot] = useState(null)
  const active =
    equipped.find((entry) => entry.slot === activeSlot) ?? equipped[0]

  if (!active) {
    return (
      <PokedexFrame>
        <p className="p-3 text-xs text-white/50">
          Nenhuma criatura equipada no time ainda.
        </p>
      </PokedexFrame>
    )
  }

  const species = getSpecies(active.speciesId)

  return (
    <PokedexFrame
      tabs={equipped.map(({ slot, speciesId }) => {
        const tabSpecies = getSpecies(speciesId)
        return {
          key: slot,
          label: tabSpecies ? formatSpeciesName(tabSpecies.id) : speciesId,
          active: slot === active.slot,
          onClick: () => setActiveSlot(slot),
        }
      })}
    >
      {species ? (
        <StatsScreen species={species} />
      ) : (
        <p className="text-xs text-white/50">Espécie não encontrada.</p>
      )}
    </PokedexFrame>
  )
}

/**
 * Moldura vermelha + tira de "luzes" + abas como botões de dispositivo
 * — o "estilo Pokédex" em si, separado do CONTEÚDO (`StatsScreen`) pra
 * não misturar decoração com dado. `tabs` opcional (a mensagem de
 * "nenhuma criatura equipada" não tem aba nenhuma pra mostrar).
 */
function PokedexFrame({ tabs, children }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 rounded-t border-2 border-b-0 border-red-600 bg-red-700 px-2 py-1.5">
        <span className="h-2.5 w-2.5 rounded-full bg-sky-300 ring-1 ring-white/50" />
        <span className="h-1.5 w-1.5 rounded-full bg-red-300" />
        <span className="h-1.5 w-1.5 rounded-full bg-yellow-300" />
        <span className="h-1.5 w-1.5 rounded-full bg-green-300" />
      </div>

      {tabs && tabs.length > 0 && (
        <div className="flex gap-1 border-x-2 border-red-600 bg-neutral-950 px-2 pt-2">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={tab.onClick}
              className={`rounded-t px-2 py-1 text-[11px] ${
                tab.active
                  ? 'bg-neutral-900 text-white'
                  : 'bg-black/40 text-white/50 hover:bg-black/60'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      <div className="rounded-b border-2 border-t-0 border-red-600 bg-neutral-900 p-3">
        {children}
      </div>
    </div>
  )
}

function StatsScreen({ species }) {
  const stats = species.stats
  const hasStats = stats && Object.keys(stats).length > 0
  const cp = typeof stats?.cp === 'number' ? stats.cp : null

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <SpritePortrait
          species={species}
          size={48}
          xpPercent={resolveXpPercent(species)}
        />
        <div className="flex flex-1 flex-col">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">
              {formatSpeciesName(species.id)}
            </span>
            {species.level != null && (
              <span className="text-[11px] text-white/50">
                Lv.{species.level}
              </span>
            )}
          </div>
          {cp != null && (
            <span className="text-[11px] text-amber-400">CP {cp}</span>
          )}
        </div>
      </div>

      {hasStats ? (
        <>
          <StatsRadar stats={stats} />

          <table className="w-full text-[11px]">
            <thead>
              <tr className="text-white/50">
                <th className="pb-1 text-left font-normal">Atributo</th>
                <th className="pb-1 text-right font-normal">Base</th>
                <th className="pb-1 text-right font-normal">IV</th>
                <th className="pb-1 text-right font-normal">EV</th>
                <th className="pb-1 text-right font-normal">Status</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(STAT_LABELS).map(([key, label]) => {
                const stat = stats[key]
                if (!stat) return null
                return (
                  <tr key={key} className="border-t border-white/10">
                    <td className="py-1">{label}</td>
                    <td className="text-right text-white/70">
                      {stat?.base ?? '-'}
                    </td>
                    <td className="text-right text-white/70">
                      {stat?.iv ?? '-'}
                    </td>
                    <td className="text-right text-white/70">
                      {stat?.ev ?? '-'}
                    </td>
                    <td className="text-right font-semibold">
                      {stat?.stat ?? '-'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </>
      ) : (
        <p className="text-xs text-white/50">
          Sem status configurados ainda pra esta espécie.
        </p>
      )}
    </div>
  )
}

const RADAR_SIZE = 160
const RADAR_CENTER = RADAR_SIZE / 2
const RADAR_RADIUS = 58
const RADAR_LABEL_OFFSET = 18
const RADAR_RINGS = [1 / 3, 2 / 3, 1]

/** Ponto na borda do hexágono pro eixo `index` (de `RADAR_KEYS.length`
 * eixos), a `radius` de distância do centro — `index` 0 sempre no
 * TOPO (`-90°`), sentido horário, mesma convenção de relógio que
 * `XpRing` (`view/shared/statusDisplay.jsx`) já usa. */
function radarPoint(index, total, radius) {
  const angle = (Math.PI * 2 * index) / total - Math.PI / 2
  return {
    x: RADAR_CENTER + radius * Math.cos(angle),
    y: RADAR_CENTER + radius * Math.sin(angle),
  }
}

/**
 * Radar (hexágono) dos seis status de combate — SVG puro, mesma técnica
 * de "sem canvas, sem lib nova" que `XpRing` já usa pro anel de XP.
 * `maxValue` é o MAIOR status desta própria criatura ×1.15 (folga pro
 * pico não encostar na borda) — escala relativa, não um teto absoluto
 * de jogo de Pokémon de verdade (ver docstring de `StatsPanel` acima
 * pro porquê). Marcas/grade seguem o mesmo espírito recessivo de
 * `XpRing` (linhas finas, baixa opacidade) — só o polígono de dados e
 * os vértices usam cor de destaque de verdade.
 */
function StatsRadar({ stats }) {
  const total = RADAR_KEYS.length
  const values = RADAR_KEYS.map((key) => stats[key]?.stat ?? 0)
  const maxValue = Math.max(...values, 1) * 1.15

  const dataPoints = RADAR_KEYS.map((key, i) => {
    const value = stats[key]?.stat ?? 0
    return radarPoint(i, total, (value / maxValue) * RADAR_RADIUS)
  })
  const dataPath = dataPoints.map((p) => `${p.x},${p.y}`).join(' ')

  return (
    <svg
      width={RADAR_SIZE}
      height={RADAR_SIZE}
      viewBox={`0 0 ${RADAR_SIZE} ${RADAR_SIZE}`}
      className="mx-auto"
    >
      {RADAR_RINGS.map((ratio) => (
        <polygon
          key={ratio}
          points={RADAR_KEYS.map((_, i) => {
            const p = radarPoint(i, total, RADAR_RADIUS * ratio)
            return `${p.x},${p.y}`
          }).join(' ')}
          className="fill-none stroke-white/10"
          strokeWidth={1}
        />
      ))}

      {RADAR_KEYS.map((key, i) => {
        const p = radarPoint(i, total, RADAR_RADIUS)
        return (
          <line
            key={key}
            x1={RADAR_CENTER}
            y1={RADAR_CENTER}
            x2={p.x}
            y2={p.y}
            className="stroke-white/10"
            strokeWidth={1}
          />
        )
      })}

      <polygon
        points={dataPath}
        className="fill-sky-400/25 stroke-sky-400"
        strokeWidth={2}
        strokeLinejoin="round"
      />
      {dataPoints.map((p, i) => (
        <circle
          key={RADAR_KEYS[i]}
          cx={p.x}
          cy={p.y}
          r={3}
          className="fill-sky-300"
        />
      ))}

      {RADAR_KEYS.map((key, i) => {
        const p = radarPoint(i, total, RADAR_RADIUS + RADAR_LABEL_OFFSET)
        return (
          <text
            key={key}
            x={p.x}
            y={p.y}
            textAnchor="middle"
            dominantBaseline="middle"
            className="fill-white/70 text-[9px]"
          >
            {RADAR_SHORT_LABELS[key]} {stats[key]?.stat ?? 0}
          </text>
        )
      })}
    </svg>
  )
}
