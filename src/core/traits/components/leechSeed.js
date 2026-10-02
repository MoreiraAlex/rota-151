import { relation, trait } from 'koota'

/**
 * Semente do Leech Seed plantada nesta criatura (ver
 * docs/features/033-skills-de-combate-e-vfx.md, Parte 9): a cada `interval`
 * segundos drena `fraction` do HP máximo dela e cura quem plantou o mesmo
 * valor; acaba quando `timeLeft` zera ou ela desmaia.
 *
 * - `timeLeft` — segundos até a semente secar (renovado ao plantar de novo).
 * - `tickTimer` — segundos até a próxima drenagem (a 1ª é `interval` depois
 *   de plantar, como o fim de turno do Pokémon).
 * - `fraction`/`interval` — copiados do efeito da skill no plantio.
 *
 * Quem plantou é a relação `SeededBy`, não um campo aqui — e as duas vivem
 * separadas de propósito: se quem plantou some (recolhido, destruído), o
 * Koota tira a relação sozinho e a semente CONTINUA drenando, só sem curar
 * ninguém.
 *
 * Dono de escrita: `plantarSemente` (`core/actions/leechSeed.js`) cria e
 * renova; `leechSeedSystem.js` conta o tempo e remove.
 */
export const LeechSeed = trait({
  timeLeft: 0,
  tickTimer: 0,
  fraction: 0,
  interval: 0,
})

/**
 * Quem plantou a semente (`LeechSeed`) nesta criatura — relação, regra do
 * projeto pra ligação entre entidades (`docs/rules/README.md`, "R3F +
 * Koota"). `exclusive`: uma semente por alvo; plantar de novo troca quem
 * recebe a cura. Some sozinha quando quem plantou é destruído.
 *
 * Dono de escrita: `plantarSemente` (adiciona); `leechSeedSystem.js`
 * (remove junto com a semente).
 */
export const SeededBy = relation({ exclusive: true })
