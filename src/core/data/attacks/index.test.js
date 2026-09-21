import { describe, it, expect } from 'vitest'
import {
  getAttack,
  listAttacks,
  resolveCreatureAttack,
  ATTACK_REGISTRY,
} from './index'

const FAKE_REGISTRY = {
  scratch: {
    id: 'scratch',
    staminaCost: 2,
    range: 1.4,
    visual: { effectGroup: 'scratch', revealDuration: 0.2 },
    audio: { group: 'punch' },
  },
  punch: {
    id: 'punch',
    staminaCost: 2,
    range: 1.4,
    visual: { effectGroup: 'punch', revealDuration: 0 },
    audio: { group: 'punch' },
  },
}

describe('attack registry — mecanismo', () => {
  it('getAttack acha pelo id', () => {
    expect(getAttack('scratch', FAKE_REGISTRY)).toEqual(FAKE_REGISTRY.scratch)
  })

  it('getAttack devolve null pra id desconhecido', () => {
    expect(getAttack('nao-existe', FAKE_REGISTRY)).toBeNull()
  })

  it('listAttacks devolve todas as entradas como array', () => {
    const list = listAttacks(FAKE_REGISTRY)
    expect(list).toHaveLength(2)
    expect(list).toContainEqual(FAKE_REGISTRY.punch)
  })

  it('sem argumento, usa o ATTACK_REGISTRY real', () => {
    expect(listAttacks()).toEqual(Object.values(ATTACK_REGISTRY))
  })

  it('registro real tem scratch e punch', () => {
    expect(getAttack('scratch')).toBeTruthy()
    expect(getAttack('punch')).toBeTruthy()
  })
})

describe('resolveCreatureAttack', () => {
  it('sem referência (espécie sem esse slot), devolve null', () => {
    expect(resolveCreatureAttack(null)).toBeNull()
    expect(resolveCreatureAttack(undefined)).toBeNull()
  })

  it('referência string desconhecida devolve null, sem quebrar', () => {
    expect(resolveCreatureAttack('nao-existe')).toBeNull()
  })

  it('referência string usa a definição base sem alteração', () => {
    expect(resolveCreatureAttack('scratch')).toEqual(getAttack('scratch'))
  })

  it('id desconhecido dentro de { id, overrides } também devolve null', () => {
    expect(
      resolveCreatureAttack({ id: 'nao-existe', overrides: { range: 5 } }),
    ).toBeNull()
  })

  it('{ id } sem overrides (ou overrides vazio/undefined) usa a base', () => {
    expect(resolveCreatureAttack({ id: 'punch' })).toEqual(getAttack('punch'))
  })

  it('override de campo de topo substitui só esse campo, mantém o resto da base', () => {
    const resolved = resolveCreatureAttack({
      id: 'scratch',
      overrides: { staminaCost: 20 },
    })
    const base = getAttack('scratch')
    expect(resolved.staminaCost).toBe(20)
    expect(resolved.range).toBe(base.range)
    expect(resolved.duration).toBe(base.duration)
  })

  it('override de campo DENTRO de uma seção (visual/audio/animation) mescla campo a campo — não apaga o resto da seção', () => {
    const resolved = resolveCreatureAttack({
      id: 'scratch',
      overrides: { visual: { rotationOffset: { x: 0, y: 90, z: 0 } } },
    })
    const base = getAttack('scratch')
    expect(resolved.visual.rotationOffset).toEqual({ x: 0, y: 90, z: 0 })
    // Resto de `visual` continua vindo da base, não foi apagado.
    expect(resolved.visual.effectGroup).toBe(base.visual.effectGroup)
    expect(resolved.visual.revealDuration).toBe(base.visual.revealDuration)
  })

  it('overrides não mutam a definição base (nem o registro global)', () => {
    const base = getAttack('scratch')
    const baseVisualBefore = { ...base.visual }

    resolveCreatureAttack({
      id: 'scratch',
      overrides: { visual: { effectGroup: 'punch' } },
    })

    expect(getAttack('scratch').visual).toEqual(baseVisualBefore)
  })
})
