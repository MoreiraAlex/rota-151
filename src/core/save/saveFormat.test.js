import { describe, expect, it } from 'vitest'
import { GAME_CONFIG } from '../gameConfig'
import { POSTURES } from '../party/posture'
import { DEFAULT_VOLUMES, VOLUME_KEYS } from '../data/audio/mixer'
import {
  DEFAULT_MUSIC_FREQUENCY,
  MUSIC_FREQUENCIES,
} from '../data/audio/musicTracks'
import { SAVE_VERSION, migrateSave, validateSave } from './saveFormat'

// Formato do save (docs/features/044-salvar-o-jogo.md): versão, migração e a
// validação de fronteira. Conteúdo só como dado de teste.
function minimalSave(overrides = {}) {
  return {
    version: SAVE_VERSION,
    trainer: {
      heldItemId: null,
      settings: {
        volume: { ...DEFAULT_VOLUMES },
        musicFrequency: DEFAULT_MUSIC_FREQUENCY,
      },
      inventory: { counts: {}, positions: {} },
      pokedex: { speciesIds: [], history: [] },
    },
    pokemon: [],
    worldItems: { chunks: {}, foraged: {} },
    wildCreatures: [],
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

describe('migração 1 → 2 (itens do mundo, 055)', () => {
  it('save da versão 1 chega à atual com os itens do mundo vazios', () => {
    const { worldItems, ...old } = minimalSave({ version: 1 })

    const result = migrateSave(old)

    expect(worldItems).toBeTruthy()
    expect(result.ok).toBe(true)
    expect(result.save.worldItems).toEqual({ chunks: {}, foraged: {} })
  })

  it('recusa um item do mundo sem id', () => {
    const save = minimalSave({
      worldItems: {
        chunks: {
          '1,2': {
            items: [{ itemId: 'x', x: 0, y: 0, z: 0 }],
            lastRefill: 0,
            nextIndex: 0,
          },
        },
        foraged: {},
      },
    })
    expect(validateSave(save).ok).toBe(false)
  })

  it('save do primeiro desenho da 055 (sem `foraged`) ainda carrega', () => {
    const save = minimalSave({
      worldItems: {
        chunks: {
          '1,2': {
            items: [
              { id: '1,2:0', itemId: 'x', x: 0, y: 0, z: 0, hidden: true },
            ],
            lastRefill: 0,
            nextIndex: 0,
          },
        },
        trees: {},
      },
    })
    const result = validateSave(save)
    expect(result.ok).toBe(true)
    expect(result.save.worldItems.foraged).toEqual({})
  })
})

describe('migração 2 → 3 (condições em lista, 061)', () => {
  const pokemon = (conditions) => ({
    id: 'a',
    speciesId: 'x',
    ballId: null,
    level: 1,
    xp: 0,
    ivs: {},
    moves: { slots: {}, training: {} },
    storedVitals: null,
    faintTimeLeft: null,
    conditions,
    location: { kind: 'party', slot: 'slot1' },
  })

  it('a queimadura da versão 2 vira uma entrada da lista, com o corte do Ataque nos modificadores', () => {
    const burn = {
      timeLeft: 3,
      tickTimer: 1,
      fraction: 0.1,
      interval: 2,
      attackMultiplier: 0.5,
    }
    const old = minimalSave({
      version: 2,
      pokemon: [pokemon({ burn }), pokemon(null)],
    })

    const result = migrateSave(old)

    expect(result.ok).toBe(true)
    const [burned, clean] = result.save.pokemon
    const { attackMultiplier, ...rest } = burn
    expect(burned.conditions).toEqual([
      {
        id: 'burn',
        ...rest,
        to: null,
        modifiers: { attack: attackMultiplier },
      },
    ])
    expect(clean.conditions).toBe(null)
  })
})

describe('migração 3 → 4 (selvagens, 062)', () => {
  it('save da versão 3 chega à atual sem nenhuma selvagem', () => {
    const { wildCreatures, ...old } = minimalSave({ version: 3 })

    const result = migrateSave(old)

    expect(wildCreatures).toBeTruthy()
    expect(result.ok).toBe(true)
    expect(result.save.wildCreatures).toEqual([])
  })

  it('recusa uma selvagem sem espécie', () => {
    const save = minimalSave({
      wildCreatures: [
        {
          x: 0,
          y: 0,
          z: 0,
          rotationY: 0,
          level: 1,
          xp: 0,
          ivs: {},
          temperament: 'peaceful',
          hp: 1,
          stamina: 1,
          faintTimeLeft: null,
          conditions: null,
          age: 0,
        },
      ],
    })
    expect(validateSave(save).ok).toBe(false)
  })
})

describe('migração 4 → 5 (postura, 064)', () => {
  const pokemon = (extra = {}) => ({
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
    location: { kind: 'party', slot: 'slot1' },
    ...extra,
  })

  it('save da versão 4 carrega com todo Pokémon na postura padrão', () => {
    const result = migrateSave(
      minimalSave({ version: 4, pokemon: [pokemon()] }),
    )

    expect(result.ok).toBe(true)
    expect(result.save.pokemon[0].posture).toBe(
      GAME_CONFIG.PARTY_BEHAVIOR.DEFAULT_POSTURE,
    )
  })

  it('aceita toda postura e recusa uma desconhecida', () => {
    for (const posture of POSTURES) {
      expect(
        validateSave(minimalSave({ pokemon: [pokemon({ posture })] })).ok,
      ).toBe(true)
    }
    expect(
      validateSave(minimalSave({ pokemon: [pokemon({ posture: 'furiosa' })] }))
        .ok,
    ).toBe(false)
  })
})

// Volumes do jogador (docs/features/065-sons-do-mundo.md, Parte 1).
describe('ajustes do treinador', () => {
  function withoutSettings(version) {
    const save = minimalSave({ version })
    delete save.trainer.settings
    return save
  }

  it('save da versão 5 carrega com os ajustes padrão', () => {
    const result = migrateSave(withoutSettings(5))

    expect(result.ok).toBe(true)
    expect(result.save.trainer.settings.volume).toEqual(DEFAULT_VOLUMES)
    expect(result.save.trainer.settings.musicFrequency).toBe(
      DEFAULT_MUSIC_FREQUENCY,
    )
  })

  it('ajustes sem a frequência da música ganham a padrão', () => {
    const save = minimalSave()
    delete save.trainer.settings.musicFrequency
    const result = validateSave(save)

    expect(result.ok).toBe(true)
    expect(result.save.trainer.settings.musicFrequency).toBe(
      DEFAULT_MUSIC_FREQUENCY,
    )
  })

  it('aceita toda frequência da música e recusa uma desconhecida', () => {
    for (const musicFrequency of Object.keys(MUSIC_FREQUENCIES)) {
      const save = minimalSave()
      save.trainer.settings.musicFrequency = musicFrequency
      expect(validateSave(save).ok).toBe(true)
    }
    const save = minimalSave()
    save.trainer.settings.musicFrequency = 'nunca-mais'
    expect(validateSave(save).ok).toBe(false)
  })

  it('save da versão atual sem os ajustes é recusado', () => {
    expect(validateSave(withoutSettings(SAVE_VERSION)).ok).toBe(false)
  })

  it('recusa volume fora de 0 a 1 em qualquer chave', () => {
    for (const key of VOLUME_KEYS) {
      for (const value of [-0.1, 1.1]) {
        const save = minimalSave()
        save.trainer.settings.volume[key] = value
        expect(validateSave(save).ok).toBe(false)
      }
    }
  })
})
