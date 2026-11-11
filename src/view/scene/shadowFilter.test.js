import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { installShadowFilter } from './shadowFilter'

// Leitura da sombra mais barata (docs/features/066-revisao-dos-biomas.md).
describe('installShadowFilter', () => {
  const fresh = () => ({ ...THREE.ShaderChunk })

  it('acha o filtro do three e põe o caminho de uma leitura antes dele', () => {
    const chunks = fresh()
    const original = chunks.shadowmap_pars_fragment

    expect(installShadowFilter(chunks)).toBe(true)

    const patched = chunks.shadowmap_pars_fragment
    expect(patched).toContain('SHADOW_SINGLE_TAP')
    expect(patched).toContain('shadowRadius <= 0.0')
    // O filtro original continua lá, inteiro, no outro caminho.
    const filterStart = original.indexOf('float phi = interleavedGradientNoise')
    const filterEnd = original.indexOf(') * 0.2;', filterStart)
    expect(patched).toContain(original.slice(filterStart, filterEnd))
  })

  it('rodar de novo não muda nada', () => {
    const chunks = fresh()
    installShadowFilter(chunks)
    const once = chunks.shadowmap_pars_fragment

    installShadowFilter(chunks)

    expect(chunks.shadowmap_pars_fragment).toBe(once)
  })

  it('sem o filtro conhecido, deixa o trecho como está', () => {
    const chunks = {
      shadowmap_pars_fragment: 'float getShadow() { return 1.0; }',
    }
    const warn = console.warn
    console.warn = () => {}
    try {
      expect(installShadowFilter(chunks)).toBe(false)
    } finally {
      console.warn = warn
    }
    expect(chunks.shadowmap_pars_fragment).toBe(
      'float getShadow() { return 1.0; }',
    )
  })
})
