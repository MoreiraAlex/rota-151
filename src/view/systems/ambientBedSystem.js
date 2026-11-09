import { TEST_LEVEL } from '@/core/data/testLevel'
import {
  AMBIENCE,
  AMBIENT_ONE_SHOTS,
  AMBIENT_BEDS,
} from '@/core/data/audio/ambientBeds'
import {
  ambientBedLevels,
  daylightFactor,
  oneShotPresence,
} from '@/core/audio/ambience'
import { randomBetween } from '@/core/audio/music'
import { sunDirection } from '@/core/time/dayCycle'
import {
  InputControlled,
  LocalWeather,
  Position,
  WorldClock,
} from '@/core/traits'
import {
  getAmbientState,
  releaseBed,
  requestBed,
} from '@/view/audio/ambientBeds'
import { pickRandomVariation } from '@/view/audio/pickRandomVariation'

/**
 * Som ambiente do mundo (docs/features/065-sons-do-mundo.md, Parte 4), fase
 * `presentation`:
 *
 * - **Fundos**: de `PROBE_INTERVAL` em `PROBE_INTERVAL` s lê os pesos dos
 *   biomas em volta de quem o jogador controla; o volume de cada fundo é
 *   `ambientBedLevels` (peso × dia/noite, a chuva baixando o de dia),
 *   chegando lá aos poucos (`LEVEL_SMOOTHING`). Fundo pedido carrega e
 *   toca; fundo que sumiu para e é largado.
 * - **Avulsos** (coruja, rajada): cada um com seu intervalo sorteado; na
 *   vez, toca só se o lugar e a hora batem (`oneShotPresence` acima de
 *   `ONE_SHOT_MIN_PRESENCE`). A coruja nasce num ponto em volta do
 *   jogador, no alto.
 *
 * Som é cosmético: o sorteio usa `Math.random`.
 */
const weightsScratch = { array: null }

export function ambientBedSystem({ world, delta }) {
  const state = getAmbientState()
  if (!state.root || !world.has(WorldClock)) return
  const focus = world.queryFirst(InputControlled, Position)
  if (!focus) return
  const pos = focus.get(Position)

  state.probeTimer -= delta
  if (state.probeTimer <= 0) {
    state.probeTimer = AMBIENCE.PROBE_INTERVAL
    state.weights = biomeWeightsAt(pos.x, pos.z)
  }

  const daylight = daylightFactor(
    sunDirection(world.get(WorldClock).time).y,
    AMBIENCE.TWILIGHT,
  )
  const weather = world.has(LocalWeather) ? world.get(LocalWeather) : null
  const rain = weather ? Math.min(1, weather.rain + weather.storm) : 0

  updateBeds(
    state,
    ambientBedLevels(state.weights, {
      daylight,
      rain,
      rainDucking: AMBIENCE.RAIN_DUCKING,
    }),
    delta,
  )
  updateOneShots(state, pos, daylight, delta)
}

// `{ biomeId: peso }` em `(x, z)`, pela receita do relevo em uso.
function biomeWeightsAt(x, z) {
  const { biomeList } = TEST_LEVEL.terrain.recipe()
  if (weightsScratch.array?.length !== biomeList.length) {
    weightsScratch.array = new Float64Array(biomeList.length)
  }
  TEST_LEVEL.terrain.sample(x, z, weightsScratch.array)
  const weights = {}
  biomeList.forEach((biome, i) => {
    const weight = weightsScratch.array[i]
    if (weight > 0) weights[biome.id] = (weights[biome.id] ?? 0) + weight
  })
  return weights
}

function updateBeds(state, targets, delta) {
  const follow = 1 - Math.exp(-delta / AMBIENCE.LEVEL_SMOOTHING)
  for (const [id, bed] of Object.entries(state.beds)) {
    const target = targets[id] ?? 0
    if (target > 0) requestBed(id)
    bed.level += (target - bed.level) * follow
    if (target <= 0 && bed.level < 1e-3) {
      if (bed.buffer) releaseBed(id)
      continue
    }
    if (!bed.buffer) continue
    if (bed.audio.buffer !== bed.buffer) bed.audio.setBuffer(bed.buffer)
    bed.audio.setVolume(bed.level * AMBIENT_BEDS[id].volume)
    if (!bed.audio.isPlaying) bed.audio.play()
  }
}

function updateOneShots(state, pos, daylight, delta) {
  for (const [id, entry] of Object.entries(state.oneShots)) {
    const shot = AMBIENT_ONE_SHOTS[id]
    if (entry.audio.isPlaying) continue
    entry.timer -= delta
    if (entry.timer > 0) continue
    entry.timer = randomBetween(shot.interval, Math.random)

    const presence = oneShotPresence(shot, state.weights, daylight)
    if (presence < AMBIENCE.ONE_SHOT_MIN_PRESENCE) continue
    if (entry.buffers.length === 0) continue

    if (entry.holder) placeAround(entry.holder, pos, shot.spatial)
    entry.audio.setBuffer(pickRandomVariation(entry.buffers))
    entry.audio.setVolume(shot.volume)
    entry.audio.play()
  }
}

function placeAround(holder, pos, spatial) {
  const angle = Math.random() * Math.PI * 2
  const distance = randomBetween(spatial.distance, Math.random)
  holder.position.set(
    pos.x + Math.cos(angle) * distance,
    pos.y + spatial.height,
    pos.z + Math.sin(angle) * distance,
  )
  holder.updateMatrixWorld(true)
}
