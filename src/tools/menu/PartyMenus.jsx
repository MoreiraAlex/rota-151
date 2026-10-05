'use client'

import { useEffect } from 'react'
import { useTrait } from 'koota/react'
import {
  MoveLearnRequest,
  PartyActionMenu as PartyActionMenuTrait,
} from '@/core/traits'
import { adiarAprendizado, fecharMenuDeAcoes } from '@/core/actions'
import { PartyActionMenu } from './PartyActionMenu'
import { ForgetMoveDialog } from './ForgetMoveDialog'

/**
 * Telas treinador↔Pokémon (docs/features/038-aprendizado-treino-e-dominio-
 * de-golpes.md): o menu de ações (segurar Q/E/R, `PartyActionMenu`) e o
 * "esquecer qual golpe?" (`MoveLearnRequest`) — o core decide QUANDO abrem;
 * aqui só se desenha e se cuida do ponteiro:
 *
 * - abrir solta o ponteiro (pra clicar no menu);
 * - Esc ou travar o ponteiro de novo (clique no jogo) fecha — no "esquecer
 *   qual?", isso é o mesmo que "Agora não";
 * - fechar tenta travar o ponteiro de novo (`onRelock`).
 *
 * Enquanto alguma está aberta, o input de ação do jogo fica bloqueado no core
 * (`partyActionMenuInputSystem.js`).
 */
export function PartyMenus({ trainer, onRelock }) {
  const menu = useTrait(trainer, PartyActionMenuTrait)
  const request = useTrait(trainer, MoveLearnRequest)
  const menuSlot = menu?.slot ?? null
  const forgetting = !!request?.moveId
  const open = !!menuSlot || forgetting

  useEffect(() => {
    if (!open) return

    if (document.pointerLockElement) document.exitPointerLock()

    const close = () => {
      if (trainer.get(MoveLearnRequest)?.moveId) adiarAprendizado(trainer)
      fecharMenuDeAcoes(trainer)
    }
    const onKeyDown = (event) => {
      if (event.code !== 'Escape') return
      event.preventDefault()
      close()
    }
    const onLockChange = () => {
      if (document.pointerLockElement) close()
    }
    window.addEventListener('keydown', onKeyDown)
    document.addEventListener('pointerlockchange', onLockChange)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('pointerlockchange', onLockChange)
      if (!document.pointerLockElement) onRelock?.()
    }
  }, [open, trainer, onRelock])

  if (forgetting) return <ForgetMoveDialog trainer={trainer} />
  if (menuSlot) return <PartyActionMenu trainer={trainer} slot={menuSlot} />
  return null
}
