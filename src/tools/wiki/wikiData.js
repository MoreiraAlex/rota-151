import { GAME_CONFIG } from '@/core/gameConfig'
import {
  TYPE_CHART,
  listTypes,
  resolveSkillType,
  resolveSpeciesTypes,
} from '@/core/data/types'
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
import {
  resolveBallMultiplier,
  resolveCaptureChance,
  resolveCaptureValue,
  resolveShakeChance,
  resolveSpeciesCaptureRate,
} from '@/core/battle/capture'
import { resolveLevelCost } from '@/core/battle/levelCost'
import { resolveTrainingHours } from '@/core/battle/actionCost'
import { resolveRetaliateChance } from '@/core/battle/wildBehavior'
import { resolveMovementCostMultiplier } from '@/core/actions/stamina'
import { resolveSpeedMultiplier } from '@/core/actions/movementSpeed'
import { resolveCreatureStats } from '@/core/data/species/stats'
import {
  GROWTH_RATES,
  calculateExperienceGain,
  experienceForLevel,
  resolveBaseXp,
  resolveGrowthRate,
} from '@/core/data/species/experience'
import { FORMULA_MAX_LEVEL } from '@/core/data/species/formulaLevel'
import {
  ITEM_CATEGORY_ORDER,
  getItem,
  isStackableItem,
  listItems,
} from '@/core/data/items'
import {
  MAX_MASTERY,
  MOVE_SLOTS,
  createMovesState,
  findMoveSlot,
  listLearnset,
} from '@/core/data/species/moves'
import {
  resolveMasteryAccuracyFactor,
  resolveMasteryAfterUse,
  resolveMasteryCooldownFactor,
  resolveMasteryCostFactor,
} from '@/core/battle/moveMastery'
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
import {
  describeEffect,
  formatName,
  resolveConditionCaptureBonus,
} from './wikiFormat'

/**
 * O "retrato" de números da wiki: TUDO que as páginas mostram, num objeto
 * simples (só número, texto, lista) tirado do jogo pelas funções dele.
 *
 * As páginas nunca leem o jogo direto — só este retrato. A versão ATUAL da
 * wiki monta o retrato ao vivo; quando uma versão nova abre, a anterior
 * congela o seu num `data.json` (`npm run wiki:freeze`) e continua mostrando
 * os números da época mesmo depois de o jogo mudar.
 */

// Entradas de exemplo das tabelas ilustrativas — não são valores do jogo
// (o último é o nível máximo, que é).
const EXAMPLE_LEVELS = [5, 15, 30, GAME_CONFIG.EXPERIENCE.MAX_LEVEL]
const EXAMPLE_GROWTH_LEVELS = [
  5,
  10,
  20,
  30,
  40,
  GAME_CONFIG.EXPERIENCE.MAX_LEVEL,
]
// Domínios de exemplo da tabela de domínio (frações do máximo — o inicial do
// jogo entra junto, ver `buildMoves`).
const EXAMPLE_MASTERY = [0, 0.25, 0.5, 0.75, 1]

// Lutas de exemplo da tabela de XP ganho: nível de quem vence, da derrotada
// e quantas criaturas do time dividem.
const EXAMPLE_DUELS = [
  { winner: 5, defeated: 5, participants: 1 },
  { winner: 10, defeated: 5, participants: 1 },
  { winner: 5, defeated: 10, participants: 1 },
  { winner: 20, defeated: 20, participants: 1 },
  { winner: 5, defeated: 5, participants: 2 },
]
const EXAMPLE_HP_FRACTIONS = [1, 0.75, 0.5, 0.25, 0]
const EXAMPLE_COURAGE = [
  { own: 1, hit: 0.1, attacker: 1 },
  { own: 1, hit: 0.1, attacker: 0.5 },
  { own: 0.75, hit: 0.25, attacker: 1 },
  { own: 0.5, hit: 0.1, attacker: 1 },
  { own: 0.5, hit: 0.4, attacker: 1 },
  { own: 0.25, hit: 0.1, attacker: 0.25 },
]

/**
 * Os itens do jogo, na ordem do inventário organizado (por categoria). Só o
 * que o jogador vê: nome, descrição, ícone e o que cada um faz.
 */
function buildItems() {
  const order = (item) => {
    const index = ITEM_CATEGORY_ORDER.indexOf(item.category)
    return index === -1 ? ITEM_CATEGORY_ORDER.length : index
  }
  return [...listItems()]
    .sort((a, b) => order(a) - order(b))
    .map((item) => ({
      id: item.id,
      name: item.name ?? formatName(item.id),
      description: item.description ?? null,
      category: item.category,
      sprite: item.sprite?.path ?? null,
      stackable: isStackableItem(item),
      heal: item.consumable?.healAmount ?? null,
      berryHeal: item.berry?.healAmount ?? null,
      berryDuration: item.berry?.duration ?? null,
      captureMultiplier: item.pokeball?.captureMultiplier ?? null,
    }))
}

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
    skillId: attack.id,
    name: formatName(attack.id),
    type: resolveSkillType(attack),
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
    baseXp: resolveBaseXp(species),
    growthRate: resolveGrowthRate(species),
    bodyRadius: species.body?.capsuleRadius ?? null,
    hasTypes: Boolean(species.types?.length),
    types: resolveSpeciesTypes(species),
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
    learnset: buildLearnset(species),
  }
}

/**
 * Golpes que a espécie pode aprender além do kit inicial, com o nível
 * exigido (`null` = sem condição de nível) e se há outra condição.
 */
function buildLearnset(species) {
  const kit = createMovesState(species)
  return listLearnset(species)
    .filter((entry) => findMoveSlot(kit, entry.id) == null)
    .map((entry) => ({
      id: entry.id,
      level: entry.requires?.level ?? null,
      otherCondition: Object.keys(entry.requires ?? {}).some(
        (key) => key !== 'level',
      ),
    }))
}

// Usos em combate pra ir do domínio inicial ao máximo (todos errando ou todos
// acertando).
function countUsesToMaster(hit) {
  let mastery = GAME_CONFIG.MOVES.MASTERY.INITIAL
  let uses = 0
  while (mastery < MAX_MASTERY && uses < 100000) {
    mastery = resolveMasteryAfterUse(mastery, hit)
    uses++
  }
  return uses
}

/** Domínio, treino e esquecimento de golpes (docs/features/038-*). */
function buildMoves() {
  const { MASTERY, TRAINING } = GAME_CONFIG.MOVES
  const levels = [...new Set([...EXAMPLE_MASTERY, MASTERY.INITIAL])].sort(
    (a, b) => a - b,
  )
  return {
    initialMastery: MASTERY.INITIAL,
    minAccuracyFactor: MASTERY.MIN_ACCURACY_FACTOR,
    maxCostFactor: MASTERY.MAX_COST_FACTOR,
    maxCooldownFactor: MASTERY.MAX_COOLDOWN_FACTOR,
    opponentRadius: MASTERY.OPPONENT_RADIUS,
    usesToMasterMissing: countUsesToMaster(false),
    usesToMasterHitting: countUsesToMaster(true),
    masteryRows: levels.map((mastery) => ({
      mastery,
      initial: mastery === MASTERY.INITIAL,
      accuracy: resolveMasteryAccuracyFactor(mastery),
      cost: resolveMasteryCostFactor(mastery),
      cooldown: resolveMasteryCooldownFactor(mastery),
    })),
    trainingRadius: TRAINING.START_RADIUS,
    learnHoursPer100Weight: TRAINING.LEARN_HOURS_PER_100_WEIGHT,
    minLearnHours: TRAINING.MIN_LEARN_HOURS,
    masteryHoursMultiplier: TRAINING.MASTERY_HOURS_MULTIPLIER,
    repetitionInterval: TRAINING.REPETITION_INTERVAL,
    restFraction: TRAINING.REST_STAMINA_FRACTION,
    forgetRetained: TRAINING.FORGET_RETAINED,
    slots: MOVE_SLOTS.length,
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
    type: summary.type,
    // tipos em que o golpe de status não pega (ex.: o roubo de vida em Planta)
    immuneTypes: skill.immuneTypes ?? [],
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
    trainingHours: resolveTrainingHours(skill),
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

/** Curvas de nível e exemplos de XP ganho (contra a primeira da lista). */
function buildExperience(speciesList) {
  const { EXPERIENCE } = GAME_CONFIG
  const example = speciesList[0]
  const baseXp = resolveBaseXp(example)
  const growthRate = resolveGrowthRate(example)
  const xpToNext = (level) =>
    experienceForLevel(growthRate, level + 1) -
    experienceForLevel(growthRate, level)
  return {
    maxLevel: EXPERIENCE.MAX_LEVEL,
    formulaMaxLevel: FORMULA_MAX_LEVEL,
    formulaScale: FORMULA_MAX_LEVEL / EXPERIENCE.MAX_LEVEL,
    baseDivisor: EXPERIENCE.BASE_DIVISOR,
    scalingExponent: EXPERIENCE.SCALING_EXPONENT,
    wildLevelMin: EXPERIENCE.WILD_LEVEL_MIN,
    wildLevelMax: EXPERIENCE.WILD_LEVEL_MAX,
    growthLevels: EXAMPLE_GROWTH_LEVELS,
    growthRows: GROWTH_RATES.map((rate) => ({
      rate,
      totals: EXAMPLE_GROWTH_LEVELS.map((level) =>
        experienceForLevel(rate, level),
      ),
    })),
    example: example
      ? {
          speciesName: formatName(example.id),
          baseXp,
          growthRate,
          duels: EXAMPLE_DUELS.map((duel) => {
            const gain = calculateExperienceGain({
              baseXp,
              defeatedLevel: duel.defeated,
              winnerLevel: duel.winner,
              participants: duel.participants,
            })
            return {
              ...duel,
              gain,
              // quantas vitórias iguais a esta pra subir UM nível
              winsToLevel:
                duel.winner < EXPERIENCE.MAX_LEVEL
                  ? xpToNext(duel.winner) / gain
                  : null,
            }
          }),
        }
      : null,
  }
}

/**
 * Os tipos e a tabela de efetividade: cada tipo com nome e cor, e, por tipo de
 * golpe, só os pares que não são neutros (`{ attack, defender, multiplier }`).
 */
function buildTypes() {
  const chart = []
  for (const [attack, row] of Object.entries(TYPE_CHART)) {
    for (const [defender, multiplier] of Object.entries(row)) {
      chart.push({ attack, defender, multiplier })
    }
  }
  return {
    list: listTypes().map(({ id, name, color }) => ({ id, name, color })),
    chart,
  }
}

/**
 * A queimadura como o jogo aplica hoje — os valores do primeiro golpe que
 * queima (`effects` com `type: 'burn'`); `null` se nenhum queima.
 */
function buildBurn() {
  for (const skill of listWikiSkills()) {
    const burn = skill.effects?.find((effect) => effect.type === 'burn')
    if (!burn) continue
    return {
      chance: burn.chance ?? 1,
      fraction: burn.fraction ?? 0,
      interval: burn.interval ?? 0,
      duration: burn.duration ?? 0,
      attackMultiplier: burn.attackMultiplier ?? 1,
      immuneTypes: burn.immuneTypes ?? [],
      captureBonus: resolveConditionCaptureBonus('burn'),
    }
  }
  return null
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
      const { damage, stab, typeMultiplier } = resolveDamagePreview({
        attacker: { species: attacker, individualValues: ivs },
        defender: { species: defender, individualValues: ivs },
        slot,
      })
      rows.push({
        attackerName: formatName(attacker.id),
        attackName: formatName(attack.id),
        category: resolveAttackCategory(attack),
        power: attack.damage.power ?? null,
        stab,
        typeMultiplier: typeMultiplier.multiplier,
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

// Vida (fração) das linhas da tabela de chance de captura; 0 = desmaiada.
const CAPTURE_EXAMPLE_HP = [1, 0.5, 0.2, 0]

/**
 * Captura (docs/features/043-captura.md): as regras e uma tabela de chance
 * por vida e por bola, pela mesma conta do jogo (`core/battle/capture.js`),
 * pra uma espécie de taxa comum (`CAPTURE.DEFAULT_RATE`); e a taxa de cada
 * espécie.
 */
function buildCapture() {
  const { CAPTURE } = GAME_CONFIG
  const balls = listItems().filter((item) => item.category === 'pokeball')
  const chance = (hp, ballMultiplier, rate) =>
    resolveCaptureChance(
      resolveShakeChance(
        resolveCaptureValue({ hp, maxHp: 1, rate, ballMultiplier }),
      ),
      CAPTURE.SHAKE_COUNT,
    )
  return {
    shakeCount: CAPTURE.SHAKE_COUNT,
    defaultRate: CAPTURE.DEFAULT_RATE,
    maxRate: CAPTURE.MAX_CAPTURE_VALUE,
    backStrikeBonus: CAPTURE.BACK_STRIKE_BONUS,
    xpFraction: CAPTURE.XP_FRACTION,
    escapeWakeFraction: CAPTURE.ESCAPE_WAKE_HP_FRACTION,
    escapeFightHostile: CAPTURE.ESCAPE_FIGHT_CHANCE.hostile ?? 0,
    escapeFightPeaceful: CAPTURE.ESCAPE_FIGHT_CHANCE.peaceful ?? 0,
    balls: balls.map((item) => ({
      id: item.id,
      name: item.name ?? formatName(item.id),
    })),
    rows: CAPTURE_EXAMPLE_HP.map((hp) => ({
      hp,
      chances: balls.map((item) =>
        chance(hp, resolveBallMultiplier(item), CAPTURE.DEFAULT_RATE),
      ),
    })),
    speciesRates: listWikiSpecies().map((species) => ({
      id: species.id,
      name: formatName(species.id),
      rate: resolveSpeciesCaptureRate(species),
    })),
    example: buildCaptureExample(balls),
  }
}

/**
 * O exemplo resolvido da página de captura: a primeira espécie da Pokédex,
 * com a vida máxima dela no nível inicial (IV do meio), de vida cheia e com a
 * bola mais fraca; e, pra comparar, a mesma de vida pela metade com a bola
 * mais forte. Cada passo da conta (valor → chance por balançada → total).
 */
function buildCaptureExample(balls) {
  const species = listWikiSpecies()[0]
  if (!species || balls.length === 0) return null
  const { SHAKE_COUNT } = GAME_CONFIG.CAPTURE
  const maxHp =
    resolveCreatureStats(species, uniformIndividualValues(middleIv()))?.hp
      ?.stat ?? 0
  const rate = resolveSpeciesCaptureRate(species)
  const sorted = [...balls].sort(
    (a, b) => resolveBallMultiplier(a) - resolveBallMultiplier(b),
  )
  const scenario = (hp, ball) => {
    const multiplier = resolveBallMultiplier(ball)
    const value = resolveCaptureValue({
      hp,
      maxHp,
      rate,
      ballMultiplier: multiplier,
    })
    const shakeChance = resolveShakeChance(value)
    return {
      hp,
      ballName: ball.name ?? formatName(ball.id),
      multiplier,
      value,
      shakeChance,
      total: resolveCaptureChance(shakeChance, SHAKE_COUNT),
    }
  }
  return {
    speciesName: formatName(species.id),
    level: species.level ?? 1,
    maxHp,
    rate,
    base: scenario(maxHp, sorted[0]),
    better: scenario(Math.round(maxHp / 2), sorted[sorted.length - 1]),
  }
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
      burnWeight: AI_ATTACK.BURN_VALUE,
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
    capture: buildCapture(),
    inventory: {
      columns: GAME_CONFIG.INVENTORY.COLUMNS,
      rows: GAME_CONFIG.INVENTORY.ROWS,
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
    items: buildItems(),
    types: buildTypes(),
    burn: buildBurn(),
    experience: buildExperience(speciesList),
    moves: buildMoves(),
    species: speciesList.map(buildSpecies),
    skills: listWikiSkills().map(buildSkill),
    ivExample: buildIvExample(speciesList[0]),
    damageExamples: buildDamageExamples(speciesList),
  }
}
