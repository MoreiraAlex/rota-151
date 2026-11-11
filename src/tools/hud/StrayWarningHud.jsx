'use client'

import { useQuery, useTrait } from 'koota/react'
import { GAME_CONFIG } from '@/core/gameConfig'
import { playerEntity } from '@/core/world/world'
import { OwnedBy, StrayWarning, SummonedCreature } from '@/core/traits'
import { formatSpeciesName } from '@/view/shared/formatName'
import { RecallWarningIcon } from '@/view/scene/RecallWarningIcon'

/**
 * O texto do aviso: título (quem vai voltar) e o porquê. Com o motivo no
 * treinador, quem volta é a criatura que o jogador controla — "você".
 */
function resolveText(warning, name) {
  // Longe de quem treina num boneco (docs/features/067-campo-de-treino-e-
  // avisos-de-nivel.md).
  if (warning.reason === 'trainingFar') {
    if (warning.stage === 'warn') {
      return {
        title: `Longe do treino de ${name}`,
        detail: 'Volte, ou ele vai parar de treinar e voltar para a Pokébola.',
      }
    }
    return {
      title: `Puxando ${name} de volta para a Pokébola`,
      detail: 'Você se afastou do treino — ele vai parar de treinar.',
    }
  }
  if (warning.stage === 'warn') {
    return {
      title: 'Longe demais do treinador',
      detail: 'Volte, ou você vai ser puxado para a Pokébola.',
    }
  }
  switch (warning.reason) {
    case 'trainerFar':
      return {
        title: 'Você vai ser puxado para a Pokébola',
        detail: 'Longe demais do treinador.',
      }
    case 'trainerStuck':
      return {
        title: 'Você vai ser puxado para a Pokébola',
        detail: 'O treinador ficou preso.',
      }
    case 'stuck':
      return {
        title: `Puxando ${name} de volta para a Pokébola`,
        detail: `${name} ficou preso.`,
      }
    default:
      return {
        title: `Puxando ${name} de volta para a Pokébola`,
        detail: `${name} ficou longe demais.`,
      }
  }
}

function StrayWarningBanner({ entity }) {
  const warning = useTrait(entity, StrayWarning)
  const creature = useTrait(entity, SummonedCreature)
  if (!warning || !creature) return null

  const { title, detail } = resolveText(
    warning,
    formatSpeciesName(creature.speciesId),
  )
  const counting = warning.stage === 'recall' && warning.duration > 0
  const fraction = counting ? warning.timeLeft / warning.duration : 0
  const step = GAME_CONFIG.FEEDBACK.RECALL_WARNING.DISPLAY_STEP

  return (
    <div
      className={`w-80 rounded-md border px-3 py-2 text-white shadow-lg backdrop-blur-sm ${
        counting
          ? 'border-red-400/60 bg-red-950/70'
          : 'border-amber-300/50 bg-black/60'
      }`}
    >
      <div className="flex items-center gap-2">
        <RecallWarningIcon warning={warning} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold leading-tight">{title}</p>
          <p className="text-xs text-white/75">{detail}</p>
        </div>
        {counting && (
          <span className="shrink-0 font-mono text-2xl font-bold tabular-nums">
            {Math.ceil(warning.timeLeft)}
          </span>
        )}
      </div>
      {counting && (
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/15">
          <div
            className="h-full rounded-full bg-red-400"
            style={{
              width: `${fraction * 100}%`,
              // Desce liso entre um degrau e outro da contagem.
              transition: `width ${step}s linear`,
            }}
          />
        </div>
      )}
    </div>
  )
}

/**
 * Aviso no topo da tela de que uma criatura do time vai ser puxada para a
 * bola (docs/features/064-revisao-da-ia-do-parceiro.md, Parte 1): a que
 * ficou para trás ("Puxando X de volta...") ou a que o jogador controla,
 * quando o treinador ficou para trás ("Você vai ser puxado..."), com a
 * contagem e a barra do tempo. Antes da contagem, com a controlada só um
 * pouco longe do treinador, o aviso amarelo sem contagem.
 *
 * Só leitura: quem escreve o `StrayWarning` é o `followLimitSystem.js`, em
 * degraus de `FEEDBACK.RECALL_WARNING.DISPLAY_STEP` — redesenha poucas
 * vezes por segundo, não a cada tick.
 */
export function StrayWarningHud() {
  const entities = useQuery(
    SummonedCreature,
    StrayWarning,
    OwnedBy(playerEntity),
  )
  if (entities.length === 0) return null

  return (
    <div className="pointer-events-none absolute inset-x-0 top-20 flex flex-col items-center gap-2">
      {entities.map((entity) => (
        <StrayWarningBanner key={entity} entity={entity} />
      ))}
    </div>
  )
}
