import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { buscarCNPJ } from '@/lib/utils'
import { appError, isAppError, mapBetterAuthError } from '@/lib/errors'

export async function POST(req) {
  let createdUserId = ''

  try {
    const body = await req.json()
    const { email, password, username, cnpj, token } = body

    if (!token) {
      throw appError('Token obrigatório', 400)
    }

    const invite = await prisma.invite.findUnique({
      where: { token },
    })

    const now = new Date()
    const expiresAt = new Date(invite?.expiresAt)

    if (!invite || invite.used || expiresAt < now) {
      throw appError('Convite inválido ou expirado', 400)
    }

    const workshopExists = await prisma.workshop.findUnique({
      where: { cnpj },
    })

    if (workshopExists) {
      throw appError('CNPJ já existe', 400)
    }

    const cnpjData = await buscarCNPJ(cnpj)

    if (!cnpjData) {
      throw appError('CNPJ não encontrado na Receita', 400)
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

    await prisma.$transaction(async (tx) => {
      const workshop = await tx.workshop.create({
        data: {
          cnpj,
          name: cnpjData.name,
          fantasyName: cnpjData.fantasyName,
          email: cnpjData.email,
          phone: cnpjData.phone,
          address: cnpjData.address,
          number: cnpjData.number,
          district: cnpjData.district,
          city: cnpjData.city,
          state: cnpjData.state,
          zipCode: cnpjData.zipCode,
        },
      })

      await tx.user.update({
        where: { id: signUp.user.id },
        data: {
          workshopId: workshop.id,
          username: username.toLowerCase(),
          name: username,
          displayUsername: username,
          role: 'admin',
        },
      })

      await tx.invite.update({
        where: { token },
        data: { used: true },
      })

      return workshop
    })

    return NextResponse.json(signUp.user, { status: 201 })
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
