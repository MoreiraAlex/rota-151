'use client'

import { useTrait, useQuery, useQueryFirst } from 'koota/react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeftRight } from 'lucide-react'
import { playerEntity } from '@/core/world/world'
import { getSpecies } from '@/core/data/species'
import { InputControlled, Party, SummonedCreature, Vitals } from '@/core/traits'
import {
  formatSpeciesName,
  KeyHint,
  resolveXpPercent,
  SpritePortrait,
  VitalBar,
} from '@/view/shared/statusDisplay'
import { CARD_TRANSITION, statusLayoutId } from './statusMotion'

const PARTY_SLOTS = [
  { key: 'slot1', label: 'Q', trade: '1' },
  { key: 'slot2', label: 'E', trade: '2' },
  { key: 'slot3', label: 'R', trade: '3' },
]

// Ícone (img, não lucide-react) da tecla de invocar/recolher — pokébola
// FECHADA (criatura equipada, ainda dentro dela, tecla libera) ou ABERTA
// (criatura já invocada, tecla recolhe) — pedido do usuário, "10ª
// rodada": "quero poder colocar além de ícone, img tb, peguei umas
// imagens aqui". Usa os dois arquivos que o usuário adicionou em
// `public/assets/sprites/pokebola/default/`.
const POKEBALL_CLOSED = '/assets/sprites/pokebola/default/poke_fechada.png'
const POKEBALL_OPEN = '/assets/sprites/pokebola/default/poke_aberta.png'

/**
 * HUD real (não-debug, ver `docs/backlog.md` — "HUD real (não-debug)") —
 * mostra os 3 slots do time (mesma tecla física que já invoca/recolhe,
 * `secondary1-3` — ver docs/features/011-slots-de-acao.md), lado a lado.
 *
 * Só exibe — não deixa trocar o que está equipado (ver
 * docs/features/018-preview-de-equipamento-no-inventario.md). Equipar é
 * responsabilidade só do Inventário (menu de pausa), que mostra em tempo
 * real pra onde vai; o HUD existia clicável até essa versão, mas ter dois
 * lugares fazendo a mesma coisa é confuso, então essa responsabilidade
 * saiu daqui.
 *
 * Sempre montado (ver `src/app/(auth)/page.js`) — ver time/item equipado é
 * jogo, não ferramenta de dev.
 *
 * **Slot de clique saiu daqui (5ª rodada, docs/features/027-hud-de-status-e-habilidades.md)** — pedido do usuário: "preciso que o slot de
 * clique saia do slotParty, quero ele no canto inferior direito". Virou
 * `tools/hud/ActionSlotHud.jsx`, próprio arquivo/posição — este
 * componente agora só mostra os 3 slots do time.
 *
 * **Slots do time viraram cards de status (4ª rodada, docs/features/027-hud-de-status-e-habilidades.md)** — pedido do usuário: "no HUD dos slots,
 * quero deixar uma otimizada... preciso enxergar tb vida, stamina, level,
 * xp" — cada slot equipado mostra `SpritePortrait` (retrato + anel de
 * XP)/nome/nível + barra de vida/stamina, SEMPRE (ver docstring de
 * `PartySlotCard` abaixo — "5ª rodada" corrigiu isso pra aparecer mesmo
 * fora de campo, não só quando a criatura está DE FATO no mundo).
 *
 * **Slot da criatura controlada SOME (7ª rodada, docs/features/027-hud-de-status-e-habilidades.md)** — pedido do usuário corrigindo a 4ª
 * rodada: "quando eu controlar uma criatura: o slot dela na party tem
 * que sumir e não ser trocado pelo do treinador". Antes, esse slot
 * trocava pro card do TREINADOR (ver histórico abaixo) — decisão
 * revertida; agora o treinador ganhou o próprio card, MENOR, embaixo do
 * `StatusHud.jsx` principal (`tools/hud/StatusHud.jsx`, "7ª rodada"),
 * então não precisa mais "se esconder" dentro do PartyHud pra aparecer
 * em algum lugar. `InputControlled` lido via `useQueryFirst` (reativo —
 * comparar entidade por igualdade, não `entity.has(...)` solto, é o que
 * corrige o mesmo bug já achado em `NameplateView.jsx`, "3ª rodada":
 * `.has()` fora de um hook reativo não dispara re-render numa troca de
 * controle) direto em `PartyHud` — a decisão de sumir é tomada ALI, o
 * slot controlado nem chega a montar `PartySlotCard`.
 *
 * **Transições suaves (8ª rodada, docs/features/027-hud-de-status-e-habilidades.md)** — pedido do usuário: "quero ver a troca sendo realizada,
 * se possível... demais HUDs das criaturas se adequarem à ordem". Dois
 * mecanismos do Framer Motion cobrem isso:
 * - `<AnimatePresence>` ao redor do `.map()` — React já retorna `null`
 *   pro slot controlado (comportamento de sempre, ver acima); o que
 *   muda é que agora esse `null` é reconhecido pelo AnimatePresence
 *   como "a criança com esta `key` saiu", permitindo uma transição em
 *   vez de sumir/aparecer instantâneo (suporte documentado do Framer
 *   Motion pra esse padrão exato — `array.map(x => cond ? <M key/> :
 *   null)`).
 * - `layout` (prop, em `motion.div`) em CADA slot restante — quando um
 *   slot soma na lista (o `.map()` produz um item a menos), os OUTROS
 *   `motion.div layout` animam sozinhos a nova posição em vez de
 *   "pular" pro lugar — é isso que cobre "demais HUDs das criaturas se
 *   adequarem à ordem".
 *
 * `PartySlotCard` some com `layoutId={statusLayoutId(slot)}`
 * (`tools/hud/statusMotion.js`) — MESMO id que `StatusHud.jsx` usa no
 * card principal quando ESSA criatura passa a estar no controle; ver
 * docstring de `statusLayoutId` pro mecanismo completo de "subir até o
 * topo" entre os dois arquivos.
 *
 * **`mode="popLayout"` (correção, mesma 8ª rodada)** — bug relatado:
 * "qualquer troca faz tudo parecer descer para no final subir tudo de
 * novo". Causa: o modo PADRÃO do `AnimatePresence` (`"sync"`) mantém o
 * elemento que está SAINDO ocupando o espaço dele no `flex` normal
 * enquanto a animação de saída roda (só o `opacity` muda, a caixa
 * continua lá) — os slots ABAIXO dele só se movem quando ele
 * finalmente desmonta de verdade, ou seja: primeiro nada se mexe
 * (empurrado pra baixo pela caixa "fantasma" que ainda existe),
 * depois, de repente, tudo pula pra cima quando a caixa some. Com
 * `mode="popLayout"`, o elemento saindo é tirado do fluxo do layout
 * IMEDIATAMENTE (vira `position: absolute` por baixo dos panos, ver
 * doc do Framer Motion) — os vizinhos já sabem a posição final deles
 * desde o primeiro frame da transição, então animam direto pra lá, sem
 * o "empurrão" temporário.
 *
 * **`items-start` no wrapper (correção, achado ao investigar o mesmo
 * bug em `StatusHud.jsx`, ver docstring lá)** — sem declarar
 * `align-items`, o default de um flex container é `stretch`: o slot
 * VAZIO (`HudSlot`, `w-20`) sentado ao lado de `PartySlotCard`s
 * (`w-40`) seria ESTICADO pra largura do irmão mais largo, a caixa de
 * fora (borda + fundo) ficando do tamanho errado por cima do conteúdo
 * menor — mesma causa raiz do bug do card compacto do treinador.
 *
 * **`KeyHint` — indicadores de tecla redesenhados (9ª rodada)** — bug
 * relatado: "os indicadores de tecla nos slots party tão estranho,
 * tando o de invocar (Q/E/R) quanto trocar (1/2/3/4)". `label`
 * (Q/E/R, invoca/recolhe) e `trade` (1/2/3, troca de controle) eram
 * texto solto e IDÊNTICO visualmente nos dois cantos — nada comunicava
 * que são duas ações diferentes. Trocado por `KeyHint`
 * (`view/shared/statusDisplay.jsx`, ver docstring lá pro raciocínio
 * completo) — badge com ícone. O badge de `trade` agora é SEMPRE
 * renderizado (`dim={!active}` em vez de `{active && trade && ...}`)
 * — o espaço fica reservado, só fica apagado até a criatura estar
 * invocada, sem o layout "pular".
 *
 * **Ícone de invocar vira pokébola de verdade (10ª rodada)** — pedido
 * do usuário: "quero poder colocar além de ícone, img tb, peguei umas
 * imagens aqui" — trocou o ícone genérico `CircleArrowDown` pelas duas
 * imagens de pokébola que ele adicionou (`POKEBALL_CLOSED`/`_OPEN`,
 * acima). Em `PartySlotCard`, a bola reflete o estado de VERDADE
 * (`active`) — fechada (criatura ainda dentro, tecla libera) ou aberta
 * (criatura já em campo, tecla recolhe); em `HudSlot` (slot vazio,
 * sem criatura), sempre fechada.
 *
 * **Pokébola apaga (`dim`) enquanto uma CRIATURA está no controle (13ª
 * rodada)** — pedido do usuário: "preciso que esse dim seja true
 * quando eu tiver controlando as criaturas". Não é só estética — é o
 * mecanismo de verdade: `partySummonSystem.js` (ver docstring lá)
 * restringe a reação a `secondary1-3` (Q/E/R) a `entity.has(
 * InputControlled)` — ENQUANTO uma criatura está no controle, essas
 * teclas são reservadas pras skills dela (`SkillsHud.jsx`), não
 * invocam/recolhem por cima; só voltam a invocar/recolher quando o
 * TREINADOR está no controle. `controllingCreature` (`controlled &&
 * controlled !== playerEntity`) captura exatamente essa condição —
 * mesmo critério que `StatusHud.jsx` já usa (`trainerControlled`,
 * invertido) pra distinguir quem está pilotando. Passado pra baixo
 * pros dois componentes (`PartySlotCard` E `HudSlot`) — a tecla
 * também não faz nada nos slots vazios enquanto isso.
 */
export function PartyHud() {
  const party = useTrait(playerEntity, Party)
  const summoned = useQuery(SummonedCreature)
  const controlled = useQueryFirst(InputControlled)
  const controllingCreature = !!controlled && controlled !== playerEntity

  if (!party) return null

  return (
    <div className="pointer-events-none absolute top-1/4 left-4 flex flex-col items-start gap-2 font-mono text-xs text-white">
      <AnimatePresence mode="popLayout">
        {PARTY_SLOTS.map(({ key: slot, label, trade }) => {
          const speciesId = party[slot]
          if (!speciesId) {
            return (
              <HudSlot
                key={slot}
                label={label}
                value={null}
                dimInvoke={controllingCreature}
              />
            )
          }

          const activeEntity = summoned.find(
            (entity) => entity.get(SummonedCreature).slot === slot,
          )

          if (activeEntity && activeEntity === controlled) return null

          return (
            <PartySlotCard
              key={slot}
              slot={slot}
              label={label}
              trade={trade}
              speciesId={speciesId}
              activeEntity={activeEntity}
              dimInvoke={controllingCreature}
            />
          )
        })}
      </AnimatePresence>
    </div>
  )
}

/**
 * Um slot de time EQUIPADO (e NÃO controlado agora — `PartyHud` filtra
 * isso antes de montar este componente, ver docstring lá, "7ª rodada").
 * `activeEntity` pode ser `undefined` (criatura equipada mas não
 * invocada agora) — `useTrait(undefined, Vitals)` é seguro (mesmo
 * padrão gracioso que `SkillsHud.jsx` já usa pra `controlled`
 * possivelmente nulo).
 *
 * **Vida/stamina aparecem SEMPRE, invocada ou não** (pedido do usuário,
 * "5ª rodada", correção: "preciso que os vitals apareçam sempre,
 * independente se a criatura tá invocada ou não" — antes, sem
 * `activeEntity`, a barra sumia por falta de `Vitals` de verdade pra
 * ler). Sem entidade viva (criatura só equipada, nunca invocada — não
 * existe corpo físico, logo não existe trait `Vitals` pra ler), cai no
 * máximo ESTÁTICO configurado na espécie (`species.vitals.maxHp`/
 * `.maxStamina`, `_template/index.js`; `100`/`100` se a espécie nem
 * declarou `vitals`, mesmo default do trait `Vitals`) mostrado CHEIO —
 * não há combate acontecendo fora de campo que justifique outro valor.
 */
function PartySlotCard({
  slot,
  label,
  trade,
  speciesId,
  activeEntity,
  dimInvoke,
}) {
  const liveVitals = useTrait(activeEntity, Vitals)

  const species = getSpecies(speciesId)
  const active = !!activeEntity

  if (!species) {
    return <HudSlot label={label} value={null} dimInvoke={dimInvoke} />
  }

  const maxHp = species.vitals?.maxHp ?? 100
  const maxStamina = species.vitals?.maxStamina ?? 100
  const hp = liveVitals?.hp ?? maxHp
  const stamina = liveVitals?.stamina ?? maxStamina

  return (
    <motion.div
      layout
      layoutId={statusLayoutId(slot)}
      transition={CARD_TRANSITION}
      initial={{ opacity: 0, x: -50 }}
      animate={{ opacity: 1, x: 0}}
      exit={{ opacity: 0 }}
      className={`flex w-40 items-center gap-2 rounded border p-1.5  border-white/10 bg-black/10 font-mono text-white 
  
      `}
    >
      <SpritePortrait
        species={species}
        size={36}
        xpPercent={resolveXpPercent(species)}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-center justify-between gap-1">
          <KeyHint
            keyLabel={label}
            img={active ? POKEBALL_OPEN : POKEBALL_CLOSED}
            dim={dimInvoke}
          />
          {trade && (
            <KeyHint
              keyLabel={trade}
              icon={ArrowLeftRight}
              variant="accent"
              dim={!active}
            />
          )}
        </div>
        <div className="flex items-center gap-1">
          <span className="truncate text-[11px]">
            {formatSpeciesName(species.id)}
          </span>
          {species.level != null && (
            <span className="shrink-0 text-[10px] text-white/50">
              Lv.{species.level}
            </span>
          )}
        </div>
        <VitalBar
          height={1}
          value={hp}
          max={maxHp}
          colorClass="bg-emerald-500"
        />
        <VitalBar
          height={1}
          value={stamina}
          max={maxStamina}
          colorClass="bg-sky-400"
        />
      </div>
    </motion.div>
  )
}

/** Um slot vazio/o item na mão — só leitura, sem clique/seletor (ver
 * Decisões da v0.0.18). `layout` (sem `layoutId`, este nunca "vira" um
 * card em outro lugar) pra também se ajustar quando os vizinhos
 * entram/saem — mesmo raciocínio de `PartySlotCard`. Sem `KeyHint` de
 * `trade` — slot vazio não tem criatura pra pilotar. */
function HudSlot({
  label,
  trade,
  value,
  emptyLabel = 'vazio',
  preview,
  dimInvoke,
}) {
  return (
    <motion.div
      layout
      transition={CARD_TRANSITION}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex w-20 flex-col items-center gap-0.5 rounded border border-white/20 bg-black/70 p-1.5"
    >
      <div className="flex w-full justify-between">
        <KeyHint keyLabel={label} img={POKEBALL_CLOSED} dim={dimInvoke} />
        {trade && (
          <KeyHint keyLabel={trade} icon={ArrowLeftRight} variant="accent" dim />
        )}
      </div>
      {preview}
      <span className="w-full truncate text-center">{value ?? emptyLabel}</span>
    </motion.div>
  )
}
