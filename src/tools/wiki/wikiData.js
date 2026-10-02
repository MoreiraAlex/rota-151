import { GAME_CONFIG } from '@/core/gameConfig'
import {
  resolveStab,
  rollCriticalMultiplier,
} from '@/core/battle/calculateDamage'
import {
  ATTACK_SLOTS,
  resolveAttackForEntity,
  resolveSpeedFactor,
} from '@/core/battle/attackCasting'
import {
  STAT_STAGE_LIMIT,
  accuracyMultiplier,
  stageMultiplier,
} from '@/core/battle/statStages'
import { DEFAULT_ACCURACY } from '@/core/battle/accuracy'
import { resolveLevelCost } from '@/core/battle/levelCost'
import { resolveRetaliateChance } from '@/core/battle/wildBehavior'
import { resolveMovementCostMultiplier } from '@/core/actions/stamina'
import { resolveSpeedMultiplier } from '@/core/actions/movementSpeed'
import { resolveCreatureStats } from '@/core/data/species/stats'
import { getItem } from '@/core/data/items'
import { MAX_ENTRIES as SCAN_HISTORY_LIMIT } from '@/core/traits/components/scanHistory'
import { resolveDamagePreview } from './damageCalculator'
import {
  COMBAT_STAT_KEYS,
  listWikiSpecies,
  resolveSpeciesAttacks,
  resolveSpeciesMovement,
  resolveSpeciesMoves,
  resolveStatRange,
  uniformIndividualValues,
} from './speciesEntry'
import {
  listSkillUsers,
  listWikiSkills,
  resolveAttackArea,
  resolveAttackCategory,
  resolveSkillSummary,
} from './skillEntry'
import { describeEffect, formatName } from './wikiFormat'

/**
 * O "retrato" de números da wiki: TUDO que as páginas mostram, num objeto
 * simples (só número, texto, lista) tirado do jogo pelas funções dele.
 *
 * As páginas nunca leem o jogo direto — só este retrato. A versão ATUAL da
 * wiki monta o retrato ao vivo; quando uma versão nova abre, a anterior
 * congela o seu num `data.json` (`npm run wiki:freeze`) e continua mostrando
 * os números da época mesmo depois de o jogo mudar.
 */

// Entradas de exemplo das tabelas ilustrativas — não são valores do jogo.
const EXAMPLE_LEVELS = [5, 25, 50, 100]
const EXAMPLE_HP_FRACTIONS = [1, 0.75, 0.5, 0.25, 0]
const EXAMPLE_COURAGE = [
  { own: 1, hit: 0.1, attacker: 1 },
  { own: 1, hit: 0.1, attacker: 0.5 },
  { own: 0.75, hit: 0.25, attacker: 1 },
  { own: 0.5, hit: 0.1, attacker: 1 },
  { own: 0.5, hit: 0.4, attacker: 1 },
  { own: 0.25, hit: 0.1, attacker: 0.25 },
]

function toDegrees(radians) {
  return (radians * 180) / Math.PI
}

function middleIv() {
  const { IV_MIN, IV_MAX } = GAME_CONFIG.BATTLE
  return Math.round((IV_MIN + IV_MAX) / 2)
}

function buildAttack(entry) {
  const { attack } = entry
  return {
    slot: entry.slot,
    skillId: entry.slot === 'primary' ? null : attack.id,
    name: entry.slot === 'primary' ? 'Ataque básico' : formatName(attack.id),
    category: resolveAttackCategory(attack),
    power: attack.damage?.power ?? null,
    area: resolveAttackArea(attack),
    channel: attack.damageMode === 'channel',
    range: attack.range,
    cost: entry.staminaCost,
    cooldown: entry.cooldown,
    duration: entry.duration,
    effects: (attack.effects ?? []).map(describeEffect),
  }
}

function buildSpecies(species) {
  const range = resolveStatRange(species)
  const { IV_MIN, IV_MAX } = GAME_CONFIG.BATTLE
  return {
    id: species.id,
    name: formatName(species.id),
    dexNumber: species.dexNumber ?? null,
    sprite: species.sprite?.path ?? null,
    level: range.level,
    bodyRadius: species.body?.capsuleRadius ?? null,
    hasTypes: Boolean(species.types?.length),
    stats: range.stats,
    energy: range.energy,
    hpRegen: range.hpRegen,
    cp: range.cp,
    speedFactor: {
      slow: resolveSpeedFactor(species, uniformIndividualValues(IV_MIN)),
      fast: resolveSpeedFactor(species, uniformIndividualValues(IV_MAX)),
    },
    movement: resolveSpeciesMovement(species),
    attacks: resolveSpeciesAttacks(species).map(buildAttack),
    moves: resolveSpeciesMoves(species).map((move) => move.id),
  }
}

/** Status de UMA espécie com o mesmo IV em todos — tabela "quanto o IV pesa". */
function buildIvExample(species) {
  if (!species) return null
  const { IV_MIN, IV_MAX } = GAME_CONFIG.BATTLE
  const ivs = [IV_MIN, middleIv(), IV_MAX]
  const resolved = ivs.map((iv) =>
    resolveCreatureStats(species, uniformIndividualValues(iv)),
  )
  return {
    speciesName: formatName(species.id),
    level: species.level ?? 1,
    columns: ivs,
    rows: [...COMBAT_STAT_KEYS, 'energy'].map((stat) => ({
      stat,
      values: resolved.map((stats) => stats?.[stat]?.stat ?? null),
    })),
  }
}

function buildSkill(skill) {
  const summary = resolveSkillSummary(skill)
  return {
    id: skill.id,
    name: formatName(skill.id),
    category: summary.category,
    power: summary.power,
    accuracy: summary.accuracy,
    area: summary.area,
    range: summary.range,
    radius: summary.radius,
    duration: summary.duration,
    effectAt: summary.effectAt,
    channel: summary.channel,
    effects: summary.effects.map(describeEffect),
    weight: summary.weight,
    baseCooldown: summary.baseCooldown,
    fixedCost: summary.fixedCost,
    costByLevel: EXAMPLE_LEVELS.map((level) => ({
      level,
      cost: summary.fixedCost ?? resolveLevelCost(level, summary.weight),
    })),
    users: listSkillUsers(skill.id).map((user) => ({
      speciesId: user.species.id,
      speciesName: formatName(user.species.id),
      level: user.species.level ?? 1,
      slot: user.slot,
      cost: user.slot ? user.staminaCost : null,
      cooldown: user.slot ? user.cooldown : null,
      duration: user.slot ? user.duration : null,
    })),
  }
}

/** Cada golpe de dano de cada criatura contra a primeira da lista. */
function buildDamageExamples(speciesList) {
  const defender = speciesList[0]
  if (!defender) return null
  const ivs = uniformIndividualValues(middleIv())
  const rows = []
  for (const attacker of speciesList) {
    for (const { slot } of ATTACK_SLOTS) {
      const attack = resolveAttackForEntity(attacker, slot, ivs)
      if (!attack?.damage) continue
      const { damage } = resolveDamagePreview({
        attacker: { species: attacker, individualValues: ivs },
        defender: { species: defender, individualValues: ivs },
        slot,
      })
      rows.push({
        attackerName: formatName(attacker.id),
        attackName:
          slot === 'primary' ? 'Ataque básico' : formatName(attack.id),
        category: resolveAttackCategory(attack),
        power: attack.damage.power ?? null,
        channel: damage.channel,
        min: damage.channel ? damage.total : damage.min,
        max: damage.channel ? damage.total : damage.max,
        minPercent: damage.channel ? damage.totalPercent : damage.minPercent,
        maxPercent: damage.channel ? damage.totalPercent : damage.maxPercent,
      })
    }
  }
  return { defenderName: formatName(defender.id), iv: middleIv(), rows }
}

export function buildWikiData() {
  const {
    BATTLE,
    ACTION_COST,
    AI_ATTACK,
    AI_ENERGY,
    AI_MOVEMENT,
    AI_TARGET,
    WILD_BEHAVIOR,
    PARTY_BEHAVIOR,
    TRAINER_BATTLE,
    FAINT,
    STAMINA_BY_HP,
    SPEED_BY_HP,
    PLAYER_ACTIONS,
  } = GAME_CONFIG
  const speciesList = listWikiSpecies()

  const stageRows = []
  for (let stage = -STAT_STAGE_LIMIT; stage <= STAT_STAGE_LIMIT; stage++) {
    stageRows.push({
      stage,
      stat: stageMultiplier(stage),
      accuracy: accuracyMultiplier(stage),
    })
  }

  return {
    battle: {
      ivMin: BATTLE.IV_MIN,
      ivMax: BATTLE.IV_MAX,
      criticalChance: BATTLE.CRITICAL_HIT_CHANCE,
      criticalMultiplier: rollCriticalMultiplier(() => 0),
      randomMin: BATTLE.DAMAGE_RANDOM_MIN,
      randomMax: BATTLE.DAMAGE_RANDOM_MAX,
      stabMultiplier: resolveStab('tipo', ['tipo']),
      speedReference: BATTLE.ATTACK_SPEED.REFERENCE,
      speedFactorMin: BATTLE.ATTACK_SPEED.MIN_FACTOR,
      speedFactorMax: BATTLE.ATTACK_SPEED.MAX_FACTOR,
      defaultAccuracy: DEFAULT_ACCURACY,
      maxCombatHeight: BATTLE.MAX_COMBAT_HEIGHT_DIFF,
      meleeAssistAngle: toDegrees(BATTLE.MELEE_AIM_HALF_ANGLE),
      windupSteering: BATTLE.ATTACK_WINDUP_STEERING,
      combatModeTimeout: BATTLE.COMBAT_MODE_TIMEOUT,
      hitStun: BATTLE.HIT_STUN_DURATION,
    },
    stages: { limit: STAT_STAGE_LIMIT, rows: stageRows },
    cost: {
      divisor: ACTION_COST.COST_DIVISOR,
      cooldownPerWeight: ACTION_COST.COOLDOWN_PER_WEIGHT,
      rangedMinRange: ACTION_COST.RANGED_MIN_RANGE,
      rangedBonus: ACTION_COST.RANGED_BONUS,
      coneBonus: ACTION_COST.CONE_BONUS,
      stageWeight: AI_ATTACK.STAT_STAGE_VALUE,
      drainWeight: AI_ATTACK.LEECH_SEED_VALUE,
      runWeight: ACTION_COST.RUN_WEIGHT_PER_SECOND,
      dashWeight: ACTION_COST.DASH_WEIGHT,
      jumpWeight: ACTION_COST.JUMP_WEIGHT,
      exampleLevels: EXAMPLE_LEVELS,
    },
    dash: {
      duration: PLAYER_ACTIONS.dash.DURATION,
      speed: PLAYER_ACTIONS.dash.SPEED,
      cooldown: PLAYER_ACTIONS.dash.COOLDOWN,
    },
    lowHp: {
      costMax: STAMINA_BY_HP.MAX_MULTIPLIER,
      speedMin: SPEED_BY_HP.MIN_MULTIPLIER,
      rows: EXAMPLE_HP_FRACTIONS.map((hp) => ({
        hp,
        cost: resolveMovementCostMultiplier({ hp, maxHp: 1 }),
        speed: resolveSpeedMultiplier({ hp, maxHp: 1 }),
      })),
    },
    faint: {
      minutes: FAINT.DURATION_MINUTES,
      reviveFraction: FAINT.REVIVE_HP_FRACTION,
      recallDelay: FAINT.PARTY_RECALL_DELAY,
    },
    wild: {
      hostileChance: WILD_BEHAVIOR.DEFAULT_HOSTILE_CHANCE,
      aggroRadius: WILD_BEHAVIOR.AGGRO_RADIUS,
      exitMargin: WILD_BEHAVIOR.AGGRO_EXIT_MARGIN,
      leashRadius: WILD_BEHAVIOR.RETALIATE_LEASH_RADIUS,
      retaliateChance: WILD_BEHAVIOR.RETALIATE_CHANCE,
      courageMin: WILD_BEHAVIOR.COURAGE_MIN_CHANCE,
      courageMax: WILD_BEHAVIOR.COURAGE_MAX_CHANCE,
      lowHpFlee: WILD_BEHAVIOR.LOW_HP_FLEE_FRACTION,
      lowHpFleeChance: WILD_BEHAVIOR.LOW_HP_FLEE_CHANCE,
      lowHpRecover: WILD_BEHAVIOR.LOW_HP_RECOVER_FRACTION,
      threatHalfLife: WILD_BEHAVIOR.THREAT_HALF_LIFE,
      fleeSafeDistance: WILD_BEHAVIOR.FLEE_SAFE_DISTANCE,
      courageRows: EXAMPLE_COURAGE.map(({ own, hit, attacker }) => ({
        own,
        hit,
        attacker,
        chance: resolveRetaliateChance(
          { hp: own, maxHp: 1 },
          { hp: attacker, maxHp: 1 },
          hit,
        ),
      })),
    },
    ai: {
      inReachBonus: AI_ATTACK.IN_REACH_BONUS,
      nearBest: AI_ATTACK.NEAR_BEST_FRACTION,
      stageValue: AI_ATTACK.STAT_STAGE_VALUE,
      stageDecay: AI_ATTACK.STAT_STAGE_DECAY,
      refreshTime: AI_ATTACK.EFFECT_REFRESH_TIME,
      selfSafeDistance: AI_ATTACK.SELF_CAST_SAFE_DISTANCE,
      skillReserve: AI_ENERGY.SKILL_RESERVE_FRACTION,
      restEnter: AI_ENERGY.REST_ENTER_FRACTION,
      restExit: AI_ENERGY.REST_EXIT_FRACTION,
      dodgeChance: AI_MOVEMENT.DODGE_CHANCE,
      dodgeReaction: AI_MOVEMENT.DODGE_REACTION_TIME,
      keepDistance: AI_MOVEMENT.KEEP_DISTANCE_MIN,
      dashCloseDistance: AI_MOVEMENT.DASH_CLOSE_DISTANCE,
      beamTurnSpeed: toDegrees(AI_MOVEMENT.BEAM_TURN_SPEED),
      finishHp: AI_TARGET.FINISH_HP_FRACTION,
      finishBonus: AI_TARGET.FINISH_BONUS,
    },
    party: {
      attackInterval: PARTY_BEHAVIOR.ATTACK_INTERVAL,
      leashRadius: PARTY_BEHAVIOR.LEASH_RADIUS,
    },
    trainerBattle: {
      safeMin: TRAINER_BATTLE.SAFE_MIN_DISTANCE,
      safeMax: TRAINER_BATTLE.SAFE_MAX_DISTANCE,
    },
    pokedex: {
      scanRange: getItem('pokedex')?.scanner?.range ?? null,
      historyLimit: SCAN_HISTORY_LIMIT,
    },
    species: speciesList.map(buildSpecies),
    skills: listWikiSkills().map(buildSkill),
    ivExample: buildIvExample(speciesList[0]),
    damageExamples: buildDamageExamples(speciesList),
  }
}
