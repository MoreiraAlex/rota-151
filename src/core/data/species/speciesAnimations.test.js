import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseGlb } from '@/core/animation/gltfAnimation'
import { listSpecies } from './index'

// Os clipes procedurais (`species.clips`) e as animações embutidas
// (`species.nativeAnimations`) contra o `.glb` de verdade de cada espécie.
const WITH_MODEL = listSpecies().filter(({ model }) =>
  model?.path?.endsWith('.glb'),
)

function readRig(species) {
  const { json } = parseGlb(readFileSync(`public${species.model.path}`))
  return {
    bones: new Set(json.skins[0].joints.map((i) => json.nodes[i].name)),
    animations: new Set((json.animations ?? []).map(({ name }) => name)),
  }
}

// Nomes de animação do `.glb` citados por um estado (string, `{ animation }`,
// `{ start, loop, end }` ou `{ sequence: [...] }`).
function animationNames(entry) {
  if (typeof entry === 'string') return [entry]
  if (entry.sequence) return entry.sequence.flatMap(animationNames)
  return ['animation', 'main', 'start', 'loop', 'end']
    .map((key) => entry[key])
    .filter(Boolean)
}

describe('animações das espécies contra o .glb', () => {
  it('todo osso dos clipes procedurais existe no rig da espécie', () => {
    for (const species of WITH_MODEL) {
      const { bones } = readRig(species)
      for (const [clipId, clip] of Object.entries(species.clips ?? {})) {
        for (const bone of Object.keys(clip.bones ?? {})) {
          expect(bones.has(bone), `${species.id}.${clipId}: ${bone}`).toBe(true)
        }
      }
    }
  })

  it('estado com clipe procedural não tem animação embutida (a embutida tocaria no lugar)', () => {
    for (const species of WITH_MODEL) {
      const native = species.nativeAnimations ?? {}
      for (const clipId of Object.keys(species.clips ?? {})) {
        expect(native[clipId], `${species.id}.${clipId}`).toBeUndefined()
      }
    }
  })

  it('toda animação embutida que a espécie aponta existe no .glb', () => {
    for (const species of WITH_MODEL) {
      const { animations } = readRig(species)
      for (const [state, entry] of Object.entries(
        species.nativeAnimations ?? {},
      )) {
        for (const name of animationNames(entry)) {
          expect(animations.has(name), `${species.id}.${state}: ${name}`).toBe(
            true,
          )
        }
      }
    }
  })

  it('no Spearow o chão é procedural e o voo é o voo rasante do .glb', () => {
    const spearow = listSpecies().find(({ id }) => id === 'spearow')
    for (const state of ['walk', 'run']) {
      expect(spearow.clips[state]).toBeDefined()
    }
    for (const state of ['fly', 'flyFast']) {
      expect(spearow.nativeAnimations[state]).toBeDefined()
    }
  })
})
