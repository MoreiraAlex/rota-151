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
let characterAvoidanceController = null
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
    // Desvio de OUTROS personagens, numa consulta à parte (sem o chão) — ver
    // `getCharacterAvoidanceController`.
    characterAvoidanceController = rapierWorld.createCharacterController(
      char.CONTROLLER_OFFSET,
    )

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

/**
 * Character controller só pra desviar de OUTROS personagens (corpos
 * cinemáticos), sem autostep nem snap — o `characterPhysicsSystem.js` move
 * em duas passadas: este, contra os personagens (`charactersOnlyFilterFlags`),
 * e depois o de sempre (`getCharacterController`), contra o terreno
 * (`terrainOnlyFilterFlags`).
 *
 * Por quê: no Rapier (0.20 e 0.21, medido isolado), um personagem apoiado no
 * chão (a base dentro da folga do controller — o estado normal parado) com
 * OUTRO corpo cinemático a poucos cm não consegue andar nem pra longe nem pra
 * perto dele, só de lado — sem sobreposição nenhuma, e só com o chão na mesma
 * consulta (corpo fixo no lugar do cinemático, ou sem o chão, anda normal).
 * Era o "preso colado no oponente, só sai com pulo/dash" do combate: o pulo
 * tira a base da folga do chão. Com o chão e os personagens em consultas
 * separadas, o defeito não aparece. Ver
 * docs/features/033-skills-de-combate-e-vfx.md (Parte 8).
 */
export function getCharacterAvoidanceController() {
  return characterAvoidanceController
}

/**
 * Filtro de consulta que só enxerga PERSONAGENS (corpos cinemáticos) — tira a
 * geometria fixa do nível. Usado pela passada de desvio
 * (`getCharacterAvoidanceController`). `undefined` sem física carregada.
 */
export function charactersOnlyFilterFlags() {
  if (!rapier) return undefined
  return rapier.QueryFilterFlags.EXCLUDE_FIXED
}

/**
 * Filtro de consulta que só enxerga a geometria FIXA do nível (chão/
 * obstáculos) — todo personagem é corpo cinemático (`createCharacterBody`),
 * então fica de fora. Usado pelo raycast de terreno (`castRay`,
 * `terrainOnly`) e pelo movimento da criatura desmaiada
 * (`characterPhysicsSystem.js`), que não pode ser empurrada por quem passa
 * por cima dela. `undefined` sem física carregada.
 */
export function terrainOnlyFilterFlags() {
  if (!rapier) return undefined
  return (
    rapier.QueryFilterFlags.EXCLUDE_KINEMATIC |
    rapier.QueryFilterFlags.EXCLUDE_DYNAMIC
  )
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
  characterAvoidanceController = null
  ready = false
  levelBuilt = false
  initPromise = null
  // `rapier` e o WASM permanecem carregados — só o World é recriado.
}
