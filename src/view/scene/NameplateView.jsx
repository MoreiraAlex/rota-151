'use client'

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useQuery, useQueryFirst, useTrait } from 'koota/react'
import { Html } from '@react-three/drei'
import { getSpecies, getPlayerSpecies } from '@/core/data/species'
import { verticalClearance } from '@/core/physics/colliders'
import { clamp } from '@/core/math/clamp'
import { GAME_CONFIG } from '@/core/gameConfig'
import {
  InputControlled,
  Position,
  SummonedCreature,
  Vitals,
  WildCreature,
} from '@/core/traits'
import { formatSpeciesName, VitalBar } from '../shared/statusDisplay'

// Margem (m) além do topo da cápsula (`verticalClearance`,
// `core/physics/colliders.js`) — sem isso a etiqueta ficaria colada
// exatamente no topo da cabeça, meio "enterrada" visualmente.
const HEAD_MARGIN = 0.8

// Escala (CSS `transform: scale(...)`) do TAMANHO BASE, EM TELA, da
// etiqueta — pedido do usuário, "6ª rodada": "quero deixar um tamanho
// fixo em relação a distâncias, mas que eu possa configurar esse valor
// fixo". `1` = tamanho de referência (as classes Tailwind do bloco
// abaixo); ajusta este NÚMERO único pra deixar a etiqueta maior/menor
// em tela, sem editar `w-28`/`text-[10px]`/etc. um por um. Multiplicado
// pelo fator de distância (`NAMEPLATE_DISTANCE_MIN_SCALE`/`_MAX_SCALE`,
// abaixo) — ver docstring de `NameplateView` pro porquê da escala por
// distância ter voltado, "12ª rodada".
const NAMEPLATE_SCALE = 1

// Fator de escala por DISTÂNCIA da câmera — pedido do usuário, "12ª
// rodada": "ele ainda tá sendo proporcional ao zoom... uma tentativa é
// fazer o inverso do que tá sendo feito: quando der o zoom [aproximar]
// diminuir o nameplate, e quando afastar aumentar proporcionalmente".
// Interpola LINEARMENTE entre esses dois valores conforme a distância
// câmera-entidade vai de `GAME_CONFIG.CAMERA.MIN_DISTANCE` (zoom
// máximo, mais perto — escala MÍNIMA) a `MAX_DISTANCE` (zoom mínimo,
// mais longe — escala MÁXIMA). Ajusta os dois números olhando o
// resultado em jogo — não verificado visualmente neste sandbox (sem
// navegador).
const NAMEPLATE_DISTANCE_MIN_SCALE = 1.5
const NAMEPLATE_DISTANCE_MAX_SCALE = 0.4

/**
 * De quem é esta entidade — as TRÊS únicas fontes de `Vitals` hoje
 * (`SummonedCreature`/`WildCreature`/treinador, ver docstring de
 * `NameplatesView` abaixo), mesmo critério de eliminação que
 * `resolveControlledSpecies` (`cameraFollowSystem.js`) já usa pra
 * distinguir treinador de criatura, só que com um terceiro caso.
 */
function resolveEntitySpecies(entity) {
  const summoned = entity.get(SummonedCreature)
  if (summoned) return getSpecies(summoned.speciesId)
  const wild = entity.get(WildCreature)
  if (wild) return getSpecies(wild.speciesId)
  return getPlayerSpecies()
}

/**
 * Etiqueta acima da cabeça de UMA entidade — nome (espécie formatada),
 * nível (opcional, `species.level` — fixo POR ESPÉCIE, sem XP/progressão
 * por trás; ausente = campo não aparece, caso do treinador, ver
 * `core/data/species/boy/index.js`), barra de vida e de stamina. Pedido
 * do usuário: "quero elementos no jogo... para cada entidade, a cima da
 * cabeça, nome, nivel, vida e stamina" (docs/features/027-hud-de-status-e-habilidades.md) — TODO mundo (time, selvagens, o próprio
 * treinador), EXCETO quem está `InputControlled` agora (ver
 * `NameplatesView` abaixo — essa entidade já tem `StatusHud.jsx`, 2ª
 * rodada, pedido explícito: "a entidade que estou no controle, não
 * precisa exibir a barra em cima da cabeça").
 *
 * `<Html center>` (drei) em vez de `Billboard`+`Text` 3D: já é DOM
 * (reaproveita o MESMO vocabulário visual — Tailwind, `bg-black/70`,
 * texto pequeno — que toda outra HUD deste projeto já usa,
 * `PartyHud.jsx`/`SkillsHud.jsx`/`DebugPanel.jsx`) e já fica de frente
 * pra câmera sozinho (é um overlay 2D projetado pela posição 3D, não uma
 * malha rotacionada) — sem precisar de `Billboard` pra cancelar a
 * rotação do corpo por baixo.
 *
 * `transform={false}` (default do drei, mas passado EXPLÍCITO aqui) +
 * SEM `distanceFactor` do PRÓPRIO drei — usuário relatou (5ª e 6ª
 * rodadas) que a etiqueta "ainda tá proporcional ao zoom, conforme vou
 * aproximando a câmera, ele vai ficando pequeno, e quando afasto ele
 * vai ficando grande". Investigado o código-fonte do drei
 * (`@react-three/drei/web/Html.js`, v9.122.0, instalada): sem
 * `transform`/`distanceFactor`, o elemento é posicionado por
 * `translate3d(x,y,0) scale(s)` com `s = distanceFactor === undefined ?
 * 1 : ...` — SEMPRE `scale(1)` para QUALQUER distância de câmera; o
 * `<Html>` em SI não tem nenhum termo de escala dependente de distância
 * — o tamanho em pixel dele é, e sempre foi, fixo.
 *
 * A hipótese na 6ª rodada era que o usuário estava vendo um EFEITO
 * RELATIVO (o modelo 3D crescendo/encolhendo normalmente com a
 * distância, fazendo a etiqueta de tamanho fixo PARECER encolher/
 * crescer por comparação) — explicado, mas o usuário continuou
 * insatisfeito na 12ª rodada e pediu uma abordagem diferente: "uma
 * tentativa é tentar fazer o inverso do que tá sendo feito, quando der
 * o zoom diminuir o nameplate e quando afastar aumentar o nameplate
 * proporcionalmente". Em vez de insistir no tamanho fixo (que,
 * tecnicamente, já era garantido pelo `<Html>` desde a 6ª rodada), esta
 * rodada implementa escala por distância DE PROPÓSITO — e na direção
 * pedida: mais PERTO da câmera = etiqueta MENOR; mais LONGE = etiqueta
 * MAIOR. Isso é o OPOSTO tanto de perspectiva 3D normal (um objeto de
 * tamanho fixo no mundo fica maior perto, menor longe) quanto do
 * `distanceFactor` do próprio drei (mesma fórmula/direção) — por isso
 * não dá pra simplesmente ligar `distanceFactor`; o cálculo é feito na
 * mão, abaixo, com a relação invertida de propósito.
 *
 * `NAMEPLATE_SCALE` (base, configurável — 6ª rodada) × fator de
 * distância (`NAMEPLATE_DISTANCE_MIN_SCALE`/`_MAX_SCALE`, novo — ver
 * comentário das constantes acima) — a distância câmera-entidade é
 * calculada TODO FRAME dentro do MESMO `useFrame` que já atualiza a
 * posição do `<group>` (sem assinatura extra no R3F), mapeada pro
 * intervalo de zoom de verdade do jogo (`GAME_CONFIG.CAMERA.
 * MIN_DISTANCE`/`MAX_DISTANCE`, `2.5`–`25`) via `clamp` + interpolação
 * linear, e escrita DIRETO no `style.transform` do elemento (via
 * `contentRef`, mutação de DOM, não `useState`) — mesmo motivo de
 * performance que `group.position.set(...)` já usa aqui embaixo: mudar
 * isso todo frame via React re-renderizaria o componente inteiro 60x
 * por segundo à toa.
 *
 * Posicionamento: NÃO usa `registerView`/`syncTransformSystem` (o padrão
 * de `AttackEffectView.jsx`/`RecallBeamView.jsx`) de propósito — essa
 * entidade JÁ TEM um view registrado (o modelo animado, via
 * `useAnimatedModel.js`), e o registro é um Map de UM valor por
 * entidade; registrar de novo aqui SUBSTITUIRIA a referência do modelo,
 * quebrando o `syncTransformSystem` pra ele. Em vez disso, `useFrame`
 * próprio lê `entity.get(Position)` direto e escreve na posição do
 * grupo — mesma técnica (e mesmo motivo: overlay cosmético que só
 * ACOMPANHA a posição, nunca a escreve) que `AttackRangeDebugView.jsx`
 * já usa. A etiqueta fica um pouco ACIMA do topo da cápsula
 * (`verticalClearance`, `core/physics/colliders.js`) + `HEAD_MARGIN`.
 *
 * Vida/stamina lidas via `useTrait` — `vitalsRegenSystem.js` MUTA os
 * campos por referência todo tick, e o hook já reage a isso (mesmo
 * padrão de `SkillsHud.jsx`/`DebugPanel.jsx`), sem polling manual pros
 * NÚMEROS (só a posição precisa de `useFrame`, os números já são
 * reativos por conta própria).
 *
 * Sem oclusão (não checa se tem parede entre a câmera e a entidade) —
 * `<Html>`, sendo overlay DOM, sempre desenha por cima de tudo,
 * inclusive atrás de obstáculo. `occlude` do drei resolveria, mas exige
 * raycast contra a cena (custo + risco de configurar errado sem poder
 * testar visualmente neste sandbox) — deixado de fora nesta rodada.
 */
function NameplateView({ entity, species }) {
  const groupRef = useRef()
  const contentRef = useRef()
  const vitals = useTrait(entity, Vitals)

  useFrame((state) => {
    const group = groupRef.current
    const pos = entity.get(Position)
    if (!group || !pos) return
    group.position.set(pos.x, pos.y, pos.z)

    const content = contentRef.current
    if (!content) return
    const { MIN_DISTANCE, MAX_DISTANCE } = GAME_CONFIG.CAMERA
    const distance = state.camera.position.distanceTo(group.position)
    const t = clamp(
      (distance - MIN_DISTANCE) / (MAX_DISTANCE - MIN_DISTANCE),
      0,
      1,
    )
    const distanceScale =
      NAMEPLATE_DISTANCE_MIN_SCALE +
      (NAMEPLATE_DISTANCE_MAX_SCALE - NAMEPLATE_DISTANCE_MIN_SCALE) * t
    content.style.transform = `scale(${NAMEPLATE_SCALE * distanceScale})`
  })

  if (!vitals) return null

  const headHeight = verticalClearance(species.body) + HEAD_MARGIN

  return (
    <group ref={groupRef}>
      <Html
        center
        transform={false}
        position={[0, headHeight, 0]}
        className="pointer-events-none"
      >
        <div
          ref={contentRef}
          className="flex w-28 flex-col items-center gap-0.5 rounded px-1.5 py-1 font-mono text-[10px] "
          style={{ transform: `scale(${NAMEPLATE_SCALE})` }}
        >
          <div className="flex w-full items-center justify-center gap-1">
            <span className="truncate">{formatSpeciesName(species.id)}</span>
            {species.level != null && (
              <span className="shrink-0 text-white/50">Lv.{species.level}</span>
            )}
          </div>
          <VitalBar
            height={2}
            value={vitals.hp}
            max={vitals.maxHp}
            colorClass="bg-emerald-500"
          />
          <VitalBar
            height={1}
            value={vitals.stamina}
            max={vitals.maxStamina}
            colorClass="bg-sky-400"
          />
        </div>
      </Html>
    </group>
  )
}

/**
 * Renderiza uma `NameplateView` por entidade com `Vitals` — hoje só três
 * fontes existem (`SummonedCreature`/`WildCreature`/treinador, ver
 * `resolveEntitySpecies` acima), então `useQuery(Vitals, Position)`
 * sozinho já cobre exatamente os três, sem precisar de três queries
 * separadas. `useQuery` é reativo — monta/desmonta sozinho quando uma
 * criatura nasce/morre/é recolhida.
 *
 * Exclui quem tem `InputControlled` — pedido do usuário: "a entidade que
 * estou no controle, não precisa exibir a barra em cima da cabeça" (ela
 * já tem o próprio resumo em `tools/hud/StatusHud.jsx`, canto superior
 * esquerdo da tela — mostrar as duas juntas seria redundante, e a
 * etiqueta 3D fica logo atrás da câmera na visão em terceira pessoa
 * mesmo assim, quase nunca visível de qualquer forma).
 *
 * Bug real, relatado jogando: "você está ocultando o Nameplate apenas
 * do trainer, até quando estou controlando uma criatura, está oculto o
 * Nameplate do trainer". Causa — `entity.has(InputControlled)` era
 * checado DENTRO do `.map()`, mas `InputControlled` não fazia parte da
 * lista de traits do `useQuery(Vitals, Position)` — trocar de controle
 * (`controlSwitchSystem.js`, `current.remove(InputControlled);
 * target.add(InputControlled)`) não adiciona nem remove `Vitals`/
 * `Position` de ninguém, só REPOSICIONA a tag entre duas entidades que
 * JÁ estavam na lista — então o koota nunca via motivo pra este
 * componente re-renderizar, e o `.map()` continuava rodando com o
 * resultado da última vez que ELE tinha re-renderizado por outro motivo
 * (normalmente a montagem inicial, quando o treinador é quem começa
 * controlado) — o filtro "travava" em quem estava controlado NAQUELE
 * momento, não em quem está controlado AGORA.
 *
 * Corrigido lendo `InputControlled` com seu PRÓPRIO hook reativo
 * (`useQueryFirst`, mesma técnica que `SkillsHud.jsx`/`DebugPanel.jsx`
 * já usam pra achar "quem está sendo pilotado agora") — QUALQUER troca
 * de controle dispara um re-render deste componente (é exatamente a
 * trait que este hook observa), e a comparação por igualdade de
 * entidade (`entity === controlled`) dentro do `.map()` sempre reflete
 * o valor fresco.
 */
export function NameplatesView() {
  const entities = useQuery(Vitals, Position)
  const controlled = useQueryFirst(InputControlled)

  return (
    <>
      {entities.map((entity) => {
        if (entity === controlled) return null
        const species = resolveEntitySpecies(entity)
        if (!species) return null
        return <NameplateView key={entity} entity={entity} species={species} />
      })}
    </>
  )
}
