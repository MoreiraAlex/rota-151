import { describe, expect, it } from 'vitest'
import { listItems } from '@/core/data/items'
import { listSkills } from '@/core/data/skills'
import { listSpecies } from '@/core/data/species'
import { listModelPaths, listSpritePaths, preloadImages } from './assetPreload'

// Pré-carregamento da tela de "Carregando…" (docs/features/044-salvar-o-
// jogo.md). Os caminhos vêm dos próprios dados.
function fakeImage() {
  return { onload: null, onerror: null, src: null }
}

describe('listSpritePaths / listModelPaths', () => {
  it('todo sprite de item, espécie e golpe entra, sem repetição', () => {
    const paths = listSpritePaths()
    const expected = [...listItems(), ...listSpecies(), ...listSkills()]
      .map((entry) => entry.sprite?.path)
      .filter(Boolean)
    expect(new Set(paths)).toEqual(new Set(expected))
    expect(paths.length).toBe(new Set(paths).size)
  })

  it('todo modelo de item e espécie entra, sem repetição', () => {
    const paths = listModelPaths()
    const expected = [...listItems(), ...listSpecies()]
      .map((entry) => entry.model?.path)
      .filter(Boolean)
    expect(new Set(paths)).toEqual(new Set(expected))
    expect(paths.length).toBe(new Set(paths).size)
  })
})

describe('preloadImages', () => {
  it('resolve quando todas terminam, carregando ou falhando', async () => {
    const images = []
    const done = preloadImages(['a', 'b'], {
      createImage: () => {
        const image = fakeImage()
        images.push(image)
        return image
      },
      setTimer: () => {},
    })
    expect(images.map((image) => image.src)).toEqual(['a', 'b'])

    let resolved = false
    done.then(() => {
      resolved = true
    })
    images[0].onload()
    await Promise.resolve()
    expect(resolved).toBe(false)

    images[1].onerror()
    await done
    expect(resolved).toBe(true)
  })

  it('não espera mais que o limite de tempo', async () => {
    let fireTimeout
    const done = preloadImages(['lenta'], {
      createImage: fakeImage,
      setTimer: (fn) => {
        fireTimeout = fn
      },
    })
    fireTimeout()
    await expect(done).resolves.toBeUndefined()
  })
})

describe('preloadImages — progresso', () => {
  it('avisa cada imagem que termina', () => {
    const images = []
    let finished = 0
    preloadImages(['a', 'b'], {
      createImage: () => {
        const image = fakeImage()
        images.push(image)
        return image
      },
      setTimer: () => {},
      onEach: () => finished++,
    })
    images[0].onload()
    images[1].onerror()
    expect(finished).toBe(2)
  })
})
