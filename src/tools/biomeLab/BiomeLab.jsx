'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { GameCanvas } from '@/view/scene/GameCanvas'
import { WorldProvider } from '@/core/world/WorldProvider'
import { GAME_CONFIG } from '@/core/gameConfig'
import { TEST_LEVEL } from '@/core/data/testLevel'
import { listBiomes } from '@/core/data/biomes'
import { playerEntity, world } from '@/core/world/world'
import {
  definirGeradorDeUid,
  definirVelocidadeDoRelogio,
  forcarClima,
  prepararTreinador,
} from '@/core/actions'
import { initPhysics } from '@/core/physics/physicsWorld'
import { createPokemonUid } from '@/platform/persistence/pokemonUid'
import { GameLoop } from '@/view/loop/GameLoop'
import { FrameLimiter } from '@/view/scene/FrameLimiter'
import { GameScene } from '@/view/scene/GameScene'
import { SceneReady } from '@/view/scene/SceneReady'
import { preloadGameAssets } from '@/view/preload/preloadGameAssets'
import {
  GAME_PACKS_DIR,
  LAB_PACKS_DIR,
  loadVegetationPacks,
} from '@/view/vegetation/vegetationPacks'
import { preloadVegetationModels } from '@/view/vegetation/useVegetationModels'
import { TerrainTuningPanel } from '@/tools/debug/TerrainTuningPanel'
import { DayWeatherPanel } from '@/tools/debug/DayWeatherPanel'
import { VegetationPanel } from '@/tools/debug/VegetationPanel'
import { CameraPanel } from '@/tools/debug/CameraPanel'
import { BiomeLabPanel } from './BiomeLabPanel'
import { BiomeLabRig } from './BiomeLabRig'
import { LAB_BIOMES, findBiomePoints } from './labPoints'
import { buildLabSave } from './labSave'
import { labState } from './labState'
import { snapshotOf } from './labValues'

// Hora de abrir (0–24) e o dia de jogo (o clima sorteia pelo tempo total).
const START_HOUR = 10.5
const START_DAY = 3

// Os pacotes do jogo (os modelos que os biomas usam) e, por cima, os
// inteiros do lab (`scripts/lab/`), quando houver.
async function loadPacks() {
  const game = await loadVegetationPacks(GAME_PACKS_DIR)
  const lab = await loadVegetationPacks(LAB_PACKS_DIR)
  preloadVegetationModels()
  const labIds = new Set(lab.map(({ id }) => id))
  return [...game.filter(({ id }) => !labIds.has(id)), ...lab]
}

/**
 * Laboratório de biomas (docs/features/066-revisao-dos-biomas.md, Parte
 * 3): a cena do jogo (`GameScene`) num ponto fixo de um bioma, sem login,
 * save, HUD nem time em campo, ocupando a tela ao lado do painel do lab
 * (luz, cor, câmeras, captura, grama, árvores, relevo, montanhas). F2 liga os painéis de ajuste do jogo
 * (terreno, dia e clima, vegetação, câmera) por cima.
 *
 * Abre com o relógio parado, tempo limpo e sem selvagens nascendo, para a
 * cena ficar igual entre um ajuste e outro.
 */
export function BiomeLab() {
  const [boot, setBoot] = useState({ status: 'loading', error: null })
  const [lab, setLab] = useState(null)
  const [sceneReady, setSceneReady] = useState(false)
  const [showDebug, setShowDebug] = useState(false)
  const [panelContainer, setPanelContainer] = useState(null)
  const sceneRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    GAME_CONFIG.WILD_SPAWN.ENABLED = false
    definirGeradorDeUid(() => createPokemonUid())
    const points = findBiomePoints(TEST_LEVEL.terrain, LAB_BIOMES)
    const start = points[labState.point] ?? Object.values(points).find(Boolean)
    Promise.all([
      loadPacks(),
      initPhysics().then(
        () => true,
        () => false,
      ),
      preloadGameAssets(),
    ])
      .then(([packs, physicsLoaded]) => {
        if (cancelled) return
        if (!physicsLoaded) {
          setBoot({ status: 'error', error: 'A física do jogo não carregou.' })
          return
        }
        if (!start) {
          setBoot({
            status: 'error',
            error: 'Nenhum bioma achado perto da origem.',
          })
          return
        }
        prepararTreinador(
          world,
          playerEntity,
          buildLabSave({ ...start, time: START_DAY + START_HOUR / 24 }),
        )
        definirVelocidadeDoRelogio(world, 0)
        forcarClima(world, 'clear')
        // A cópia para o "Copiar valores": o config e os biomas como estão
        // ao abrir (já com as escolhas do lab).
        const snapshot = snapshotOf({
          config: GAME_CONFIG,
          biomes: Object.fromEntries(listBiomes().map((b) => [b.id, b])),
        })
        setLab({ points, packs, snapshot })
        setBoot({ status: 'ready', error: null })
      })
      .catch((error) => {
        if (!cancelled) setBoot({ status: 'error', error: String(error) })
      })
    return () => {
      cancelled = true
    }
  }, [])

  // F2 liga os painéis de ajuste do jogo.
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.code !== 'F2') return
      event.preventDefault()
      setShowDebug((current) => !current)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // A cena em PNG, no tamanho em que está na tela.
  const capture = useCallback(() => {
    const canvas = sceneRef.current?.querySelector('canvas')
    canvas?.toBlob((blob) => {
      if (!blob) return
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = `lab-bioma-${labState.point}-${Date.now()}.png`
      link.click()
      setTimeout(() => URL.revokeObjectURL(link.href), 1000)
    }, 'image/png')
  }, [])

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-neutral-900 text-neutral-200">
      {/* O painel do lab numa coluna própria, sem cobrir a cena. */}
      <div
        ref={setPanelContainer}
        className="h-full w-[260px] shrink-0 overflow-y-auto"
      />

      {/* A cena ocupa o resto da tela. */}
      <div ref={sceneRef} className="relative h-full min-w-0 flex-1 bg-black">
        {boot.status === 'ready' && (
          <WorldProvider>
            <GameCanvas
              shadows
              frameloop="never"
              gl={{
                antialias: GAME_CONFIG.RENDER.MSAA,
                // Para o "Capturar" ler a imagem depois de desenhada.
                preserveDrawingBuffer: true,
              }}
            >
              <FrameLimiter />
              <GameLoop castModeOverride={null} />
              <GameScene />
              <BiomeLabRig />
              <SceneReady onReady={() => setSceneReady(true)} />
            </GameCanvas>
          </WorldProvider>
        )}
        {(boot.status !== 'ready' || !sceneReady) && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-neutral-300">
            {boot.status === 'error' ? boot.error : 'Carregando o laboratório…'}
          </div>
        )}
        <p className="pointer-events-none absolute bottom-2 left-2 rounded bg-black/50 px-2 py-1 text-xs text-neutral-300">
          Clique na cena para andar e girar a câmera (Esc solta o mouse). F2
          liga os painéis de ajuste do jogo.
        </p>
      </div>

      {boot.status === 'ready' && lab && panelContainer && (
        <BiomeLabPanel
          container={panelContainer}
          points={lab.points}
          snapshot={lab.snapshot}
          packs={lab.packs}
          onCapture={capture}
        />
      )}
      {showDebug && <TerrainTuningPanel />}
      {showDebug && <DayWeatherPanel />}
      {showDebug && <VegetationPanel />}
      {showDebug && <CameraPanel />}
    </div>
  )
}
