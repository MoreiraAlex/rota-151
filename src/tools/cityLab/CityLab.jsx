'use client'

import { useEffect, useState } from 'react'
import { GameCanvas } from '@/view/scene/GameCanvas'
import { WorldProvider } from '@/core/world/WorldProvider'
import { GAME_CONFIG } from '@/core/gameConfig'
import { playerEntity, world } from '@/core/world/world'
import {
  definirGeradorDeUid,
  definirVelocidadeDoRelogio,
  forcarClima,
  prepararTreinador,
} from '@/core/actions'
import { regenerarTerreno } from '@/core/actions/terrain'
import { initPhysics } from '@/core/physics/physicsWorld'
import { createPokemonUid } from '@/platform/persistence/pokemonUid'
import { GameLoop } from '@/view/loop/GameLoop'
import { FrameLimiter } from '@/view/scene/FrameLimiter'
import { GameScene } from '@/view/scene/GameScene'
import { SceneReady } from '@/view/scene/SceneReady'
import { preloadGameAssets } from '@/view/preload/preloadGameAssets'
import {
  GAME_PACKS_DIR,
  loadVegetationPacks,
} from '@/view/vegetation/vegetationPacks'
import { preloadVegetationModels } from '@/view/vegetation/useVegetationModels'
import { TerrainTuningPanel } from '@/tools/debug/TerrainTuningPanel'
import { DayWeatherPanel } from '@/tools/debug/DayWeatherPanel'
import { VegetationPanel } from '@/tools/debug/VegetationPanel'
import { CameraPanel } from '@/tools/debug/CameraPanel'
import { buildLabSave } from '@/tools/biomeLab/labSave'
import { CityLabPanel } from './CityLabPanel'
import { CityLabRig } from './CityLabRig'
import { cidadeDoLab, ligarCidadeDoLab } from './cityLabWorld'

// Hora de abrir (0–24) e o dia de jogo (o clima sorteia pelo tempo total).
const START_HOUR = 10.5
const START_DAY = 3

/**
 * Laboratório da cidade (docs/features/069-revisao-do-bioma-cidade.md): a
 * cena do jogo com a primeira cidade montada à mão a partir do layout de
 * uma cidade do Let's Go (`core/data/cityLayouts/`, por enquanto
 * Viridian), sem login, save, HUD nem time em campo. O treinador nasce na
 * chegada dela para andar e sentir a escala; o painel do lab mexe no chão
 * (degraus, montanha, lago, rampas e tamanho) e refaz o mundo. F2 liga os
 * painéis de ajuste do jogo por cima.
 *
 * Abre com o relógio parado, tempo limpo, sem selvagens nascendo e sem
 * névoa (`CityLabRig`).
 */
export function CityLab() {
  const [boot, setBoot] = useState({ status: 'loading', error: null })
  const [sceneReady, setSceneReady] = useState(false)
  const [showDebug, setShowDebug] = useState(false)
  const [panelContainer, setPanelContainer] = useState(null)

  useEffect(() => {
    let cancelled = false
    GAME_CONFIG.WILD_SPAWN.ENABLED = false
    definirGeradorDeUid(() => createPokemonUid())
    Promise.all([
      loadVegetationPacks(GAME_PACKS_DIR).then(() => preloadVegetationModels()),
      initPhysics().then(
        () => true,
        () => false,
      ),
      preloadGameAssets(),
    ])
      .then(([, physicsLoaded]) => {
        if (cancelled) return
        if (!physicsLoaded) {
          setBoot({ status: 'error', error: 'A física do jogo não carregou.' })
          return
        }
        // O mundo refeito já com a cidade do lab (nada carregado ainda).
        ligarCidadeDoLab()
        regenerarTerreno(world)
        const town = cidadeDoLab()
        if (!town) {
          setBoot({
            status: 'error',
            error: 'A cidade do lab não montou (falta o bioma da cidade?).',
          })
          return
        }
        prepararTreinador(
          world,
          playerEntity,
          buildLabSave({
            x: town.spawn.x,
            z: town.spawn.z,
            yaw: town.spawn.yaw,
            time: START_DAY + START_HOUR / 24,
          }),
        )
        definirVelocidadeDoRelogio(world, 0)
        forcarClima(world, 'clear')
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

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-neutral-900 text-neutral-200">
      {/* O painel do lab numa coluna própria, sem cobrir a cena. */}
      <div
        ref={setPanelContainer}
        className="h-full w-[260px] shrink-0 overflow-y-auto"
      />

      {/* A cena ocupa o resto da tela. */}
      <div className="relative h-full min-w-0 flex-1 bg-black">
        {boot.status === 'ready' && (
          <WorldProvider>
            <GameCanvas
              shadows
              frameloop="never"
              gl={{ antialias: GAME_CONFIG.RENDER.MSAA }}
            >
              <FrameLimiter />
              <GameLoop castModeOverride={null} />
              <GameScene />
              <CityLabRig />
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

      {boot.status === 'ready' && panelContainer && (
        <CityLabPanel container={panelContainer} />
      )}
      {showDebug && <TerrainTuningPanel />}
      {showDebug && <DayWeatherPanel />}
      {showDebug && <VegetationPanel />}
      {showDebug && <CameraPanel />}
    </div>
  )
}
