import { describe, expect, it } from 'vitest'
import { resolveEyeState } from './eyeState'

const AWAKE = { open: { x: 0, y: 0 }, closed: { x: 0, y: 1 } }
const SLEEPING = { open: { x: 1, y: 1 }, closed: { x: 1, y: 1 } }
const FAINT = { open: { x: 2, y: 2 }, closed: { x: 2, y: 2 } }

describe('resolveEyeState', () => {
  it('usa o estado do humor quando a espécie declara', () => {
    expect(resolveEyeState({ awake: AWAKE, faint: FAINT }, 'faint')).toBe(FAINT)
  })

  it('desmaiada sem `faint` declarado usa o olho de dormindo', () => {
    expect(resolveEyeState({ awake: AWAKE, sleeping: SLEEPING }, 'faint')).toBe(
      SLEEPING,
    )
  })

  it('sem o humor nem o parecido, cai no primeiro declarado', () => {
    expect(resolveEyeState({ awake: AWAKE }, 'faint')).toBe(AWAKE)
    expect(resolveEyeState({ awake: AWAKE, sleeping: SLEEPING }, 'angry')).toBe(
      AWAKE,
    )
  })
})
