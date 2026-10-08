import { GAME_CONFIG } from '../gameConfig'
import { resolveCreatureStats } from '../data/species/stats'
import { resolveFormulaLevel } from '../data/species/formulaLevel'
import { stageMultiplier } from './statStages'
import {
  resolveWeatherDefenseMultiplier,
  resolveWeatherMoveMultiplier,
} from '../weather/weatherModifiers'
import {
  resolveSpeciesTypes,
  resolveTypeEffectiveness,
  resolveTypeMultiplier,
} from '../data/types'

/**
 * Fórmula de dano de ataque — convenção clássica de Pokémon, pedido
 * EXATO do usuário, mantida sem ajuste silencioso:
 * `(((((2*level*critical)/5 + 2) * power * attack) / defense) / 50 + 2)
 * * modificadores`, `modificadores = weather * stab * type1 * type2 *
 * random` — `weather` é o do clima no lugar do golpe
 * (docs/features/048-dia-noite-e-clima.md).
 *
 * Pura — não sabe nada de espécie/trait/ECS. Quem monta os parâmetros é
 * `resolveDamageAmount` (abaixo).
 */
export function calculateDamage({
  level,
  attack,
  defense,
  power = 1,
  critical = 1,
  weather = 1,
  stab = 1,
  type1 = 1,
  type2 = 1,
  random = 1,
}) {
  const modificadores = weather * stab * type1 * type2 * random

  return (
    ((((2 * level * critical) / 5 + 2) * power * attack) / defense / 50 + 2) *
    modificadores
  )
}

/**
 * Chance de crítico separada do cálculo em si — pedido do usuário: "a
 * definição de quando um ataque é crítico pode ficar separada do
 * cálculo de dano". Devolve o multiplicador pronto pra `calculateDamage`
 * (`critical` acima, `1` ou `2`), não um boolean, pra quem chama não
 * precisar saber o valor mágico. `rng` é sempre passado de fora
 * (`gameplayRng`, `core/rng.js`) — regra 3.5 de docs/rules/README.md,
 * sem `Math.random()` em lógica de jogo.
 */
export function rollCriticalMultiplier(rng) {
  return rng() < GAME_CONFIG.BATTLE.CRITICAL_HIT_CHANCE ? 2 : 1
}

/**
 * Fator aleatório do dano (`random` da fórmula) — uniforme dentro de
 * `GAME_CONFIG.BATTLE.DAMAGE_RANDOM_MIN/MAX`. Pedido do usuário: "deve
 * ser recebido pelo cálculo, sem necessariamente implementar toda a
 * lógica de geração" — esta é a parte mínima (uma faixa configurável),
 * sem variação por crítico/habilidade/etc.
 */
export function rollDamageRandomFactor(rng) {
  const { DAMAGE_RANDOM_MIN, DAMAGE_RANDOM_MAX } = GAME_CONFIG.BATTLE
  return DAMAGE_RANDOM_MIN + rng() * (DAMAGE_RANDOM_MAX - DAMAGE_RANDOM_MIN)
}

/**
 * STAB (same-type attack bonus) — `GAME_CONFIG.TYPES.STAB_MULTIPLIER` quando
 * `attackType` é um dos tipos do próprio atacante (`species.types`), senão
 * `1`. Atacante sem tipo (treinador) nunca tem STAB.
 */
export function resolveStab(attackType, attackerTypes) {
  if (!attackType || !attackerTypes) return 1
  return attackerTypes.includes(attackType)
    ? GAME_CONFIG.TYPES.STAB_MULTIPLIER
    : 1
}

/**
 * Multiplicador de efetividade entre o tipo do golpe e UM tipo do defensor —
 * chamada até duas vezes (`type1`/`type2` da fórmula, um por tipo do
 * defensor). A tabela é a da Gen 1 (`core/data/types/index.js`); defensor sem
 * tipo é neutro.
 */
export function resolveTypeEffectivenessMultiplier(attackType, defenderType) {
  return resolveTypeMultiplier(attackType, defenderType)
}

/**
 * Efetividade do golpe (`context.attackType`) contra os tipos do defensor —
 * `{ multiplier, effectiveness }` (`'super'`/`'neutral'`/`'weak'`/
 * `'immune'`), pro feedback e pra quem precisa saber se o golpe pega.
 */
export function resolveDamageEffectiveness(context) {
  return resolveTypeEffectiveness(
    context.attackType,
    resolveSpeciesTypes(context.defenderSpecies),
  )
}

/**
 * Status ofensivo/defensivo de UMA criatura, prontos pra fórmula de
 * dano. `resolveCreatureStats` (`core/data/species/stats.js`) devolve
 * `null` pra espécie que ainda não migrou pro formato `stats.<key>.base`
 * (sem `attack`/`defense` de verdade) — cai em `FALLBACK_COMBAT_STAT`
 * (`gameConfig.js`) em vez de deixar o ataque delas sem causar dano
 * nenhum, mesmo "fallback gracioso" que `resolveMaxHp`/`resolveMaxStamina`
 * já usam pra essas mesmas espécies.
 */
export function resolveCombatStats(
  species,
  individualValues,
  level = species?.level ?? 1,
) {
  const resolved = resolveCreatureStats(species, individualValues, level)
  const fallback = GAME_CONFIG.BATTLE.FALLBACK_COMBAT_STAT

  return {
    // escala das fórmulas (teto 100) — o `level` recebido é o do jogo
    level: resolveFormulaLevel(level),
    attack: resolved?.attack?.stat ?? fallback,
    defense: resolved?.defense?.stat ?? fallback,
    sp_atk: resolved?.sp_atk?.stat ?? fallback,
    sp_def: resolved?.sp_def?.stat ?? fallback,
  }
}

/**
 * Monta os parâmetros de `calculateDamage` a partir de atacante, alvo e
 * `attack.damage` (definição do golpe — `core/data/skills/<id>/
 * index.js`) e devolve `{ amount, critical, effectiveness }` — o dano final,
 * se o crítico saiu (pro retorno visual diferenciar) e a efetividade de tipo.
 * `attackType` é o tipo do golpe (`resolveSkillType`). Ponto único que
 * decide `attack`/`sp_atk` vs `defense`/`sp_def` pela `category` do
 * ataque (`'physical'` usa `attack`/`defense`, `'special'` usa
 * `sp_atk`/`sp_def` — categoria ausente cai em `'physical'`, mesmo
 * fallback gracioso de sempre).
 */
export function resolveDamageAmount({
  attackerSpecies,
  attackerIndividualValues,
  attackerLevel,
  defenderSpecies,
  defenderIndividualValues,
  defenderLevel,
  damage,
  attackType,
  attackerStages,
  defenderStages,
  attackerBurnMultiplier,
  weather,
  rng,
}) {
  const context = {
    attackerSpecies,
    attackerIndividualValues,
    attackerLevel,
    defenderSpecies,
    defenderIndividualValues,
    defenderLevel,
    damage,
    attackType,
    attackerStages,
    defenderStages,
    attackerBurnMultiplier,
    weather,
  }
  // Sorteado antes do `random` — mesma ordem de consumo do `rng` de antes.
  const critical = rollCriticalMultiplier(rng)
  const amount = computeDamage(context, {
    critical,
    random: rollDamageRandomFactor(rng),
  })
  return {
    amount,
    critical: critical > 1,
    effectiveness: resolveDamageEffectiveness(context).effectiveness,
  }
}

/**
 * Dano de UM tick de um ataque canalizado (`damageMode: 'channel'`, ver
 * `core/battle/channelAttack.js`) — pedido do usuário: o canal não repete o
 * dano cheio a cada tick; o canal INTEIRO vale o dano de um golpe, repartido.
 *
 * - "Orçamento" do alvo = o dano do golpe com o fator aleatório MÉDIO
 *   (`(DAMAGE_RANDOM_MIN + DAMAGE_RANDOM_MAX) / 2`) e sem crítico — o que um
 *   golpe único renderia em média.
 * - Cada tick leva a sua fração do orçamento (`weight`, sorteado no disparo
 *   por `rollChannelWeights` — frações diferentes que somam 1, então os
 *   ticks variam entre si e o total, segurando até o fim com o alvo no
 *   cone, é EXATAMENTE o orçamento).
 * - Crítico sorteado POR TICK: o tick crítico vale o dobro da sua fração,
 *   bônus por cima do orçamento.
 */
export function resolveChannelTickDamage({
  attackerSpecies,
  attackerIndividualValues,
  attackerLevel,
  defenderSpecies,
  defenderIndividualValues,
  defenderLevel,
  damage,
  attackType,
  attackerStages,
  defenderStages,
  attackerBurnMultiplier,
  weather,
  weight,
  rng,
}) {
  const { DAMAGE_RANDOM_MIN, DAMAGE_RANDOM_MAX } = GAME_CONFIG.BATTLE
  const context = {
    attackerSpecies,
    attackerIndividualValues,
    attackerLevel,
    defenderSpecies,
    defenderIndividualValues,
    defenderLevel,
    damage,
    attackType,
    attackerStages,
    defenderStages,
    attackerBurnMultiplier,
    weather,
  }
  const budget = computeDamage(context, {
    critical: 1,
    random: (DAMAGE_RANDOM_MIN + DAMAGE_RANDOM_MAX) / 2,
  })
  const critical = rollCriticalMultiplier(rng) > 1
  return {
    amount: budget * weight * (critical ? 2 : 1),
    critical,
    effectiveness: resolveDamageEffectiveness(context).effectiveness,
  }
}

/**
 * Monta os parâmetros da fórmula (status, STAB, tipo) e calcula, com
 * `critical`/`random` já decididos por quem chama. Exportada pra quem precisa
 * da conta sem sorteio — a calculadora da wiki (`tools/wiki/
 * damageCalculator.js`) pede os extremos da faixa pela mesma função do jogo.
 */
export function computeDamage(context, { critical, random }) {
  const attacker = resolveCombatStats(
    context.attackerSpecies,
    context.attackerIndividualValues,
    context.attackerLevel,
  )
  const defender = resolveCombatStats(
    context.defenderSpecies,
    context.defenderIndividualValues,
    context.defenderLevel,
  )
  const { damage } = context
  const isSpecial = damage?.category === 'special'
  // Estágios de atributo (golpes de status, `core/battle/statStages.js`):
  // multiplicam o atributo do ataque do atacante e o de defesa do alvo.
  const attackKey = isSpecial ? 'sp_atk' : 'attack'
  const defenseKey = isSpecial ? 'sp_def' : 'defense'
  // Queimadura (`Burn.attackMultiplier`, do efeito da skill que queimou):
  // corta o Ataque de quem está queimado — só no golpe físico.
  const burnMultiplier = isSpecial ? 1 : (context.attackerBurnMultiplier ?? 1)
  const attackMultiplier =
    stageMultiplier(context.attackerStages?.[attackKey] ?? 0) * burnMultiplier
  const defenseMultiplier = stageMultiplier(
    context.defenderStages?.[defenseKey] ?? 0,
  )
  const { attackType } = context
  const attackerTypes = resolveSpeciesTypes(context.attackerSpecies)
  const defenderTypes = resolveSpeciesTypes(context.defenderSpecies)
  // Clima no lugar do golpe (`context.weather`, tipo de clima; sem ele,
  // neutro): o golpe de um tipo fica mais forte ou fraco, e a defesa de um
  // tipo de defensor sobe.
  const weatherDefense = resolveWeatherDefenseMultiplier(
    context.weather,
    defenderTypes,
    defenseKey,
  )

  return calculateDamage({
    level: attacker.level,
    attack: attacker[attackKey] * attackMultiplier,
    defense: defender[defenseKey] * defenseMultiplier * weatherDefense,
    power: damage?.power ?? 1,
    critical,
    weather: resolveWeatherMoveMultiplier(context.weather, attackType),
    stab: resolveStab(attackType, attackerTypes),
    type1: resolveTypeEffectivenessMultiplier(
      attackType,
      defenderTypes[0] ?? null,
    ),
    type2: resolveTypeEffectivenessMultiplier(
      attackType,
      defenderTypes[1] ?? null,
    ),
    random,
  })
}
