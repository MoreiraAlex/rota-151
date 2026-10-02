import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'
import { getSkill, listSkills, resolveSkill, SKILL_REGISTRY } from './index'

const FAKE_REGISTRY = {
  tackle: {
    id: 'tackle',
    staminaCost: 2,
    range: 1.4,
    visual: { effectGroup: 'tackle', revealDuration: 0.2 },
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

describe('skill registry — mecanismo', () => {
  it('getSkill acha pelo id', () => {
    expect(getSkill('tackle', FAKE_REGISTRY)).toEqual(FAKE_REGISTRY.tackle)
  })

  it('getSkill devolve null pra id desconhecido', () => {
    expect(getSkill('nao-existe', FAKE_REGISTRY)).toBeNull()
  })

  it('listSkills devolve todas as entradas como array', () => {
    const list = listSkills(FAKE_REGISTRY)
    expect(list).toHaveLength(2)
    expect(list).toContainEqual(FAKE_REGISTRY.punch)
  })

  it('sem argumento, usa o SKILL_REGISTRY real', () => {
    expect(listSkills()).toEqual(Object.values(SKILL_REGISTRY))
  })

  it('registro real tem tackle e punch', () => {
    expect(getSkill('tackle')).toBeTruthy()
    expect(getSkill('punch')).toBeTruthy()
  })
})

describe('resolveSkill', () => {
  it('sem referência (espécie sem esse slot), devolve null', () => {
    expect(resolveSkill(null)).toBeNull()
    expect(resolveSkill(undefined)).toBeNull()
  })

  it('referência string desconhecida devolve null, sem quebrar', () => {
    expect(resolveSkill('nao-existe')).toBeNull()
  })

  it('referência string usa a definição base sem alteração', () => {
    expect(resolveSkill('tackle')).toEqual(getSkill('tackle'))
  })

  it('id desconhecido dentro de { id, overrides } também devolve null', () => {
    expect(
      resolveSkill({ id: 'nao-existe', overrides: { range: 5 } }),
    ).toBeNull()
  })

  it('{ id } sem overrides (ou overrides vazio/undefined) usa a base', () => {
    expect(resolveSkill({ id: 'punch' })).toEqual(getSkill('punch'))
  })

  it('override de campo de topo substitui só esse campo, mantém o resto da base', () => {
    const resolved = resolveSkill({
      id: 'tackle',
      overrides: { staminaCost: 20 },
    })
    const base = getSkill('tackle')
    expect(resolved.staminaCost).toBe(20)
    expect(resolved.range).toBe(base.range)
    expect(resolved.duration).toBe(base.duration)
  })

  it('override de campo DENTRO de uma seção (visual/audio/animation) mescla campo a campo — não apaga o resto da seção', () => {
    const resolved = resolveSkill({
      id: 'tackle',
      overrides: { visual: { rotationOffset: { x: 0, y: 90, z: 0 } } },
    })
    const base = getSkill('tackle')
    expect(resolved.visual.rotationOffset).toEqual({ x: 0, y: 90, z: 0 })
    // Resto de `visual` continua vindo da base, não foi apagado.
    expect(resolved.visual.effectGroup).toBe(base.visual.effectGroup)
    expect(resolved.visual.revealDuration).toBe(base.visual.revealDuration)
  })

  it('overrides não mutam a definição base (nem o registro global)', () => {
    const base = getSkill('tackle')
    const baseVisualBefore = { ...base.visual }

    resolveSkill({
      id: 'tackle',
      overrides: { visual: { effectGroup: 'punch' } },
    })

    expect(getSkill('tackle').visual).toEqual(baseVisualBefore)
  })
})

describe('skills de STATUS (Growl)', () => {
  it('o growl está no registro e não tem dano, só efeitos', () => {
    const growl = getSkill('growl')

    expect(growl).toBe(SKILL_REGISTRY.growl)
    expect(growl.damage).toBeNull()
    expect(growl.effects).toHaveLength(1)
  })

  it('o efeito é um estágio de atributo válido (tipo, atributo, estágios e duração)', () => {
    const [effect] = getSkill('growl').effects

    expect(effect.type).toBe('statStage')
    expect(['attack', 'defense', 'sp_atk', 'sp_def']).toContain(effect.stat)
    expect(effect.stages).toBeLessThan(0) // baixa o atributo do alvo
    expect(effect.duration).toBeGreaterThan(0)
  })

  it('resolveSkill por id e com override do efeito (outra espécie pode rosnar mais forte)', () => {
    expect(resolveSkill('growl').id).toBe('growl')

    const stronger = resolveSkill({
      id: 'growl',
      overrides: {
        effects: [
          { type: 'statStage', stat: 'attack', stages: -2, duration: 20 },
        ],
      },
    })
    expect(stronger.effects[0].stages).toBe(-2)
    expect(stronger.damage).toBeNull()
  })

  it('o ícone do growl existe em public/', () => {
    // evita um ícone quebrado no HUD de habilidades
    expect(getSkill('growl').sprite.path).toBe(
      '/assets/sprites/abilities/growl.png',
    )
  })
})

describe('growth', () => {
  it('está no registro, sem dano, em si mesmo', () => {
    const growth = getSkill('growth')
    expect(growth).toBe(SKILL_REGISTRY.growth)
    expect(growth.damage).toBeNull()
    expect(growth.area).toBe('self')
  })

  it('o ícone do growth existe em public/', () => {
    expect(
      existsSync(join(process.cwd(), 'public', getSkill('growth').sprite.path)),
    ).toBe(true)
  })
})

describe('leech-seed', () => {
  it('está no registro: sem dano, com um efeito de semente, precisão 90', () => {
    const seed = getSkill('leech-seed')
    expect(seed).toBe(SKILL_REGISTRY['leech-seed'])
    expect(seed.damage).toBeNull()
    expect(seed.accuracy).toBe(90)
    // a forma do efeito; os números são balanceamento do usuário
    expect(seed.effects).toHaveLength(1)
    const [effect] = seed.effects
    expect(effect.type).toBe('leechSeed')
    expect(effect.fraction).toBeGreaterThan(0)
    expect(effect.interval).toBeGreaterThan(0)
    expect(effect.duration).toBeGreaterThan(0)
  })

  it('o ícone existe em public/', () => {
    expect(
      existsSync(
        join(process.cwd(), 'public', getSkill('leech-seed').sprite.path),
      ),
    ).toBe(true)
  })
})

describe('water-gun', () => {
  it('está no registro: dano especial, à distância, canalizado em feixe', () => {
    const gun = getSkill('water-gun')
    expect(gun).toBe(SKILL_REGISTRY['water-gun'])
    expect(gun.damage).toMatchObject({ category: 'special' })
    expect(gun.aim).toBe('ranged')
    expect(gun.damageMode).toBe('channel')
    expect(gun.area).toBe('line')
    expect(gun.visual).toMatchObject({
      channelGroup: 'water-jet',
      channelHitGroup: 'water-gun-hit',
    })
  })

  it('o ícone existe em public/', () => {
    expect(
      existsSync(
        join(process.cwd(), 'public', getSkill('water-gun').sprite.path),
      ),
    ).toBe(true)
  })
})
