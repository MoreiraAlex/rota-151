import { Prisma } from '@prisma/client'

/**
 * Save do jogo no banco (docs/features/044-salvar-o-jogo.md): tabela
 * `trainer` (uma por conta) e `pokemon` (uma linha por Pokémon). Só o
 * servidor usa (`src/app/api/save/route.js`). O formato e a validação são do
 * jogo (`src/core/save/`); aqui é só a tradução save ↔ linhas.
 */

/** Linhas do banco → save (ainda sem migrar nem validar). */
export function rowsToSave(trainer) {
  return {
    version: trainer.saveVersion,
    trainer: {
      position: trainer.position,
      heldItemId: trainer.heldItemId,
      inventory: trainer.inventory,
      pokedex: trainer.pokedex,
    },
    pokemon: trainer.pokemon.map((row) => ({
      id: row.id,
      speciesId: row.speciesId,
      ballId: row.ballId,
      level: row.level,
      xp: row.xp,
      ivs: row.ivs,
      moves: row.moves,
      storedVitals: row.storedVitals,
      faintTimeLeft: row.faintTimeLeft,
      conditions: row.conditions,
      location: row.location,
    })),
  }
}

/** Um Pokémon do save → colunas da linha (sem o dono). */
export function pokemonToRow(saved) {
  return {
    speciesId: saved.speciesId,
    ballId: saved.ballId,
    level: saved.level,
    xp: saved.xp,
    ivs: saved.ivs,
    moves: saved.moves,
    storedVitals: saved.storedVitals ?? Prisma.DbNull,
    faintTimeLeft: saved.faintTimeLeft,
    conditions: saved.conditions ?? Prisma.DbNull,
    location: saved.location,
  }
}

/** O save do usuário, ou `null` se ele ainda não tem. */
export async function loadSaveRows(prisma, userId) {
  const trainer = await prisma.trainer.findUnique({
    where: { userId },
    include: { pokemon: true },
  })
  return trainer ? rowsToSave(trainer) : null
}

/** Erro de save recusado (ex.: Pokémon de outro treinador). */
export class SaveRejectedError extends Error {}

/**
 * Grava o `save` (já validado, versão atual) do usuário numa transação:
 * atualiza o treinador, faz upsert de cada Pokémon pelo id e apaga os que
 * não vieram (soltos, trocados...). Um id que já é de outro treinador recusa
 * o save inteiro.
 */
export async function writeSaveRows(prisma, userId, save) {
  const trainerData = {
    saveVersion: save.version,
    position: save.trainer.position ?? Prisma.DbNull,
    heldItemId: save.trainer.heldItemId,
    inventory: save.trainer.inventory,
    pokedex: save.trainer.pokedex,
  }
  const ids = save.pokemon.map((saved) => saved.id)

  await prisma.$transaction(async (tx) => {
    const trainer = await tx.trainer.upsert({
      where: { userId },
      create: { userId, ...trainerData },
      update: trainerData,
    })

    const foreign = await tx.pokemon.count({
      where: { id: { in: ids }, trainerId: { not: trainer.id } },
    })
    if (foreign > 0) {
      throw new SaveRejectedError('O save tem Pokémon de outro treinador.')
    }

    await tx.pokemon.deleteMany({
      where: { trainerId: trainer.id, id: { notIn: ids } },
    })
    for (const saved of save.pokemon) {
      const row = pokemonToRow(saved)
      await tx.pokemon.upsert({
        where: { id: saved.id },
        create: { id: saved.id, trainerId: trainer.id, ...row },
        update: row,
      })
    }
  })
}

/** Apaga o save do usuário (o treinador e, em cascata, os Pokémon). */
export async function deleteSaveRows(prisma, userId) {
  await prisma.trainer.deleteMany({ where: { userId } })
}
