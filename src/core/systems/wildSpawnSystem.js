import { TEST_LEVEL } from '../data/testLevel'
import { getSpecies, listSpecies } from '../data/species'
import { nascerSelvagem } from '../actions/wildSpawn'
import { GAME_CONFIG } from '../gameConfig'
import { verticalClearance } from '../physics/capsule'
import { gameplayRng } from '../rng'
import { dayPhaseOf } from '../time/dayCycle'
import { weatherAt } from '../weather/worldWeather'
import {
  listSpawnCandidates,
  nearestDistance,
  pickSpawnSpecies,
  rollSpawnPoint,
  spawnParams,
} from '../wildSpawn/wildSpawn'
import { listSpawnPlayers } from '../wildSpawn/spawnPlayers'
import { baseLevelAt, rollLevelAround } from '../wildSpawn/wildLevel'
import { Position, WildCreature, WildSpawnState, WorldClock } from '../traits'

/**
 * Povoa o mundo de selvagens em volta de cada jogador (docs/features/062-
 * spawn-estilo-cobblemon.md). A cada `WILD_SPAWN.INTERVAL`, para cada
 * jogador abaixo do teto (selvagens até o raio longe dele), tenta alguns
 * pontos em volta de quem a câmera segue — andando, parte deles na frente,
 * logo além da névoa — e faz nascer até `SPAWNS_PER_INTERVAL`. Cada ponto
 * bom sorteia a faixa de raridade e, pelo bioma, pela fase do dia e pelo
 * clima dali, uma espécie dela, que nasce no nível das cidades em volta.
 *
 * Lê `WorldClock`, os jogadores (`listSpawnPlayers`) e o relevo do nível;
 * escreve `WildSpawnState.spawnTimer` e cria selvagens (`nascerSelvagem`).
 *
 * Headless. Fase: simulation, depois do `wildDespawnSystem` (a vaga de quem
 * sumiu já conta) e antes da IA e da física das selvagens.
 */
export function wildSpawnSystem(context) {
  const { world, delta = 0, events } = context
  if (!world.has(WildSpawnState)) return

  const state = world.get(WildSpawnState)
  state.spawnTimer -= delta
  if (state.spawnTimer > 0) return
  state.spawnTimer = GAME_CONFIG.WILD_SPAWN.INTERVAL

  const params = spawnParams()
  const time = world.has(WorldClock) ? world.get(WorldClock).time : 0
  const phase = dayPhaseOf(time)
  const speciesList = listSpecies().filter((species) => species.spawn)
  const wildPositions = world
    .query(WildCreature, Position)
    .map((entity) => entity.get(Position))

  for (const player of listSpawnPlayers(world)) {
    let count = wildPositions.filter(
      (position) =>
        nearestDistance(position, player.viewers) <= params.FAR_RADIUS,
    ).length

    let spawned = 0
    for (let attempt = 0; attempt < params.ATTEMPTS; attempt++) {
      if (count >= params.MAX_PER_PLAYER) break
      if (spawned >= params.SPAWNS_PER_INTERVAL) break
      const point = rollSpawnPoint(
        gameplayRng,
        {
          center: player.view ?? player.viewers[0],
          viewers: player.viewers,
          view: player.view,
          ground: TEST_LEVEL.terrain,
          heading: player.heading,
        },
        params,
      )
      if (!point) continue

      const speciesId = pickSpawnSpecies(
        gameplayRng,
        listSpawnCandidates(
          speciesList,
          {
            biome: TEST_LEVEL.terrain.biomeAt(point.x, point.z),
            phase,
            weather: weatherAt(point.x, point.z, time).type,
          },
          params,
        ),
        params,
      )
      if (!speciesId) continue

      const entity = nascerSelvagem(world, events, {
        speciesId,
        position: { ...point, y: point.y + spawnLift(speciesId) },
        level: levelAt(point),
      })
      if (!entity) continue
      wildPositions.push(entity.get(Position))
      count += 1
      spawned += 1
    }
  }
}

// O nível de quem nasce em `point`: o das cidades em volta, mais a
// variação do indivíduo.
function levelAt(point) {
  const nearest = TEST_LEVEL.terrain.nearestCities(point.x, point.z, 2)
  const base = baseLevelAt(GAME_CONFIG.WORLD.SEED, nearest)
  return rollLevelAround(gameplayRng, base)
}

// Do chão ao centro do corpo, com a folga de cair no chão.
const spawnLift = (speciesId) =>
  verticalClearance(getSpecies(speciesId).body) +
  GAME_CONFIG.TERRAIN.SPAWN_HEIGHT
