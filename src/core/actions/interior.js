import { TEST_LEVEL } from '../data/testLevel'
import { GAME_CONFIG } from '../gameConfig'
import { getInterior, interiorCollidersOf } from '../data/interiors'
import {
  createInteriorColliders,
  destroyCharacterBody,
  destroyInteriorColliders,
  hasRigidBody,
  teleportCharacterBody,
} from '../physics/colliders'
import { isPhysicsReady } from '../physics/physicsWorld'
import { verticalClearance } from '../physics/capsule'
import {
  interiorExitPoint,
  interiorOrigin,
  interiorToWorld,
  outsideSpot,
} from '../interior/interiorPlacement'
import { devolverControleAoDono } from './control'
import { derrubarComida } from './eating'
import { resolveOwner } from './owner'
import { guardarForaDeCampo } from './pokemon'
import {
  CameraSnap,
  CharacterController,
  Indoors,
  InteriorTransition,
  OrbitCamera,
  OwnedBy,
  PendingTraining,
  PhysicsBody,
  Position,
  Rotation,
  SaveRequested,
  SummonBall,
  SummonRequest,
  SummonedCreature,
  Velocity,
} from '../traits'

/**
 * Entrar e sair dos prédios (docs/features/068-interior-dos-predios.md).
 * Em dois tempos: o F na porta só começa a transição (`abrirPorta`/
 * `pedirSaida`, a tela escurece); no escuro, o `interiorSystem` faz a
 * troca (`entrarNoPredio`/`sairDoPredio`).
 *
 * Lá dentro: a sala fica acima da porta (`interiorPlacement.js`) com a
 * colisão dela (`createInteriorColliders`), o treinador ganha `Indoors`
 * (as selvagens não o alcançam, o mundo de fora some na tela) e o time
 * fica na bola — quem estava em campo volta na hora, sem a animação de
 * recolher (a tela está escura).
 */

/** O treinador está dentro de um prédio? */
export function isIndoors(entity) {
  return Boolean(entity?.isAlive?.() && entity.has(Indoors))
}

/** Já está indo ou vindo por uma porta? */
export function isPassingDoor(world) {
  return Boolean(world.get(InteriorTransition)?.phase)
}

function startTransition(world, transition) {
  world.set(InteriorTransition, { phase: 'out', elapsed: 0, ...transition })
}

/**
 * O `trainer` abre a porta `door` (`interiorPlacement.js`, `doorOf`): a
 * tela começa a escurecer. Já dentro, já passando por uma porta ou sala
 * desconhecida: nada (devolve `false`).
 */
export function abrirPorta(world, trainer, door) {
  if (!world.has(InteriorTransition) || isPassingDoor(world)) return false
  if (isIndoors(trainer) || !getInterior(door.interiorId)) return false
  startTransition(world, {
    action: 'enter',
    interiorId: door.interiorId,
    door,
  })
  return true
}

/** O `trainer` vai sair pela porta por onde entrou: a tela escurece. */
export function pedirSaida(world, trainer) {
  if (!world.has(InteriorTransition) || isPassingDoor(world)) return false
  if (!isIndoors(trainer)) return false
  startTransition(world, { action: 'exit', interiorId: null, door: null })
  return true
}

/**
 * O time do `trainer` volta para a bola na hora: quem está em campo (com o
 * que tinha — vida, condições, desmaio: `guardarForaDeCampo`), as bolas de
 * invocar em voo e os pedidos de treino somem.
 */
export function guardarTimeNaHora(world, trainer) {
  // Copiadas antes: destruir no meio da query mexe nela.
  const creatures = [...world.query(SummonedCreature, OwnedBy(trainer))]
  for (const creature of creatures) {
    derrubarComida(world, creature)
    guardarForaDeCampo(creature)
    devolverControleAoDono(creature)
    destroyCharacterBody(creature.get(PhysicsBody)?.bodyHandle ?? -1)
    creature.destroy()
  }
  const balls = [...world.query(SummonBall, OwnedBy(trainer))]
  for (const ball of balls) ball.destroy()
  for (const pokemon of [...world.query(PendingTraining)]) {
    if (resolveOwner(pokemon) === trainer) pokemon.remove(PendingTraining)
  }
  if (trainer.has(SummonRequest)) trainer.remove(SummonRequest)
}

// Põe o treinador em `position` (o centro do corpo), parado, virado para
// `yaw`.
function moveTrainer(trainer, position, yaw) {
  trainer.set(Position, { ...position })
  if (trainer.has(Velocity)) trainer.set(Velocity, { x: 0, y: 0, z: 0 })
  trainer.set(Rotation, { ...trainer.get(Rotation), y: yaw })
  if (trainer.has(PhysicsBody)) {
    teleportCharacterBody(trainer.get(PhysicsBody).bodyHandle, position)
  }
}

// A câmera atrás de quem olha para `facing` (o giro do corpo), sem a
// suavização no próximo quadro (`CameraSnap`). A frente da câmera é
// `(-sin yaw, -cos yaw)` (core/camera/orbitCamera.js) e a do corpo
// `(sin y, cos y)`: meia volta de diferença.
function aimCamera(world, facing, orbit = {}) {
  const camera = world.queryFirst(OrbitCamera)
  if (!camera) return
  camera.set(OrbitCamera, {
    ...camera.get(OrbitCamera),
    ...orbit,
    yaw: facing + Math.PI,
  })
  if (!camera.has(CameraSnap)) camera.add(CameraSnap)
}

// Passar pela porta é um ponto de save (como `pedirSave`, actions/save.js —
// sem importar de lá: o save importa daqui).
function requestSave(trainer) {
  if (!trainer.has(SaveRequested)) trainer.add(SaveRequested)
}

const clearanceOf = (trainer) => {
  const body = trainer.get(CharacterController)
  return body ? verticalClearance(body) : 0
}

/**
 * No escuro: o `trainer` entra pela porta `door`. A sala aparece acima
 * dela com a colisão, o time volta para a bola e o treinador fica no
 * tapete da entrada, virado para dentro (o −Z da sala), com a câmera atrás.
 */
export function entrarNoPredio(world, trainer, door) {
  const interior = getInterior(door.interiorId)
  if (!interior || isIndoors(trainer)) return false
  guardarTimeNaHora(world, trainer)

  const place = { ...interiorOrigin(door), scale: door.scale }
  const bodyHandle = createInteriorColliders(
    interiorCollidersOf(interior),
    place,
  )
  trainer.add(
    Indoors({
      interiorId: interior.id,
      ...place,
      door: { ...door },
      bodyHandle,
    }),
  )

  const spot = interiorExitPoint(interior, place)
  // Virado para o fundo da sala (−Z): o giro do corpo de quem olha para
  // `(0, −1)`.
  const facing = Math.PI
  moveTrainer(
    trainer,
    { x: spot.x, y: spot.y + clearanceOf(trainer), z: spot.z },
    facing,
  )
  // A câmera de frente para a sala (`cameraControlSystem` a segura ali).
  const { PITCH, DISTANCE } = GAME_CONFIG.INTERIOR.CAMERA
  aimCamera(world, facing, { pitch: PITCH, distance: DISTANCE })
  requestSave(trainer)
  return true
}

/**
 * No escuro: o `trainer` sai pela porta por onde entrou. A colisão da sala
 * some e ele fica à frente da porta, virado para a rua, em pé no relevo.
 */
export function sairDoPredio(world, trainer) {
  if (!isIndoors(trainer)) return false
  const { door, bodyHandle } = trainer.get(Indoors)
  destroyInteriorColliders(bodyHandle)
  trainer.remove(Indoors)
  guardarTimeNaHora(world, trainer)

  const spot = outsideSpot(door)
  const ground = TEST_LEVEL.terrain.heightAt(spot.x, spot.z)
  moveTrainer(
    trainer,
    {
      x: spot.x,
      y: ground + clearanceOf(trainer) + GAME_CONFIG.TERRAIN.SPAWN_HEIGHT,
      z: spot.z,
    },
    spot.yaw,
  )
  aimCamera(world, spot.yaw)
  requestSave(trainer)
  return true
}

/**
 * O que vai no save sobre o prédio (`indoors`, saveFormat.js): a sala e a
 * porta por onde o `trainer` entrou — ou `null`, do lado de fora. A
 * posição salva é a de dentro da sala.
 */
export function indoorsSaveOf(trainer) {
  if (!isIndoors(trainer)) return null
  const { interiorId, door } = trainer.get(Indoors)
  const { x, y, z, yaw, scale } = door
  return { interiorId, door: { x, y, z, yaw, scale } }
}

// Folga (m, na escala da sala) acima do piso em que uma posição ainda conta
// como dentro da sala (salvo no meio de um pulo).
const ROOM_HEIGHT_REACH = 6

/**
 * Ao carregar o jogo: o `trainer` volta para dentro da sala salva (`saved`,
 * a forma de `indoorsSaveOf`), em `position` — ou no tapete da entrada, se
 * ela não cai no piso da sala. A colisão da sala chega quando a física
 * estiver pronta (`garantirColisaoDaSala`). Sala que não existe mais:
 * nada (devolve `false`).
 */
export function voltarParaDentro(trainer, saved, position) {
  const interior = getInterior(saved?.interiorId)
  if (!interior) return false
  const door = { ...saved.door, interiorId: interior.id }
  const place = { ...interiorOrigin(door), scale: door.scale }
  const indoors = { interiorId: interior.id, ...place, door, bodyHandle: -1 }
  if (trainer.has(Indoors)) trainer.set(Indoors, indoors)
  else trainer.add(Indoors(indoors))

  const { floor } = interiorCollidersOf(interior)
  const min = interiorToWorld(place, {
    x: floor.minX,
    y: floor.y,
    z: floor.minZ,
  })
  const max = interiorToWorld(place, {
    x: floor.maxX,
    y: floor.y,
    z: floor.maxZ,
  })
  const isOnFloor =
    position &&
    position.x >= min.x &&
    position.x <= max.x &&
    position.z >= min.z &&
    position.z <= max.z &&
    position.y >= min.y &&
    position.y <= min.y + ROOM_HEIGHT_REACH * place.scale
  const exit = interiorExitPoint(interior, place)
  trainer.set(
    Position,
    isOnFloor
      ? { x: position.x, y: position.y, z: position.z }
      : { x: exit.x, y: exit.y + clearanceOf(trainer), z: exit.z },
  )
  return true
}

/**
 * A colisão da sala de quem está dentro, se ela ainda não existe: ao
 * carregar o jogo dentro de um prédio (a física fica pronta depois) ou com
 * o mundo da física refeito. Sem física ainda, espera. Devolve se criou.
 */
export function garantirColisaoDaSala(trainer) {
  if (!isIndoors(trainer) || !isPhysicsReady()) return false
  const indoors = trainer.get(Indoors)
  if (hasRigidBody(indoors.bodyHandle)) return false
  const interior = getInterior(indoors.interiorId)
  if (!interior) return false
  const bodyHandle = createInteriorColliders(
    interiorCollidersOf(interior),
    indoors,
  )
  trainer.set(Indoors, { ...indoors, bodyHandle })
  return bodyHandle >= 0
}
