'use client'

import { useQueryFirst, useTrait } from 'koota/react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeftRight } from 'lucide-react'
import { playerEntity } from '@/core/world/world'
import { getPlayerSpecies } from '@/core/data/species'
import { resolveControlledSpecies } from '@/view/systems/cameraFollowSystem'
import {
  formatSpeciesName,
  KeyHint,
  resolveXpPercent,
  SpritePortrait,
  VitalBar,
} from '@/view/shared/statusDisplay'
import { InputControlled, SummonedCreature, Vitals } from '@/core/traits'
import { CARD_TRANSITION, statusLayoutId } from './statusMotion'

/**
 * HUD real (não-debug, ver docs/backlog.md — "HUD real (não-debug)") no
 * canto superior esquerdo — nome/nível/vida/stamina de QUEM ESTÁ NO
 * CONTROLE agora (treinador OU criatura, troca sozinho ao trocar de
 * controle), com um retrato redondo + anel de XP. Pedido do usuário:
 * "quero tb um hud com as mesmas infos, mas uma area para colocar um
 * sprite no canto superior esquerdo, mas as infos tem que ser da
 * entidade que estou no controle" (docs/features/027-hud-de-status-e-habilidades.md, "2ª rodada").
 *
 * Complementa `view/scene/NameplateView.jsx` (a mesma info, mas
 * ANCORADA no mundo 3D, acima da cabeça de TODA entidade EXCETO quem
 * está controlada agora — a exclusão foi pedida junto: "a entidade que
 * estou no controle, não precisa exibir a barra em cima da cabeça",
 * justamente porque este HUD já cobre ela). `formatSpeciesName`/
 * `VitalBar`/`SpritePortrait`/`resolveXpPercent` compartilhados com
 * `NameplateView.jsx`/`PartyHud.jsx` via `view/shared/statusDisplay.jsx`
 * — mesmo texto/barra/retrato, três lugares.
 *
 * `resolveControlledSpecies` (exportada de `cameraFollowSystem.js`)
 * resolve a espécie por `SummonedCreature` presente ou, na ausência, o
 * treinador — mesmo critério que a câmera já usa pra saber quem seguir.
 *
 * Retrato+anel: `SpritePortrait` (`view/shared/statusDisplay.jsx`, "3ª/
 * 4ª rodada" — pedido do usuário: "algumas [sprites] ficaram muito
 * pequena, pode padronizar e fazer todas ocupar o espaço determinado no
 * hud e preciso que seja redondo e não quadrado" + "ao redor do sprite,
 * quero um ring que vai ser a barra de XP") — ver docstring completa lá
 * pro porquê do `sprite.scale` por espécie e da técnica do anel SVG.
 *
 * **Card menor do treinador, quando ele NÃO está no controle (7ª
 * rodada, docs/features/027-hud-de-status-e-habilidades.md)** — pedido do
 * usuário, sobre o `PartyHud` deixar de mostrar o treinador no lugar do
 * slot da criatura controlada: "deve criar outro Status HUD para o
 * treinador, só que menor e um pouco abaixo do status HUD principal (que
 * no caso vai ser o da criatura controlada)". `trainerControlled =
 * controlled === playerEntity` decide se esse segundo card aparece — só
 * some quando é o PRÓPRIO treinador que está no controle (já é o card
 * principal, mostrar os dois seria redundante). Os dois cards moram no
 * MESMO wrapper `flex flex-col` (`left-4 top-4`), então o segundo já
 * nasce logo abaixo do primeiro sozinho, sem precisar calcular um offset
 * de pixel fixo (a altura do card principal pode mudar).
 *
 * **Transições suaves (8ª rodada, docs/features/027-hud-de-status-e-habilidades.md)** — pedido do usuário: "quero ver a troca sendo realizada"
 * (subir até o topo + swipe do treinador com o principal). Os DOIS
 * cards usam `layoutId` (`statusLayoutId`, `tools/hud/statusMotion.js`
 * — mesma convenção usada por `PartyHud.jsx`, ver docstring lá pro
 * mecanismo completo do Framer Motion):
 * - **Card principal**: `layoutId` muda conforme quem está no controle
 *   — `statusLayoutId('trainer')` quando é o treinador,
 *   `statusLayoutId(summoned.slot)` quando é uma criatura. Ao trocar
 *   pra uma criatura, esse id passa a bater com o `layoutId` que o
 *   `PartySlotCard` daquele slot usava em `PartyHud.jsx` — a troca
 *   simultânea (um sai de lá, o outro entra aqui, no MESMO commit) faz
 *   o Framer Motion animar a transição entre os dois em vez de só
 *   sumir/aparecer: literalmente "a HUD da criatura subir até o topo".
 * - **Card compacto**: SEMPRE `statusLayoutId('trainer')`, o MESMO id
 *   que o card principal usa quando é o treinador quem está no
 *   controle. Ao trocar de "treinador controlado" pra "criatura
 *   controlada", o card do treinador não desmonta e remonta — ele
 *   ENCOLHE da posição/tamanho principal pra a posição/tamanho
 *   compacto (e vice-versa ao voltar) — é o "swipe com o principal"
 *   pedido.
 *
 * `<AnimatePresence>` ao redor dos dois — sem ela, o React troca a
 * `key`/desmonta o card antigo no mesmo tick sem dar chance da lib
 * animar a saída; com ela, o Framer Motion consegue reconhecer o
 * hand-off entre o card que sai e o que entra com o MESMO `layoutId` (a
 * mesma técnica documentada de "shared layout animations" da lib).
 *
 * `mode="popLayout"` — mesma correção de `PartyHud.jsx` (ver docstring
 * lá pro porquê): sem isso, o card compacto do treinador "empurraria"
 * o resto pra baixo enquanto o card principal antigo ainda está
 * ocupando espaço no `flex` durante a própria saída, só se acomodando
 * de vez quando ele desmonta — o mesmo "desce e depois sobe" relatado.
 *
 * **Bug corrigido: `compact` "não funcionava"** — relatado: "o hud dele
 * [treinador] tá do mesmo tamanho do hud das criatura controlada... o
 * espaço interno parece ter mudado, mas o bg não". Causa: `align-items`
 * de um flex container é `stretch` por PADRÃO quando não declarado —
 * o wrapper (`flex flex-col`, abaixo) não tinha `items-start`, então
 * cada `StatusCard` (item do eixo cruzado, já que o eixo principal
 * aqui é vertical) era ESTICADO pra largura do IRMÃO mais largo (o
 * card principal). O conteúdo interno (texto, portrait, `w-24`) de
 * fato encolhia com `compact` — só a CAIXA de fora (borda + `bg-black/
 * 20`, que é o próprio elemento esticado) continuava do tamanho do
 * card principal por cima do conteúdo menor. `items-start` no wrapper
 * faz cada card ocupar só a largura do PRÓPRIO conteúdo.
 *
 * **`KeyHint` no card compacto (9ª rodada)** — o usuário já tinha
 * começado a indicar a tecla `4` (`returnToBot`, `keyboardInput.js` —
 * sempre devolve o controle pro treinador, `controlSwitchSystem.js`)
 * com um texto solto; virou `KeyHint` (`view/shared/statusDisplay.jsx`,
 * ver docstring lá) igual às teclas de `PartyHud.jsx` — MESMO ícone
 * (`ArrowLeftRight`) que 1/2/3 usam lá, já que é a MESMA ação
 * (`switchControlTo`), só que o alvo é sempre o treinador. Não
 * `dim` — enquanto o card compacto existe (uma criatura está no
 * controle), apertar `4` sempre funciona.
 */
export function StatusHud() {
  const controlled = useQueryFirst(InputControlled, Vitals)
  const vitals = useTrait(controlled, Vitals)
  const trainerVitals = useTrait(playerEntity, Vitals)
  const summoned = useTrait(controlled, SummonedCreature)

  if (!controlled || !vitals) return null

  const species = resolveControlledSpecies(controlled)
  if (!species) return null

  const trainerControlled = controlled === playerEntity
  const mainLayoutId = statusLayoutId(
    trainerControlled ? 'trainer' : summoned?.slot,
  )

  return (
    <div className="pointer-events-none absolute left-4 top-4 flex flex-col items-start gap-2">
      <AnimatePresence mode="wait">
        <StatusCard
          key={mainLayoutId}
          layoutId={mainLayoutId}
          species={species}
          vitals={vitals}
          size={48}
        />
        {!trainerControlled && trainerVitals && (
          <StatusCard
            key="status-trainer-compact"
            layoutId={statusLayoutId('trainer')}
            species={getPlayerSpecies()}
            vitals={trainerVitals}
            size={32}
            compact={true}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

function StatusCard({ species, vitals, size, compact = false, layoutId }) {
  return (
    <motion.div
      layout
      layoutId={layoutId}
      transition={CARD_TRANSITION}
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0 }}
      className={`flex items-center gap-2 font-mono rounded border border-white/10 bg-black/10 text-white ${
        compact ? 'p-1.5 text-[10px]' : 'p-2 text-xs'
      }`}
    >
      <SpritePortrait
        species={species}
        size={size}
        xpPercent={resolveXpPercent(species)}
      />
      <div className={`flex flex-col gap-0.5 ${compact ? 'w-24' : 'w-52'}`}>
        <div className="flex items-center justify-between gap-1">
          <span className="truncate">{formatSpeciesName(species.id)}</span>
          {species.level != null && (
            <span className="shrink-0 text-white/50">Lv.{species.level}</span>
          )}
          {compact && <KeyHint keyLabel="4" icon={ArrowLeftRight} variant="accent" />}
        </div>
        <VitalBar
          height={compact ? 2 : 5}
          value={vitals.hp}
          max={vitals.maxHp}
          colorClass="bg-emerald-500"
          activeValue={!compact}
        />
        <VitalBar
          height={compact ? 1 : 2}
          value={vitals.stamina}
          max={vitals.maxStamina}
          colorClass="bg-sky-400"
        />
      </div>
    </motion.div>
  )
}
