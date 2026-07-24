'use client'

import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useState } from 'react'
import { authClient } from '@/shared/lib/auth-client'
import Image from 'next/image'

export default function Login() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (loading) return

    setLoading(true)
    const form = e.currentTarget

    const loginPromise = authClient.signIn.username({
      username: form.username.value,
      password: form.password.value,
    })

    toast.promise(loginPromise, {
      loading: 'Validando acesso...',

      success: (result) => {
        setLoading(false)

        if (result.error) {
          throw new Error(result.error.message)
        }

        router.push('/')
        router.refresh()

        return 'Acesso liberado com sucesso'
      },

      error: (error) => {
        setLoading(false)

        return error?.message || 'Usuário ou senha inválidos'
      },
    })
  }

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2 bg-background">
      {/* LOGIN */}
      <div className="flex items-center justify-center px-6">
        <div className="w-full max-w-md">
          <div className="mb-10">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-12 w-12 rounded-full bg-primary flex items-center justify-center shadow-lg">
                <Image
                  src="/logo.png"
                  alt="OS Upflow"
                  width={100}
                  height={100}
                  className="object-contain"
                />
              </div>

              <div>
                <h1 className="text-3xl font-bold tracking-tight">ROTA 151</h1>

                <p className="text-sm text-muted-foreground">
                  Mundo Pokémon Online
                </p>
              </div>
            </div>

            <p className="text-muted-foreground">
              Entre na sua conta e continue sua jornada.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="flex flex-col gap-2">
              <label htmlFor="username">Treinador</label>

              <input
                id="username"
                name="username"
                placeholder="Seu nome de treinador"
                className="p-2 rounded"
                required
              />
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="password">Senha</label>

              <input
                id="password"
                name="password"
                type="password"
                placeholder="Sua senha"
                className="p-2 rounded"
                required
              />
            </div>

            <button
              disabled={loading}
              className="w-full h-12 text-base rounded bg-primary"
              type="submit"
            >
              {loading ? 'Entrando na região...' : 'Iniciar Jornada'}
            </button>
          </form>

          <p className="mt-8 text-xs text-center text-muted-foreground">
            Prepare seus Pokémon. Sua aventura começa agora.
          </p>

          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              Ainda não possui uma conta?
            </p>
            <button
              type="button"
              onClick={() => router.push('/autenticate/signup')}
              className="mt-2 font-semibold text-primary hover:underline transition"
            >
              Criar treinador
            </button>
          </div>
        </div>
      </div>

      {/* HERO */}
      <div className="relative hidden lg:flex items-center justify-center overflow-hidden bg-gradient-to-br from-primary to-primary/70 text-primary-foreground px-16">
        {/* decoração */}
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_top,_white,_transparent_50%)]" />
        <div className="relative max-w-xl">
          <h2 className="text-5xl font-black leading-tight">
            Explore.
            <br />
            Capture.
            <br />
            Evolua.
          </h2>

          <p className="mt-6 text-lg text-primary-foreground/80">
            Uma nova região espera por você. Encontre criaturas raras, enfrente
            treinadores e construa sua própria história.
          </p>

          <div className="mt-10 flex gap-4">
            <div className="rounded-xl bg-white/10 backdrop-blur px-5 py-4">
              <p className="font-bold">151+</p>
              <p className="text-sm">Criaturas</p>
            </div>

            <div className="rounded-xl bg-white/10 backdrop-blur px-5 py-4 ">
              <p className="font-bold">Online</p>
              <p className="text-sm">Mundo vivo</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
