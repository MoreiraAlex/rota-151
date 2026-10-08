import { describe, expect, it, vi } from 'vitest'
import {
  createLoadingProgress,
  resolveLoadingFraction,
} from './loadingProgress'

// Progresso da tela de carregamento (docs/features/044-salvar-o-jogo.md).
describe('createLoadingProgress', () => {
  it('conta o que falta e o rótulo pendente de cada etapa', () => {
    const progress = createLoadingProgress()
    progress.add('a', 2)
    progress.add('b')

    progress.complete('a')
    expect(progress.getSnapshot()).toEqual({
      done: 1,
      total: 3,
      pending: ['a', 'b'],
    })

    progress.complete('a')
    expect(progress.getSnapshot().pending).toEqual(['b'])
  })

  it('não conta além do que foi pedido', () => {
    const progress = createLoadingProgress()
    progress.add('a')
    progress.complete('a')
    progress.complete('a')
    progress.complete('outra')
    expect(progress.getSnapshot()).toMatchObject({ done: 1, total: 1 })
  })

  it('track: a promise conta como uma unidade, cumprida ou falhada', async () => {
    const progress = createLoadingProgress()
    const ok = progress.track('a', Promise.resolve('x'))
    const failed = progress.track('b', Promise.reject(new Error('y')))
    expect(progress.getSnapshot().total).toBe(2)

    await expect(ok).resolves.toBe('x')
    await failed.catch(() => {})
    await Promise.resolve()
    expect(progress.getSnapshot()).toMatchObject({ done: 2, pending: [] })
  })

  it('avisa quem assina e para de avisar ao sair', () => {
    const progress = createLoadingProgress()
    const listener = vi.fn()
    const unsubscribe = progress.subscribe(listener)
    progress.add('a')
    unsubscribe()
    progress.complete('a')
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('reset zera tudo', () => {
    const progress = createLoadingProgress()
    progress.add('a', 3)
    progress.reset()
    expect(progress.getSnapshot()).toEqual({ done: 0, total: 0, pending: [] })
  })
})

describe('resolveLoadingFraction', () => {
  it('soma as etapas do jogo com os arquivos do three.js', () => {
    expect(
      resolveLoadingFraction({ done: 1, total: 2 }, { loaded: 1, total: 2 }),
    ).toBe(0.5)
  })

  it('nada a fazer ainda: zero', () => {
    expect(resolveLoadingFraction({ done: 0, total: 0 }, null)).toBe(0)
  })
})
