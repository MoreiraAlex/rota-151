import { auth } from '@/shared/lib/auth'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

export const metadata = {
  title: 'Game',
}

export default async function Layout({ children }) {
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  if (!session) {
    redirect('/autenticate/login')
  }

  return <>{children}</>
}
