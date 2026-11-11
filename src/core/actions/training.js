import { GAME_CONFIG } from '../gameConfig'
import { getBiome } from '../data/biomes'
import { getSpecies } from '../data/species'
import { MAX_MASTERY, findMoveSlot } from '../data/species/moves'
import {
  resolveHitTrigger,
  resolveTriggerFrontEdge,
} from '../battle/hitTrigger'
import { chunkKey } from '../terrain/terrainChunk'
import { TRAINING_DUMMY_KIND } from '../town/townPlan'
import { lgpeColliderOf } from '../vegetation/solidModels'
import { finishAttack } from '../battle/attackCasting'
import { TRAINING_SLOT } from '../battle/creatureAttack'
import {
  ActionState,
  CombatMode,
  Fainted,
  InputControlled,
  CreatureMoves,
  PartyBehavior,
  PendingTraining,
  Position,
  SummonRequest,
  Training,
  TrainingObject,
  TrainingObjectChunks,
  Velocity,
} from '../traits'
import { podeTreinarGolpe } from './moves'
import { resolveOwner } from './owner'
import {
  findSummonedCreature,
  isPokemonFainted,
  resolvePartySlot,
  resolvePokemonSpeciesId,
} from './pokemon'

/**
 * Treino de golpe (docs/features/038-aprendizado-treino-e-dominio-de-
 * golpes.md) nos bonecos dos campos de treino das cidades (docs/features/
 * 067-campo-de-treino-e-avisos-de-nivel.md): com o TREINADOR perto de um
 * boneco, o Pokémon do time — em campo ou na bola (aí ele é invocado rumo ao
 * boneco) — vai de onde estiver até o lugar do treino, na frente do boneco
 * (`resolveTrainingSpot`), e repete o golpe sozinho até aprender
 * (`trainingSystem.js`). Um Pokémon por boneco.
 */

/**
 * O `object` já é o boneco de outro Pokémon: o treino de outra criatura
 * (não `creature`) ou o treino pedido de outro registro que ainda está na
 * bola (não `pokemon`).
 */
function isTrainingObjectTaken(world, object, { creature, pokemon } = {}) {
  const inTraining = world
    .query(Training)
    .some(
      (entity) => entity !== creature && entity.get(Training).object === object,
    )
  if (inTraining) return true
  return world
    .query(PendingTraining)
    .some(
      (entity) =>
        entity !== pokemon && entity.get(PendingTraining).object === object,
    )
}

/**
 * O boneco de treino livre mais perto de `pos`, até `TRAINING.START_RADIUS`
 * da borda dele (ou `null`). Livre: nenhum outro Pokémon treina nele nem o
 * pediu (`except`: `{ creature, pokemon }`, o que pergunta — o boneco dele
 * conta como livre).
 */
export function findNearbyTrainingObject(world, pos, except = {}) {
  const { START_RADIUS } = GAME_CONFIG.MOVES.TRAINING
  let nearest = null
  let nearestDistance = Infinity
  world
    .query(TrainingObject, Position)
    .readEach(([object, objectPos], entity) => {
      const distance =
        Math.hypot(objectPos.x - pos.x, objectPos.z - pos.z) - object.radius
      if (distance > START_RADIUS || distance >= nearestDistance) return
      if (isTrainingObjectTaken(world, entity, except)) return
      nearest = entity
      nearestDistance = distance
    })
  return nearest
}

/** Há algum boneco de treino (livre ou não) até `START_RADIUS` de `pos`? */
function hasTrainingObjectNear(world, pos) {
  const { START_RADIUS } = GAME_CONFIG.MOVES.TRAINING
  return world.query(TrainingObject, Position).some((entity) => {
    const objectPos = entity.get(Position)
    const { radius } = entity.get(TrainingObject)
    return (
      Math.hypot(objectPos.x - pos.x, objectPos.z - pos.z) - radius <=
      START_RADIUS
    )
  })
}

/** Da frente do corpo da espécie até o centro dele (m). */
export function resolveBodyFront(species) {
  return resolveTriggerFrontEdge(resolveHitTrigger(species?.body))
}

/**
 * O lugar do treino no boneco `object`: na frente dele (o lado da entrada do
 * campo, `TrainingObject.front`), a `SPOT_GAP` m entre a borda do boneco e
 * a frente do corpo do Pokémon (`bodyFront`, `resolveBodyFront`).
 */
export function resolveTrainingSpot(object, bodyFront = 0) {
  const { SPOT_GAP } = GAME_CONFIG.MOVES.TRAINING
  const pos = object.get(Position)
  const { radius, front } = object.get(TrainingObject)
  const distance = radius + SPOT_GAP + bodyFront
  return {
    x: pos.x + Math.sin(front) * distance,
    y: pos.y,
    z: pos.z + Math.cos(front) * distance,
  }
}

/** Os bonecos de treino dos sólidos do `chunk` (`TRAINING_DUMMY_KIND`). */
export function trainingDummiesOf(chunk) {
  return (chunk.solids?.buildings ?? []).filter(
    ({ kind }) => kind === TRAINING_DUMMY_KIND,
  )
}

/**
 * O chunk carregou: cada boneco de treino dele vira uma entidade
 * (`TrainingObject` + `Position`). Já carregado: nada.
 */
export function carregarBonecosDoChunk(world, chunk) {
  const key = chunkKey(chunk.chunkX, chunk.chunkZ)
  const { loaded } = world.get(TrainingObjectChunks)
  if (loaded.has(key)) return
  trainingDummiesOf(chunk).forEach((dummy, index) => {
    const reach = lgpeColliderOf(dummy)?.reach ?? 0
    // O giro do modelo (`turn`) não muda para onde o boneco olha.
    const turn = getBiome(dummy.biome)?.town?.trainingField?.turn ?? 0
    world.spawn(
      Position({ x: dummy.x, y: dummy.y, z: dummy.z }),
      TrainingObject({
        id: `${key}:${index}`,
        chunkKey: key,
        radius: reach * dummy.scale,
        model: dummy.model,
        yaw: dummy.yaw,
        scale: dummy.scale,
        front: dummy.yaw - turn,
      }),
    )
  })
  loaded.add(key)
}

/**
 * O chunk descarregou: os bonecos dele saem — quem treinava num deles para
 * (o `trainingSystem` também para quem perde o boneco).
 */
export function descarregarBonecosDoChunk(world, key) {
  const gone = world
    .query(TrainingObject)
    .filter((entity) => entity.get(TrainingObject).chunkKey === key)
  for (const creature of world.query(Training)) {
    if (gone.includes(creature.get(Training).object)) pararTreino(creature)
  }
  for (const pokemon of world.query(PendingTraining)) {
    if (gone.includes(pokemon.get(PendingTraining).object)) {
      pokemon.remove(PendingTraining)
    }
  }
  // Fora da iteração: destruir no meio da query mexe nela.
  for (const entity of gone) entity.destroy()
  world.get(TrainingObjectChunks).loaded.delete(key)
}

/** A criatura está em luta (modo combate ou defendendo o grupo)? */
export function isFighting(creature) {
  return (
    creature.has(CombatMode) || creature.get(PartyBehavior)?.state === 'fight'
  )
}

/**
 * Por que o `pokemon` não pode treinar AGORA (independe do golpe):
 * `'fainted'` | `'controlled'` (em campo, pilotado) | `'in-combat'` (em
 * campo, lutando) | `'no-object'` (o treinador não está perto de um boneco)
 * | `'occupied'` (os bonecos perto dele estão com outro Pokémon) — ou
 * `null`, se pode. Na bola também pode: ele é invocado rumo ao boneco.
 */
export function resolveTrainingBlock(world, pokemon) {
  const creature = findSummonedCreature(world, pokemon)
  if (creature) {
    if (creature.has(Fainted)) return 'fainted'
    if (creature.has(InputControlled)) return 'controlled'
    if (isFighting(creature)) return 'in-combat'
  } else if (isPokemonFainted(pokemon)) {
    return 'fainted'
  }
  const trainerPos = resolveOwner(pokemon)?.get(Position)
  if (!trainerPos) return 'no-object'
  if (findNearbyTrainingObject(world, trainerPos, { creature, pokemon })) {
    return null
  }
  return hasTrainingObjectNear(world, trainerPos) ? 'occupied' : 'no-object'
}

/**
 * O que treinar `moveId` faz agora no `pokemon`: `'learn'` (apto, treino
 * ainda incompleto), `'master'` (equipado e ainda não dominado) ou `null`
 * (nada a treinar).
 */
export function resolveTrainingGoal(pokemon, moveId) {
  const state = pokemon?.get?.(CreatureMoves)
  if (!state) return null
  const moveSlot = findMoveSlot(state, moveId)
  if (moveSlot != null) {
    return state.slots[moveSlot].mastery < MAX_MASTERY ? 'master' : null
  }
  if (!podeTreinarGolpe(pokemon, moveId)) return null
  return (state.training?.[moveId] ?? 0) < 1 ? 'learn' : null
}

/**
 * Pede para o `trainer` invocar o Pokémon do `slot` jogando a bola rumo a
 * `target` (`SummonRequest`, atendido pelo `partySummonSystem` quando ele
 * estiver livre).
 */
export function pedirInvocacao(trainer, slot, target) {
  const request = { slot, x: target.x, y: target.y, z: target.z }
  if (trainer.has(SummonRequest)) trainer.set(SummonRequest, request)
  else trainer.add(SummonRequest(request))
}

/**
 * Começa a treinar `moveId` no `pokemon` (troca o treino atual, se houver)
 * — pra APRENDER (golpe apto) ou pra DOMINAR (golpe equipado sem domínio
 * total), ver `resolveTrainingGoal` —, no boneco livre mais perto do
 * treinador. Em campo, a criatura vai até o lugar do treino; na bola, o
 * treinador a invoca rumo ao boneco e ela começa ao nascer
 * (`PendingTraining`). Só se ele pode treinar agora
 * (`resolveTrainingBlock`). Devolve se começou.
 */
export function iniciarTreino(world, pokemon, moveId) {
  if (resolveTrainingBlock(world, pokemon)) return false
  if (!resolveTrainingGoal(pokemon, moveId)) return false

  const creature = findSummonedCreature(world, pokemon)
  const trainer = resolveOwner(pokemon)
  const object = findNearbyTrainingObject(world, trainer.get(Position), {
    creature,
    pokemon,
  })
  if (creature) {
    comecarTreino(creature, moveId, object)
    return true
  }

  const slot = resolvePartySlot(trainer, pokemon)
  if (!slot) return false
  const pending = {
    moveId,
    object,
    timeLeft: GAME_CONFIG.MOVES.TRAINING.PENDING_TIMEOUT,
  }
  if (pokemon.has(PendingTraining)) pokemon.set(PendingTraining, pending)
  else pokemon.add(PendingTraining(pending))
  const species = getSpecies(resolvePokemonSpeciesId(pokemon))
  pedirInvocacao(
    trainer,
    slot,
    resolveTrainingSpot(object, resolveBodyFront(species)),
  )
  return true
}

/** A criatura começa (ou troca) o treino de `moveId` no boneco `object`. */
export function comecarTreino(creature, moveId, object) {
  const training = {
    moveId,
    object,
    wait: 0,
    resting: false,
    repeating: false,
    waiting: false,
    elapsed: 0,
    arrived: false,
  }
  if (creature.has(Training)) creature.set(Training, training)
  else creature.add(Training(training))
}

/**
 * Para o treino da criatura (ela volta a seguir o treinador). Uma repetição
 * em andamento acaba junto: sem o `Training`, o slot interno de treino não
 * resolve mais golpe nenhum.
 */
export function pararTreino(creature) {
  if (!creature?.isAlive?.() || !creature.has(Training)) return
  const action = creature.has(ActionState) ? creature.get(ActionState) : null
  if (action?.current === 'attack' && action.pendingSlot === TRAINING_SLOT) {
    finishAttack(creature, action, { cooldown: 0 })
    creature.set(ActionState, action)
  }
  creature.remove(Training)
  if (creature.has(Velocity)) {
    creature.set(Velocity, { ...creature.get(Velocity), x: 0, z: 0 })
  }
}

/**
 * O `pokemon` está treinando (em campo, ou pedido e saindo da bola)?
 * Devolve o id do golpe (ou `null`).
 */
export function resolveTrainingMove(world, pokemon) {
  const creature = findSummonedCreature(world, pokemon)
  if (creature?.has(Training)) return creature.get(Training).moveId
  return pokemon?.get?.(PendingTraining)?.moveId ?? null
}

/**
 * Para o treino do `pokemon`: o da criatura em campo e o pedido que
 * esperava ela sair da bola (o "Parar" do menu).
 */
export function pararTreinoDoPokemon(world, pokemon) {
  if (pokemon?.has?.(PendingTraining)) pokemon.remove(PendingTraining)
  pararTreino(findSummonedCreature(world, pokemon))
}
