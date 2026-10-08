import { describe, expect, it } from 'vitest'
import { SAVE_VERSION, migrateSave, validateSave } from './saveFormat'

// Formato do save (docs/features/044-salvar-o-jogo.md): versão, migração e a
// validação de fronteira. Conteúdo só como dado de teste.
function minimalSave(overrides = {}) {
  return {
    version: SAVE_VERSION,
    trainer: {
      heldItemId: null,
      inventory: { counts: {}, positions: {} },
      pokedex: { speciesIds: [], history: [] },
    },
    pokemon: [],
    ...overrides,
  }
}

describe('validateSave', () => {
  it('aceita um save da versão atual', () => {
    const result = validateSave(minimalSave())
    expect(result.ok).toBe(true)
    expect(result.save).toEqual(minimalSave())
  })

  it('recusa um save sem as partes obrigatórias', () => {
    const withoutTrainer = minimalSave()
    delete withoutTrainer.trainer
    expect(validateSave(withoutTrainer).ok).toBe(false)
  })

  it('recusa um Pokémon com lugar inválido', () => {
    const save = minimalSave({
      pokemon: [
        {
          id: 'a',
          speciesId: 'x',
          ballId: null,
          level: 1,
          xp: 0,
          ivs: {},
          moves: { slots: {}, training: {} },
          storedVitals: null,
          faintTimeLeft: null,
          conditions: null,
          location: { kind: 'ground' },
        },
      ],
    })
    expect(validateSave(save).ok).toBe(false)
  })
})

describe('migrateSave', () => {
  it('save da versão atual passa direto', () => {
    expect(migrateSave(minimalSave()).ok).toBe(true)
  })

  it('save de versão mais nova é recusado com mensagem', () => {
    const result = migrateSave(minimalSave({ version: SAVE_VERSION + 1 }))
    expect(result.ok).toBe(false)
    expect(result.error).toEqual(expect.any(String))
  })

  it('save sem versão é recusado', () => {
    expect(migrateSave({ ...minimalSave(), version: undefined }).ok).toBe(false)
    expect(migrateSave(null).ok).toBe(false)
  })

  it('aplica as migrações em ordem até a versão atual', () => {
    const calls = []
    const migrations = {}
    for (let from = 1; from < SAVE_VERSION; from++) {
      migrations[from] = (data) => {
        calls.push(from)
        return data
      }
    }
    const result = migrateSave(minimalSave({ version: 1 }), migrations)
    expect(result.ok).toBe(true)
    expect(calls).toEqual(Object.keys(migrations).map(Number))
  })
})
