import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { appError, isAppError, mapBetterAuthError } from '@/lib/errors'

export async function GET() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    })

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        workshop: true,
      },
    })

    // if (!user?.workshopId) {
    //   return NextResponse.json(
    //     { error: 'User has no workshop' },
    //     { status: 400 },
    //   )
    // }

    return NextResponse.json(user, { status: 200 })
  } catch (error) {
    console.error('GET_USER_ERROR', error)

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    )
  }
}

export async function POST(req) {
  let createdUserId = ''

  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    })

    if (!session?.user?.id) {
      throw appError('Não autorizado', 401)
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    })

    if (user?.role !== 'su') {
      throw appError('Acesso negado', 403)
    }

    const body = await req.json()
    const { email, password, username, cnpj, role } = body

    const workshop = await prisma.workshop.findUnique({
      where: { cnpj },
    })

    if (!workshop) {
      throw appError('CNPJ não encontrado', 400)
    }

    const userExists = await prisma.user.findUnique({
      where: {
        workshopId_username: {
          workshopId: workshop.id,
          username: username.toLowerCase(),
        },
      },
    })

    if (userExists) {
      throw appError('Nome de usuário já está em uso', 409)
    }

    let signUp
    try {
      signUp = await auth.api.signUpEmail({
        body: {
          email,
          password,
          username: 'temp',
          name: 'temp',
          displayUsername: 'temp',
        },
      })
    } catch (err) {
      const mapped = mapBetterAuthError(err)
      if (mapped) throw mapped
      throw err
    }

    if (!signUp?.user?.id) {
      throw appError('Falha ao criar usuário', 500)
    }
    createdUserId = signUp.user.id

    await prisma.user.update({
      where: { id: signUp.user.id },
      data: {
        workshopId: workshop.id,
        username: username.toLowerCase(),
        name: username,
        displayUsername: username,
        role,
      },
    })

    const newUser = signUp.user
    return NextResponse.json(newUser, { status: 201 })
  } catch (error) {
    console.error('SIGNUP_ERROR', error)

    if (createdUserId) {
      try {
        await auth.api.deleteUser({
          body: { userId: createdUserId },
        })
        console.log('Compensação: usuário removido')
      } catch (cleanupError) {
        console.error('CLEANUP_ERROR', cleanupError)
      }
    }

    if (isAppError(error)) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode },
      )
    }

    return NextResponse.json(
      { error: 'Falha ao criar usuário' },
      { status: 500 },
    )
  }
}
