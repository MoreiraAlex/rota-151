'use client'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { LogOut } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

export default function Logout({ className, variant = 'ghost' }) {
  const router = useRouter()

  let loggingOut = false

  async function handleLogout() {
    if (loggingOut) return
    loggingOut = true

    const logoutPromise = fetch('/api/auth/sign-out', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    }).then((res) => {
      if (!res.ok) throw new Error()
      return res.json()
    })

    toast.promise(logoutPromise, {
      loading: 'Saindo...',
      success: () => {
        router.push('/autenticate/login')
        router.refresh()
        loggingOut = false
        return 'Logout realizado com sucesso'
      },
      error: () => {
        loggingOut = false
        return 'Erro ao sair da conta'
      },
    })
  }

  return (
    <Button
      variant={variant}
      onClick={handleLogout}
      className={cn('p-0 h-6', className)}
    >
      <LogOut className="w-4 mr-2" />
      Sair
    </Button>
  )
}
