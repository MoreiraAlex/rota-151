import { existsSync } from 'node:fs'
import { describe, it, expect } from 'vitest'
import { listItems } from '@/core/data/items'
import {
  CAPTURE_TEXTURE_PATHS,
  SEND_OUT_PROFILES,
  buildCaptureEmitters,
  buildSendOutEmitters,
  listPokeballVfxTexturePaths,
  resolveSendOutProfile,
  resolveSendOutTexturePaths,
} from './pokeballVfx'

function expectWellFormed(emitters, textureKeys) {
  for (const emitter of emitters) {
    expect(textureKeys).toContain(emitter.texture)
    expect(emitter.strip).toBeGreaterThan(0)
    expect(emitter.frames.count).toBeLessThanOrEqual(emitter.strip)
    expect(typeof emitter.size).toBe('function')
    expect(emitter.size(0, Array(10).fill(0.5))).toBeGreaterThan(0)
    expect(
      emitter.burst !== undefined || typeof emitter.rate === 'function',
    ).toBe(true)
  }
}

describe('partículas da Pokébola', () => {
  it('toda textura citada existe em public/', () => {
    for (const path of listPokeballVfxTexturePaths()) {
      expect(existsSync(`public${path}`)).toBe(true)
    }
  })

  it('o envio de cada bola usa as texturas dela; bola sem perfil usa a Poké Bola', () => {
    for (const item of listItems().filter((i) => i.category === 'pokeball')) {
      const emitters = buildSendOutEmitters(resolveSendOutProfile(item.id))
      expectWellFormed(
        emitters,
        Object.keys(resolveSendOutTexturePaths(item.id)),
      )
    }
    expect(resolveSendOutProfile('nao-existe')).toBe(
      SEND_OUT_PROFILES['poke-ball'],
    )
    expect(resolveSendOutTexturePaths('nao-existe')).toEqual(
      resolveSendOutTexturePaths('poke-ball'),
    )
  })

  it('o "Capturado!" usa as texturas da captura', () => {
    expectWellFormed(buildCaptureEmitters(), Object.keys(CAPTURE_TEXTURE_PATHS))
  })
})
