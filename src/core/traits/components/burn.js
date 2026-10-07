import { relation, trait } from 'koota'

/**
 * Queimadura nesta criatura (docs/features/039-tipos-e-combate-classico.md, Parte
 * 4): a cada `interval` segundos tira `fraction` do HP máximo; enquanto dura,
 * o atributo de Ataque dela é multiplicado por `attackMultiplier` (só golpe
 * físico — `computeDamage`). Acaba quando `timeLeft` zera ou ela desmaia.
 *
 * - `timeLeft` — segundos até apagar (renovado ao queimar de novo).
 * - `tickTimer` — segundos até o próximo dano (o 1º é `interval` depois de
 *   queimar, como o fim de turno do Pokémon).
 * - `fraction`/`interval`/`attackMultiplier` — copiados do efeito da skill.
 *
 * Quem queimou é a relação `BurnedBy` (crédito do XP), separada pelo mesmo
 * motivo do `SeededBy`: se quem queimou some, a queimadura continua.
 *
 * Dono de escrita: `queimar` (`core/actions/burn.js`) cria e renova;
 * `burnSystem.js` conta o tempo e remove.
 */
export const Burn = trait({
  timeLeft: 0,
  tickTimer: 0,
  fraction: 0,
  interval: 0,
  attackMultiplier: 1,
})

/**
 * Quem queimou esta criatura (`Burn`). `exclusive`: uma queimadura por alvo;
 * queimar de novo troca quem leva o crédito. Some sozinha quando quem queimou
 * é destruído.
 *
 * Dono de escrita: `queimar` (adiciona); `burnSystem.js` (remove junto).
 */
export const BurnedBy = relation({ exclusive: true })
