import { describe, it, expect, afterEach } from 'vitest'
import { makeWorld } from '@/test/makeWorld'
import { AimAnchor, OrbitCamera } from '@/core/traits'
import { aimAnchorSystem } from './aimAnchorSystem'

const spawnedWorlds = []
function spawnWorld(...args) {
  const created = makeWorld(...args)
  spawnedWorlds.push(created.world)
  return created
}

afterEach(() => {
  while (spawnedWorlds.length) spawnedWorlds.pop().destroy()
})

function tick(world, input = {}) {
  aimAnchorSystem({ world, input })
}

describe('aimAnchorSystem', () => {
  it('sem mirar, não captura nada', () => {
    const { world, player } = spawnWorld()

    tick(world, { aiming: false })

    expect(player.get(AimAnchor).active).toBe(false)
  })

  it('começar a mirar (borda de subida) captura o ponto', () => {
    const { world, player } = spawnWorld()

    tick(world, { aiming: true })

    expect(player.get(AimAnchor).active).toBe(true)
  })

  it('continuar mirando não recaptura — o ponto fica fixo mesmo girando a câmera', () => {
    const { world, player, camera } = spawnWorld()

    tick(world, { aiming: true })
    const captured = { ...player.get(AimAnchor) }

    camera.set(OrbitCamera, { yaw: 2, pitch: 0.2, distance: 20 })
    tick(world, { aiming: true })

    expect(player.get(AimAnchor)).toEqual(captured)
  })

  it('soltar (borda de descida) libera o ponto', () => {
    const { world, player } = spawnWorld()

    tick(world, { aiming: true })
    tick(world, { aiming: false })

    expect(player.get(AimAnchor).active).toBe(false)
  })

  it('soltar e mirar de novo, com a câmera em outro lugar, captura um ponto diferente', () => {
    const { world, player, camera } = spawnWorld()

    tick(world, { aiming: true })
    const first = { ...player.get(AimAnchor) }

    tick(world, { aiming: false })
    camera.set(OrbitCamera, { yaw: 1.7, pitch: 0.3, distance: 6 })
    tick(world, { aiming: true })

    expect(player.get(AimAnchor)).not.toEqual(first)
  })
})
