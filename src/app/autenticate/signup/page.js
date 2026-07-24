'use client'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useState } from 'react'
import { authClient } from '@/shared/lib/auth-client'
import Image from 'next/image'

export default function SignupPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (loading) return

    setLoading(true)
    const form = e.currentTarget

    const signupPromise = authClient.signUp.email({
      email: form.email.value,
      name: form.username.value,
      password: form.password.value,
      username: form.username.value,
      displayUsername: form.username.value,
    })

    toast.promise(signupPromise, {
      loading: 'Criando treinador...',

      success: (result) => {
        setLoading(false)

        if (result.error) {
          throw new Error(result.error.message)
        }

        router.push('/')
        router.refresh()

        return 'Sua jornada começou!'
      },

      error: (error) => {
        setLoading(false)

        return error?.message || 'Erro ao criar conta'
      },
    })
  }

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2 bg-background">
      {/* FORM */}
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
                <h1 className="text-3xl font-bold">ROTA 151</h1>
                <p className="text-sm text-muted-foreground">Novo treinador</p>
              </div>
            </div>

            <p className="text-muted-foreground">
              Crie sua conta e comece sua aventura.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex flex-col gap-2">
              <label htmlFor="username">Nome do treinador</label>
              <input
                id="username"
                name="username"
                placeholder="Escolha seu nome"
                required
                className="p-2 rounded"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                name="email"
                type="email"
                placeholder="email@exemplo.com"
                required
                className="p-2 rounded"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="password">Senha</label>
              <input
                id="password"
                name="password"
                type="password"
                placeholder="Crie uma senha"
                required
                className="p-2 rounded"
              />
            </div>

            <button
              disabled={loading}
              className="w-full h-12 text-base rounded bg-primary"
              type="submit"
            >
              {loading ? 'Preparando aventura...' : 'Criar treinador'}
            </button>
          </form>

          <p className="mt-8 text-center text-xs text-muted-foreground">
            Seu primeiro passo rumo à Rota 151.
          </p>

          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              Já possui um treinador?
            </p>
            <button
              type="button"
              onClick={() => router.push('/autenticate/login')}
              className="mt-2 font-semibold text-primary hover:underline transition"
            >
              Voltar para login
            </button>
          </div>
        </div>
      </div>

      {/* HERO */}
      <div className="hidden lg:flex items-center justify-center overflow-hidden px-16 text-primary-foreground bg-gradient-to-br from-primary to-primary/70">
        <div className="max-w-xl">
          <h2 className="text-5xl font-black leading-tight">
            Uma nova
            <br />
            aventura
            <br />
            começa aqui
          </h2>

          <p className="mt-6 text-lg text-primary-foreground/80">
            Escolha seu nome, monte sua equipe e explore uma região cheia de
            desafios, descobertas e criaturas únicas.
          </p>

          <div className="mt-10 grid grid-cols-3 gap-4">
            <div className="bg-white/10 rounded-xl p-4">
              <p className="font-bold text-xl">151</p>
              <p className="text-sm">Criaturas</p>
            </div>

            <div className="bg-white/10 rounded-xl p-4">
              <p className="font-bold text-xl">PvE</p>
              <p className="text-sm">Batalhas</p>
            </div>

            <div className="bg-white/10 rounded-xl p-4">
              <p className="font-bold text-xl">MMO</p>
              <p className="text-sm">Mundo</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
