import { describe, expect, it } from 'vitest'
import { revealWhenReady } from './revealWhenReady'

// Renderizador de mentira: a compilação termina quando o teste manda.
function fakeRenderer({ compileAsync = true } = {}) {
  const renderer = { compiled: [], uploaded: [], finishCompile: null }
  if (compileAsync) {
    renderer.compileAsync = (object, camera, scene) => {
      renderer.compiled.push({ object, camera, scene })
      return new Promise((resolve) => {
        renderer.finishCompile = resolve
      })
    }
  }
  renderer.initTexture = (texture) => renderer.uploaded.push(texture)
  return renderer
}

// Quadros controlados pelo teste.
function fakeFrames() {
  const pending = []
  return {
    nextFrame: (callback) => pending.push(callback),
    async step() {
      pending.shift()?.()
      await flush()
    },
  }
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('revealWhenReady', () => {
  it('fica invisível até compilar e subir as texturas, uma por quadro', async () => {
    const object = { visible: false }
    const renderer = fakeRenderer()
    const frames = fakeFrames()
    const textures = ['a', 'b']
    const done = revealWhenReady({
      object,
      renderer,
      camera: 'camera',
      scene: 'scene',
      textures,
      nextFrame: frames.nextFrame,
    })

    await flush()
    expect(renderer.compiled).toEqual([
      { object, camera: 'camera', scene: 'scene' },
    ])
    expect(object.visible).toBe(false)

    renderer.finishCompile()
    await flush()
    expect(renderer.uploaded).toEqual([])

    await frames.step()
    expect(renderer.uploaded).toEqual(['a'])
    expect(object.visible).toBe(false)

    await frames.step()
    await done
    expect(renderer.uploaded).toEqual(textures)
    expect(object.visible).toBe(true)
  })

  it('a mesma textura em dois materiais sobe uma vez só', async () => {
    const object = { visible: false }
    const renderer = fakeRenderer({ compileAsync: false })
    const frames = fakeFrames()
    const done = revealWhenReady({
      object,
      renderer,
      textures: ['a', 'a'],
      nextFrame: frames.nextFrame,
    })
    await flush()
    await frames.step()
    await done
    expect(renderer.uploaded).toEqual(['a'])
    expect(object.visible).toBe(true)
  })

  it('cancelado antes de ficar pronto, não mostra nem sobe mais nada', async () => {
    const object = { visible: false }
    const renderer = fakeRenderer({ compileAsync: false })
    const frames = fakeFrames()
    let cancelled = false
    const done = revealWhenReady({
      object,
      renderer,
      textures: ['a', 'b'],
      isCancelled: () => cancelled,
      nextFrame: frames.nextFrame,
    })
    await flush()
    cancelled = true
    await frames.step()
    await done
    expect(renderer.uploaded).toEqual([])
    expect(object.visible).toBe(false)
  })

  it('erro ao compilar ou subir não deixa o modelo escondido', async () => {
    const object = { visible: false }
    const renderer = {
      compileAsync: () => Promise.reject(new Error('sem contexto')),
      initTexture: () => {
        throw new Error('textura quebrada')
      },
    }
    const frames = fakeFrames()
    const done = revealWhenReady({
      object,
      renderer,
      textures: ['a'],
      nextFrame: frames.nextFrame,
    })
    await flush()
    await frames.step()
    await done
    expect(object.visible).toBe(true)
  })
})
