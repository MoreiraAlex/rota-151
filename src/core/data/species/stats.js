import { randomInt } from '../../rng'

/**
 * Fórmulas de status de batalha, mesma convenção clássica de Pokémon
 * (gen 3+): `value` de cada status vem de `base` (fixo por espécie),
 * `iv` (0-31, "individual" — varia por criatura), `ev` (0-252,
 * treino) e `level`. Extraídas pra função — um objeto literal NÃO tem
 * escopo "próprio" pra um campo (`value`) referenciar outro campo
 * IRMÃO (`base`/`iv`/`ev`) durante a própria criação; `{ base: 45,
 * value: base + 1 }` lança `ReferenceError: base is not defined`,
 * porque `base` só passa a existir como propriedade DEPOIS que o
 * objeto inteiro termina de ser avaliado, nunca durante. Calcula fora,
 * com variáveis de verdade, e só monta o objeto no final.
 *
 * `stats`/`moves` de espécie ainda não têm formato fechado (ver
 * `_template/index.js`) — o sistema de batalha em si não foi
 * desenhado. Estas duas funções não formalizam esse formato; só dão um
 * jeito seguro de calcular `value` pra quem já quiser usar a fórmula
 * de verdade enquanto isso.
 */

/** Fórmula de HP: `trunc((2*base + iv + trunc(ev/4)) * level / 100) + level + 10`. */
export function calculateHpStat({ base, iv, ev, level }) {
  return (
    Math.trunc(((2 * base + iv + Math.trunc(ev / 4)) * level) / 100) +
    level +
    10
  )
}

export function calculateEnergyStat({ hp, defense, sp_def }) {
  return Math.trunc((hp + defense + sp_def) / 3)
}

/**
 * Fórmula dos demais status (ataque/defesa/sp. atk/sp. def/veloc.):
 * `trunc((trunc((2*base + iv + trunc(ev/4)) * level / 100) + 5) * nature)`.
 * `nature` (opcional, default `1` = neutra) multiplica o resultado —
 * `1.1` bônus, `0.9` penalidade, mesma convenção de Pokémon de verdade.
 */
export function calculateStat({ base, iv, ev, level, nature = 1 }) {
  return Math.trunc(
    (Math.trunc(((2 * base + iv + Math.trunc(ev / 4)) * level) / 100) + 5) *
      nature,
  )
}

export function calculateCP({ SomaStatus, SomaIV, SomaEV, level }) {
  const goPower = SomaIV + Math.trunc(SomaEV / 4);

  return (
    Math.min(
      Math.trunc(
        (SomaStatus - goPower) * level * 0.06 +
        goPower * (level * 0.04 + 2)
      ),
      10000
    )
  )
}

export function calculateAttackInterval(speed) {
  const minSpeed = 5
  const maxSpeed = 400

  const minInterval = 0.15
  const maxInterval = 0.75

  const t = Math.min(
    1,
    Math.max(
      0,
      (Math.sqrt(speed) - Math.sqrt(minSpeed)) /
        (Math.sqrt(maxSpeed) - Math.sqrt(minSpeed))
    )
  )

  return maxInterval - t * (maxInterval - minInterval)
}

// Os seis status de combate que têm `base`/`iv`/`ev` de verdade — `energy`
// e `cp` ficam de fora (são DERIVADOS destes, ver `resolveCreatureStats`
// abaixo), `moves` não é um status.
const STAT_KEYS = ['hp', 'attack', 'defense', 'sp_atk', 'sp_def', 'speed']

/**
 * Sorteia um IV (individual value) por status, dentro de `[min, max]` —
 * usado tanto por `wildCreatureSpawnSystem.js` (cada SELVAGEM sorteia o
 * próprio, no spawn) quanto por `core/actions/party.js`
 * (`equiparCriatura`, sorteia e CONGELA quando uma espécie nova entra
 * num slot do time do jogador) — mesmo mecanismo pros dois, "IV é
 * aleatório pra todo mundo" (pedido do usuário). `rng` é sempre
 * passado de fora (`core/rng.js`, `gameplayRng`) — sem `Math.random()`
 * aqui, regra 3.5 de `docs/rules/README.md`.
 */
export function rollIndividualValues(rng, { min, max }) {
  const values = {}
  for (const key of STAT_KEYS) {
    values[key] = randomInt(rng, min, max)
  }
  return values
}

/**
 * Combina `base`/`ev` da espécie (os dois únicos campos que
 * `species.stats.<key>` ainda guarda — ver `_template`/qualquer espécie
 * migrada) com o `level` da espécie e o `individualValues` de UMA
 * ENTIDADE (`IndividualValues`/`PartyIndividualValues`, sorteado uma
 * vez e congelado — ver docstring dos traits) pra chegar no status de
 * verdade DESTA criatura. Não existe mais um `iv`/`stat`/`cp`
 * pré-calculado guardado na espécie (removido — IV é sempre sorteado
 * por indivíduo agora, nunca um literal fixo, pedido do usuário: "IVs
 * vão ser gerados aleatoriamente para todos, sejam meus ou
 * selvagens") — por isso `individualValues` não é mais opcional de
 * verdade: sem ele, todo `iv` cai em `0`.
 *
 * Retorna `null` pra espécie sem o formato de `stats` com `base`
 * (`fox`/`wolf` ainda têm `stats: {}`, `boy`/treinador tem `stats.hp`
 * sem `base` — não é Pokémon, não tem IV) — chamador cai pro fallback
 * de sempre nesse caso (ver `resolveMaxHp`/`resolveMaxStamina`,
 * `core/traits/components/vitals.js`).
 */
export function resolveCreatureStats(species, individualValues) {
  const base = species?.stats
  if (!base?.hp || base.hp.base == null) return null

  const level = species.level ?? 1
  const resolved = {}

  for (const key of STAT_KEYS) {
    const entry = base[key]
    if (!entry || entry.base == null) continue

    const iv = individualValues?.[key] ?? 0
    const ev = entry.ev ?? 0
    resolved[key] = {
      base: entry.base,
      iv,
      ev,
      stat:
        key === 'hp'
          ? calculateHpStat({ base: entry.base, iv, ev, level })
          : calculateStat({ base: entry.base, iv, ev, level }),
    }
  }

  if (resolved.hp && resolved.defense && resolved.sp_def) {
    resolved.energy = {
      ...base.energy,
      stat: calculateEnergyStat({
        hp: resolved.hp.stat,
        defense: resolved.defense.stat,
        sp_def: resolved.sp_def.stat,
      }),
    }
  }

  if (STAT_KEYS.every((key) => resolved[key])) {
    resolved.cp = calculateCP({
      SomaStatus: STAT_KEYS.reduce((sum, key) => sum + resolved[key].stat, 0),
      SomaIV: STAT_KEYS.reduce((sum, key) => sum + resolved[key].iv, 0),
      SomaEV: STAT_KEYS.reduce((sum, key) => sum + resolved[key].ev, 0),
      level,
    })
  }

  return resolved
}
