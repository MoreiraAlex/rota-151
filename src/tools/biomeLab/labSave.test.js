import { describe, expect, it } from 'vitest'
import { SAVE_VERSION, saveSchema } from '@/core/save/saveFormat'
import { buildLabSave } from './labSave'

describe('save do laboratório de biomas (066)', () => {
  it('sai na versão atual e válido', () => {
    const save = buildLabSave({ x: 10, z: -20, time: 3.5 })
    expect(save.version).toBe(SAVE_VERSION)
    expect(saveSchema.safeParse(save).success).toBe(true)
  })

  it('o treinador nasce no ponto e na hora pedidos, sem time nem itens', () => {
    const save = buildLabSave({ x: 10, z: -20, yaw: 1, time: 3.5 })
    expect(save.trainer.position).toMatchObject({ x: 10, z: -20, yaw: 1 })
    expect(save.trainer.worldTime).toBe(3.5)
    expect(save.pokemon).toEqual([])
    expect(Object.keys(save.trainer.inventory.counts)).toHaveLength(0)
  })
})
