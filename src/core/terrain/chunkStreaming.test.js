import { describe, expect, it } from 'vitest'
import { planChunkStreaming } from './chunkStreaming'

const SIZE = 10
const at = (chunkX, chunkZ) => ({ x: chunkX * SIZE, z: chunkZ * SIZE })
const keys = (list) => list.map(({ chunkX, chunkZ }) => `${chunkX},${chunkZ}`)

const plan = (overrides) =>
  planChunkStreaming({
    centers: [at(0, 0)],
    loaded: [],
    chunkSize: SIZE,
    loadRadius: 2,
    unloadRadius: 3,
    nearRadius: 1,
    ...overrides,
  })

describe('planChunkStreaming', () => {
  it('quer o quadrado do raio de carregar em volta do centro', () => {
    const { toLoadNow, toLoadLater } = plan({})
    const wanted = [...toLoadNow, ...toLoadLater]
    expect(wanted).toHaveLength(5 * 5)
    for (const { chunkX, chunkZ } of wanted) {
      expect(Math.max(Math.abs(chunkX), Math.abs(chunkZ))).toBeLessThanOrEqual(
        2,
      )
    }
  })

  it('o chão em volta do centro carrega na hora; o resto vai para a fila', () => {
    const { toLoadNow, toLoadLater } = plan({})
    expect(toLoadNow).toHaveLength(3 * 3)
    expect(toLoadNow[0]).toEqual({ chunkX: 0, chunkZ: 0 })
    for (const { chunkX, chunkZ } of toLoadLater) {
      expect(Math.max(Math.abs(chunkX), Math.abs(chunkZ))).toBe(2)
    }
  })

  it('a fila vem do mais perto para o mais longe', () => {
    const { toLoadLater } = plan({ nearRadius: 0 })
    const ring = ({ chunkX, chunkZ }) =>
      Math.max(Math.abs(chunkX), Math.abs(chunkZ))
    const rings = toLoadLater.map(ring)
    expect(rings).toEqual([...rings].sort((a, b) => a - b))
  })

  it('não pede de novo o que já está carregado', () => {
    const { toLoadNow } = plan({ loaded: [{ chunkX: 0, chunkZ: 0 }] })
    expect(keys(toLoadNow)).not.toContain('0,0')
  })

  it('dois centros: junta os dois quadrados, sem repetir', () => {
    const { toLoadNow, toLoadLater } = plan({ centers: [at(0, 0), at(1, 0)] })
    const all = keys([...toLoadNow, ...toLoadLater])
    expect(new Set(all).size).toBe(all.length)
    expect(all).toContain('3,0')
    expect(all).toContain('-2,0')
  })

  it('folga: entre os raios fica carregado; além do de descarregar sai', () => {
    const loaded = [
      { chunkX: 3, chunkZ: 0 },
      { chunkX: 0, chunkZ: -4 },
      { chunkX: 1, chunkZ: 1 },
    ]
    const { toUnload, kept } = plan({ loaded })
    expect(keys(kept)).toEqual(['3,0'])
    expect(keys(toUnload)).toEqual(['0,-4'])
  })

  it('o chunk perto de um dos centros não descarrega', () => {
    const { toUnload } = plan({
      centers: [at(0, 0), at(10, 0)],
      loaded: [{ chunkX: 10, chunkZ: 1 }],
    })
    expect(toUnload).toEqual([])
  })

  it('sem centro, não mexe em nada', () => {
    const result = plan({ centers: [], loaded: [{ chunkX: 9, chunkZ: 9 }] })
    expect(result).toEqual({
      toLoadNow: [],
      toLoadLater: [],
      toUnload: [],
      kept: [],
    })
  })
})
