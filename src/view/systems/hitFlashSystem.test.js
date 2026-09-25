import { afterEach, describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import { attackResolved } from '@/core/events'
import { GAME_CONFIG } from '@/core/gameConfig'
import { registerView, unregisterView } from '../registry/viewRegistry'
import { hitFlashSystem } from './hitFlashSystem'

const { DURATION, INTENSITY } = GAME_CONFIG.FEEDBACK.HIT_FLASH
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
    attackId: 'scratch',
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
  it('acerto acende o alvo na hora (emissive branco, intensidade configurada)', () => {
    const mesh = spawnModel('alvo', new THREE.MeshStandardMaterial())

    run(0, [hitEvent('alvo')])

    expect(mesh.material.emissive.getHexString()).toBe('ffffff')
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
      attackId: 'scratch',
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
})
