import { TEST_LEVEL } from '../data/testLevel'
import { GAME_CONFIG } from '../gameConfig'
import {
  multiplyQuaternions,
  quaternionFromAxisAngle,
  wrapAngle,
} from '../math'
import { chunkKey } from '../terrain/terrainChunk'
import { getRapier, getRapierWorld } from './physicsWorld'

/**
 * Colisor do relevo de um chunk (docs/features/045-terreno-de-um-chunk.md):
 * heightfield do Rapier com as alturas do chunk, posto no lugar dele. O
 * Rapier centra o heightfield no corpo e lê as alturas por coluna (`ix` ao
 * longo de X, `iz` ao longo de Z) — a mesma ordem de `TerrainChunk.heights`.
 * Devolve o handle do corpo (para `destroyTerrainChunkCollider`).
 */
export function createTerrainChunkCollider(chunk) {
  const RAPIER = getRapier()
  const world = getRapierWorld()
  const half = chunk.size / 2

  const body = world.createRigidBody(
    RAPIER.RigidBodyDesc.fixed().setTranslation(
      chunk.minX + half,
      0,
      chunk.minZ + half,
    ),
  )
  world.createCollider(
    RAPIER.ColliderDesc.heightfield(
      chunk.resolution,
      chunk.resolution,
      chunk.heights,
      { x: chunk.size, y: 1, z: chunk.size },
    ),
    body,
  )
  return body.handle
}

/** Desfaz `createTerrainChunkCollider`. Handle que já não existe: nada. */
export function destroyTerrainChunkCollider(bodyHandle) {
  const world = getRapierWorld()
  const body = world?.getRigidBody(bodyHandle)
  if (!body) return
  world.removeRigidBody(body)
}

// Corpos dos obstáculos criados por `createStaticLevel` — para
// `destroyStaticLevel`.
let staticLevelBodies = []
// Corpo do colisor de cada chunk carregado, por chave
// (docs/features/046-sistema-de-chunks.md).
const chunkBodies = new Map()

/**
 * Colisor do chunk carregado `chunk` no nível (`carregarChunk`,
 * core/actions/chunks.js). Se já tinha um, troca.
 */
export function addLevelChunkCollider(chunk) {
  removeLevelChunkCollider(chunk.chunkX, chunk.chunkZ)
  chunkBodies.set(
    chunkKey(chunk.chunkX, chunk.chunkZ),
    createTerrainChunkCollider(chunk),
  )
}

/** Desfaz `addLevelChunkCollider` (`descarregarChunk`). */
export function removeLevelChunkCollider(chunkX, chunkZ) {
  const key = chunkKey(chunkX, chunkZ)
  if (!chunkBodies.has(key)) return
  destroyTerrainChunkCollider(chunkBodies.get(key))
  chunkBodies.delete(key)
}

/** O chunk `(chunkX, chunkZ)` tem colisor no nível? */
export function hasLevelChunkCollider(chunkX, chunkZ) {
  return chunkBodies.has(chunkKey(chunkX, chunkZ))
}

/**
 * Cria os colliders estáticos do nível a partir de TEST_LEVEL: os
 * obstáculos (corpos fixos, cuboides) e o relevo dos chunks JÁ carregados —
 * os que carregarem depois ganham colisor em `carregarChunk`. Chamado uma
 * vez quando a física fica pronta (`physicsBootstrapSystem`, que também
 * cobre o world refeito do hot-reload).
 */
export function createStaticLevel() {
  const RAPIER = getRapier()
  const world = getRapierWorld()
  staticLevelBodies = []

  // World novo: os handles de antes não valem mais.
  chunkBodies.clear()
  for (const chunk of TEST_LEVEL.terrain.loadedChunks()) {
    addLevelChunkCollider(chunk)
  }

  for (const obstacle of TEST_LEVEL.obstacles) {
    const [w, h, d] = obstacle.size
    let desc = RAPIER.RigidBodyDesc.fixed().setTranslation(
      obstacle.position[0],
      obstacle.position[1],
      obstacle.position[2],
    )
    if (obstacle.rotation) {
      desc = desc.setRotation(
        quaternionFromAxisAngle(
          obstacle.rotation.axis,
          obstacle.rotation.angle,
        ),
      )
    }
    const body = world.createRigidBody(desc)
    world.createCollider(RAPIER.ColliderDesc.cuboid(w / 2, h / 2, d / 2), body)
    staticLevelBodies.push(body.handle)
  }
}

/**
 * Desfaz `createStaticLevel` — para refazer o nível com o relevo ajustado
 * (debug, `regenerarTerreno`).
 */
export function destroyStaticLevel() {
  const world = getRapierWorld()
  for (const handle of staticLevelBodies) {
    const body = world?.getRigidBody(handle)
    if (body) world.removeRigidBody(body)
  }
  staticLevelBodies = []
  for (const handle of chunkBodies.values()) {
    destroyTerrainChunkCollider(handle)
  }
  chunkBodies.clear()
}

// Rapier gera a cápsula em pé (comprida no eixo Y local). Deitar ela é girar
// esse eixo local 90° em torno de um dos outros dois — 'y' não precisa de
// rotação nenhuma (já é o padrão do primitivo).
const CAPSULE_TILT = {
  x: () => quaternionFromAxisAngle('z', Math.PI / 2),
  z: () => quaternionFromAxisAngle('x', Math.PI / 2),
}

// Mora em `capsule.js` (sem Rapier) — reexportada aqui por quem já importava
// daqui.
export { verticalClearance } from './capsule'

/**
 * Cria o corpo cinemático + collider cápsula do personagem na posição dada.
 * `radius`/`halfHeight`/`axis` vêm do trait CharacterController da entidade
 * (por sua vez copiado de `core/data/species/<id>/index.js` no spawn) — cada
 * entidade pode ter um corpo de tamanho e orientação diferentes. `axis`
 * deita a cápsula (`'x'`/`'z'`) pra corpos alongados na horizontal
 * (quadrúpedes) em vez de em pé (`'y'`, padrão). Retorna os handles para
 * guardar no trait PhysicsBody.
 *
 * Collider sem grupo de interação especial — colide com QUALQUER outro
 * collider, incluindo outros personagens (jogador/criaturas entre si).
 * Uma tentativa anterior fazia personagens se ignorarem entre si
 * (`InteractionGroups`, atravessava um pelo outro) — revertida a pedido
 * do usuário: passar direto um pelo outro não é aceitável, o controle de
 * não esbarrar tem que vir de EVASÃO (`creatureFollowSystem.js` desvia
 * proativamente de outros personagens próximos), não de fingir que eles
 * não existem fisicamente.
 */
export function createCharacterBody(
  position,
  { radius, halfHeight, axis = 'y' },
) {
  const RAPIER = getRapier()
  const world = getRapierWorld()

  const body = world.createRigidBody(
    RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(
      position.x,
      position.y,
      position.z,
    ),
  )

  let colliderDesc = RAPIER.ColliderDesc.capsule(halfHeight, radius)
  const tilt = CAPSULE_TILT[axis]
  if (tilt) colliderDesc = colliderDesc.setRotation(tilt())

  const collider = world.createCollider(colliderDesc, body)

  return { bodyHandle: body.handle, colliderHandle: collider.handle }
}

/**
 * Desfaz `createCharacterBody` — remove o rigid body (e o collider
 * atrelado a ele, o Rapier cuida disso sozinho) do world físico. Usado
 * quando uma entidade com corpo dinâmico (hoje só `SummonedCreature`, ver
 * `partySummonSystem.js`) é destruída — sem isso, cada ciclo de invocar/
 * recolher vazaria um rigid body no world do Rapier, que nunca mais seria
 * usado nem liberado. `bodyHandle < 0` (nunca chegou a ser criado, ex.:
 * física ainda não estava pronta na invocação) ou um handle que já não
 * existe mais não fazem nada — seguro chamar sempre, sem checar antes.
 */
export function destroyCharacterBody(bodyHandle) {
  if (bodyHandle < 0) return
  const world = getRapierWorld()
  const body = world.getRigidBody(bodyHandle)
  if (!body) return
  world.removeRigidBody(body)
}

/**
 * Liga/desliga o collider de um personagem sem destruí-lo — desligado, ele
 * sai da colisão com os outros (atravessam) e das consultas (`castRay`),
 * mas o próprio `computeColliderMovement` dele continua funcionando (ainda
 * pisa no chão). Usado pelo desmaio (`core/actions/faint.js`): a criatura
 * desmaiada fica intangível e volta ao normal ao acordar. Handle inválido
 * (`< 0`, física não estava pronta) ou que já não existe: não faz nada.
 */
export function setCharacterColliderEnabled(colliderHandle, enabled) {
  if (colliderHandle == null || colliderHandle < 0) return
  const world = getRapierWorld()
  const collider = world?.getCollider(colliderHandle)
  if (!collider) return
  collider.setEnabled(enabled)
}

/**
 * Põe o corpo de um personagem direto em `position` (sem varrer o caminho)
 * — o selvagem que escapa da Pokébola reaparece onde a bola estava
 * (docs/features/043-captura.md). Handle inválido ou que já não existe: não
 * faz nada.
 */
export function teleportCharacterBody(bodyHandle, position) {
  if (bodyHandle == null || bodyHandle < 0) return
  const body = getRapierWorld()?.getRigidBody(bodyHandle)
  if (!body) return
  body.setTranslation(position, true)
  body.setNextKinematicTranslation(position)
}

// Resto numérico (m) tolerado ao comparar distâncias.
const CLEARANCE_EPSILON = 1e-4
// Passos da busca binária pelo maior giro livre — N passos = precisão de
// 1/2^N do giro pedido.
const TURN_SEARCH_STEPS = 6

/**
 * Distância (m) da cápsula do personagem `colliderHandle`, posta em
 * `position` e virada pra `yaw`, até o OUTRO personagem mais próximo —
 * negativa = sobreposta (o quanto entrou). Só olha até `margin`: sem ninguém
 * mais perto que isso, devolve `margin`. Só personagens contam (chão e
 * paredes são corpos fixos); collider desligado (desmaiado) não conta.
 * `axis` é o `capsuleAxis` (a cápsula deitada gira junto com o corpo).
 */
export function characterClearance(
  colliderHandle,
  position,
  yaw,
  axis,
  margin,
) {
  const world = getRapierWorld()
  const collider = world.getCollider(colliderHandle)
  if (!collider) return margin

  const shape = collider.shape
  const tilt = CAPSULE_TILT[axis]
  const rotation = tilt
    ? multiplyQuaternions(quaternionFromAxisAngle('y', yaw), tilt())
    : quaternionFromAxisAngle('y', yaw)
  const reach = shape.radius + shape.halfHeight + margin

  let nearest = margin
  world.collidersWithAabbIntersectingAabb(
    position,
    { x: reach, y: reach, z: reach },
    (other) => {
      if (other.handle === collider.handle || !other.isEnabled()) return true
      if (other.parent()?.isFixed() !== false) return true
      const contact = shape.contactShape(
        position,
        rotation,
        other.shape,
        other.translation(),
        other.rotation(),
        margin,
      )
      if (contact) nearest = Math.min(nearest, contact.distance)
      return true
    },
  )
  return nearest
}

/**
 * Até onde o personagem pode GIRAR, de `fromYaw` (a rotação que o corpo tem
 * agora) na direção de `toYaw` (a pedida), sem chegar perto demais de outro
 * personagem. Quem move o corpo é o character controller, que confere
 * colisão no DESLOCAMENTO mas não na rotação — uma cápsula deitada (corpo de
 * quadrúpede, `capsuleAxis` `'x'`/`'z'`) que vira colada noutra criatura
 * varre a ponta pra dentro dela, e o controller não sabe sair de uma
 * sobreposição: bloqueia até o movimento de se afastar (medido: 1 mm já
 * basta). Ver docs/features/033-skills-de-combate-e-vfx.md (Parte 8).
 *
 * Regra: o giro não pode deixar a cápsula mais perto de outro personagem que
 * a folga do controller (`CONTROLLER_OFFSET`, a mesma distância que ele
 * mantém ao andar) — ou, se já estiver mais perto que isso, mais perto do que
 * está (pode girar pra se afastar, nunca pra entrar). Se o giro inteiro não
 * cabe, busca o maior pedaço que cabe. Cápsula em pé (`'y'`) é igual de
 * qualquer lado: gira sempre, sem consulta. Devolve o yaw a aplicar.
 */
export function resolveFreeTurn(
  colliderHandle,
  position,
  fromYaw,
  toYaw,
  axis,
) {
  if (!CAPSULE_TILT[axis]) return toYaw
  const delta = wrapAngle(toYaw - fromYaw)
  if (Math.abs(delta) < 1e-6) return toYaw

  const margin = GAME_CONFIG.PHYSICS.CHARACTER.CONTROLLER_OFFSET
  const clearance = (yaw) =>
    characterClearance(colliderHandle, position, yaw, axis, margin)
  const required = Math.min(clearance(fromYaw), margin) - CLEARANCE_EPSILON
  const fits = (fraction) => clearance(fromYaw + delta * fraction) >= required
  if (fits(1)) return toYaw

  let free = 0
  let blocked = 1
  for (let i = 0; i < TURN_SEARCH_STEPS; i++) {
    const middle = (free + blocked) / 2
    if (fits(middle)) free = middle
    else blocked = middle
  }
  return wrapAngle(fromYaw + delta * free)
}
