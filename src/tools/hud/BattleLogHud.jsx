'use client'

import { useSyncExternalStore } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { battleLogStore } from '@/view/registry/battleLogStore'

const serverSnapshot = () => ({ lines: [], visible: false })

/**
 * Log de batalha (docs/features/039-tipos-e-combate-classico.md): as últimas
 * mensagens do combate em texto, no estilo dos jogos de turno ("Charmander
 * usou Ember!", "É super efetivo!", "Bulbasaur selvagem desmaiou!"), no canto
 * inferior esquerdo. Só leitura — quem escreve é `battleLogSystem.js`;
 * aqui só assina o `battleLogStore`, que muda por mensagem nova ou quando o
 * log apaga sozinho (`FEEDBACK.BATTLE_LOG.IDLE_FADE_TIME` sem mensagem), nunca por
 * frame. Linha nova entra deslizando; a mais antiga sai pelo topo.
 */
export function BattleLogHud() {
  const { lines, visible } = useSyncExternalStore(
    battleLogStore.subscribe,
    battleLogStore.getSnapshot,
    serverSnapshot,
  )
  if (lines.length === 0) return null

  return (
    <div
      className={`pointer-events-none absolute bottom-4 left-4 w-80 rounded border border-white/10 bg-black/40 px-2 py-1.5 font-mono text-[11px] leading-snug transition-opacity duration-700 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <AnimatePresence initial={false}>
        {lines.map((line) => (
          <motion.p
            key={line.id}
            layout
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{
              color: line.color,
              textShadow: '0 1px 2px rgba(0, 0, 0, 0.8)',
            }}
          >
            {line.text}
          </motion.p>
        ))}
      </AnimatePresence>
    </div>
  )
}
