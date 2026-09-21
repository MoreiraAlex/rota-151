'use client'

import { useEffect, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { WorldProvider } from '@/core/world/WorldProvider'
import { GameLoop } from '@/view/loop/GameLoop'
import { GameScene } from '@/view/scene/GameScene'
import { PhysicsDebugView } from '@/tools/debug/PhysicsDebugView'
import { PathfindingDebugView } from '@/tools/debug/PathfindingDebugView'
import { AttackRangeDebugView } from '@/tools/debug/AttackRangeDebugView'
import { DebugPanel } from '@/tools/debug/DebugPanel'
import { PauseMenu } from '@/tools/menu/PauseMenu'
import { PartyHud } from '@/tools/hud/PartyHud'
import { SkillsHud } from '@/tools/hud/SkillsHud'
import { Crosshair } from '@/tools/hud/Crosshair'

export default function GamePage() {
  const [showDebug, setShowDebug] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuView, setMenuView] = useState('main')
  const containerRef = useRef(null)

  useEffect(() => {
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
    // o outro useEffect abaixo). O botão direito não solta mais o Pointer
    // Lock (virou mirar, ver docs/features/016-mira-e-arremesso.md/
    // pointerInput.js), então nem chega a disparar isso.
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

  return (
    <WorldProvider>
      <div
        ref={containerRef}
        className="relative h-screen w-screen overflow-hidden"
      >
        <Canvas shadows>
          <GameLoop />
          <GameScene>
            {showDebug && (
              <>
                <PhysicsDebugView />
                <PathfindingDebugView />
                <AttackRangeDebugView />
              </>
            )}
          </GameScene>
        </Canvas>

        <Crosshair />
        <PartyHud />
        <SkillsHud />

        {showDebug && <DebugPanel />}

        {menuOpen && (
          <PauseMenu
            onResume={closeMenu}
            view={menuView}
            onViewChange={setMenuView}
          />
        )}
      </div>
    </WorldProvider>
  )
}
