import { despawnarSelvagem } from '../actions/wildSpawn'
import { GAME_CONFIG } from '../gameConfig'
import { gameplayRng } from '../rng'
import {
  despawnReason,
  isOutOfView,
  nearestDistance,
  spawnParams,
} from '../wildSpawn/wildSpawn'
import { listSpawnPlayers } from '../wildSpawn/spawnPlayers'
import {
  BeingCaptured,
  Position,
  WildCreature,
  WildSpawnInfo,
  WildSpawnState,
} from '../traits'

/**
 * Tira do mundo as selvagens que ficaram para trás (docs/features/062-
 * spawn-estilo-cobblemon.md). A idade de todas anda a cada passo; a cada
 * `WILD_SPAWN.DESPAWN_CHECK_INTERVAL`, cada uma vê a faixa pela distância
 * até o jogador mais perto: perto fica, longe some, e no meio some quem
 * está velha e fora da vista de todos (com a chance crescendo com a
 * idade). Quem está dentro de uma Pokébola sendo capturada nunca some.
 * Desmaiada não tem proteção: segue as faixas como qualquer uma.
 *
 * Sem jogador nenhum no mundo, ninguém some.
 *
 * Lê os jogadores (`listSpawnPlayers`) e `Position`; escreve
 * `WildSpawnInfo.age` e `WildSpawnState.despawnTimer` e destrói selvagens
 * (`despawnarSelvagem`).
 *
 * Headless. Fase: simulation, logo antes do `wildSpawnSystem`.
 */
export function wildDespawnSystem(context) {
  const { world, delta = 0, events } = context

  world.query(WildSpawnInfo).updateEach(([info]) => {
    info.age += delta
  })

  if (!world.has(WildSpawnState)) return
  const state = world.get(WildSpawnState)
  state.despawnTimer -= delta
  if (state.despawnTimer > 0) return
  state.despawnTimer = GAME_CONFIG.WILD_SPAWN.DESPAWN_CHECK_INTERVAL

  const players = listSpawnPlayers(world)
  if (players.length === 0) return
  const viewers = players.flatMap((player) => player.viewers)
  const views = players.map((player) => player.view)

  const params = spawnParams()
  const leaving = []
  world
    .query(WildCreature, WildSpawnInfo, Position)
    .readEach(([, info, position], entity) => {
      const reason = despawnReason(
        {
          distance: nearestDistance(position, viewers),
          age: info.age,
          outOfView: views.every((view) => isOutOfView(position, view, params)),
          isProtected: entity.has(BeingCaptured),
        },
        gameplayRng(),
        params,
      )
      if (reason) leaving.push({ entity, reason })
    })

  // Fora da query: destruir muda a lista iterada.
  for (const { entity, reason } of leaving) {
    despawnarSelvagem(world, events, entity, reason)
  }
}
