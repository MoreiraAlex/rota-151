import { describe, it, expect } from 'vitest'
import { resolveBones } from './resolveBones'

function makeBone(name, overrides = {}) {
  return {
    name,
    rotation: { x: 0, y: 0, z: 0, ...overrides.rotation },
    position: { x: 0, y: 0, z: 0, ...overrides.position },
    scale: { x: 1, y: 1, z: 1, ...overrides.scale },
    quaternion: { x: 0, y: 0, z: 0, w: 1, ...overrides.quaternion },
  }
}

describe('resolveBones', () => {
  it('indexa cada osso pelo próprio nome, sem mapeamento', () => {
    const skeleton = { bones: [makeBone('hip'), makeBone('tail')] }
    expect(Object.keys(resolveBones(skeleton))).toEqual(['hip', 'tail'])
  })

  it('guarda a pose de descanso (rotation/position/scale) da resolução', () => {
    const bone = makeBone('leg', { rotation: { z: 1.2 }, position: { y: 3 } })
    const bones = resolveBones({ bones: [bone] })

    expect(bones.leg.rest.rotation.z).toBe(1.2)
    expect(bones.leg.rest.position.y).toBe(3)
    expect(bones.leg.rest.scale).toEqual({ x: 1, y: 1, z: 1 })
  })

  it('guarda o quaternion de descanso, separado da tripla de Euler', () => {
    const bone = makeBone('thigh', {
      // rig como o do Mixamo: descansa longe da identidade (180° em Z)
      quaternion: { x: 0, y: 0, z: 1, w: 0 },
    })
    const bones = resolveBones({ bones: [bone] })

    expect(bones.thigh.restQuaternion).toEqual({ x: 0, y: 0, z: 1, w: 0 })
  })

  it('mudar o osso depois de resolvido não afeta o rest/restQuaternion já capturados', () => {
    const bone = makeBone('leg')
    const bones = resolveBones({ bones: [bone] })

    bone.rotation.z = 5 // alguém animando o osso depois da resolução
    bone.quaternion.z = 0.9

    expect(bones.leg.rest.rotation.z).toBe(0)
    expect(bones.leg.restQuaternion.z).toBe(0)
  })

  it('esqueleto vazio devolve mapa vazio', () => {
    expect(resolveBones({ bones: [] })).toEqual({})
  })
})
