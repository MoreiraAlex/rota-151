'use client'

import { useEffect, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { Stats } from '@react-three/drei'
import { useTrait } from 'koota/react'
import { WorldProvider } from '@/core/world/WorldProvider'
import { playerEntity } from '@/core/world/world'
import { ScanHistory, ScanMode } from '@/core/traits'
import { GameLoop } from '@/view/loop/GameLoop'
import { GameScene } from '@/view/scene/GameScene'
import { PhysicsDebugView } from '@/tools/debug/PhysicsDebugView'
import { PathfindingDebugView } from '@/tools/debug/PathfindingDebugView'
import { ScanRangeDebugView } from '@/tools/debug/ScanRangeDebugView'
import { DebugPanel } from '@/tools/debug/DebugPanel'
import { PauseMenu } from '@/tools/menu/PauseMenu'
import { ActionSlotHud } from '@/tools/hud/ActionSlotHud'
import { PartyHud } from '@/tools/hud/PartyHud'
import { SkillsHud } from '@/tools/hud/SkillsHud'
import { StatusHud } from '@/tools/hud/StatusHud'
import { PokedexVisorHud } from '@/tools/hud/PokedexVisorHud'

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
function GameHud({ onScanned, onMenuOpenRequested }) {
  // Modo scanner (Pokédex equipada, botão direito — `scannerModeSystem.js`,
  // docs/features/031-*.md) troca a HUD inteira pelo visor.
  const scanMode = useTrait(playerEntity, ScanMode)
  const scanning = !!scanMode?.active
  const history = useTrait(playerEntity, ScanHistory)

  useEffect(() => {
    if (history?.entries?.length) onScanned(history.entries[0].id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history?.entries])

  useEffect(() => {
    if (scanMode?.menuOpenRequests) onMenuOpenRequested()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanMode?.menuOpenRequests])

  if (scanning) return <PokedexVisorHud />

  return (
    <>
      <PartyHud />
      <SkillsHud />
      <StatusHud />
      <ActionSlotHud />
    </>
  )
}

export default function GamePage() {
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
  const closeMenu = () => {
    setMenuOpen(false)
    try {
      containerRef.current
        ?.querySelector('canvas')
        ?.requestPointerLock()
        ?.catch(() => {})
    } catch {
      // Cooldown do browser — ignora, o próximo clique trava normalmente.
    }
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
      if (document.pointerLockElement) document.exitPointerLock()
      setMenuView('inventory')
      setMenuOpen(true)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menuOpen, menuView])

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
              </>
            )}
          </GameScene>
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
          />

          {showDebug && <DebugPanel />}

          {menuOpen && (
            <PauseMenu
              onResume={closeMenu}
              view={menuView}
              onViewChange={setMenuView}
              pokedexInitialTab={pokedexInitialTab}
              pokedexInitialHistoryEntryId={pokedexHistoryEntryId}
            />
          )}
        </div>
      </div>
    </WorldProvider>
  )
}
