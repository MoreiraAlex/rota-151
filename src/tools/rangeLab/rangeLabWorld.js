import { nascerSelvagem, removerSelvagem } from '@/core/actions/wildSpawn'
import { getSpecies } from '@/core/data/species'
import { resolveVoiceSound } from '@/core/data/audio/voiceSound'
import { verticalClearance } from '@/core/physics/colliders'
import { animationStateSystem } from '@/core/systems/animationStateSystem'
import { CryPulse, Grounded, Position, Rotation, Velocity } from '@/core/traits'
import {
  DEFAULT_VOICE_MAX_DISTANCE,
  DEFAULT_VOICE_REF_DISTANCE,
  DEFAULT_VOICE_VOLUME,
} from '@/view/audio/soundRanges'
import { getVoiceAudioEntry } from '@/view/registry/voiceAudioRegistry'
import {
  headingOf,
  pointAround,
  resolveSoundRange,
  stepOrbit,
  stepShuttle,
} from './rangeLabData'

/**
 * O mundo do laboratório de alcance (docs/features/062-spawn-estilo-
 * cobblemon.md): UMA selvagem de verdade (`nascerSelvagem`) em volta da
 * câmera, parada na origem, sem física nem IA — quem a põe no lugar é o
 * `rangeLabSystem`. Ela fica num raio da câmera, no ângulo pedido (zero = a
 * frente do lab, positivo à direita, `pointAround`).
 *
 * `lab` são as escolhas da página: `{ speciesId, mode, distance, angle, from,
 * to, speed, orbitSpeed, respawnEvery, cryEvery }`, com `mode` `'still'`,
 * `'shuttle'`, `'orbit'` ou `'respawn'`. `state` é de quem roda o system
 * (`createRangeLabState`): a selvagem, os temporizadores, os comandos dos
 * botões e o teste do estalo. `viewCommands` são da cena (a câmera), não
 * daqui.
 */

// Quanto além do alcance da voz o teste do estalo nasce.
const CLICK_TEST_MARGIN = 10
// Espera (s) entre nascer e gritar: o modelo e o som precisam montar.
const CLICK_TEST_SETTLE = 0.3
const LAB_LEVEL = 5

export function createRangeLabState() {
  return {
    entity: null,
    speciesId: null,
    wanted: true,
    distance: null,
    angle: 0,
    direction: 1,
    respawnTimer: 0,
    cryTimer: 0,
    commands: [],
    viewCommands: [],
    clickTest: null,
  }
}

/** O alcance da voz da espécie, como o `useAnimatedModel` resolve. */
export function resolveVoiceRange(species) {
  return resolveSoundRange(resolveVoiceSound(species), {
    refDistance: DEFAULT_VOICE_REF_DISTANCE,
    maxDistance: DEFAULT_VOICE_MAX_DISTANCE,
  })
}

/** O volume da voz da espécie no config, como o `useAnimatedModel` resolve. */
export function resolveVoiceVolume(species) {
  return resolveVoiceSound(species)?.volume ?? DEFAULT_VOICE_VOLUME
}

export function standingHeight(species) {
  return verticalClearance(species.body)
}

/**
 * Põe a selvagem no raio `distance`, ângulo `angle`, virada para `heading`
 * (como a `Rotation.y`) e andando a `speed` (m/s) para lá.
 */
function place(entity, species, { distance, angle, heading, speed }) {
  const { x, z } = pointAround(distance, angle)
  entity.set(Position, { x, y: standingHeight(species), z })
  entity.set(Rotation, { x: 0, y: heading, z: 0 })
  entity.set(Velocity, {
    x: Math.sin(heading) * speed,
    y: 0,
    z: Math.cos(heading) * speed,
  })
}

// Rumo de quem se afasta da câmera no ângulo `angle`.
function outward(angle) {
  return headingOf(pointAround(1, angle))
}

function placeStill(entity, species, distance, angle) {
  place(entity, species, { distance, angle, heading: outward(angle), speed: 0 })
}

function alive(state) {
  return state.entity?.isAlive?.() ? state.entity : null
}

function remove(state) {
  removerSelvagem(alive(state))
  state.entity = null
}

function spawn(world, lab, state, distance) {
  remove(state)
  const species = getSpecies(lab.speciesId)
  const { x, z } = pointAround(distance, lab.angle)
  const entity = nascerSelvagem(world, null, {
    speciesId: lab.speciesId,
    position: { x, y: standingHeight(species), z },
    level: LAB_LEVEL,
  })
  // Sem física, ninguém diria que está no chão (a animação pede).
  entity.add(Grounded)
  state.entity = entity
  state.speciesId = lab.speciesId
  state.distance = distance
  state.angle = lab.angle
  state.direction = 1
}

/** Grita agora, se a voz já carregou. Devolve se gritou. */
function cry(entity) {
  if (!entity || !getVoiceAudioEntry(entity)?.buffers.length) return false
  entity.add(CryPulse)
  return true
}

function runCommands(world, lab, state) {
  for (const command of state.commands.splice(0)) {
    if (command === 'cry') cry(alive(state))
    if (command === 'respawn') {
      state.wanted = true
      spawn(world, lab, state, lab.distance)
    }
    if (command === 'remove') {
      state.wanted = false
      state.clickTest = null
      remove(state)
    }
    if (command === 'clickTest') {
      state.wanted = true
      const species = getSpecies(lab.speciesId)
      const distance =
        resolveVoiceRange(species).maxDistance + CLICK_TEST_MARGIN
      spawn(world, lab, state, distance)
      state.clickTest = { phase: 'settle', wait: CLICK_TEST_SETTLE, distance }
    }
  }
}

/**
 * O teste do estalo: uma selvagem nova, fora do alcance, grita pela primeira
 * vez e tem que sair mudo. O som novo nasce na origem do mundo, onde a câmera
 * do laboratório está — sem pôr o som no lugar antes de tocar
 * (`view/audio/spatialAudio.js`), o começo do grito vaza. Espera a voz
 * carregar, grita e fica lá até o som acabar.
 */
function runClickTest(entity, state, delta) {
  const test = state.clickTest
  const playing = getVoiceAudioEntry(entity)?.audio.isPlaying
  if (test.phase === 'settle') {
    test.wait -= delta
    if (test.wait <= 0 && cry(entity)) test.phase = 'cried'
  } else if (test.phase === 'cried') {
    // O pulso só vira som no quadro de apresentação seguinte.
    if (playing) test.phase = 'playing'
  } else if (!playing) {
    state.clickTest = null
  }
}

/** Põe a selvagem onde a página pede, a cada passo fixo. */
export function rangeLabSystem({ world, delta, lab, state }) {
  runCommands(world, lab, state)
  if (!state.wanted) return

  if (!alive(state) || state.speciesId !== lab.speciesId) {
    spawn(world, lab, state, lab.distance)
  }
  const entity = state.entity
  const species = getSpecies(lab.speciesId)

  if (state.clickTest) {
    state.distance = state.clickTest.distance
    placeStill(entity, species, state.distance, state.angle)
    runClickTest(entity, state, delta)
    return
  }

  if (lab.mode === 'shuttle') {
    const next = stepShuttle(state.distance, state.direction, lab, delta)
    state.distance = next.distance
    state.direction = next.direction
    state.angle = lab.angle
    const heading = outward(lab.angle) + (next.direction > 0 ? 0 : Math.PI)
    place(entity, species, {
      distance: state.distance,
      angle: state.angle,
      heading,
      speed: lab.speed,
    })
  } else if (lab.mode === 'orbit') {
    state.distance = lab.distance
    state.angle = stepOrbit(state.angle, lab.orbitSpeed, delta)
    // Anda de lado em relação à câmera, no sentido em que o ângulo cresce.
    const heading =
      outward(state.angle) + Math.sign(lab.orbitSpeed) * -(Math.PI / 2)
    const speed = Math.abs(lab.orbitSpeed) * (Math.PI / 180) * state.distance
    place(entity, species, {
      distance: state.distance,
      angle: state.angle,
      heading,
      speed,
    })
  } else {
    state.distance = lab.distance
    state.angle = lab.angle
    state.direction = 1
    placeStill(entity, species, state.distance, state.angle)
  }

  if (lab.mode === 'respawn') {
    state.respawnTimer -= delta
    if (state.respawnTimer <= 0) {
      state.respawnTimer = lab.respawnEvery
      spawn(world, lab, state, lab.distance)
    }
  }

  if (lab.cryEvery > 0) {
    state.cryTimer -= delta
    if (state.cryTimer <= 0 && cry(alive(state))) {
      state.cryTimer = lab.cryEvery
    }
  }
}

/** Tira a selvagem do laboratório. */
export function desmontarRangeLab(state) {
  remove(state)
}

/** Um passo fixo do laboratório. */
export function runRangeLabStep(context) {
  rangeLabSystem(context)
  animationStateSystem(context)
}
