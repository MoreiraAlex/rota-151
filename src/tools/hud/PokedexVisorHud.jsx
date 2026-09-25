'use client'

import { useTarget } from 'koota/react'
import { playerEntity } from '@/core/world/world'
import { Targeting } from '@/core/traits'
import { formatSpeciesName } from '@/view/shared/statusDisplay'
import { resolveTargetSpecies } from '../shared/resolveTargetSpecies'

/**
 * HUD do modo scanner — pedido do usuário: "pode mudar a hud inteira
 * para simular o visor da pokédex" (ver docs/features/031-*.md).
 * Substitui TODA a HUD normal (`PartyHud`/`SkillsHud`/`StatusHud`/
 * `ActionSlotHud`, ver `src/app/(auth)/page.js`) enquanto `ScanMode.active`
 * — não some junto com nenhuma delas, é uma troca completa de tela, não
 * uma camada por cima.
 *
 * **Sinal de alvo travado** (docs/features/032-*.md) — pedido do
 * usuário: "ao apontar a pokédex para uma criatura, tem que ter alguma
 * interação no hud que sinalize isso". Lê `Targeting`
 * (`core/traits/components/targeting.js`) reativamente via `useTarget`
 * do koota — o mesmo raycast que `scannerModeSystem.js` já roda todo
 * tick enquanto o modo está ligado, sem duplicar lógica aqui (este
 * componente só EXIBE o resultado). Sem alvo, retículo/texto ficam na
 * cor neutra de sempre; com alvo, viram verde e mostram o nome da
 * espécie + a dica de clicar pra escanear.
 *
 * **Segurar, não clicar (docs/features/033-*.md)** — bug relatado pelo
 * usuário, confirmado com log próprio: o mecanismo de dois cliques
 * (clicar pra abrir, clicar de novo pra confirmar) não sustentava de
 * forma confiável na prática — "ao invés do modo scan ser por clique,
 * ele seja por holding, eu tenho que manter o clique enquanto uso".
 * Botão direito agora é SEGURAR (`ScanMode.active` reflete
 * `input.secondaryHeld` direto, `scannerModeSystem.js`) — soltar
 * confirma o que estiver na mira (ou só sai, sem alvo) e volta a HUD
 * normal sozinho.
 */
export function PokedexVisorHud() {
  const target = useTarget(playerEntity, Targeting)
  const species = resolveTargetSpecies(target)
  const locked = !!species

  const accent = locked ? 'text-emerald-400' : 'text-red-300'
  const reticleColor = locked ? 'border-emerald-400' : 'border-red-400/70'

  return (
    <div className="pointer-events-none absolute inset-0 font-mono text-white">
      <div className="absolute inset-0 border-[10px] border-red-700/70" />
      <div className="absolute inset-3 border border-red-400/40" />

      <div className="absolute left-4 top-4 flex items-center gap-1.5">
        <span className="h-3 w-3 rounded-full bg-sky-300 ring-1 ring-white/50" />
        <span className="h-1.5 w-1.5 rounded-full bg-red-300" />
        <span className="h-1.5 w-1.5 rounded-full bg-yellow-300" />
        <span className="h-1.5 w-1.5 rounded-full bg-green-300" />
        <span className="ml-2 text-[10px] text-red-300">POKÉDEX</span>
      </div>

      <span className={`absolute right-4 top-4 text-[11px] ${accent}`}>
        {locked ? formatSpeciesName(species.id) : 'MODO SCANNER'}
      </span>

      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative h-16 w-16">
          <span
            className={`absolute inset-0 rounded-full border-2 transition-colors ${reticleColor}`}
          />
          <span
            className={`absolute left-1/2 top-0 h-3 w-px -translate-x-1/2 ${locked ? 'bg-emerald-400' : 'bg-red-400/70'}`}
          />
          <span
            className={`absolute bottom-0 left-1/2 h-3 w-px -translate-x-1/2 ${locked ? 'bg-emerald-400' : 'bg-red-400/70'}`}
          />
          <span
            className={`absolute left-0 top-1/2 h-px w-3 -translate-y-1/2 ${locked ? 'bg-emerald-400' : 'bg-red-400/70'}`}
          />
          <span
            className={`absolute right-0 top-1/2 h-px w-3 -translate-y-1/2 ${locked ? 'bg-emerald-400' : 'bg-red-400/70'}`}
          />
        </div>
      </div>

      <span className="absolute bottom-4 left-1/2 -translate-x-1/2 text-[11px] text-white/50">
        {locked ? 'clique direito para escanear' : 'solte para sair'}
      </span>
    </div>
  )
}
