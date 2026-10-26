import { describe, it, expect, afterEach } from 'vitest'
import { getSkill, resolveSkill } from '@/core/data/skills'
import { resolveHitTrigger } from '@/core/battle/hitTrigger'
import { listSpecies } from '@/core/data/species'
import {
  listLearnset,
  resolveSpeciesMoveReference,
} from '@/core/data/species/moves'
import {
  applyLiveBase,
  applyLiveOverrides,
  captureSkillData,
  findSpeciesMove,
  applyLiveTrigger,
  restoreMove,
  restoreTrigger,
  restoreSkillData,
} from './skillLabLive'

const snapshot = captureSkillData()
afterEach(() => restoreSkillData(snapshot))

// Uma espécie com golpe no kit e outra no learnset.
const species = listSpecies().find(
  (candidate) =>
    listLearnset(candidate).some((move) => move.requires) &&
    listLearnset(candidate).some((move) => !move.requires),
)
const kitMove = listLearnset(species).find((move) => !move.requires)
const learnsetMove = listLearnset(species).find((move) => move.requires)

describe('applyLiveBase', () => {
  it('troca a definição no lugar: quem guardou o objeto vê o valor novo', () => {
    const held = getSkill(kitMove.id)
    applyLiveBase(kitMove.id, { ...held, labField: 1 })
    expect(getSkill(kitMove.id)).toBe(held)
    expect(held.labField).toBe(1)
  })
})

describe('applyLiveOverrides', () => {
  it('no kit, o jogo passa a resolver o golpe com o override novo', () => {
    applyLiveOverrides(species, kitMove.id, { labField: 2 })
    const reference = resolveSpeciesMoveReference(species, kitMove.id)
    expect(resolveSkill(reference).labField).toBe(2)
  })

  it('no learnset, mantém o requires', () => {
    applyLiveOverrides(species, learnsetMove.id, { labField: 3 })
    const found = findSpeciesMove(species, learnsetMove.id)
    expect(found.reference.overrides).toEqual({ labField: 3 })
    expect(found.reference.requires).toEqual(learnsetMove.requires)
  })

  it('sem override, a entrada volta à forma curta', () => {
    applyLiveOverrides(species, kitMove.id, {})
    expect(findSpeciesMove(species, kitMove.id).reference.overrides).toBeNull()
  })
})

describe('restoreSkillData', () => {
  it('desfaz base e espécie', () => {
    const before = structuredClone({
      skill: getSkill(kitMove.id),
      kit: species.skills,
      moves: species.moves,
    })
    applyLiveBase(kitMove.id, { id: kitMove.id })
    applyLiveOverrides(species, kitMove.id, { labField: 4 })
    applyLiveOverrides(species, learnsetMove.id, { labField: 5 })
    restoreSkillData(snapshot)
    expect(getSkill(kitMove.id)).toEqual(before.skill)
    expect(species.skills).toEqual(before.kit)
    expect(species.moves).toEqual(before.moves)
  })
})

describe('restoreMove', () => {
  it('volta só o golpe pedido', () => {
    const other = structuredClone(getSkill(learnsetMove.id))
    const original = structuredClone(getSkill(kitMove.id))
    applyLiveBase(kitMove.id, { id: kitMove.id })
    applyLiveOverrides(species, kitMove.id, { labField: 6 })
    applyLiveBase(learnsetMove.id, { id: learnsetMove.id })
    restoreMove(snapshot, species, kitMove.id)
    expect(getSkill(kitMove.id)).toEqual(original)
    expect(findSpeciesMove(species, kitMove.id).reference.overrides).toEqual(
      findSpeciesMove(
        {
          skills: snapshot.species[species.id].skills,
          moves: snapshot.species[species.id].moves,
        },
        kitMove.id,
      ).reference.overrides,
    )
    expect(getSkill(learnsetMove.id)).not.toEqual(other)
  })
})

describe('applyLiveTrigger', () => {
  it('põe o trigger na espécie e o jogo passa a ver', () => {
    const trigger = {
      radius: 0.9,
      halfLength: 0,
      angle: 0,
      offset: { x: 0, z: 0 },
    }
    applyLiveTrigger(species, trigger)
    expect(resolveHitTrigger(species.body)).toEqual(trigger)
  })

  it('restaurar volta ao arquivo (sem trigger, a cápsula da física)', () => {
    const before = resolveHitTrigger(species.body)
    applyLiveTrigger(species, { ...before, radius: before.radius + 1 })
    restoreTrigger(snapshot, species)
    expect(resolveHitTrigger(species.body)).toEqual(before)
  })
})
