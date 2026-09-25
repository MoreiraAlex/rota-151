'use client'

import { resolveCreatureStats } from '@/core/data/species/stats'
import {
  formatSpeciesName,
  resolveXpPercent,
  SpritePortrait,
} from '@/view/shared/statusDisplay'

// Mesmas chaves de `species.stats` (`core/data/species/stats.js`) —
// legenda em português só pra exibição, a chave/dado em si não muda.
// `hp`/`energy` não têm `iv`/`ev` (não são "status de combate" no
// sentido de IV/EV — são o que alimenta `Vitals`, ver `core/traits/
// components/vitals.js`), por isso a tabela abaixo trata os campos
// como opcionais (`stat?.base ?? '-'`) em vez de assumir que existem.
// `energy` só aparece no modo INDIVIDUAL (ver docstring de
// `StatsScreen`) — não é um dos status de combate "de espécie".
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
 * Tela de status de UMA criatura — retrato + CP + radar + tabela de
 * status. Extraída de `tools/menu/StatsPanel.jsx` (docs/features/032-
 * *.md) nesta rodada (docs/features/033-*.md) pra ser reaproveitada
 * pelas TRÊS abas do novo menu da Pokédex (`tools/menu/pokedex/`) —
 * pedido do usuário: "reaproveitar componentes existentes sempre que
 * possível, principalmente a tela de stats", "não criar uma nova
 * lógica de cálculo de atributos se os dados necessários já estiverem
 * disponíveis".
 *
 * `species.stats` ainda não tem formato fechado em toda espécie (ver
 * `core/data/species/_template/index.js`) — hoje só algumas migraram
 * (`boy`/`bulbasaur`/`charmander`/`squirtle`); as demais ainda têm
 * `stats: {}` ou incompleto. Sem dado, a tela mostra uma mensagem em
 * vez de tabela/radar vazios — mesmo fallback gracioso de sempre.
 *
 * `stats`/`cp` NÃO vêm de um literal guardado na espécie —
 * `resolveCreatureStats` (`core/data/species/stats.js`) recalcula na
 * hora, combinando `base`/`ev` da espécie com o `individualValues`
 * passado (IV de UMA entidade — congelado por indivíduo — ou `null`
 * pra "sem indivíduo", ver `showIndividual` abaixo).
 *
 * `showIndividual` (novo, docs/features/033-*.md) — pedido do usuário:
 * a aba "Pokémons" (visão GENÉRICA por espécie, sem indivíduo real por
 * trás — grid dos 151) precisa mostrar só os valores BASE, sem "IV",
 * "EV", "Status" (o valor individual calculado) nem CP nem a linha de
 * Energia — tudo isso só faz sentido pra uma criatura de VERDADE (time
 * ou histórico de scan). `true` (default, comportamento de sempre) —
 * tabela completa + CP; `false` — só Atributo/Base, sem CP, sem linha
 * de Energia, radar plotando `base` em vez do `stat` calculado (que
 * dependeria de um IV que não existe nesse modo).
 */
export function StatsScreen({ species, individualValues, showIndividual = true, vertical = false }) {
  const stats = resolveCreatureStats(species, individualValues)
  const hasStats = stats != null
  const cp = showIndividual && typeof stats?.cp === 'number' ? stats.cp : null

  return (
    <div className="w-full space-y-3">
      {hasStats ? (
        <>
          <div className={`flex w-full items-${vertical ? 'center' : 'start'} justify-between`}>
            {/* Pokémon */}
            <div className="flex items-center gap-2">
              <SpritePortrait
                species={species}
                size={48}
                xpPercent={resolveXpPercent(species)}
              />

              <div className="flex flex-col">
                <span className="text-sm font-semibold">
                  {formatSpeciesName(species.id)}
                </span>

                {cp != null && (
                  <span className="text-[11px] text-amber-400">
                    CP {cp}
                  </span>
                )}
              </div>
            </div>

            {/* Radar */}
            {!vertical && (
              <div className="flex flex-1 justify-center">
                <StatsRadar
                  stats={stats}
                  showIndividual={showIndividual}
                />
              </div>
            )}

            {/* Level */}
            {species.level != null && (
              <span className="text-[11px] text-white/50">
                Lv.{species.level}
              </span>
            )}
          </div>

          {/* Radar vertical */}
          {vertical && (
            <div className="flex w-full justify-center">
              <StatsRadar
                stats={stats}
                showIndividual={showIndividual}
              />
            </div>
          )}

          <table className="w-full text-[11px]">
            <thead>
              <tr className="text-white/50">
                <th className="pb-1 text-left font-normal">
                  Atributo
                </th>
                <th className="pb-1 text-right font-normal">
                  Base
                </th>

                {showIndividual && (
                  <>
                    <th className="pb-1 text-right font-normal">
                      IV
                    </th>
                    <th className="pb-1 text-right font-normal">
                      EV
                    </th>
                    <th className="pb-1 text-right font-normal">
                      Status
                    </th>
                  </>
                )}
              </tr>
            </thead>

            <tbody>
              {Object.entries(STAT_LABELS).map(([key, label]) => {
                if (key === 'energy' && !showIndividual) {
                  return null
                }

                const stat = stats[key]

                if (!stat) {
                  return null
                }

                return (
                  <tr
                    key={key}
                    className="border-t border-white/10"
                  >
                    <td className="py-1">
                      {label}
                    </td>

                    <td className="text-right text-white/70">
                      {stat.base ?? '-'}
                    </td>

                    {showIndividual && (
                      <>
                        <td className="text-right text-white/70">
                          {stat.iv ?? '-'}
                        </td>

                        <td className="text-right text-white/70">
                          {stat.ev ?? '-'}
                        </td>

                        <td className="text-right font-semibold">
                          {stat.stat ?? '-'}
                        </td>
                      </>
                    )}
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
 * de jogo de Pokémon de verdade. Marcas/grade seguem o mesmo espírito
 * recessivo de `XpRing` (linhas finas, baixa opacidade) — só o
 * polígono de dados e os vértices usam cor de destaque de verdade.
 *
 * `showIndividual` (ver docstring de `StatsScreen`) decide qual campo
 * plotar por eixo: `stat` (valor individual calculado, default) ou
 * `base` (visão genérica por espécie, sem indivíduo real por trás).
 */
function StatsRadar({ stats, showIndividual }) {
  const valueKey = showIndividual ? 'stat' : 'base'
  const total = RADAR_KEYS.length
  const values = RADAR_KEYS.map((key) => stats[key]?.[valueKey] ?? 0)
  const maxValue = Math.max(...values, 1) * 1.15

  const dataPoints = RADAR_KEYS.map((key, i) => {
    const value = stats[key]?.[valueKey] ?? 0
    return radarPoint(i, total, (value / maxValue) * RADAR_RADIUS)
  })
  const dataPath = dataPoints.map((p) => `${p.x},${p.y}`).join(' ')

  return (
    <svg
      width={RADAR_SIZE}
      height={RADAR_SIZE}
      viewBox={`0 0 ${RADAR_SIZE} ${RADAR_SIZE}`}
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
            {RADAR_SHORT_LABELS[key]} {stats[key]?.[valueKey] ?? 0}
          </text>
        )
      })}
    </svg>
  )
}
