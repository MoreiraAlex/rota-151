'use client'

import { useQueryFirst, useTrait } from 'koota/react'
import { getSpecies } from '@/core/data/species'
import { resolveCreatureAttack } from '@/core/data/attacks'
import {
  AttackCooldowns,
  InputControlled,
  SummonedCreature,
} from '@/core/traits'
import { SlotPreview } from '../shared/SlotPreview'

const SKILL_SLOTS = [
  { key: 'secondary1', label: 'Q' },
  { key: 'secondary2', label: 'E' },
  { key: 'secondary3', label: 'R' },
]

/**
 * HUD real (não-debug, ver docs/backlog.md — "HUD real (não-debug)") das
 * SKILLS da criatura controlada (Q/E/R — `attacks.secondary1-3`, ver
 * docs/features/025-ataque-comum-de-criatura.md, "9ª rodada") — pedido do
 * usuário: "preciso da hud das habilidades bem como algum efeito que
 * mostre o tempo de recarga no slot da habilidade". Mesmo princípio de
 * `PartyHud.jsx` (só leitura, sempre montado) — mostra só o que existe de
 * VERDADE (`resolveCreatureAttack` não-nulo); slot sem skill configurada
 * nem aparece (hoje só `secondary1` tem conteúdo, nas 3 espécies
 * iniciais). Não mostra `primary` (ataque comum, botão esquerdo) — o
 * usuário chamou de "habilidades", terminologia que o resto do projeto já
 * usa só pra Q/E/R (ver docstring de `creatureAttackSystem.js`), nunca
 * pro ataque comum.
 *
 * Só visível pilotando uma CRIATURA — `useQueryFirst(InputControlled,
 * SummonedCreature)` (mesma técnica reativa de `DebugPanel.jsx`) devolve
 * `null` quando é o treinador no controle (ele nunca tem
 * `SummonedCreature`), e o componente não renderiza nada.
 *
 * `AttackCooldowns` é lido DIRETO via `useTrait`, sem polling manual —
 * `creatureAttackSystem.js` MUTA os campos por referência todo tick
 * (`cooldowns[slot] = ...`, não `entity.set`), e o hook já reage a isso
 * (mesmo padrão de `DebugPanel.jsx` mostrando stamina/vida ao vivo) — a
 * contagem regressiva do slot atualiza sozinha.
 */
export function SkillsHud() {
  const controlled = useQueryFirst(InputControlled, SummonedCreature)
  const creature = useTrait(controlled, SummonedCreature)
  const cooldowns = useTrait(controlled, AttackCooldowns)

  if (!creature || !cooldowns) return null

  const species = getSpecies(creature.speciesId)
  const slots = SKILL_SLOTS.map(({ key, label }) => ({
    key,
    label,
    attack: resolveCreatureAttack(species?.attacks?.[key]),
  }))
  // .filter((slot) => slot.attack)

  if (slots.length === 0) return null

  return (
    <div className="pointer-events-none absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-2 font-mono text-xs text-white">
      {slots.map(({ key, label, attack }) => (
        <SkillSlot
          key={key}
          label={label}
          attack={attack}
          remaining={cooldowns[key]}
        />
      ))}
    </div>
  )
}

/**
 * Um slot de skill — ícone (`SlotPreview`, cor por ataque em
 * `view/attackColors.js`) + tecla (Q/E/R) + "sombra" de recarga: um véu
 * escuro cobrindo o ícone de CIMA pra BAIXO, encolhendo conforme
 * `remaining` cai até zerar — mesma leitura visual de barra de cooldown
 * de qualquer jogo com habilidades, e mesma técnica de "escalar por
 * cima" de barra de vida/stamina que `DebugPanel.jsx` já usa (`height`
 * em porcentagem, não geometria nova). Pronto (`remaining <= 0`) = véu
 * some, borda vira verde — mesmo verde de "ativo" que `PartyHud.jsx`
 * já usa pro slot de time que está fora.
 */
function SkillSlot({ label, attack, remaining }) {
  const onCooldown = remaining > 0
  const overlayHeight =
    attack?.cooldown > 0 ? Math.min(remaining / attack?.cooldown, 1) * 100 : 0

  return (
    <div
      className={`flex w-16 flex-col items-center gap-0.5 rounded border p-1.5 ${
        attack && !onCooldown
        ? 'border-emerald-400 bg-emerald-900/60'
        : 'border-white/20 bg-black/70'
      }`}
    >
      <span className="text-[10px] text-white/50">{label}</span>
      <span className="relative inline-block h-5 w-5">
        <SlotPreview kind="attack" id={attack?.id} />
        {onCooldown && (
          <span
            className="absolute inset-x-0 top-0 rounded bg-black/70"
            style={{ height: `${overlayHeight}%` }}
          />
        )}
      </span>
      <span className="w-full truncate text-center">
        {attack ? onCooldown ? `${remaining.toFixed(1)}s` : 'pronto' : ''}
      </span>
    </div>
  )
}
