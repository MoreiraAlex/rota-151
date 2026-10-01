import { afterEach, describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import { createWorld } from 'koota'
import { attackResolved, statStageChanged } from '@/core/events'
import { SummonedCreature, WildCreature } from '@/core/traits'
import { GAME_CONFIG } from '@/core/gameConfig'
import { registerView, unregisterView } from '../registry/viewRegistry'
import { hitFlashSystem } from './hitFlashSystem'

const { DURATION, INTENSITY } = GAME_CONFIG.FEEDBACK.HIT_FLASH
const { OPPONENT, ALLY } = GAME_CONFIG.FEEDBACK.FEEDBACK_COLORS
// '#rrggbb' → 'rrggbb' (o que `getHexString` devolve)
const hex = (color) => color.slice(1)
const ATTACKER = 'atacante'
const registered = []

// Modelo mínimo: um grupo com um mesh — mesma forma do que
// `useAnimatedModel.js` registra no `viewRegistry`.
function spawnModel(entity, material) {
  const group = new THREE.Group()
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(), material)
  group.add(mesh)
  registerView(entity, group)
  registered.push(entity)
  return mesh
}

function hitEvent(target) {
  return attackResolved({
    attacker: ATTACKER,
    target,
    attackId: 'tackle',
    slot: 'primary',
    origin: { x: 0, y: 0, z: 0 },
    impactPoint: { x: 0, y: 0, z: 1 },
    contactPoint: { x: 0, y: 0, z: 0.8 },
    damage: 5,
  })
}

function run(delta, frameEvents = []) {
  hitFlashSystem({ delta, frameEvents })
}

afterEach(() => {
  while (registered.length) unregisterView(registered.pop())
  run(0) // descarta o estado do system pras entidades que saíram
})

describe('hitFlashSystem', () => {
  it('acerto acende o alvo na hora (vermelho no oponente, intensidade configurada)', () => {
    const mesh = spawnModel('alvo', new THREE.MeshStandardMaterial())

    run(0, [hitEvent('alvo')])

    expect(mesh.material.emissive.getHexString()).toBe(hex(OPPONENT.DAMAGE))
    expect(mesh.material.emissiveIntensity).toBeCloseTo(INTENSITY)
  })

  it('clona o material: outra criatura com o MESMO material não acende junto', () => {
    const shared = new THREE.MeshStandardMaterial()
    const targetMesh = spawnModel('alvo', shared)
    const otherMesh = spawnModel('vizinho', shared)

    run(0, [hitEvent('alvo')])

    expect(targetMesh.material).not.toBe(shared)
    expect(otherMesh.material).toBe(shared)
    expect(shared.emissive.getHexString()).toBe('000000')
  })

  it('apaga ao longo de DURATION e volta exatamente à cor original', () => {
    const material = new THREE.MeshStandardMaterial({ emissive: '#220000' })
    const mesh = spawnModel('alvo', material)

    run(0, [hitEvent('alvo')])
    run(DURATION / 2)
    const halfway = mesh.material.emissive.r
    run(DURATION)

    expect(halfway).toBeGreaterThan(0.2)
    expect(halfway).toBeLessThan(1)
    expect(mesh.material.emissive.getHexString()).toBe('220000')
    expect(mesh.material.emissiveIntensity).toBeCloseTo(1)
  })

  it('acerto durante o flash reinicia o tempo sem prender o brilho como "cor original"', () => {
    const mesh = spawnModel('alvo', new THREE.MeshStandardMaterial())

    run(0, [hitEvent('alvo')])
    run(DURATION * 0.9) // flash quase no fim (10% restante)
    // Novo acerto: o tempo volta pra DURATION — sem o reinício, o flash
    // acabaria antes de mais DURATION/2.
    run(0, [hitEvent('alvo')])
    run(DURATION / 2)
    expect(mesh.material.emissive.r).toBeGreaterThan(0) // ainda acesa

    run(DURATION)
    expect(mesh.material.emissive.getHexString()).toBe('000000')
  })

  it('miss não acende ninguém', () => {
    const mesh = spawnModel('alvo', new THREE.MeshStandardMaterial())
    const miss = attackResolved({
      attacker: ATTACKER,
      attackId: 'tackle',
      slot: 'primary',
      origin: { x: 0, y: 0, z: 0 },
      impactPoint: { x: 0, y: 0, z: 1 },
    })

    run(0, [miss])

    expect(mesh.material.emissive.getHexString()).toBe('000000')
  })

  it('material sem emissive (MeshBasicMaterial) é ignorado sem erro', () => {
    spawnModel('alvo', new THREE.MeshBasicMaterial())

    expect(() => run(0, [hitEvent('alvo')])).not.toThrow()
  })

  it('entidade que sai de cena tem o material clonado descartado (dispose)', () => {
    const mesh = spawnModel('alvo', new THREE.MeshStandardMaterial())
    run(0, [hitEvent('alvo')])
    const dispose = vi.spyOn(mesh.material, 'dispose')

    unregisterView('alvo')
    registered.splice(registered.indexOf('alvo'), 1)
    run(0)

    expect(dispose).toHaveBeenCalledOnce()
  })

  it('golpe de STATUS (damage 0, status: true) não acende o alvo', () => {
    const mesh = spawnModel('alvo', new THREE.MeshStandardMaterial())

    run(0, [{ ...hitEvent('alvo'), status: true, damage: 0 }])

    expect(mesh.material.emissiveIntensity).not.toBeCloseTo(INTENSITY)
    expect(mesh.material.emissive.getHex()).toBe(0x000000)
  })

  describe('cor do brilho: tipo de acontecimento × lado do alvo', () => {
    const worlds = []
    afterEach(() => {
      while (worlds.length) worlds.pop().destroy()
    })
    function spawnEntity(...traits) {
      const world = createWorld()
      worlds.push(world)
      return world.spawn(...traits)
    }
    const ally = () =>
      spawnEntity(SummonedCreature({ slot: 'slot1', speciesId: 'charmander' }))
    const opponent = () =>
      spawnEntity(WildCreature({ speciesId: 'charmander' }))
    const stat = (target, delta) =>
      statStageChanged({
        attacker: 'a',
        target,
        attackId: 'growl',
        stat: 'attack',
        delta,
        stage: delta,
      })
    const colorAfter = (target, events) => {
      const mesh = spawnModel(target, new THREE.MeshStandardMaterial())
      run(0, events)
      return mesh.material.emissive.getHexString()
    }

    it('DANO: vermelho no oponente, rosa no aliado (o treinador e as criaturas do time)', () => {
      const wild = opponent()
      expect(colorAfter(wild, [hitEvent(wild)])).toBe(hex(OPPONENT.DAMAGE))

      const mine = ally()
      expect(colorAfter(mine, [hitEvent(mine)])).toBe(hex(ALLY.DAMAGE))
    })

    it('STATUS NEGATIVO (atributo baixou): laranja no oponente, violeta no aliado', () => {
      const wild = opponent()
      expect(colorAfter(wild, [stat(wild, -1)])).toBe(hex(OPPONENT.DEBUFF))

      const mine = ally()
      expect(colorAfter(mine, [stat(mine, -1)])).toBe(hex(ALLY.DEBUFF))
    })

    it('STATUS POSITIVO (atributo subiu): verde no oponente, ciano no aliado', () => {
      const wild = opponent()
      expect(colorAfter(wild, [stat(wild, 1)])).toBe(hex(OPPONENT.BUFF))

      const mine = ally()
      expect(colorAfter(mine, [stat(mine, 2)])).toBe(hex(ALLY.BUFF))
    })

    it('o golpe de status (damage 0, status: true) sozinho não acende; quem acende é o statStageChanged', () => {
      const wild = opponent()
      const status = { ...hitEvent(wild), status: true, damage: 0 }
      const mesh = spawnModel(wild, new THREE.MeshStandardMaterial())

      run(0, [status])
      expect(mesh.material.emissive.getHexString()).toBe('000000')

      run(0, [stat(wild, -1)])
      expect(mesh.material.emissive.getHexString()).toBe(hex(OPPONENT.DEBUFF))
    })

    it('dano e status no MESMO frame: o dano ganha (vermelho, não laranja)', () => {
      const wild = opponent()
      expect(colorAfter(wild, [hitEvent(wild), stat(wild, -1)])).toBe(
        hex(OPPONENT.DAMAGE),
      )
      // a ordem dos eventos não importa
      const other = opponent()
      expect(colorAfter(other, [stat(other, -1), hitEvent(other)])).toBe(
        hex(OPPONENT.DAMAGE),
      )
    })

    it('status negativo ganha de positivo no mesmo frame', () => {
      const wild = opponent()
      expect(colorAfter(wild, [stat(wild, 1), stat(wild, -1)])).toBe(
        hex(OPPONENT.DEBUFF),
      )
    })

    it('um brilho novo durante outro TROCA a cor e reinicia o tempo, sem recapturar a cor base', () => {
      const wild = opponent()
      const mesh = spawnModel(wild, new THREE.MeshStandardMaterial())
      run(0, [hitEvent(wild)])
      run(DURATION / 2)

      run(0, [stat(wild, 1)])

      expect(mesh.material.emissive.getHexString()).toBe(hex(OPPONENT.BUFF))
      // ao apagar, volta à cor ORIGINAL (preto), não fica preso brilhando
      run(DURATION + 0.01)
      expect(mesh.material.emissive.getHexString()).toBe('000000')
    })

    it('os brilhos de um alvo não contaminam o vizinho', () => {
      const wild = opponent()
      const neighbour = opponent()
      const target = spawnModel(wild, new THREE.MeshStandardMaterial())
      const other = spawnModel(neighbour, new THREE.MeshStandardMaterial())

      run(0, [stat(wild, -1)])

      expect(target.material.emissive.getHexString()).toBe(hex(OPPONENT.DEBUFF))
      expect(other.material.emissive.getHexString()).toBe('000000')
    })
  })
})
