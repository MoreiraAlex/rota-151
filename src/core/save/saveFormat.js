import { z } from 'zod'
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
export const SAVE_VERSION = 1

const numberRecord = z.record(z.string(), z.number())

const burnSchema = z.object({
  timeLeft: z.number(),
  tickTimer: z.number(),
  fraction: z.number(),
  interval: z.number(),
  attackMultiplier: z.number(),
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
  }),
  storedVitals: numberRecord.nullable(),
  faintTimeLeft: z.number().min(0).nullable(),
  conditions: z.object({ burn: burnSchema.nullable() }).nullable(),
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
  heldItemId: z.string().nullable(),
  inventory: z.object({
    counts: z.record(z.string(), z.number().int().min(0)),
    positions: z.record(z.string(), z.number().int().min(0)),
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

export const saveSchema = z.object({
  version: z.literal(SAVE_VERSION),
  trainer: trainerSaveSchema,
  pokemon: z.array(pokemonSaveSchema),
})

/**
 * Migrações por versão de origem: `MIGRATIONS[n]` leva um save da versão `n`
 * pra `n + 1`. Vazio enquanto só existe a versão 1.
 */
const MIGRATIONS = {}

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
