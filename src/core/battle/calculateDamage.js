import { GAME_CONFIG } from '../gameConfig'
import { resolveCreatureStats } from '../data/species/stats'

/**
 * Fórmula de dano de ataque — convenção clássica de Pokémon, pedido
 * EXATO do usuário, mantida sem ajuste silencioso:
 * `(((((2*level*critical)/5 + 2) * power * attack) / defense) / 50 + 2)
 * * modificadores`, `modificadores = stab * type1 * type2 * random`.
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
  stab = 1,
  type1 = 1,
  type2 = 1,
  random = 1,
}) {
  const modificadores = stab * type1 * type2 * random

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
 * STAB (same-type attack bonus) — `1.5` quando `attackType` é um dos
 * tipos do próprio atacante, senão `1`. `attackerTypes` viria de
 * `species.types` — campo ainda não declarado em NENHUMA espécie (ver
 * `core/data/species/_template/index.js`), então hoje isto sempre cai
 * em `1`. Estrutura pronta, sem inventar dado de tipo agora (pedido
 * explícito do usuário).
 */
export function resolveStab(attackType, attackerTypes) {
  if (!attackType || !attackerTypes) return 1
  return attackerTypes.includes(attackType) ? 1.5 : 1
}

/**
 * Multiplicador de efetividade de tipo entre o tipo do ataque e UM tipo
 * do defensor — chamada até duas vezes (`type1`/`type2` da fórmula, um
 * por tipo do defensor, já que uma criatura pode ter dois). Pedido do
 * usuário: "por enquanto podem permanecer como 1... quero deixar a
 * estrutura preparada" — sem tabela de fraqueza/resistência/imunidade
 * ainda, sempre neutro. Aceita `(attackType, defenderType)` na prática
 * (ver chamadores em `resolveDamageAmount`), sem declarar os parâmetros
 * aqui pra não disparar "unused vars" enquanto não há tabela nenhuma pra
 * consultar — assinatura de chamada pronta pra receber essa tabela
 * depois, sem precisar mexer em quem chama.
 */
export function resolveTypeEffectivenessMultiplier() {
  return 1
}

/**
 * Status ofensivo/defensivo de UMA criatura, prontos pra fórmula de
 * dano. `resolveCreatureStats` (`core/data/species/stats.js`) devolve
 * `null` pra espécie que ainda não migrou pro formato `stats.<key>.base`
 * (`fox`/`wolf` e seus clones `fox-red/green/blue`, hoje as únicas sem
 * `attack`/`defense` de verdade) — cai em `FALLBACK_COMBAT_STAT`
 * (`gameConfig.js`) em vez de deixar o ataque delas sem causar dano
 * nenhum, mesmo "fallback gracioso" que `resolveMaxHp`/`resolveMaxStamina`
 * já usam pra essas mesmas espécies.
 */
export function resolveCombatStats(species, individualValues) {
  const resolved = resolveCreatureStats(species, individualValues)
  const fallback = GAME_CONFIG.BATTLE.FALLBACK_COMBAT_STAT

  return {
    level: species?.level ?? 1,
    attack: resolved?.attack?.stat ?? fallback,
    defense: resolved?.defense?.stat ?? fallback,
    sp_atk: resolved?.sp_atk?.stat ?? fallback,
    sp_def: resolved?.sp_def?.stat ?? fallback,
  }
}

/**
 * Monta os parâmetros de `calculateDamage` a partir de atacante, alvo e
 * `attack.damage` (definição do golpe — `core/data/attacks/<id>/
 * index.js`) e devolve `{ amount, critical }` — o dano final e se o
 * crítico saiu (pro retorno visual diferenciar). Ponto único que
 * decide `attack`/`sp_atk` vs `defense`/`sp_def` pela `category` do
 * ataque (`'physical'` usa `attack`/`defense`, `'special'` usa
 * `sp_atk`/`sp_def` — categoria ausente cai em `'physical'`, mesmo
 * fallback gracioso de sempre).
 */
export function resolveDamageAmount({
  attackerSpecies,
  attackerIndividualValues,
  defenderSpecies,
  defenderIndividualValues,
  damage,
  rng,
}) {
  const attacker = resolveCombatStats(attackerSpecies, attackerIndividualValues)
  const defender = resolveCombatStats(defenderSpecies, defenderIndividualValues)
  const isSpecial = damage?.category === 'special'
  const attackerTypes = attackerSpecies?.types ?? null
  const defenderTypes = defenderSpecies?.types ?? []
  // Sorteado antes do `random` — mesma ordem de consumo do `rng` de antes.
  const critical = rollCriticalMultiplier(rng)

  const amount = calculateDamage({
    level: attacker.level,
    attack: isSpecial ? attacker.sp_atk : attacker.attack,
    defense: isSpecial ? defender.sp_def : defender.defense,
    power: damage?.power ?? 1,
    critical,
    stab: resolveStab(damage?.type, attackerTypes),
    type1: resolveTypeEffectivenessMultiplier(
      damage?.type,
      defenderTypes[0] ?? null,
    ),
    type2: resolveTypeEffectivenessMultiplier(
      damage?.type,
      defenderTypes[1] ?? null,
    ),
    random: rollDamageRandomFactor(rng),
  })

  return { amount, critical: critical > 1 }
}
