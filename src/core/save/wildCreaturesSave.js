import { getSpecies } from '../data/species'
import { desmaiar } from '../actions/faint'
import { listStorable } from '../actions/conditions'
import { nascerSelvagem, removerSelvagem } from '../actions/wildSpawn'
import {
  BeingCaptured,
  Conditions,
  CreatureLevel,
  Fainted,
  IndividualValues,
  Position,
  Rotation,
  Vitals,
  WildBehavior,
  WildCreature,
  WildSpawnInfo,
} from '../traits'

/**
 * As selvagens no save (docs/features/062-spawn-estilo-cobblemon.md): as
 * vivas no mundo, como estão — espécie, lugar, indivíduo, vida, desmaio,
 * condições e idade. Luta, caminho e alvo não vão: ao voltar, ela vaga.
 * Quem está dentro de uma Pokébola não vai (a captura não sobrevive ao
 * save). Forma em `wildCreatureSaveSchema` (`saveFormat.js`).
 */

/** As selvagens do mundo como lista salva. Só lê o mundo. */
export function serializeWildCreatures(world) {
  const saved = []
  world.query(WildCreature, Position).readEach(([wild, position], entity) => {
    if (entity.has(BeingCaptured)) return
    // Saindo do mapa (fugiu, 063): conta como já fugida.
    if (entity.get(WildBehavior)?.state === 'leave') return
    const { level, xp } = entity.get(CreatureLevel)
    const vitals = entity.get(Vitals)
    const fainted = entity.get(Fainted)
    const conditions = listStorable(entity.get(Conditions)?.list)
    saved.push({
      speciesId: wild.speciesId,
      x: position.x,
      y: position.y,
      z: position.z,
      rotationY: entity.get(Rotation)?.y ?? 0,
      level,
      xp,
      ivs: { ...entity.get(IndividualValues) },
      temperament: entity.get(WildBehavior)?.temperament ?? 'peaceful',
      hp: vitals?.hp ?? 0,
      stamina: vitals?.stamina ?? 0,
      faintTimeLeft: fainted ? Math.max(0, fainted.timeLeft) : null,
      conditions: conditions.length ? conditions : null,
      age: entity.get(WildSpawnInfo)?.age ?? 0,
    })
  })
  return saved
}

/**
 * Troca as selvagens do mundo pelas salvas. As que já nasceram antes do
 * save chegar saem; espécie que não existe mais fica de fora.
 */
export function restoreWildCreatures(world, saved = []) {
  for (const entity of world.query(WildCreature)) removerSelvagem(entity)
  for (const entry of saved) restoreWild(world, entry)
}

function restoreWild(world, saved) {
  if (!getSpecies(saved.speciesId)) return null
  const entity = nascerSelvagem(world, null, {
    speciesId: saved.speciesId,
    position: { x: saved.x, y: saved.y, z: saved.z },
    individual: {
      individualValues: { ...saved.ivs },
      levelState: { level: saved.level, xp: saved.xp },
      temperament: saved.temperament,
      age: saved.age,
      rotationY: saved.rotationY,
    },
  })
  if (!entity) return null

  const vitals = entity.get(Vitals)
  entity.set(Vitals, {
    hp: Math.min(saved.hp, vitals.maxHp),
    stamina: Math.min(saved.stamina, vitals.maxStamina),
  })
  if (saved.conditions?.length) {
    entity.add(Conditions({ list: listStorable(saved.conditions) }))
  }
  if (saved.faintTimeLeft != null) {
    desmaiar(world, entity)
    entity.set(Fainted, { timeLeft: saved.faintTimeLeft })
  }
  return entity
}
