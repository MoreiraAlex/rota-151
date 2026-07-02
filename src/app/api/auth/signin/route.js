import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { headers } from 'next/headers'
import { appError, isAppError, mapBetterAuthError } from '@/lib/errors'

export async function POST(req) {
  try {
    const body = await req.json()
    const { cnpj, username, password } = body

    const workshop = await prisma.workshop.findUnique({
      where: {
        cnpj,
      },
    })

    if (!workshop) {
      throw appError('Oficina não encontrada', 404)
    }

    const user = await prisma.user.findUnique({
      where: {
        workshopId_username: {
          workshopId: workshop.id,
          username: username.toLowerCase(),
        },
      },
    })

    if (!user) {
      throw appError('Usuário não encontrado', 401)
    }

    let signIn
    try {
      signIn = await auth.api.signInEmail({
        body: {
          email: user.email,
          password,
        },
        headers: await headers(),
      })
    } catch (err) {
      const mapped = mapBetterAuthError(err)
      if (mapped) throw mapped
      throw err
    }

    if (!signIn?.user) {
      throw appError('Credenciais inválidas', 401)
    }

    return NextResponse.json(signIn, {
      status: 200,
      headers: signIn.headers,
    })
  } catch (error) {
    console.error('LOGIN_ERROR', error)

    if (isAppError(error)) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode },
      )
    }

    return NextResponse.json(
      { error: 'Erro ao entrar no sistema' },
      { status: 500 },
    )
  }
}
