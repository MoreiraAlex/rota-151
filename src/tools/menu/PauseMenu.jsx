'use client'

import { X } from 'lucide-react'
import { GAME_CONFIG } from '@/core/gameConfig'
import { ConfigPanel } from './ConfigEditor'
import { InventoryPanel } from './InventoryPanel'
import { PokedexMenu } from './pokedex/PokedexMenu'

// Largura da caixa por subtela — Inventário precisa de mais espaço (grade +
// preview de equipamento lado a lado, ver InventoryPanel.jsx); a Pokédex tem
// largura própria (pedido do usuário, docs/features/033-*.md — a restrição
// dela é de ALTURA, ver `PokedexFrame.jsx`, não largura);
// as outras ficam na largura compacta de sempre.
const BOX_WIDTH = {
  main: 'w-80',
  settings: 'w-80',
  inventory: 'w-[36rem]',
  pokedex: 'w-[800px]',
}

/**
 * Menu de pausa — abre sozinho quando o ponteiro destrava (Esc, ver
 * `src/app/(auth)/page.js`), do mesmo jeito que qualquer jogo em primeira
 * pessoa; apertar `Esc` de novo (ou "Continuar") pede o pointer lock e
 * fecha o menu (o próprio `pointerlockchange` já dirige o estado em
 * `page.js`).
 *
 * Duas opções no menu principal: Inventário (grade com os itens e os
 * Pokémon fora do time, o time, a mão e os detalhes do que foi clicado —
 * `InventoryPanel.jsx`; é onde se equipa a mão e se monta o time, único
 * lugar com essa responsabilidade) e
 * Configurações (edita `GAME_CONFIG` ao vivo). Sem pausar a simulação
 * em si: o jogo continua rodando atrás do menu.
 *
 * A subtela `pokedex` (`pokedex/PokedexMenu.jsx`, com as três abas —
 * Pokémons/Time/Histórico) continua existindo, mas SEM botão nenhum
 * aqui pra abrir ela — pedido do usuário: "vai ser só pela pokédex
 * agora" (docs/features/032-*.md), agora estendido pelo clique esquerdo
 * (abre a aba padrão) e pela confirmação de um scan (abre direto na aba
 * Histórico com o registro recém-escaneado — ver docs/features/033-
 * *.md, seção 4). Só `src/app/(auth)/page.js` abre essa view de fora
 * (`onViewChange`), nunca um botão neste menu.
 *
 * Sem fundo escurecendo a tela inteira nem capturar clique fora de si mesmo
 * (o wrapper é `pointer-events-none`, só a caixa do menu é `-auto`) — o
 * `DebugPanel` (canto inferior esquerdo) continua visível e manipulável com
 * o menu aberto ao mesmo tempo.
 *
 * `canOpenInventory`: o Inventário só abre com o treinador no controle
 * (pilotando uma criatura, o botão fica desligado).
 *
 * `view`/`onViewChange` vêm de fora (`page.js`) em vez de estado interno —
 * a tecla `I` (e o scanner, pra `pokedex`) precisa abrir direto na
 * subtela, sem passar pela principal primeiro. `pokedexInitialTab`/
 * `pokedexInitialHistoryEntryId` (vêm de fora, junto com `view`) são só
 * repassadas pra `PokedexMenu` — ver docstring de lá.
 */
export function PauseMenu({
  onResume,
  view,
  onViewChange,
  canOpenInventory = true,
  pokedexInitialTab,
  pokedexInitialHistoryEntryId,
}) {
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
            <MenuButton
              disabled={!canOpenInventory}
              onClick={() => setView('inventory')}
            >
              Inventário
            </MenuButton>
            <MenuButton onClick={() => setView('settings')}>
              Configurações
            </MenuButton>
            <MenuButton onClick={onResume}>Continuar</MenuButton>
          </div>
        )}

        {view === 'inventory' && (
          <MenuView title="Inventário" onClose={onResume}>
            <InventoryPanel />
          </MenuView>
        )}

        {view === 'pokedex' && (
          <MenuView title="Pokédex" onClose={onResume}>
            <PokedexMenu
              initialTab={pokedexInitialTab}
              initialHistoryEntryId={pokedexInitialHistoryEntryId}
            />
          </MenuView>
        )}

        {view === 'settings' && (
          <MenuView title="Configurações" onClose={onResume}>
            <ConfigPanel gameConfig={GAME_CONFIG} />
          </MenuView>
        )}
      </div>
    </div>
  )
}

function MenuButton({ onClick, disabled = false, children }) {
  return (
    <button
      type="button"
      disabled={disabled}
      className="w-full rounded bg-white/10 px-3 py-2 text-left text-sm hover:bg-white/20 disabled:cursor-default disabled:opacity-30 disabled:hover:bg-white/10"
      onClick={onClick}
    >
      {children}
    </button>
  )
}

/** Cabeçalho (título + fechar) comum a toda subtela do menu — botão "X"
 * no lugar do antigo link de texto "← voltar" (pedido do usuário: "em
 * vez do botão Voltar, cada menu deve possuir apenas um botão X pra
 * fechar o menu atual", docs/features/033-*.md).
 *
 * `onClose` é `onResume` (bug corrigido — pedido do usuário: "a função
 * responsável por fechar um menu deve realmente fechar o menu atual...
 * não deve navegar, abrir ou redirecionar para outro menu"). Na troca
 * do botão de texto pro "X", o `onClick` continuou `() =>
 * setView('main')` por engano — isso NAVEGA pra tela principal do
 * menu de pausa (ainda aberta, só troca de subtela), não fecha nada.
 * `onResume` (`src/app/(auth)/page.js`, a mesma função que "Continuar"
 * já usa) é quem de fato fecha o menu inteiro e devolve o controle pro
 * jogo — é isso que "fechar o menu atual" pede. */
function MenuView({ title, onClose, children }) {
  return (
    <div className="space-y-2">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide">
          {title}
        </h2>
        <button
          type="button"
          className="text-white/60 hover:text-white"
          onClick={onClose}
          aria-label="Fechar"
        >
          <X size={16} />
        </button>
      </div>
      {children}
    </div>
  )
}
