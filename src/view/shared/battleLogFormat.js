import { EVENT_TYPES } from '@/core/events'
import { GAME_CONFIG } from '@/core/gameConfig'
import { getSkill } from '@/core/data/skills'
import { Pokemon, WildCreature, resolveCreatureSpeciesId } from '@/core/traits'
import { formatSpeciesName } from './formatName'
import { resolveFeedbackColor, resolveSide } from '../vfx/feedbackColors'

/**
 * Texto do log de batalha (docs/features/039-tipos-e-combate-classico.md): cada
 * evento de combate vira zero ou mais linhas `{ text, color }`, no estilo dos
 * jogos de turno ("Charmander usou Ember!"). Puro — quem guarda e mostra é
 * `battleLogSystem.js` + `tools/hud/BattleLogHud.jsx`.
 */

// Nome do atributo com o artigo ("O Ataque de X caiu!").
const STAT_NAMES = {
  attack: 'O Ataque',
  defense: 'A Defesa',
  sp_atk: 'O Ataque Especial',
  sp_def: 'A Defesa Especial',
  accuracy: 'A Precisão',
}

const EFFECTIVENESS_SUFFIX = {
  super: ' É super efetivo!',
  weak: ' Não é muito efetivo…',
}

/**
 * Nome de quem luta: a criatura do time pelo nome da espécie, a selvagem com
 * "selvagem", outra criatura inimiga com "inimigo"; sem espécie, o treinador.
 */
export function formatCombatantName(entity) {
  if (!entity?.isAlive?.()) return 'Alguém'
  const speciesId = resolveCreatureSpeciesId(entity)
  if (!speciesId) return 'Treinador'
  const name = formatSpeciesName(speciesId)
  if (entity.has(WildCreature)) return `${name} selvagem`
  return resolveSide(entity) === 'ally' ? name : `${name} inimigo`
}

/** Nome da criatura do time num evento de progresso (em campo ou na bola). */
function formatPartyName(event) {
  if (event.creature?.isAlive?.()) return formatCombatantName(event.creature)
  const speciesId = event.pokemon?.get?.(Pokemon)?.speciesId
  return speciesId ? formatSpeciesName(speciesId) : 'Sua criatura'
}

/** Nome do golpe (o id formatado); id fora do registro, "Ataque". */
export function formatMoveName(attackId) {
  return getSkill(attackId) ? formatSpeciesName(attackId) : 'Ataque'
}

/** Se o evento entra no log: as repetições do treino no objeto nunca. */
function isLoggedSlot(slot) {
  return slot !== 'training'
}

function line(text, color) {
  return { text, color }
}

/** "O Ataque de X caiu!" / "...caiu muito!" / "...subiu!" / "...subiu muito!" */
export function formatStatChangeLine(stat, delta, targetName) {
  const verb = delta < 0 ? 'caiu' : 'subiu'
  const intensity = Math.abs(delta) >= 2 ? ' muito' : ''
  return `${STAT_NAMES[stat] ?? stat} de ${targetName} ${verb}${intensity}!`
}

function formatResolved(event) {
  const { FEEDBACK } = GAME_CONFIG
  const target = event.target
  if (!target) return [line('Mas não acertou ninguém!', FEEDBACK.MISS_COLOR)]

  const name = formatCombatantName(target)
  if (event.missed) return [line(`Errou ${name}!`, FEEDBACK.MISS_COLOR)]
  if (event.effectiveness === 'immune') {
    return [line(`Não afeta ${name}…`, FEEDBACK.EFFECTIVENESS_COLORS.immune)]
  }
  // golpe de status: quem fala é o `statStageChanged`; a semente fala aqui
  if (event.status) {
    const seeds = getSkill(event.attackId)?.effects?.some(
      (effect) => effect.type === 'leechSeed',
    )
    return seeds
      ? [
          line(
            `${name} foi semeado!`,
            resolveFeedbackColor('debuff', resolveSide(target)),
          ),
        ]
      : []
  }

  const color = resolveFeedbackColor(
    event.critical ? 'crit' : 'damage',
    resolveSide(target),
  )
  const suffix =
    (event.critical ? ' Golpe crítico!' : '') +
    (EFFECTIVENESS_SUFFIX[event.effectiveness] ?? '')
  // canalizado: uma linha só, no primeiro tick (sem número — o dano vem aos
  // poucos)
  if (event.channel) {
    if (event.channelTick > 0) return []
    return [line(`${name} foi atingido!${suffix}`, color)]
  }
  const amount = Math.max(1, Math.round(event.damage))
  return [line(`${name} perdeu ${amount} de HP.${suffix}`, color)]
}

/**
 * Linhas de UM evento (`[]` = não entra no log). Os eventos de golpe do
 * treino ficam de fora (`isLoggedSlot`).
 */
export function formatBattleLogEvent(event) {
  const { FEEDBACK } = GAME_CONFIG
  const { BATTLE_LOG } = FEEDBACK
  switch (event.type) {
    case EVENT_TYPES.ATTACK_USED:
      if (!isLoggedSlot(event.slot)) return []
      return [
        line(
          `${formatCombatantName(event.entity)} usou ${formatMoveName(event.attackId)}!`,
          BATTLE_LOG.USED_COLOR,
        ),
      ]
    case EVENT_TYPES.ATTACK_FAILED:
      if (!isLoggedSlot(event.slot)) return []
      return [line('Mas falhou!', FEEDBACK.FAIL_COLOR)]
    case EVENT_TYPES.ATTACK_RESOLVED:
      if (!isLoggedSlot(event.slot)) return []
      return formatResolved(event)
    case EVENT_TYPES.STAT_STAGE_CHANGED: {
      if (!event.target?.isAlive?.()) return []
      return [
        line(
          formatStatChangeLine(
            event.stat,
            event.delta,
            formatCombatantName(event.target),
          ),
          resolveFeedbackColor(
            event.delta < 0 ? 'debuff' : 'buff',
            resolveSide(event.target),
          ),
        ),
      ]
    }
    case EVENT_TYPES.ATTACK_INTERRUPTED:
      if (!isLoggedSlot(event.slot)) return []
      return [
        line(
          `O golpe de ${formatCombatantName(event.entity)} foi interrompido!`,
          FEEDBACK.INTERRUPT_COLOR,
        ),
      ]
    case EVENT_TYPES.LEECH_SEED_DRAINED: {
      const amount = Math.max(1, Math.round(event.damage))
      return [
        line(
          `A semente drenou ${amount} de HP de ${formatCombatantName(event.target)}!`,
          resolveFeedbackColor('damage', resolveSide(event.target)),
        ),
      ]
    }
    case EVENT_TYPES.BURN_APPLIED:
      return [
        line(
          `${formatCombatantName(event.target)} foi queimado!`,
          FEEDBACK.CONDITION_COLORS.burn,
        ),
      ]
    case EVENT_TYPES.BURN_DAMAGED: {
      const amount = Math.max(1, Math.round(event.damage))
      return [
        line(
          `${formatCombatantName(event.target)} sofre com a queimadura (${amount} de HP)!`,
          FEEDBACK.CONDITION_COLORS.burn,
        ),
      ]
    }
    case EVENT_TYPES.CREATURE_FAINTED:
      return [
        line(
          `${formatCombatantName(event.entity)} desmaiou!`,
          FEEDBACK.MISS_COLOR,
        ),
      ]
    case EVENT_TYPES.EXPERIENCE_GAINED:
      return [
        line(
          `${formatPartyName(event)} ganhou ${Math.round(event.amount)} XP!`,
          FEEDBACK.XP_COLOR,
        ),
      ]
    case EVENT_TYPES.LEVELED_UP:
      return [
        line(
          `${formatPartyName(event)} subiu para o nível ${event.level}!`,
          FEEDBACK.LEVEL_UP_COLOR,
        ),
      ]
    case EVENT_TYPES.MOVE_UNLOCKED:
      return [
        line(
          `${formatPartyName(event)} pode aprender ${event.moveIds
            .map(formatSpeciesName)
            .join(', ')}!`,
          FEEDBACK.MOVE_NOTICE_COLOR,
        ),
      ]
    case EVENT_TYPES.MOVE_LEARNED: {
      const forgot = event.forgottenId
        ? ` e esqueceu ${formatSpeciesName(event.forgottenId)}`
        : ''
      return [
        line(
          `${formatPartyName(event)} aprendeu ${formatSpeciesName(event.moveId)}${forgot}!`,
          FEEDBACK.MOVE_NOTICE_COLOR,
        ),
      ]
    }
    default:
      return []
  }
}
