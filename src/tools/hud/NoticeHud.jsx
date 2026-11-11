'use client'

import { useSyncExternalStore } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { noticeStore } from '@/view/registry/noticeStore'

const serverSnapshot = () => []

// Ícone de cada tipo de aviso.
const ICONS = {
  level: '▲',
  move: '✦',
  hint: '?',
  warn: '!',
}

/**
 * Avisos no canto superior direito (docs/features/067-campo-de-treino-e-
 * avisos-de-nivel.md): "X subiu para o nível N!", "X pode aprender Y!" e a
 * dica do campo de treino. Só leitura — quem escreve é `noticeSystem.js`
 * (e `trainingFieldHintSystem.js`); aqui só assina o `noticeStore`, que
 * muda quando entra ou sai um aviso, nunca por frame. Aviso novo entra
 * deslizando por baixo; o vencido some.
 */
export function NoticeHud() {
  const notices = useSyncExternalStore(
    noticeStore.subscribe,
    noticeStore.getSnapshot,
    serverSnapshot,
  )

  return (
    <div className="pointer-events-none absolute right-4 top-4 flex w-80 flex-col items-end gap-2">
      <AnimatePresence initial={false}>
        {notices.map((notice) => (
          <motion.div
            key={notice.id}
            layout
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 24 }}
            transition={{ duration: 0.25 }}
            className="flex w-full items-start gap-2 rounded-md border border-white/15 bg-black/60 px-3 py-2 text-white shadow-lg backdrop-blur-sm"
            style={{ borderLeftColor: notice.color, borderLeftWidth: 3 }}
          >
            <span
              className="mt-px text-sm font-bold"
              style={{ color: notice.color }}
            >
              {ICONS[notice.kind] ?? '•'}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold leading-tight">{notice.title}</p>
              {notice.detail && (
                <p className="text-xs text-white/75">{notice.detail}</p>
              )}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
