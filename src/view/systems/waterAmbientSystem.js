import { GAME_CONFIG } from '@/core/gameConfig'
import { TEST_LEVEL } from '@/core/data/testLevel'
import { WATER_AMBIENT } from '@/core/data/audio/waterSounds'
import { levelWaterDepthAt } from '@/core/actions/water'
import { nearestWaterPoints } from '@/core/terrain/water'
import { InputControlled, Position } from '@/core/traits'
import { WATER_KINDS, getWaterAmbientState } from '@/view/audio/waterAmbient'

/**
 * Som de fundo da água (docs/features/065-sons-do-mundo.md, Parte 5), fase
 * `presentation`. De `PROBE_INTERVAL` em `PROBE_INTERVAL` s, procura o
 * ponto de lago e o de rio mais perto de quem o jogador controla
 * (`nearestWaterPoints`). O som de cada tipo vai pro ponto achado — na hora
 * na primeira vez, deslizando (`MOVE_SMOOTHING`) depois — e toca em loop;
 * o alcance do som (`spatialAudio.js`) cuida do volume pela distância. Sem
 * água daquele tipo no raio, o som para.
 */
export function waterAmbientSystem({ world, delta }) {
  const state = getWaterAmbientState()
  if (!state.root) return
  const focus = world.queryFirst(InputControlled, Position)
  if (!focus) return

  state.probeTimer -= delta
  if (state.probeTimer <= 0) {
    state.probeTimer = WATER_AMBIENT.PROBE_INTERVAL
    const { x, z } = focus.get(Position)
    state.targets = nearestWaterPoints(
      levelWaterDepthAt,
      TEST_LEVEL.terrain.flowAt,
      x,
      z,
      {
        radius: WATER_AMBIENT.SEARCH_RADIUS,
        step: WATER_AMBIENT.SEARCH_STEP,
        directions: WATER_AMBIENT.SEARCH_DIRECTIONS,
        riverFlow: WATER_AMBIENT.RIVER_FLOW,
      },
    )
  }

  const follow = 1 - Math.exp(-delta / WATER_AMBIENT.MOVE_SMOOTHING)
  for (const kind of WATER_KINDS) {
    const voice = state.voices[kind]
    const target = state.targets[kind]
    if (!voice) continue
    if (!target) {
      if (voice.audio.isPlaying) voice.audio.pause()
      voice.placed = false
      continue
    }
    placeVoice(voice, target, voice.placed ? follow : 1)
    voice.placed = true
    if (voice.audio.buffer && !voice.audio.isPlaying) voice.audio.play()
  }
}

function placeVoice({ holder }, target, amount) {
  const { position } = holder
  position.x += (target.x - position.x) * amount
  position.z += (target.z - position.z) * amount
  position.y = GAME_CONFIG.TERRAIN.WATER_LEVEL
}
