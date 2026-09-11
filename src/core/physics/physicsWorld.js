import { GAME_CONFIG } from '../gameConfig'

/**
 * Singleton da física. É o ÚNICO módulo que importa Rapier.
 *
 * Rapier-compat é WASM puro (sem DOM), então este módulo continua headless:
 * roda em Node, worker ou servidor. O resto do projeto fala com a física
 * apenas por esta API.
 *
 * O WASM é carregado uma única vez no processo (`loadRapier`). O `World` em si é
 * criado por `initPhysics()` e liberado por `disposePhysics()`, então um
 * hot-reload ou um teste pode reinicializar sem recarregar o WASM.
 */
let rapier = null
let rapierWorld = null
let characterController = null
let ready = false
let levelBuilt = false
let wasmPromise = null
let initPromise = null

function loadRapier() {
  if (!wasmPromise) {
    wasmPromise = (async () => {
      const RAPIER = await import('@dimforge/rapier3d-compat')
      await RAPIER.init()
      rapier = RAPIER
    })()
  }
  return wasmPromise
}

export async function initPhysics() {
  if (ready) return
  if (initPromise) return initPromise

  initPromise = (async () => {
    await loadRapier()

    const cfg = GAME_CONFIG.PHYSICS
    const char = cfg.CHARACTER

    rapierWorld = new rapier.World({ x: 0, y: cfg.GRAVITY, z: 0 })

    characterController = rapierWorld.createCharacterController(
      char.CONTROLLER_OFFSET,
    )
    characterController.enableAutostep(
      char.AUTOSTEP_HEIGHT,
      char.AUTOSTEP_MIN_WIDTH,
      true,
    )
    characterController.enableSnapToGround(char.SNAP_TO_GROUND)
    characterController.setMaxSlopeClimbAngle(char.MAX_SLOPE_CLIMB)
    characterController.setMinSlopeSlideAngle(char.MIN_SLOPE_SLIDE)

    ready = true
    initPromise = null
  })()

  return initPromise
}

export function isPhysicsReady() {
  return ready
}

export function getRapier() {
  return rapier
}

export function getRapierWorld() {
  return rapierWorld
}

export function getCharacterController() {
  return characterController
}

export function stepPhysics() {
  if (rapierWorld) rapierWorld.step()
}

/**
 * Marca o nível como construído. Usado pelo physicsBootstrapSystem para não
 * recriar colliders a cada tick; resetado por disposePhysics.
 */
export function isLevelBuilt() {
  return levelBuilt
}

export function markLevelBuilt() {
  levelBuilt = true
}

export function disposePhysics() {
  if (rapierWorld) rapierWorld.free()
  rapierWorld = null
  characterController = null
  ready = false
  levelBuilt = false
  initPromise = null
  // `rapier` e o WASM permanecem carregados — só o World é recriado.
}
