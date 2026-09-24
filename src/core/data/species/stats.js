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
