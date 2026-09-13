import { describe, it, expect } from 'vitest'
import { resolveBones } from './resolveBones'

function makeBone(name, overrides = {}) {
  return {
    name,
    rotation: { x: 0, y: 0, z: 0, ...overrides.rotation },
    position: { x: 0, y: 0, z: 0, ...overrides.position },
    scale: { x: 1, y: 1, z: 1, ...overrides.scale },
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

  it('mudar o osso depois de resolvido não afeta o rest já capturado', () => {
    const bone = makeBone('leg')
    const bones = resolveBones({ bones: [bone] })

    bone.rotation.z = 5 // alguém animando o osso depois da resolução

    expect(bones.leg.rest.rotation.z).toBe(0)
  })

  it('esqueleto vazio devolve mapa vazio', () => {
    expect(resolveBones({ bones: [] })).toEqual({})
  })
})
