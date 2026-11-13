import { z } from 'zod'
import { POSTURES } from '../party/posture'
import { GAME_CONFIG } from '../gameConfig'
import { DEFAULT_VOLUMES, VOLUME_KEYS } from '../data/audio/mixer'
import {
  DEFAULT_MUSIC_FREQUENCY,
  MUSIC_FREQUENCIES,
} from '../data/audio/musicTracks'
import { PARTY_SLOT_IDS } from '../traits'

/**
 * Formato do save (docs/features/044-salvar-o-jogo.md): o que vai pro banco e
 * volta dele. Toda versão nova do formato sobe `SAVE_VERSION` e ganha uma
 * migração em `MIGRATIONS` (da versão anterior pra ela) — save antigo passa
 * por todas, em ordem; save de versão desconhecida é recusado.
 *
 * O schema é a fronteira: o adapter (cliente) e a rota da API (servidor)
 * validam com ele antes de o dado entrar no jogo ou no banco.
 */
export const SAVE_VERSION = 8

const numberRecord = z.record(z.string(), z.number())

// Os gráficos de quem nunca mexeu (docs/features/066-revisao-dos-biomas.md).
const defaultGraphics = () => ({
  shadow: GAME_CONFIG.GRAPHICS.SHADOW.DEFAULT,
  aspect: GAME_CONFIG.GRAPHICS.ASPECT.DEFAULT,
  canvasScale: GAME_CONFIG.GRAPHICS.CANVAS_SIZE.DEFAULT,
  viewDistance: GAME_CONFIG.GRAPHICS.VIEW_DISTANCE.DEFAULT,
})

// Uma condição guardada (a mesma forma das entradas de `Conditions`).
const conditionSchema = z.object({
  id: z.string().min(1),
  timeLeft: z.number(),
  tickTimer: z.number(),
  fraction: z.number(),
  interval: z.number(),
  to: z.enum(['source']).nullable(),
  modifiers: numberRecord,
})

const moveSlotSchema = z
  .object({ id: z.string().min(1), mastery: z.number() })
  .nullable()

export const pokemonSaveSchema = z.object({
  id: z.string().min(1).max(64),
  speciesId: z.string().min(1),
  ballId: z.string().nullable(),
  level: z.number().int().min(1),
  xp: z.number().int().min(0),
  ivs: numberRecord,
  moves: z.object({
    slots: z.record(z.string(), moveSlotSchema),
    training: numberRecord,
    // Golpes novos que o jogador ainda não viu no Treino (o marcador "novo",
    // docs/features/067-campo-de-treino-e-avisos-de-nivel.md).
    unseen: z.array(z.string().min(1)),
  }),
  storedVitals: numberRecord.nullable(),
  faintTimeLeft: z.number().min(0).nullable(),
  conditions: z.array(conditionSchema).nullable(),
  posture: z.enum(POSTURES),
  location: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('party'), slot: z.enum(PARTY_SLOT_IDS) }),
    z.object({ kind: z.literal('inventory'), cell: z.number().int().min(0) }),
  ]),
})

export const trainerSaveSchema = z.object({
  // Opcional: saves de antes da posição entrar começam no ponto inicial.
  position: z
    .object({ x: z.number(), y: z.number(), z: z.number(), yaw: z.number() })
    .nullable()
    .optional(),
  // Dentro de um prédio (docs/features/068-interior-dos-predios.md): a sala
  // e a porta por onde entrou (`Indoors`) — a posição é a de dentro dela.
  // Opcional: fora, ou saves de antes, sem.
  indoors: z
    .object({
      interiorId: z.string(),
      door: z.object({
        x: z.number(),
        y: z.number(),
        z: z.number(),
        yaw: z.number(),
        scale: z.number().positive(),
      }),
    })
    .nullable()
    .optional(),
  // No mapa de uma cidade copiada (docs/features/069-revisao-do-bioma-
  // cidade.md — Pallet): o mapa, o lugar dele e de onde o treinador veio
  // (`OnTownMap`) — a posição é a de dentro dele. Opcional: fora, ou saves
  // de antes, sem.
  townMap: z
    .object({
      mapId: z.string(),
      place: z.object({
        x: z.number(),
        y: z.number(),
        z: z.number(),
        scale: z.number().positive(),
      }),
      from: z.object({
        x: z.number(),
        y: z.number(),
        z: z.number(),
        yaw: z.number(),
      }),
    })
    .nullable()
    .optional(),
  heldItemId: z.string().nullable(),
  // Horário do mundo em dias de jogo (docs/features/048-dia-noite-e-
  // clima.md). Opcional: saves de antes dele começam no horário inicial.
  worldTime: z.number().min(0).nullable().optional(),
  inventory: z.object({
    counts: z.record(z.string(), z.number().int().min(0)),
    positions: z.record(z.string(), z.number().int().min(0)),
  }),
  // Ajustes do jogador (docs/features/065-sons-do-mundo.md): o volume
  // geral e o de cada canal (`core/data/audio/mixer.js`) e a frequência da
  // música (`musicTracks.js`).
  settings: z.object({
    volume: z.object(
      Object.fromEntries(
        VOLUME_KEYS.map((key) => [key, z.number().min(0).max(1)]),
      ),
    ),
    musicFrequency: z
      .enum(Object.keys(MUSIC_FREQUENCIES))
      .default(DEFAULT_MUSIC_FREQUENCY),
    // Gráficos (docs/features/066-revisao-dos-biomas.md): o nível da
    // sombra, a proporção e o tamanho do canvas e a distância de visão
    // (`GAME_CONFIG.GRAPHICS`).
    // Um valor que deixou de valer (ou ainda não existia no save) volta ao
    // padrão; o que saiu do formato (a antiga resolução) é ignorado.
    graphics: z.object({
      shadow: z
        .enum(Object.keys(GAME_CONFIG.GRAPHICS.SHADOW.LEVELS))
        .catch(GAME_CONFIG.GRAPHICS.SHADOW.DEFAULT),
      aspect: z
        .enum(Object.keys(GAME_CONFIG.GRAPHICS.ASPECT.LEVELS))
        .catch(GAME_CONFIG.GRAPHICS.ASPECT.DEFAULT),
      canvasScale: z
        .number()
        .min(GAME_CONFIG.GRAPHICS.CANVAS_SIZE.MIN)
        .max(1)
        .catch(GAME_CONFIG.GRAPHICS.CANVAS_SIZE.DEFAULT),
      viewDistance: z
        .number()
        .int()
        .min(GAME_CONFIG.GRAPHICS.VIEW_DISTANCE.MIN)
        .max(GAME_CONFIG.GRAPHICS.VIEW_DISTANCE.MAX)
        .catch(GAME_CONFIG.GRAPHICS.VIEW_DISTANCE.DEFAULT),
    }),
  }),
  pokedex: z.object({
    speciesIds: z.array(z.string()),
    history: z.array(
      z.object({
        speciesId: z.string(),
        individualValues: numberRecord,
        level: z.number().int().min(1),
      }),
    ),
  }),
})

// Os itens do mundo que o jogador mexeu (docs/features/055-itens-no-
// mundo.md, `WorldItemsMemory`): os que restam no chão de cada chunk mexido
// e os arbustos e árvores colhidos hoje.
const worldItemSaveSchema = z.object({
  id: z.string().min(1).max(64),
  itemId: z.string().min(1),
  x: z.number(),
  y: z.number(),
  z: z.number(),
})

export const worldItemsSaveSchema = z.object({
  chunks: z.record(
    z.string().max(32),
    z.object({
      items: z.array(worldItemSaveSchema).max(64),
      lastRefill: z.number(),
      nextIndex: z.number().int().min(0),
    }),
  ),
  // Opcional: os saves do primeiro desenho da 055 não têm.
  foraged: z.record(z.string().max(64), z.number().int()).default({}),
})

// As selvagens vivas no mundo (docs/features/062-spawn-estilo-
// cobblemon.md, `wildCreaturesSave.js`).
export const wildCreatureSaveSchema = z.object({
  speciesId: z.string().min(1),
  x: z.number(),
  y: z.number(),
  z: z.number(),
  rotationY: z.number(),
  level: z.number().int().min(1),
  xp: z.number().int().min(0),
  ivs: numberRecord,
  temperament: z.enum(['hostile', 'peaceful']),
  hp: z.number().min(0),
  stamina: z.number().min(0),
  faintTimeLeft: z.number().min(0).nullable(),
  conditions: z.array(conditionSchema).nullable(),
  age: z.number().min(0),
})

export const saveSchema = z.object({
  version: z.literal(SAVE_VERSION),
  trainer: trainerSaveSchema,
  pokemon: z.array(pokemonSaveSchema),
  worldItems: worldItemsSaveSchema,
  wildCreatures: z.array(wildCreatureSaveSchema).max(64),
})

/**
 * Migrações por versão de origem: `MIGRATIONS[n]` leva um save da versão `n`
 * pra `n + 1`.
 *
 * - 1 → 2 (docs/features/055-itens-no-mundo.md): entram os itens do mundo,
 *   começando sem nada mexido.
 * - 2 → 3 (docs/features/061-revisao-das-skills.md): as condições viram uma
 *   lista (`{ burn }` → `[{ id: 'burn', ... }]`).
 * - 3 → 4 (docs/features/062-spawn-estilo-cobblemon.md): entram as
 *   selvagens, começando sem nenhuma (o spawn povoa).
 * - 4 → 5 (docs/features/064-revisao-da-ia-do-parceiro.md): entra a
 *   postura de cada Pokémon, começando na padrão.
 * - 5 → 6 (docs/features/065-sons-do-mundo.md): entram os ajustes do
 *   treinador, com os volumes e a frequência da música padrão.
 * - 6 → 7 (docs/features/066-revisao-dos-biomas.md): entram os gráficos
 *   nos ajustes, com os padrão.
 * - 7 → 8 (docs/features/067-campo-de-treino-e-avisos-de-nivel.md): entram
 *   os golpes novos não vistos de cada Pokémon, começando sem nenhum.
 */
const MIGRATIONS = {
  1: (save) => ({ ...save, worldItems: { chunks: {}, foraged: {} } }),
  2: (save) => ({
    ...save,
    pokemon: (save.pokemon ?? []).map((pokemon) => ({
      ...pokemon,
      conditions: migrateLegacyConditions(pokemon.conditions),
    })),
  }),
  3: (save) => ({ ...save, wildCreatures: [] }),
  4: (save) => ({
    ...save,
    pokemon: (save.pokemon ?? []).map((pokemon) => ({
      ...pokemon,
      posture: pokemon.posture ?? GAME_CONFIG.PARTY_BEHAVIOR.DEFAULT_POSTURE,
    })),
  }),
  5: (save) => ({
    ...save,
    trainer: {
      ...save.trainer,
      settings: save.trainer?.settings ?? {
        volume: { ...DEFAULT_VOLUMES },
        musicFrequency: DEFAULT_MUSIC_FREQUENCY,
      },
    },
  }),
  6: (save) => ({
    ...save,
    trainer: {
      ...save.trainer,
      settings: {
        ...save.trainer?.settings,
        graphics: save.trainer?.settings?.graphics ?? defaultGraphics(),
      },
    },
  }),
  7: (save) => ({
    ...save,
    pokemon: (save.pokemon ?? []).map((pokemon) => ({
      ...pokemon,
      moves: { ...pokemon.moves, unseen: pokemon.moves?.unseen ?? [] },
    })),
  }),
}

// `{ burn: { ..., attackMultiplier } }` (versão 2) → a lista da versão 3.
function migrateLegacyConditions(conditions) {
  const burn = conditions?.burn
  if (!burn) return null
  const { attackMultiplier, ...rest } = burn
  return [
    { id: 'burn', ...rest, to: null, modifiers: { attack: attackMultiplier } },
  ]
}

/**
 * Leva um save (já lido do banco, sem validar) até a versão atual e valida.
 * Devolve `{ ok: true, save }` ou `{ ok: false, error }` com uma mensagem
 * pra mostrar ao jogador.
 */
export function migrateSave(raw, migrations = MIGRATIONS) {
  const version = raw?.version
  if (!Number.isInteger(version) || version < 1) {
    return { ok: false, error: 'O save não tem uma versão válida.' }
  }
  if (version > SAVE_VERSION) {
    return {
      ok: false,
      error: `O save é de uma versão mais nova do jogo (${version}).`,
    }
  }

  let data = raw
  for (let from = version; from < SAVE_VERSION; from++) {
    const migrate = migrations[from]
    if (!migrate) {
      return {
        ok: false,
        error: `Não há como atualizar o save da versão ${from}.`,
      }
    }
    data = { ...migrate(data), version: from + 1 }
  }

  return validateSave(data)
}

/** Valida um save da versão atual: `{ ok: true, save }` ou `{ ok: false, error }`. */
export function validateSave(data) {
  const parsed = saveSchema.safeParse(data)
  if (!parsed.success) {
    return { ok: false, error: 'O save está corrompido ou incompleto.' }
  }
  return { ok: true, save: parsed.data }
}
