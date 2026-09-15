'use client'

import { GAME_CONFIG } from '@/core/gameConfig'
import { ConfigPanel } from './ConfigEditor'
import { InventoryPanel } from './InventoryPanel'

// Largura da caixa por subtela — Inventário precisa de mais espaço (grade +
// preview de equipamento lado a lado, ver InventoryPanel.jsx); as outras
// ficam na largura compacta de sempre.
const BOX_WIDTH = {
  main: 'w-80',
  settings: 'w-80',
  inventory: 'w-[34rem]',
}

/**
 * Menu de pausa — abre sozinho quando o ponteiro destrava (Esc, ver
 * `src/app/(auth)/page.js`), do mesmo jeito que qualquer jogo em primeira
 * pessoa; apertar `Esc` de novo (ou "Continuar") pede o pointer lock e
 * fecha o menu (o próprio `pointerlockchange` já dirige o estado em
 * `page.js`).
 *
 * Duas opções por hora: Inventário (grade 5x5 com tudo que o jogador tem +
 * preview de equipamento — `InventoryPanel.jsx`; é onde se equipa mão
 * principal/time, único lugar com essa responsabilidade — ver
 * docs/features/018-preview-de-equipamento-no-inventario.md) e
 * Configurações (edita `GAME_CONFIG` ao vivo). Sem pausar a simulação em
 * si: o jogo continua rodando atrás do menu.
 *
 * Sem fundo escurecendo a tela inteira nem capturar clique fora de si mesmo
 * (o wrapper é `pointer-events-none`, só a caixa do menu é `-auto`) — o
 * `DebugPanel` (canto inferior esquerdo) continua visível e manipulável com
 * o menu aberto ao mesmo tempo.
 *
 * `view`/`onViewChange` vêm de fora (`page.js`) em vez de estado interno —
 * a tecla `I` precisa abrir direto na subtela de Inventário, sem passar
 * pela principal primeiro.
 */
export function PauseMenu({ onResume, view, onViewChange }) {
  const setView = onViewChange

  return (
    <div className="pointer-events-none absolute inset-0 flex items-start justify-center pt-24 font-mono text-white">
      <div
        className={`pointer-events-auto rounded bg-neutral-900/95 p-4 shadow-lg ${BOX_WIDTH[view]}`}
      >
        {view === 'main' && (
          <div className="space-y-2">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide">
              Menu
            </h2>
            <MenuButton onClick={() => setView('inventory')}>
              Inventário
            </MenuButton>
            <MenuButton onClick={() => setView('settings')}>
              Configurações
            </MenuButton>
            <MenuButton onClick={onResume}>Continuar</MenuButton>
          </div>
        )}

        {view === 'inventory' && (
          <MenuView title="Inventário" onBack={() => setView('main')}>
            <InventoryPanel />
          </MenuView>
        )}

        {view === 'settings' && (
          <MenuView title="Configurações" onBack={() => setView('main')}>
            <ConfigPanel gameConfig={GAME_CONFIG} />
          </MenuView>
        )}
      </div>
    </div>
  )
}

function MenuButton({ onClick, children }) {
  return (
    <button
      type="button"
      className="w-full rounded bg-white/10 px-3 py-2 text-left text-sm hover:bg-white/20"
      onClick={onClick}
    >
      {children}
    </button>
  )
}

/** Cabeçalho (título + "voltar") comum a toda subtela do menu. */
function MenuView({ title, onBack, children }) {
  return (
    <div className="space-y-2">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide">
          {title}
        </h2>
        <button
          type="button"
          className="text-[11px] text-white/60 hover:text-white"
          onClick={onBack}
        >
          ← voltar
        </button>
      </div>
      {children}
    </div>
  )
}
