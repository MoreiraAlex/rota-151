'use client'

import { useQueryFirst, useTrait } from 'koota/react'
import { getSpecies } from '@/core/data/species'
import { resolveCreatureAttack } from '@/core/data/attacks'
import {
  AttackCooldowns,
  InputControlled,
  SummonedCreature,
} from '@/core/traits'
import { AttackIcon } from '@/view/shared/statusDisplay'

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
 * Um slot de ataque/skill — ícone (`AttackIcon`, `view/shared/
 * statusDisplay.jsx` — sprite de verdade quando `attack.sprite.path`
 * está configurado, cor de placeholder por `ATTACK_COLORS` quando não;
 * pedido do usuário, "4ª rodada": "os slots de skill vão precisar do
 * fundo com sprite tb") + tecla (Q/E/R) + "sombra" de recarga: um véu
 * escuro cobrindo o ícone de CIMA pra BAIXO, encolhendo conforme
 * `remaining` cai até zerar — mesma leitura visual de barra de cooldown
 * de qualquer jogo com habilidades, e mesma técnica de "escalar por
 * cima" de barra de vida/stamina que `DebugPanel.jsx` já usa (`height`
 * em porcentagem, não geometria nova). Pronto (`remaining <= 0`) = véu
 * some, borda vira verde — mesmo verde de "ativo" que `PartyHud.jsx`
 * já usa pro slot de time que está fora.
 *
 * Exportado — segundo consumidor (`tools/hud/ActionSlotHud.jsx`, "4ª
 * rodada": o slot de clique mostra o ataque `primary` da criatura
 * controlada, mesmo visual/mesma lógica de cooldown que Q/E/R aqui, só
 * outro slot/tecla) reaproveita o MESMO componente em vez de duplicar.
 *
 * **Ícone vira o FUNDO do slot inteiro (9ª rodada, redesenho maior
 * `w-16 h-16` em vez do ícone pequeno em linha)** — bug relatado: "o
 * cooldown não tá aparecendo pq a imagem tá sobrescrevendo". Causa: o
 * `<Image>` (na versão anterior desta edição) era um FILHO NORMAL do
 * flex (`position: static`), e o véu de cooldown/contagem eram
 * `position: absolute` — por regra de pintura do flexbox (itens flex
 * pintam como `inline-block`, numa camada distinta da dos descendentes
 * posicionados do MESMO container), a ordem final na tela não é
 * garantida só pela ordem no DOM quando se mistura filho flex normal
 * com filho absoluto — na prática a imagem cobria o resto.
 *
 * Corrigido tirando o `<AttackIcon>` do fluxo do flex de vez — ele mora
 * dentro de um wrapper `absolute inset-0` (o "fundo" da camada), e
 * TODOS os outros elementos (tecla, véu de cooldown, contagem) também
 * são `absolute`, sem exceção. Com TODOS os irmãos no mesmo regime de
 * posicionamento, a ordem de pintura passa a seguir só a ordem do DOM
 * (quem vem depois pinta por cima) — sem essa ambiguidade
 * flex-vs-absoluto, o véu sempre fica visível por cima do ícone.
 *
 * **`z-index` explícito em CADA camada (correção, mesma 10ª rodada)**
 * — bug relatado: "coloquei um overlap no ícone, pois tem [sprites]
 * que podem ter cores muito fortes, só que isso acabou ofuscando tudo,
 * preciso que as outras infos no slot sobreponham o overlap". O
 * "overlap" é o `<span className="absolute inset-0 bg-black/30" />`
 * que o usuário adicionou DENTRO de `AttackIcon`
 * (`view/shared/statusDisplay.jsx`) pra escurecer sprites muito
 * saturadas. Sem `z-index` NENHUM elemento daqui tinha (a exceção era
 * só a tecla, `z-30`, solta) — a ordem final dependia de regras
 * implícitas de contexto de empilhamento (`transform: scale(...)` no
 * `<Image>` de dentro do `AttackIcon`, por exemplo, JÁ cria um
 * contexto de empilhamento novo mesmo com `scale(1)`, que não muda a
 * aparência mas isola esse elemento) — difícil de raciocinar com
 * certeza sem navegador neste sandbox pra testar. Resolvido de forma
 * inequívoca dando um `z-index` EXPLÍCITO pra cada camada, do fundo
 * pra cima: ícone (`z-0`, isola de vez tudo que `AttackIcon` faz por
 * dentro — inclusive o próprio "overlap" do usuário — num único bloco
 * atômico), véu de cooldown (`z-10`), tecla + contagem (`z-20`) — três
 * números fixos, sem depender de ordem de DOM nem de contexto
 * implícito de mais nada.
 */
export function SkillSlot({ label, attack, remaining }) {
  const onCooldown = remaining > 0
  const overlayHeight =
    attack?.cooldown > 0
      ? Math.min(1 - remaining / attack.cooldown, 1) * 100
      : 0

  return (
    <div
      className={`relative h-16 w-16 overflow-hidden rounded border border-white/20 ${
        attack && !onCooldown ? 'bg-black/20' : 'bg-black/70'
      }`}
    >
      <div className="absolute inset-0 z-0">
        <AttackIcon attack={attack} size={64} />
      </div>

      {onCooldown && (
        <span
          className="absolute inset-x-0 bottom-0 z-10 bg-gray-600/75"
          style={{ height: `${overlayHeight}%` }}
        />
      )}

      <span className="absolute left-1 top-1 z-20 text-sm text-white">
        {label}
      </span>
      <span className="absolute inset-0 z-20 flex text-lg items-center justify-center text-white">
        {onCooldown && `${remaining.toFixed(1)}s`}
      </span>
    </div>
  )
}
