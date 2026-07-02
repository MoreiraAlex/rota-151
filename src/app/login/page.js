'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useState } from 'react'

export default function LoginPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (loading) return

    setLoading(true)
    const form = e.target

    const loginPromise = fetch('/api/auth/signin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: form.username.value,
        password: form.password.value,
      }),
    }).then(async (res) => {
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        throw new Error(data?.error || 'Erro ao realizar login')
      }

      return data
    })

    toast.promise(loginPromise, {
      loading: 'Entrando...',
      success: () => {
        router.push('/')
        router.refresh()
        setLoading(false)

        return 'Login realizado com sucesso'
      },
      error: (error) => {
        setLoading(false)

        return error?.message || 'Erro ao entrar no sistema'
      },
    })
  }

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-10">
      <div className="flex items-center justify-center px-6 lg:col-span-3">
        <div className="w-full max-w-sm">
          <div className="mb-8">
            {/* <Logo width={500} height={200} /> */}

            <p className="mt-1 text-sm text-muted-foreground">
              Acesse sua conta para continuar
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">
                Usuário
              </Label>

              <Input
                id="username"
                name="username"
                type="text"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">
                Senha
              </Label>

              <Input
                id="password"
                name="password"
                type="password"
                required
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full hover:cursor-pointer"
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </Button>
          </form>
        </div>
      </div>


      <div className="hidden lg:flex items-center justify-center bg-primary text-primary-foreground px-12 lg:col-span-7">
        <div className="max-w-md">
          <h3 className="text-3xl font-semibold leading-tight">
            Controle total das ordens
            <br />
            em um único painel
          </h3>


          <p className="mt-4 text-sm text-primary-foreground/80">
            O OS Upflow centraliza a criação, visualização e edição de ordens de
            serviço em um painel simples e organizado, enquanto o WhatsApp cuida
            do atendimento e da automação.
          </p>


          <p className="mt-2 text-sm text-primary-foreground/70">
            Tenha histórico, status e dados sempre à mão — sem perder mensagens
            ou controle do processo.
          </p>
        </div>
      </div>
    </div>
  )
}