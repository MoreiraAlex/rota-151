import { runInNewContext } from 'node:vm'
import { describe, it, expect } from 'vitest'
import {
  OVERRIDABLE_SECTIONS,
  applySkillGroup,
  getSkill,
  listSkills,
  resolveSkill,
} from '@/core/data/skills'
import { listSpecies } from '@/core/data/species'
import { normalizeMoveReference, listLearnset } from '@/core/data/species/moves'
import {
  clearLayer,
  diffBase,
  editLayer,
  formatBaseChanges,
  formatJs,
  formatSpeciesEntry,
  mergeLayers,
  minimalOverrides,
  readPath,
  resolveOrigin,
  withPath,
  withoutPath,
} from './skillLabData'
import { findSpeciesMove } from './skillLabLive'
import { formatTriggerSnippet } from './CreatureSection'
import { resolveHitTrigger } from '@/core/battle/hitTrigger'

// Lê um trecho JS de volta como valor, do jeito que vai parar no arquivo.
const evaluate = (code) => runInNewContext(`(${code})`)

const MERGED = OVERRIDABLE_SECTIONS[0]
const NOT_MERGED = 'damage'

// Todo golpe de toda espécie, com a referência dela.
const speciesMoves = listSpecies().flatMap((species) =>
  listLearnset(species).map(({ id }) => ({
    species,
    id,
    found: findSpeciesMove(species, id),
  })),
)

describe('mergeLayers', () => {
  it('dá o mesmo golpe que o resolveSkill do jogo, em toda espécie', () => {
    expect(speciesMoves.length).toBeGreaterThan(0)
    for (const { id, found } of speciesMoves) {
      const { overrides } = found.reference
      expect(applySkillGroup(mergeLayers(getSkill(id), overrides))).toEqual(
        resolveSkill({ id, overrides }),
      )
    }
  })
})

describe('caminhos', () => {
  it('withPath cria o caminho sem mexer no original', () => {
    const original = { a: { b: 1 } }
    const result = withPath(original, 'a.c.d', 2)
    expect(readPath(result, 'a.c.d')).toBe(2)
    expect(readPath(result, 'a.b')).toBe(1)
    expect(original).toEqual({ a: { b: 1 } })
  })

  it('withoutPath tira o campo e a seção que ficar vazia', () => {
    expect(withoutPath({ a: { b: 1 }, c: 2 }, 'a.b')).toEqual({ c: 2 })
    expect(withoutPath({ a: { b: 1, e: 3 } }, 'a.b')).toEqual({ a: { e: 3 } })
  })
})

describe('camadas', () => {
  const base = getSkill(listSkills()[0].id)
  const scalar = Object.keys(base).find((key) => typeof base[key] === 'number')

  it('campo escrito na espécie vence a base, e limpar devolve a base', () => {
    const layers = editLayer({ base, overrides: null }, 'species', scalar, 7)
    expect(resolveOrigin(layers.base, layers.overrides, scalar)).toBe('species')
    expect(mergeLayers(layers.base, layers.overrides)[scalar]).toBe(7)

    const cleared = clearLayer(layers, 'species', scalar)
    expect(resolveOrigin(cleared.base, cleared.overrides, scalar)).toBe('base')
    expect(mergeLayers(cleared.base, cleared.overrides)[scalar]).toBe(
      base[scalar],
    )
  })

  it('seção mesclada: a espécie leva só o campo', () => {
    const { overrides } = editLayer(
      { base, overrides: null },
      'species',
      `${MERGED}.lab`,
      1,
    )
    expect(overrides).toEqual({ [MERGED]: { lab: 1 } })
  })

  it('seção que não se mescla: a espécie leva a seção inteira', () => {
    const withDamage = { ...base, [NOT_MERGED]: { power: 1, category: 'x' } }
    const { overrides } = editLayer(
      { base: withDamage, overrides: null },
      'species',
      `${NOT_MERGED}.power`,
      2,
    )
    expect(overrides[NOT_MERGED]).toEqual({ power: 2, category: 'x' })
    expect(resolveOrigin(withDamage, overrides, `${NOT_MERGED}.category`)).toBe(
      'species',
    )
  })

  it('campo que ninguém declara vem do padrão', () => {
    expect(resolveOrigin(base, null, 'campoQueNaoExiste')).toBe('default')
  })

  it('editar a base não toca na espécie', () => {
    const layers = editLayer({ base, overrides: { x: 1 } }, 'base', scalar, 9)
    expect(layers.base[scalar]).toBe(9)
    expect(layers.overrides).toEqual({ x: 1 })
    expect(base[scalar]).not.toBe(9)
  })
})

describe('minimalOverrides', () => {
  it('tira o que é igual à base, campo a campo nas seções mescladas', () => {
    const base = { a: 1, [MERGED]: { x: 1, y: 2 }, [NOT_MERGED]: { p: 1 } }
    const overrides = {
      a: 1,
      [MERGED]: { x: 1, y: 3 },
      [NOT_MERGED]: { p: 1 },
    }
    expect(minimalOverrides(base, overrides)).toEqual({ [MERGED]: { y: 3 } })
  })
})

describe('diffBase', () => {
  it('lista os campos mudados e os que saíram', () => {
    const original = { a: 1, b: 2, [MERGED]: { x: 1, y: 2 } }
    const draft = { a: 1, b: 3, [MERGED]: { x: 1, z: 4 } }
    expect(diffBase(original, draft)).toEqual({
      changes: { b: 3, [MERGED]: { z: 4 } },
      removed: [`${MERGED}.y`],
    })
  })

  it('seção que não se mescla sai inteira', () => {
    const original = { [NOT_MERGED]: { power: 1, category: 'x' } }
    const draft = { [NOT_MERGED]: { power: 2, category: 'x' } }
    expect(diffBase(original, draft).changes).toEqual(draft)
  })

  it('sem mudança, vazio', () => {
    const skill = listSkills()[0]
    expect(diffBase(skill, structuredClone(skill))).toEqual({
      changes: {},
      removed: [],
    })
  })
})

describe('formatJs', () => {
  it('colado de volta, reproduz cada golpe do registro', () => {
    for (const skill of listSkills()) {
      expect(evaluate(formatJs(skill))).toEqual(skill)
    }
  })

  it('arredonda os números pra não colar ruído do slider', () => {
    expect(evaluate(formatJs({ a: 1 / 3 }))).toEqual({
      a: Number((1 / 3).toFixed(4)),
    })
  })
})

describe('trechos pra colar', () => {
  it('a mudança da base, colada num objeto, reproduz o rascunho', () => {
    const skill = listSkills().find((candidate) => candidate[NOT_MERGED])
    const draft = withPath(
      withPath(skill, `${MERGED}.scale`, 2),
      `${NOT_MERGED}.power`,
      1,
    )
    const snippet = formatBaseChanges(skill.id, diffBase(skill, draft))
    const changes = evaluate(`{${snippet}}`)
    expect(mergeLayers(skill, changes)).toEqual(draft)
  })

  it('a entrada da espécie, colada de volta, é a mesma referência', () => {
    for (const { id, found } of speciesMoves) {
      const snippet = formatSpeciesEntry({ ...found.reference, id })
      const value = evaluate(snippet.replace(/,$/, ''))
      const reference = normalizeMoveReference(value)
      expect(reference.id).toBe(id)
      expect(reference.overrides ?? null).toEqual(
        found.reference.overrides ?? null,
      )
      expect(value.requires ?? null).toEqual(found.reference.requires)
    }
  })
})

describe('formatTriggerSnippet', () => {
  it('colado de volta, é o mesmo trigger', () => {
    for (const creature of listSpecies()) {
      const trigger = resolveHitTrigger(creature.body)
      const snippet = formatTriggerSnippet(trigger)
      expect(evaluate(`{${snippet}}`).trigger).toEqual(trigger)
    }
  })
})
