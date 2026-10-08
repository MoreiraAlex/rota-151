'use client'

import Image from 'next/image'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useProgress } from '@react-three/drei'
import { GAME_CONFIG } from '@/core/gameConfig'
import { LOADING_WALLPAPERS } from './loadingWallpapers'
import { loadingProgress, resolveLoadingFraction } from './loadingProgress'

const MODELS_LABEL = 'Baixando modelos 3D…'
const SCENE_LABEL = 'Montando o mundo…'

/**
 * Tela de carregamento (docs/features/044-salvar-o-jogo.md): um fundo
 * sorteado (troca a cada `GAME_CONFIG.LOADING.WALLPAPER_INTERVAL` s, com
 * fade), o que está carregando agora e a barra com a porcentagem — etapas do
 * jogo (`loadingProgress`) + arquivos do three.js (`useProgress`).
 *
 * Com `error`, mostra a mensagem e "Tentar de novo" (`onRetry`) no lugar da
 * barra.
 */
export function LoadingScreen({ error = null, onRetry = null }) {
  const wallpaper = useWallpaperRotation()
  const steps = useSyncExternalStore(
    loadingProgress.subscribe,
    loadingProgress.getSnapshot,
    loadingProgress.getSnapshot,
  )
  const assets = useProgress()

  // A conta pode recuar quando um arquivo novo entra na fila — a barra não.
  const highest = useRef(0)
  const fraction = resolveLoadingFraction(steps, assets)
  highest.current = Math.max(highest.current, fraction)
  // 100% só quando a tela some (a cena ainda monta depois dos arquivos).
  const percent = Math.min(99, Math.round(highest.current * 100))

  const label = steps.pending[0] ?? (assets.active ? MODELS_LABEL : SCENE_LABEL)

  return (
    <div className="relative h-full min-h-screen w-full overflow-hidden bg-black text-white">
      {LOADING_WALLPAPERS.map((entry, index) => (
        <Image
          key={entry.path}
          src={entry.path}
          alt=""
          fill
          sizes="100vw"
          priority
          className="object-cover transition-opacity duration-1000"
          style={{
            objectPosition: entry.position,
            opacity: index === wallpaper ? 1 : 0,
          }}
        />
      ))}

      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/50 to-transparent px-4 pb-8 pt-24 sm:px-10">
        <div className="mx-auto flex max-w-2xl flex-col gap-3">
          <p className="text-2xl font-bold tracking-wide drop-shadow">
            Rota 151
          </p>

          {error ? (
            <div className="flex flex-col items-start gap-3">
              <p className="text-sm text-red-200">
                Não deu pra carregar o seu jogo. {error}
              </p>
              {onRetry && (
                <button
                  type="button"
                  className="rounded bg-white/15 px-4 py-2 text-sm hover:bg-white/25"
                  onClick={onRetry}
                >
                  Tentar de novo
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="flex items-baseline justify-between text-sm text-white/80">
                <span>{label}</span>
                <span className="tabular-nums">{percent}%</span>
              </div>
              <div
                className="h-2 w-full overflow-hidden rounded-full bg-white/20"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={percent}
              >
                <div
                  className="h-full rounded-full bg-yellow-400 transition-[width] duration-300"
                  style={{ width: `${percent}%` }}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Índice do fundo visível: sorteado ao montar (no cliente — no servidor fica
 * `null`, tela preta, pra não divergir na hidratação) e trocado a cada
 * `WALLPAPER_INTERVAL` segundos.
 */
function useWallpaperRotation() {
  const [index, setIndex] = useState(null)

  useEffect(() => {
    const count = LOADING_WALLPAPERS.length
    if (count === 0) return
    setIndex(Math.floor(Math.random() * count))
    if (count < 2) return
    const timer = setInterval(
      () => setIndex((current) => ((current ?? 0) + 1) % count),
      GAME_CONFIG.LOADING.WALLPAPER_INTERVAL * 1000,
    )
    return () => clearInterval(timer)
  }, [])

  return index
}
