import { NextResponse } from 'next/server'
import { auth } from '@/shared/lib/auth'
import { prisma } from '@/shared/lib/prisma'
import {
  SaveRejectedError,
  deleteSaveRows,
  loadSaveRows,
  writeSaveRows,
} from '@/shared/lib/saveRepository'
import { SAVE_VERSION, validateSave } from '@/core/save/saveFormat'

/**
 * Save do jogo da conta logada (docs/features/044-salvar-o-jogo.md):
 * - `GET` — `{ save }` (ou `{ save: null }` na primeira entrada), como está
 *   no banco; o jogo migra e valida (`migrateSave`);
 * - `PUT` — grava o save (versão atual, validado aqui de novo);
 * - `DELETE` — apaga (ferramenta de debug).
 */

async function resolveUserId(request) {
  const session = await auth.api.getSession({ headers: request.headers })
  return session?.user?.id ?? null
}

const unauthorized = () =>
  NextResponse.json({ error: 'Sessão expirada.' }, { status: 401 })

export async function GET(request) {
  const userId = await resolveUserId(request)
  if (!userId) return unauthorized()
  const save = await loadSaveRows(prisma, userId)
  return NextResponse.json({ save })
}

export async function PUT(request) {
  const userId = await resolveUserId(request)
  if (!userId) return unauthorized()

  const body = await request.json().catch(() => null)
  if (body?.version !== SAVE_VERSION) {
    return NextResponse.json(
      { error: 'Versão do save diferente da do servidor.' },
      { status: 409 },
    )
  }
  const result = validateSave(body)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  try {
    await writeSaveRows(prisma, userId, result.save)
  } catch (error) {
    if (!(error instanceof SaveRejectedError)) throw error
    return NextResponse.json({ error: error.message }, { status: 409 })
  }
  return NextResponse.json({ ok: true })
}

export async function DELETE(request) {
  const userId = await resolveUserId(request)
  if (!userId) return unauthorized()
  await deleteSaveRows(prisma, userId)
  return NextResponse.json({ ok: true })
}
