import { TEST_LEVEL } from '../data/testLevel'
import { GAME_CONFIG } from '../gameConfig'
import {
  multiplyQuaternions,
  quaternionFromAxisAngle,
  wrapAngle,
} from '../math'
import { chunkKey } from '../terrain/terrainChunk'
import { rockBaseY, solidParams, trunkOf } from '../vegetation/solidPlacement'
import { lgpeColliderOf } from '../vegetation/solidModels'
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
  addSolidColliders(chunk, body)
  return body.handle
}

/**
 * O casco do modelo do LGPE de um sólido (`lgpeColliderOf`) no tamanho
 * dele e girado como a view desenha, com a origem na base do modelo — ou
 * `null` sem modelo do LGPE.
 */
function lgpeHullOf(solid) {
  const collider = lgpeColliderOf(solid)
  if (!collider) return null
  const points = Float32Array.from(
    collider.points,
    (value) => value * solid.scale,
  )
  return getRapier()
    .ColliderDesc.convexHull(points)
    ?.setRotation(quaternionFromAxisAngle('y', solid.yaw))
}

// Quantas caixas fazem a volta de um anel (`ringBoxesOf`).
const RING_SEGMENTS = 16

/**
 * As caixas da borda de um objeto oco (`ring` do colisor do LGPE — a fonte
 * da praça, docs/features/069-revisao-do-bioma-cidade.md) posto em
 * `solid`: `RING_SEGMENTS` caixas em volta, da borda de dentro à de fora,
 * do chão até a altura dela (tudo no tamanho do objeto). Cada uma um pouco
 * mais larga que o pedaço dela, para não sobrar fresta entre elas. Dentro
 * do anel, nada.
 *
 * @returns {{ halfExtents: number[], x: number, y: number, z: number,
 *   yaw: number }[]}
 */
export function ringBoxesOf(ring, solid) {
  const { scale } = solid
  const inner = ring.inner * scale
  const outer = ring.outer * scale
  const middle = (inner + outer) / 2
  const halfHeight = (ring.height * scale) / 2
  const halfAlong = outer * Math.tan(Math.PI / RING_SEGMENTS)
  return Array.from({ length: RING_SEGMENTS }, (_, k) => {
    const angle = (k / RING_SEGMENTS) * Math.PI * 2
    return {
      halfExtents: [halfAlong, halfHeight, (outer - inner) / 2],
      x: solid.x + Math.cos(angle) * middle,
      y: solid.y + halfHeight,
      z: solid.z + Math.sin(angle) * middle,
      // O +Z da caixa para fora (do meio para a borda).
      yaw: Math.PI / 2 - angle,
    }
  })
}

/**
 * As caixas da moldura de um objeto oco retangular (`frame` do colisor do
 * LGPE — o canteiro de tronco, docs/features/069-revisao-do-bioma-
 * cidade.md) posto em `solid`: quatro caixas, do vão de dentro
 * (`frame.inner`) até a caixa no chão do modelo (`box`), do chão até a
 * altura dela, giradas com o objeto. Os lados leste e oeste cobrem os
 * cantos. Dentro do vão, nada.
 *
 * @returns {{ halfExtents: number[], x: number, y: number, z: number,
 *   yaw: number }[]}
 */
export function frameBoxesOf(frame, box, solid) {
  const [minX, minZ, maxX, maxZ] = box
  const [innerMinX, innerMinZ, innerMaxX, innerMaxZ] = frame.inner
  const sides = [
    [minX, minZ, innerMinX, maxZ],
    [innerMaxX, minZ, maxX, maxZ],
    [innerMinX, minZ, innerMaxX, innerMinZ],
    [innerMinX, innerMaxZ, innerMaxX, maxZ],
  ]
  const { scale, yaw = 0 } = solid
  const cos = Math.cos(yaw)
  const sin = Math.sin(yaw)
  const halfHeight = (frame.height * scale) / 2
  return sides.map(([x0, z0, x1, z1]) => {
    const localX = ((x0 + x1) / 2) * scale
    const localZ = ((z0 + z1) / 2) * scale
    return {
      halfExtents: [
        ((x1 - x0) / 2) * scale,
        halfHeight,
        ((z1 - z0) / 2) * scale,
      ],
      // O giro em Y do three (o mesmo do `setInstance` da view).
      x: solid.x + localX * cos + localZ * sin,
      y: solid.y + halfHeight,
      z: solid.z - localX * sin + localZ * cos,
      yaw,
    }
  })
}

/** As caixas da borda de um objeto oco (anel ou moldura), ou `null`. */
function hollowBoxesOf(solid) {
  const collider = lgpeColliderOf(solid)
  if (collider?.ring) return ringBoxesOf(collider.ring, solid)
  if (collider?.frame) return frameBoxesOf(collider.frame, collider.box, solid)
  return null
}

/**
 * Objetos sólidos do chunk (`chunk.solids`, docs/features/049-vegetacao-e-
 * floresta.md), no corpo do relevo — nascem e saem com ele. Com modelo do
 * LGPE, o casco convexo da malha (docs/features/052-assets-do-lgpe-e-
 * floresta.md, `lgpeHullOf`): o tronco da árvore até o alto (a copa não
 * colide) e a pedra inteira. Sem (modelo padrão):
 * - árvore (qualquer espécie): cilindro em pé no tronco, do tamanho da
 *   espécie (`trunkOf`);
 * - pedra: cilindro afundado um pouco no chão.
 *
 * Os prédios e objetos de rua das cidades (docs/features/056-bioma-
 * cidade.md) sempre têm modelo do LGPE: o casco dele, na base — menos o
 * oco (a fonte e o canteiro de tronco, 069), que colide só na borda
 * (`ringBoxesOf`, `frameBoxesOf`).
 */
function addSolidColliders(chunk, body) {
  if (!chunk.solids) return
  const RAPIER = getRapier()
  const world = getRapierWorld()
  const { ROCKS } = GAME_CONFIG
  const params = solidParams()
  const center = body.translation()
  const add = (desc, x, y, z) =>
    world.createCollider(
      desc.setTranslation(x - center.x, y, z - center.z),
      body,
    )

  for (const tree of chunk.solids.trees) {
    const hull = lgpeHullOf(tree)
    if (hull) {
      add(hull, tree.x, tree.y, tree.z)
      continue
    }
    const { radius, height } = trunkOf(tree, params)
    add(
      RAPIER.ColliderDesc.cylinder(height / 2, radius),
      tree.x,
      tree.y + height / 2,
      tree.z,
    )
  }
  for (const building of chunk.solids.buildings ?? []) {
    // Oco (a fonte, o canteiro): só a borda.
    const hollow = hollowBoxesOf(building)
    if (hollow) {
      for (const box of hollow) {
        const desc = RAPIER.ColliderDesc.cuboid(...box.halfExtents)
        desc.setRotation(quaternionFromAxisAngle('y', box.yaw))
        add(desc, box.x, box.y, box.z)
      }
      continue
    }
    const hull = lgpeHullOf(building)
    if (hull) add(hull, building.x, building.y, building.z)
  }
  for (const rock of chunk.solids.rocks) {
    const hull = lgpeHullOf(rock)
    if (hull) {
      add(hull, rock.x, rockBaseY(rock, ROCKS), rock.z)
      continue
    }
    const height = ROCKS.HEIGHT * rock.scale
    add(
      RAPIER.ColliderDesc.cylinder(height / 2, ROCKS.RADIUS * rock.scale),
      rock.x,
      rock.y + height * (0.5 - ROCKS.SINK),
      rock.z,
    )
  }
}

/**
 * A colisão da sala por dentro de um prédio (docs/features/068-interior-
 * dos-predios.md), num corpo fixo próprio posto em `place` (`{ x, y, z,
 * scale }`, a origem e a escala da sala — a forma de `Indoors`):
 *
 * - o **piso**: uma laje com o topo na altura dele e, por cima, dois
 *   triângulos — malha de triângulos é chão para a câmera (`castRay` com
 *   `groundOnly`, `resolveCameraCollision`), que não entra embaixo dele;
 * - as **paredes** e os **móveis**: caixas (`colliders.walls`/`solids`).
 *
 * `colliders` é o da sala (`interiorCollidersOf`), no espaço do modelo.
 * Devolve o handle do corpo (para `destroyInteriorColliders`), ou `-1`
 * sem física.
 */
export function createInteriorColliders(colliders, place) {
  const RAPIER = getRapier()
  const world = getRapierWorld()
  if (!RAPIER || !world) return -1
  const { scale } = place
  const body = world.createRigidBody(
    RAPIER.RigidBodyDesc.fixed().setTranslation(place.x, place.y, place.z),
  )
  const addBox = ([minX, minY, minZ, maxX, maxY, maxZ]) => {
    const half = [(maxX - minX) / 2, (maxY - minY) / 2, (maxZ - minZ) / 2]
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(
        ...half.map((value) => value * scale),
      ).setTranslation(
        ((minX + maxX) / 2) * scale,
        ((minY + maxY) / 2) * scale,
        ((minZ + maxZ) / 2) * scale,
      ),
      body,
    )
  }

  const { floor } = colliders
  const slab = Math.max(floor.maxX - floor.minX, floor.maxZ - floor.minZ)
  addBox([
    floor.minX,
    floor.y - slab,
    floor.minZ,
    floor.maxX,
    floor.y,
    floor.maxZ,
  ])
  const corners = [
    [floor.minX, floor.minZ],
    [floor.maxX, floor.minZ],
    [floor.maxX, floor.maxZ],
    [floor.minX, floor.maxZ],
  ]
  world.createCollider(
    RAPIER.ColliderDesc.trimesh(
      Float32Array.from(
        corners.flatMap(([x, z]) => [x * scale, floor.y * scale, z * scale]),
      ),
      Uint32Array.of(0, 2, 1, 0, 3, 2),
    ),
    body,
  )
  for (const box of colliders.walls) addBox(box)
  for (const box of colliders.solids) addBox(box)
  return body.handle
}

/**
 * A colisão do mapa de uma cidade copiada inteira do Let's Go
 * (docs/features/069-revisao-do-bioma-cidade.md — Pallet), num corpo fixo
 * próprio posto em `place` (`{ x, y, z, scale }`, a forma de `OnTownMap`):
 *
 * - o **chão**: a grade de alturas do mapa num heightfield, como o relevo
 *   dos chunks (é chão para a câmera); por coluna, `iz + ix × nz` — as
 *   linhas do Rapier vão ao longo de Z;
 * - os **prédios**, cercas, placas, troncos e as paredes da borda: caixas.
 *
 * `colliders` é o do mapa (`townMapCollidersOf`), no espaço do modelo.
 * Devolve o handle do corpo (para `destroyTownMapColliders`), ou `-1` sem
 * física.
 */
export function createTownMapColliders(colliders, place) {
  const RAPIER = getRapier()
  const world = getRapierWorld()
  if (!RAPIER || !world) return -1
  const { scale } = place
  const body = world.createRigidBody(
    RAPIER.RigidBodyDesc.fixed().setTranslation(place.x, place.y, place.z),
  )
  const { ground } = colliders
  const sizeX = (ground.nx - 1) * ground.step
  const sizeZ = (ground.nz - 1) * ground.step
  world.createCollider(
    RAPIER.ColliderDesc.heightfield(
      ground.nz - 1,
      ground.nx - 1,
      Float32Array.from(ground.heights),
      { x: sizeX * scale, y: scale, z: sizeZ * scale },
    ).setTranslation(
      (ground.minX + sizeX / 2) * scale,
      0,
      (ground.minZ + sizeZ / 2) * scale,
    ),
    body,
  )
  for (const { box } of colliders.boxes) {
    const [minX, minY, minZ, maxX, maxY, maxZ] = box
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(
        ((maxX - minX) / 2) * scale,
        ((maxY - minY) / 2) * scale,
        ((maxZ - minZ) / 2) * scale,
      ).setTranslation(
        ((minX + maxX) / 2) * scale,
        ((minY + maxY) / 2) * scale,
        ((minZ + maxZ) / 2) * scale,
      ),
      body,
    )
  }
  return body.handle
}

/** Desfaz `createTownMapColliders`. Handle que já não existe: nada. */
export function destroyTownMapColliders(bodyHandle) {
  destroyTerrainChunkCollider(bodyHandle)
}

/** Se o corpo `bodyHandle` existe no mundo da física de agora. */
export function hasRigidBody(bodyHandle) {
  if (bodyHandle == null || bodyHandle < 0) return false
  return Boolean(getRapierWorld()?.getRigidBody(bodyHandle))
}

/** Desfaz `createInteriorColliders`. Handle que já não existe: nada. */
export function destroyInteriorColliders(bodyHandle) {
  destroyTerrainChunkCollider(bodyHandle)
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

/**
 * Linhas dos colliders para o debug (F2, `tools/debug/PhysicsDebugView.jsx`)
 * SEM o relevo: o heightfield de cada chunk tem os mesmos triângulos da
 * malha visível (`terrainGeometry.js`, testado) e, com vários chunks
 * carregados, redesenhá-lo a cada quadro derrubava o FPS. Sem física, `null`.
 */
export function debugRenderWithoutTerrain() {
  const world = getRapierWorld()
  if (!world) return null
  const { ShapeType } = getRapier()
  return world.debugRender(
    undefined,
    (collider) => collider.shapeType() !== ShapeType.HeightField,
  )
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
