import { authServer } from '../src/lib/auth.js'
import { prisma } from '../src/lib/prisma.js'

async function createBotN8N() {
  try {
    const bot = await prisma.user.findUnique({
      where: {
        email: 'bot@osupflow.com',
      },
    })

    if (bot) {
      console.log('Bot ja criado')
      return
    }

    await authServer.api.signUpEmail({
      body: {
        email: 'bot@osupflow.com',
        password: process.env.BOT_PASSWORD,
        username: 'bot',
        name: 'bot',
        displayUsername: 'bot',
      },
    })
  } catch (err) {
    console.error(err)
  }
}

async function createSuperUser() {
  try {
    const superUser = await prisma.user.findUnique({
      where: {
        email: 'admin@osupflow.com',
      },
    })

    if (superUser) {
      console.log('Super User ja criado')
      return
    }

    const signUp = await authServer.api.signUpEmail({
      body: {
        email: 'admin@osupflow.com',
        password: process.env.SUPERUSER_PASSWORD,
        username: 'admin',
        name: 'admin',
        displayUsername: 'admin',
      },
    })

    await prisma.user.update({
      where: { id: signUp.user.id },
      data: { role: 'su' },
    })
  } catch (err) {
    console.error(err)
  }
}

async function main() {
  await createBotN8N()
  await createSuperUser()
}

main().catch((e) => {
  console.error('Erro no seed:', e)
  process.exit(1)
})
