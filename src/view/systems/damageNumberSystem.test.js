import { afterEach, describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { createWorld } from 'koota'
import {
  attackFailed,
  attackInterrupted,
  attackResolved,
  leechSeedDrained,
  moveLearned,
  moveUnlocked,
  statStageChanged,
} from '@/core/events'
import { GAME_CONFIG } from '@/core/gameConfig'
import {
  CharacterController,
  Position,
  SummonedCreature,
  WildCreature,
} from '@/core/traits'
import { damageNumberPool } from '../vfx/damageNumberPool'
import {
  damageNumberSystem,
  formatDamage,
  formatMoveLearned,
  formatMoveUnlocked,
  formatStatChange,
} from './damageNumberSystem'

const { OPPONENT, ALLY } = GAME_CONFIG.FEEDBACK.FEEDBACK_COLORS
const { LIFETIME, CRIT_LIFETIME, HEAD_MARGIN, SPREAD } =
  GAME_CONFIG.FEEDBACK.DAMAGE_NUMBER
const BODY = { capsuleRadius: 0.3, capsuleHalfHeight: 0.15, capsuleAxis: 'y' }

const worlds = []
function spawnTarget(position) {
  const world = createWorld()
  worlds.push(world)
  return world.spawn(Position(position), CharacterController(BODY))
}

// Câmera parada olhando pra -Z: a "direita" dela é +X.
const camera = new THREE.PerspectiveCamera()
camera.updateMatrixWorld()

function hit(target, damage, critical = false) {
  return attackResolved({
    attacker: 'atacante',
    target,
    attackId: 'tackle',
    slot: 'primary',
    origin: { x: 0, y: 0, z: 0 },
    impactPoint: { x: 0, y: 0, z: 1 },
    contactPoint: { x: 0, y: 0, z: 0.8 },
    damage,
    critical,
  })
}

function run(frameEvents, delta = 0) {
  damageNumberSystem({ delta, frameEvents, camera })
}

const activeSlots = () => damageNumberPool.slots.filter((slot) => slot.active)

afterEach(() => {
  run([], 1000) // apaga tudo do pool compartilhado
  while (worlds.length) worlds.pop().destroy()
})

describe('damageNumberSystem', () => {
  it('acerto cria um número acima da cabeça do alvo, com o dano arredondado', () => {
    const target = spawnTarget({ x: 2, y: 0.45, z: -1 })

    run([hit(target, 7.6)])

    const [slot] = activeSlots()
    expect(slot.text).toBe('8')
    expect(slot.critical).toBe(false)
    expect(slot.lifetime).toBeCloseTo(LIFETIME)
    // topo da cápsula (0.45 + 0.3 + 0.15) + folga
    expect(slot.y).toBeCloseTo(0.9 + HEAD_MARGIN)
  })

  it('crítico fica marcado e dura mais', () => {
    const target = spawnTarget({ x: 0, y: 0.45, z: 0 })

    run([hit(target, 20, true)])

    const [slot] = activeSlots()
    expect(slot.critical).toBe(true)
    expect(slot.lifetime).toBeCloseTo(CRIT_LIFETIME)
  })

  it('o golpe que ERROU no sorteio de precisão mostra "Errou!" acima do alvo, em cinza', () => {
    const target = spawnTarget({ x: 0, y: 0.45, z: 0 })
    const missed = attackResolved({
      attacker: 'atacante',
      target,
      attackId: 'tackle',
      slot: 'primary',
      origin: { x: 0, y: 0, z: 0 },
      impactPoint: { x: 0, y: 0, z: 1 },
      damage: 0,
      critical: false,
      missed: true,
    })

    run([missed])

    const [slot] = activeSlots()
    expect(slot.text).toBe('Errou!')
    expect(slot.kind).toBe('miss')
    expect(slot.color).toBe(GAME_CONFIG.FEEDBACK.MISS_COLOR)
    expect(slot.y).toBeCloseTo(0.9 + HEAD_MARGIN)
  })

  it('miss não cria número', () => {
    const miss = attackResolved({
      attacker: 'atacante',
      attackId: 'tackle',
      slot: 'primary',
      origin: { x: 0, y: 0, z: 0 },
      impactPoint: { x: 0, y: 0, z: 1 },
    })

    run([miss])

    expect(activeSlots()).toHaveLength(0)
  })

  it('golpes seguidos no mesmo alvo se afastam de lado (direita da câmera), não empilham', () => {
    const target = spawnTarget({ x: 0, y: 0.45, z: 0 })

    run([hit(target, 5), hit(target, 5), hit(target, 5)])

    const xs = activeSlots()
      .map((slot) => slot.x)
      .sort((a, b) => a - b)
    expect(xs).toHaveLength(3)
    expect(xs[0]).toBeCloseTo(-SPREAD)
    expect(xs[1]).toBeCloseTo(0)
    expect(xs[2]).toBeCloseTo(SPREAD)
  })

  it('o número some ao fim da vida', () => {
    const target = spawnTarget({ x: 0, y: 0.45, z: 0 })
    run([hit(target, 5)])

    run([], LIFETIME + 0.01)

    expect(activeSlots()).toHaveLength(0)
  })
})

describe('formatDamage', () => {
  it('inteiro arredondado, nunca menos que 1', () => {
    expect(formatDamage(7.4)).toBe('7')
    expect(formatDamage(7.5)).toBe('8')
    expect(formatDamage(0.2)).toBe('1')
  })
})

function statChanged(target, stat, delta) {
  return statStageChanged({
    attacker: 'atacante',
    target,
    attackId: 'growl',
    stat,
    delta,
    stage: delta,
  })
}

describe('formatStatChange', () => {
  it('rótulo do atributo + uma seta por estágio (no máximo 3)', () => {
    expect(formatStatChange('attack', -1)).toBe('Ataque ↓')
    expect(formatStatChange('defense', -2)).toBe('Defesa ↓↓')
    expect(formatStatChange('sp_atk', 1)).toBe('Atq. Esp. ↑')
    expect(formatStatChange('sp_def', 5)).toBe('Def. Esp. ↑↑↑')
  })
})

describe('damageNumberSystem — golpes de status (Growl)', () => {
  it('statStageChanged cria o texto "Ataque ↓" acima do alvo, como debuff', () => {
    const target = spawnTarget({ x: 0, y: 0.45, z: 0 })

    run([statChanged(target, 'attack', -1)])

    const [slot] = activeSlots()
    expect(slot.text).toBe('Ataque ↓')
    expect(slot.kind).toBe('debuff')
    expect(slot.critical).toBe(false)
    expect(slot.y).toBeCloseTo(0.9 + HEAD_MARGIN)
  })

  it('subir atributo é um buff', () => {
    const target = spawnTarget({ x: 0, y: 0.45, z: 0 })

    run([statChanged(target, 'defense', 1)])

    expect(activeSlots()[0].kind).toBe('buff')
  })

  it('golpe em SI MESMO (Growth): "Ataque ↑" e "Atq. Esp. ↑" acima de quem usou', () => {
    const user = spawnTarget({ x: 0, y: 0.45, z: 0 })
    const self = (stat) =>
      statStageChanged({
        attacker: user,
        target: user,
        attackId: 'growth',
        stat,
        delta: 1,
        stage: 1,
      })

    run([self('attack'), self('sp_atk')])

    const slots = activeSlots()
    expect(slots.map((slot) => slot.text)).toEqual(['Ataque ↑', 'Atq. Esp. ↑'])
    for (const slot of slots) {
      expect(slot.kind).toBe('buff')
      expect(slot.y).toBeCloseTo(0.9 + HEAD_MARGIN)
    }
  })

  it('drenagem do Leech Seed: dano no alvo e "+N" de cura em quem plantou', () => {
    const target = spawnTarget({ x: 0, y: 0.45, z: 0 })
    const source = spawnTarget({ x: 3, y: 0.45, z: 0 })

    run([leechSeedDrained({ target, source, damage: 10, healed: 10 })])

    const slots = activeSlots()
    expect(slots.map((slot) => slot.text)).toEqual(['10', '+10'])
    expect(slots[0].kind).toBe('damage')
    expect(slots[1].kind).toBe('buff')
    expect(slots[1].x).toBeCloseTo(3, 0)
  })

  it('drenagem sem cura (quem plantou cheio ou recolhido): só o dano', () => {
    const target = spawnTarget({ x: 0, y: 0.45, z: 0 })

    run([leechSeedDrained({ target, source: null, damage: 10, healed: 0 })])

    expect(activeSlots().map((slot) => slot.text)).toEqual(['10'])
  })

  it('golpe de status interrompido: "Interrompido!" acima de quem perdeu o golpe', () => {
    const user = spawnTarget({ x: 0, y: 0.45, z: 0 })

    run([
      attackInterrupted({
        entity: user,
        attackId: 'growth',
        slot: 'secondary1',
      }),
    ])

    const [slot] = activeSlots()
    expect(slot.text).toBe('Interrompido!')
    expect(slot.color).toBe(GAME_CONFIG.FEEDBACK.INTERRUPT_COLOR)
    expect(slot.y).toBeCloseTo(0.9 + HEAD_MARGIN)
  })

  it('golpe que falhou por domínio baixo: "Falhou!" acima de quem usou', () => {
    const user = spawnTarget({ x: 0, y: 0.45, z: 0 })

    run([
      attackFailed({ entity: user, attackId: 'growth', slot: 'secondary1' }),
    ])

    const [slot] = activeSlots()
    expect(slot.text).toBe('Falhou!')
    expect(slot.color).toBe(GAME_CONFIG.FEEDBACK.FAIL_COLOR)
  })

  it('avisos de golpe: apto ao subir de nível e aprendido, com o nome do golpe', () => {
    const creature = spawnTarget({ x: 0, y: 0.45, z: 0 })

    run([
      moveUnlocked({
        trainer: null,
        slot: 'slot1',
        creature,
        moveIds: ['smokescreen'],
      }),
      moveLearned({
        trainer: null,
        slot: 'slot1',
        creature,
        moveId: 'leech-seed',
      }),
    ])

    const texts = activeSlots().map((slot) => slot.text)
    expect(texts).toContain(formatMoveUnlocked(['smokescreen']))
    expect(texts).toContain(formatMoveLearned('leech-seed'))
    expect(formatMoveLearned('leech-seed')).toContain('Leech Seed')
  })

  it('golpe aprendido com a criatura na bola não mostra nada', () => {
    run([moveLearned({ trainer: null, slot: 'slot1', moveId: 'ember' })])
    expect(activeSlots()).toHaveLength(0)
  })

  it('o attackResolved de STATUS (damage 0) não cria número de dano', () => {
    const target = spawnTarget({ x: 0, y: 0.45, z: 0 })
    const status = { ...hit(target, 0), status: true }

    run([status])

    expect(activeSlots()).toHaveLength(0)
  })

  it('um golpe de status em 2 alvos cria 2 textos, e o de dano continua com kind "damage"', () => {
    const a = spawnTarget({ x: 0, y: 0.45, z: 0 })
    const b = spawnTarget({ x: 1, y: 0.45, z: 0 })

    run([statChanged(a, 'attack', -1), statChanged(b, 'attack', -1), hit(a, 5)])

    const slots = activeSlots()
    expect(slots).toHaveLength(3)
    expect(slots.map((slot) => slot.kind).sort()).toEqual([
      'damage',
      'debuff',
      'debuff',
    ])
  })

  it('alvo já destruído não quebra o system', () => {
    const target = spawnTarget({ x: 0, y: 0.45, z: 0 })
    const event = statChanged(target, 'attack', -1)
    target.destroy()

    expect(() => run([event])).not.toThrow()
    expect(activeSlots()).toHaveLength(0)
  })
})

describe('damageNumberSystem — cor do texto: tipo × lado do alvo', () => {
  function spawnSided(side) {
    const world = createWorld()
    worlds.push(world)
    return world.spawn(
      Position({ x: 0, y: 0.45, z: 0 }),
      CharacterController(BODY),
      side === 'ally'
        ? SummonedCreature({ slot: 'slot1', speciesId: 'charmander' })
        : WildCreature({ speciesId: 'charmander' }),
    )
  }

  it('número de DANO: vermelho no oponente, rosa no aliado', () => {
    run([hit(spawnSided('opponent'), 5)])
    expect(activeSlots()[0].color).toBe(OPPONENT.DAMAGE)
    run([], 1000)

    run([hit(spawnSided('ally'), 5)])
    expect(activeSlots()[0].color).toBe(ALLY.DAMAGE)
  })

  it('texto de STATUS: laranja/violeta quando o atributo baixa, verde/ciano quando sobe', () => {
    const expectColor = (side, delta, color) => {
      run([statChanged(spawnSided(side), 'attack', delta)])
      expect(activeSlots()[0].color).toBe(color)
      run([], 1000)
    }

    expectColor('opponent', -1, OPPONENT.DEBUFF)
    expectColor('ally', -1, ALLY.DEBUFF)
    expectColor('opponent', 1, OPPONENT.BUFF)
    expectColor('ally', 1, ALLY.BUFF)
  })

  it('o crítico usa a cor CRIT do lado e o brilho do contorno é a cor de dano do lado', () => {
    run([hit(spawnSided('ally'), 20, true)])
    run([hit(spawnSided('opponent'), 20, true)])

    const [ally, opponent] = activeSlots()
    expect(ally.critical).toBe(true)
    expect(ally.color).toBe(ALLY.CRIT)
    expect(ally.glow).toBe(ALLY.DAMAGE)
    expect(opponent.color).toBe(OPPONENT.CRIT)
    expect(opponent.glow).toBe(OPPONENT.DAMAGE)
    expect(ally.color).not.toBe(opponent.color)
  })

  it('alvo sem marca de lado (nem aliado nem selvagem) conta como oponente', () => {
    expect(() =>
      run([hit(spawnTarget({ x: 0, y: 0.45, z: 0 }), 5)]),
    ).not.toThrow()
    expect(activeSlots()[0].color).toBe(OPPONENT.DAMAGE)
  })
})
