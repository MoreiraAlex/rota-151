import { trait } from 'koota'

/**
 * Spawn e despawn das selvagens (docs/features/062-spawn-estilo-
 * cobblemon.md).
 */

/**
 * Há quanto tempo (s de jogo) a selvagem está no mundo — a idade que o
 * despawn da faixa do meio olha.
 *
 * Dono de escrita: `wildDespawnSystem` (soma o passo); `nascerSelvagem` põe
 * (zero, ou a salva no restore do save).
 */
export const WildSpawnInfo = trait({ age: 0 })

/**
 * Estado do spawn — trait do MUNDO.
 *
 * - `spawnTimer` / `despawnTimer`: segundos até a próxima tentativa de
 *   spawn e a próxima verificação do despawn.
 * - `log`: os últimos spawns e despawns (`{ kind, speciesId, reason, x,
 *   z }`), só para o debug (F2).
 *
 * Trait AoS (objetos). Dono de escrita: `wildSpawnSystem` (`spawnTimer`),
 * `wildDespawnSystem` (`despawnTimer`) e `registrarSpawnNoLog`
 * (`core/actions/wildSpawn.js`, `log`).
 */
export const WildSpawnState = trait(() => ({
  spawnTimer: 0,
  despawnTimer: 0,
  log: [],
}))
