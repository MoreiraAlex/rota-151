import { describe, it, expect } from 'vitest'
import { listSpecies } from '@/core/data/species'
import { resolveFireLight } from '@/view/systems/fireLightSystem'
import { formatFireLightSnippet } from './fireLightLabMath'

// Lê o trecho de volta como objeto, do jeito que ele vai parar no index.js.
function parseSnippet(snippet) {
  const body = snippet
    .trim()
    .replace(/^fireLight:\s*/, '')
    .replace(/,$/, '')
  const json = body
    .replace(/'/g, '"')
    .replace(/(\w+):/g, '"$1":')
    .replace(/,(\s*})/g, '$1')
  return JSON.parse(json)
}

describe('formatFireLightSnippet', () => {
  it('colado de volta, reproduz o fireLight de cada espécie que tem um', () => {
    const withLight = listSpecies().filter((s) => s.vfx?.fireLight)
    expect(withLight.length).toBeGreaterThan(0)
    for (const species of withLight) {
      const config = resolveFireLight(species.vfx.fireLight)
      expect(
        resolveFireLight(parseSnippet(formatFireLightSnippet(config))),
      ).toEqual(config)
    }
  })

  it('arredonda os números pra não colar ruído do slider', () => {
    const config = resolveFireLight({ bone: 'tip', intensity: 1 / 3 })
    const parsed = parseSnippet(formatFireLightSnippet(config))
    expect(parsed.intensity).toBe(Number((1 / 3).toFixed(3)))
  })
})
