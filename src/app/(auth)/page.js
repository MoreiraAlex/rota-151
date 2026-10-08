'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { Stats } from '@react-three/drei'
import { useHas, useTrait } from 'koota/react'
import { WorldProvider } from '@/core/world/WorldProvider'
import { playerEntity, world } from '@/core/world/world'
import { InputControlled, ScanHistory, ScanMode } from '@/core/traits'
import { GameLoop } from '@/view/loop/GameLoop'
import { GameScene } from '@/view/scene/GameScene'
import { PhysicsDebugView } from '@/tools/debug/PhysicsDebugView'
import { PathfindingDebugView } from '@/tools/debug/PathfindingDebugView'
import { ScanRangeDebugView } from '@/tools/debug/ScanRangeDebugView'
import { WaterLevelDebugView } from '@/tools/debug/WaterLevelDebugView'
import { ChunkDebugView } from '@/tools/debug/ChunkDebugView'
import { TerrainTuningPanel } from '@/tools/debug/TerrainTuningPanel'
import { WildBehaviorDebugView } from '@/tools/debug/WildBehaviorDebugView'
import { PartyBehaviorDebugView } from '@/tools/debug/PartyBehaviorDebugView'
import { DebugPanel } from '@/tools/debug/DebugPanel'
import { PauseMenu } from '@/tools/menu/PauseMenu'
import { PartyMenus } from '@/tools/menu/PartyMenus'
import {
  definirGeradorDeUid,
  isPartyMenuOpen,
  prepararTreinador,
} from '@/core/actions'
import { createSaveClient } from '@/platform/persistence/saveClient'
import { createAutosave } from '@/platform/persistence/autosave'
import { createPokemonUid } from '@/platform/persistence/pokemonUid'
import { initPhysics } from '@/core/physics/physicsWorld'
import { preloadGameAssets } from '@/view/preload/preloadGameAssets'
import { SceneReady } from '@/view/scene/SceneReady'
import { LoadingScreen } from '@/view/loading/LoadingScreen'
import { loadingProgress } from '@/view/loading/loadingProgress'
import { ActionSlotHud } from '@/tools/hud/ActionSlotHud'
import { PartyHud } from '@/tools/hud/PartyHud'
import { SkillsHud } from '@/tools/hud/SkillsHud'
import { StatusHud } from '@/tools/hud/StatusHud'
import { PokedexVisorHud } from '@/tools/hud/PokedexVisorHud'
import { BattleLogHud } from '@/tools/hud/BattleLogHud'
import { CaptureAimHud } from '@/tools/hud/CaptureAimHud'

/**
 * HUD de jogo (normal ou visor da Pokédex) — extraído do corpo de
 * `GamePage` porque `useTrait` precisa de `WorldProvider`
 * como ANCESTRAL de verdade na árvore React (`Error: Koota: useWorld
 * must be used within a WorldProvider`); `GamePage` é quem RENDERIZA o
 * `<WorldProvider>` (linha mais abaixo), não um descendente dele — ler
 * um trait ali dentro, antes do provider "existir" de verdade pra essa
 * árvore, quebra. Todo outro consumidor de `useTrait` neste arquivo já
 * era um componente próprio por esse mesmo motivo (`PartyHud`/
 * `StatusHud`/etc.) — este só juntou a decisão (normal vs. visor) no
 * mesmo lugar em vez de espalhar o `if` em cada um deles.
 *
 * `onScanned`/`onMenuOpenRequested` (docs/features/033-*.md) — pedido
 * do usuário, seção 4: "ao concluir o scan, abrir automaticamente o
 * menu principal, selecionar automaticamente a aba histórico e exibir
 * o pokémon recém-escaneado". `ScanHistory` (`core/traits/components/
 * scanHistory.js`) é escrita por `registrarScan`
 * (`core/actions/scanning.js`, chamado de `scannerModeSystem.js` na
 * confirmação do scan) — o registro mais recente é SEMPRE
 * `entries[0]` (`pushScanHistoryEntry` insere no topo, ver docstring
 * do trait), então basta reagir à MUDANÇA da lista (`useTrait` +
 * `useEffect` no array) pra saber "acabou de escanear algo" sem
 * precisar de um pulso à parte. `onMenuOpenRequested` reage do mesmo
 * jeito a `ScanMode.menuOpenRequests` — pedido do usuário, seção 1:
 * clique esquerdo (fora do modo scanner, com a Pokédex equipada) abre
 * o menu principal na aba padrão.
 */
function GameHud({ onScanned, onMenuOpenRequested, onTrainerControlChange }) {
  // Modo scanner (Pokédex equipada, botão direito — `scannerModeSystem.js`,
  // docs/features/031-*.md) troca a HUD inteira pelo visor.
  const scanMode = useTrait(playerEntity, ScanMode)
  const scanning = !!scanMode?.active
  const history = useTrait(playerEntity, ScanHistory)
  // O histórico que já veio do save (docs/features/044-salvar-o-jogo.md) não
  // é um scan novo: só reage quando a lista muda depois de montar.
  const initialHistory = useRef(history?.entries)

  useEffect(() => {
    if (history?.entries === initialHistory.current) return
    if (history?.entries?.length) onScanned(history.entries[0].id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history?.entries])

  useEffect(() => {
    if (scanMode?.menuOpenRequests) onMenuOpenRequested()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanMode?.menuOpenRequests])

  // Treinador no controle? `GamePage` usa pra liberar o Inventário — lido
  // aqui (dentro do `WorldProvider`), pelo mesmo motivo dos traits acima.
  const trainerControlled = useHas(playerEntity, InputControlled)
  useEffect(() => {
    onTrainerControlChange(trainerControlled)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trainerControlled])

  if (scanning) return <PokedexVisorHud />

  return (
    <>
      <PartyHud />
      <SkillsHud />
      <StatusHud />
      <ActionSlotHud />
      <BattleLogHud />
      <CaptureAimHud />
    </>
  )
}

/**
 * Entrada do jogo (docs/features/044-salvar-o-jogo.md): carrega o save da
 * conta antes de montar o mundo na tela — junto, a física (o WASM do Rapier:
 * sem ela, ninguém cai) e os sprites dos menus, e começa a baixar os modelos
 * (`preloadGameAssets`). Com save, volta tudo como estava;
 * sem save (primeira entrada), o kit inicial (`prepararTreinador`). Falhou
 * ao carregar: mostra o erro e NÃO começa com o kit — o save automático
 * gravaria o kit por cima do progresso de verdade.
 *
 * A tela de carregamento (`LoadingScreen`) fica por cima de tudo até a cena
 * 3D montar (`SceneReady`), com o progresso de cada etapa
 * (`loadingProgress`).
 *
 * Pronto, liga o save automático (`createAutosave`); se ele falhar, um aviso
 * discreto fica na tela até um envio dar certo.
 */
export default function GamePage() {
  const saveClient = useMemo(() => createSaveClient(), [])
  const [load, setLoad] = useState({ status: 'loading', error: null })
  const [saveError, setSaveError] = useState(null)
  const autosaveRef = useRef(null)
  const [sceneReady, setSceneReady] = useState(false)
  const markSceneReady = useCallback(() => setSceneReady(true), [])

  const loadGame = useCallback(() => {
    let cancelled = false
    setLoad({ status: 'loading', error: null })
    definirGeradorDeUid(() => createPokemonUid())
    loadingProgress.reset()
    Promise.all([
      loadingProgress.track('Carregando o save…', saveClient.load()),
      loadingProgress.track(
        'Preparando a física…',
        initPhysics().then(
          () => true,
          () => false,
        ),
      ),
      preloadGameAssets(loadingProgress),
    ]).then(([result, physicsLoaded]) => {
      if (cancelled) return
      if (!physicsLoaded) {
        setLoad({ status: 'error', error: 'A física do jogo não carregou.' })
        return
      }
      if (!result.ok) {
        setLoad({ status: 'error', error: result.error })
        return
      }
      prepararTreinador(world, playerEntity, result.save)
      setLoad({ status: 'ready', error: null })
    })
    return () => {
      cancelled = true
    }
  }, [saveClient])

  useEffect(() => loadGame(), [loadGame])

  useEffect(() => {
    if (load.status !== 'ready') return
    const autosave = createAutosave({
      world,
      trainer: playerEntity,
      client: saveClient,
      onStatusChange: (status) => setSaveError(status.ok ? null : status.error),
    })
    autosave.start()
    autosaveRef.current = autosave
    return () => {
      autosave.stop()
      autosaveRef.current = null
    }
  }, [load.status, saveClient])

  // Debug: para o save automático (senão o fechar da página gravaria de
  // novo), apaga e recarrega — sem save, entra com o kit.
  const deleteSave = useCallback(async () => {
    autosaveRef.current?.stop()
    const result = await saveClient.remove()
    if (!result.ok) {
      setSaveError(result.error)
      autosaveRef.current?.start()
      return
    }
    window.location.reload()
  }, [saveClient])

  const showLoading = load.status !== 'ready' || !sceneReady

  return (
    <>
      {load.status === 'ready' && (
        <GameScreen
          saveError={saveError}
          onDeleteSave={deleteSave}
          onSceneReady={markSceneReady}
        />
      )}
      {showLoading && (
        <div className="fixed inset-0 z-50">
          <LoadingScreen
            error={load.status === 'error' ? load.error : null}
            onRetry={loadGame}
          />
        </div>
      )}
    </>
  )
}

function GameScreen({ saveError, onDeleteSave, onSceneReady }) {
  const [showDebug, setShowDebug] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuView, setMenuView] = useState('main')
  const [pokedexInitialTab, setPokedexInitialTab] = useState('pokemons')
  const [pokedexHistoryEntryId, setPokedexHistoryEntryId] = useState(null)
  const containerRef = useRef(null)

  useEffect(() => {
    // F2 liga/desliga o modo debug inteiro — colliders/pathfinding/range de
    // ataque (dentro do Canvas), o DebugPanel de texto e o monitor de
    // desempenho (`<Stats/>` do drei, painel FPS/MS/MB do stats.js no canto
    // superior esquerdo, clicável pra alternar entre os três). Mesmo toggle
    // pros quatro, ferramenta de debug nunca ligada por padrão.
    const onKeyDown = (event) => {
      if (event.code !== 'F2') return
      event.preventDefault()
      setShowDebug((current) => !current)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // Fecha o menu de imediato — NÃO espera o pointer lock voltar pra isso.
  // O Chrome impõe um cooldown depois de um Esc que soltou o lock: qualquer
  // requestPointerLock() pedido logo em seguida é rejeitado
  // ("NotAllowedError: Too many pointer lock requests..."). Se a gente só
  // fechasse o menu quando o lock voltasse (via pointerlockchange), o Esc
  // de fechar pareceria travado bem nesse período. Por isso o fechamento é
  // sempre imediato; travar de novo é só melhor esforço (silenciosamente
  // ignorado se o browser recusar) — sem isso, o próximo clique no canvas
  // trava do jeito de sempre (pointerInput.js).
  const relockPointer = useCallback(() => {
    try {
      containerRef.current
        ?.querySelector('canvas')
        ?.requestPointerLock()
        ?.catch(() => {})
    } catch {
      // Cooldown do browser — ignora, o próximo clique trava normalmente.
    }
  }, [])

  const closeMenu = () => {
    setMenuOpen(false)
    relockPointer()
  }

  useEffect(() => {
    // Travar de novo (clique esquerdo no canvas) sempre fecha o menu, se
    // estiver aberto — rede de segurança pra além do botão "Continuar"/Esc.
    // NÃO abre o menu sozinho quando o lock se perde — só o Esc abre (ver
    // o outro useEffect abaixo). O botão direito nunca soltou o Pointer
    // Lock (hoje dispara `secondary`, ver `pointerInput.js`/
    // `scannerModeSystem.js`), então nem chega a disparar isso.
    const onLockChange = () => {
      if (document.pointerLockElement) setMenuOpen(false)
    }
    document.addEventListener('pointerlockchange', onLockChange)
    return () => document.removeEventListener('pointerlockchange', onLockChange)
  }, [])

  useEffect(() => {
    // Esc abre/fecha o menu diretamente pelo estado, não inferindo da perda
    // do Pointer Lock — abrir também solta o mouse como efeito colateral do
    // próprio browser (o Esc sempre sai do Pointer Lock quando há um
    // ativo).
    const onKeyDown = (event) => {
      if (event.code !== 'Escape') return
      // Menu de ações / "esquecer qual golpe?" aberto: o Esc é dele
      // (`PartyMenus`), não abre o menu de pausa.
      if (isPartyMenuOpen(playerEntity)) return
      event.preventDefault()
      if (menuOpen) {
        closeMenu()
      } else {
        setMenuView('main')
        setMenuOpen(true)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menuOpen])

  useEffect(() => {
    // `I` abre direto na subtela de Inventário — sem passar pela tela
    // principal do menu primeiro. Diferente do Esc, `I` não tem efeito
    // nativo nenhum do browser sobre o Pointer Lock, então precisa soltar
    // o mouse manualmente pra permitir o drag/drop da grade (ver
    // InventoryPanel.jsx). Apertar de novo com o inventário já aberto
    // fecha (mesma simetria do Esc); se o menu estiver aberto numa outra
    // subtela, só troca pra Inventário sem fechar.
    const onKeyDown = (event) => {
      if (event.code !== 'KeyI') return
      event.preventDefault()
      if (menuOpen && menuView === 'inventory') {
        closeMenu()
        return
      }
      // Só com o treinador no controle (pilotando uma criatura, não abre).
      if (!playerEntity.has(InputControlled)) return
      if (document.pointerLockElement) document.exitPointerLock()
      setMenuView('inventory')
      setMenuOpen(true)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menuOpen, menuView])

  // Inventário só com o treinador no controle: se o controle sair dele
  // (passou pra uma criatura) com o inventário aberto, fecha.
  // (`GameHud` informa, de dentro do `WorldProvider`.)
  const [trainerControlled, setTrainerControlled] = useState(true)
  useEffect(() => {
    if (!trainerControlled && menuOpen && menuView === 'inventory') closeMenu()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trainerControlled, menuOpen, menuView])

  // Abre o menu direto na aba Histórico da Pokédex, com o registro
  // recém-escaneado já selecionado — pedido do usuário, seção 4:
  // "escanear e ver a informação da criatura imediatamente na terceira
  // aba, sem a necessidade de navegar manualmente" (docs/features/033-
  // *.md). Chamado por `GameHud` quando `ScanHistory` muda (escaneou
  // algo de verdade), mesma técnica de soltar o mouse que `I` já usava.
  const openScanHistory = (entryId) => {
    if (document.pointerLockElement) document.exitPointerLock()
    setPokedexInitialTab('historico')
    setPokedexHistoryEntryId(entryId)
    setMenuView('pokedex')
    setMenuOpen(true)
  }

  // Abre o menu direto na aba Pokémons (aba padrão) — pedido do
  // usuário, seção 1: "botão esquerdo: abrir o menu principal da
  // Pokédex" (docs/features/033-*.md). Chamado por `GameHud` quando
  // `ScanMode.menuOpenRequests` muda (clique esquerdo fora do modo
  // scanner, com a Pokédex equipada — ver `scannerModeSystem.js`).
  const openPokedexMenu = () => {
    if (document.pointerLockElement) document.exitPointerLock()
    setPokedexInitialTab('pokemons')
    setPokedexHistoryEntryId(null)
    setMenuView('pokedex')
    setMenuOpen(true)
  }

  return (
    <WorldProvider>
      <div
        ref={containerRef}
        className="relative h-screen w-screen overflow-hidden"
      >
        <Canvas shadows>
          {showDebug && <Stats />}
          {/* Modo debug força o indicador antes de todo ataque. */}
          <GameLoop castModeOverride={showDebug ? 'confirm' : null} />
          <GameScene>
            {showDebug && (
              <>
                <PhysicsDebugView />
                <PathfindingDebugView />
                <ScanRangeDebugView />
                <WaterLevelDebugView />
                <ChunkDebugView />
                <WildBehaviorDebugView />
                <PartyBehaviorDebugView />
              </>
            )}
          </GameScene>
          {/* A cena só monta com os modelos prontos: tira o carregamento. */}
          <SceneReady onReady={onSceneReady} />
        </Canvas>

        {/* z-10 — bug relatado: "o Nameplate está ficando sobre o menu e
            outras coisas, isso é controlado por z-index?". É, sim:
            `NameplateView.jsx` usa `<Html>` do drei, que é injetado como
            filho do MESMO container que este `<div>` (`gl.domElement.
            parentNode`, ou seja, `containerRef` aqui), com um z-index
            gigante por padrão (~16 milhões, pensado pra oclusão 3D) —
            sempre por cima de qualquer overlay sem z-index explícito,
            não importa a ordem no DOM. `NameplateView.jsx` agora fixa
            um z-index baixo (`zIndexRange={[1, 1]}`); este wrapper
            garante que HUD/debug/menu ficam por cima dele. */}
        <div className="pointer-events-none absolute inset-0 z-10">
          <GameHud
            onScanned={openScanHistory}
            onMenuOpenRequested={openPokedexMenu}
            onTrainerControlChange={setTrainerControlled}
          />

          {showDebug && <DebugPanel onDeleteSave={onDeleteSave} />}
          {showDebug && <TerrainTuningPanel />}

          {/* Save automático falhando (docs/features/044-*.md): some no
              próximo envio que der certo. */}
          {saveError && (
            <p className="absolute right-4 top-4 rounded bg-black/70 px-3 py-1 text-xs text-yellow-300">
              Não foi possível salvar: {saveError}
            </p>
          )}

          {/* Menu de ações (segurar Q/E/R) e "esquecer qual golpe?" —
              docs/features/038-aprendizado-treino-e-dominio-de-golpes.md. */}
          <PartyMenus trainer={playerEntity} onRelock={relockPointer} />

          {menuOpen && (
            <PauseMenu
              onResume={closeMenu}
              view={menuView}
              onViewChange={setMenuView}
              canOpenInventory={trainerControlled}
              pokedexInitialTab={pokedexInitialTab}
              pokedexInitialHistoryEntryId={pokedexHistoryEntryId}
            />
          )}
        </div>
      </div>
    </WorldProvider>
  )
}
