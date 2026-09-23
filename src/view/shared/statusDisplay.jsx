import Image from 'next/image'
import { CREATURE_TINTS } from '@/view/creatureTints'
import { ATTACK_COLORS } from '@/view/attackColors'

/**
 * Formatação/UI compartilhadas entre "onde mostrar nome/nível/vida/
 * stamina/sprite/XP de uma entidade" — hoje três consumidores:
 * `view/scene/NameplateView.jsx` (etiqueta acima da cabeça, TODA
 * entidade), `tools/hud/StatusHud.jsx` (canto superior esquerdo, só a
 * entidade CONTROLADA) e `tools/hud/PartyHud.jsx` (os 3 slots do time),
 * ver docs/features/027-hud-de-status-e-habilidades.md. Fica em
 * `view/shared/` (não `tools/shared/`) porque `NameplateView.jsx` é
 * view — a direção de dependência do projeto é tools → view, nunca o
 * inverso (ver docstring de `GameScene.jsx`), então um helper usado pela
 * view não pode morar em `tools/`. `CREATURE_TINTS` é lido direto daqui
 * (não via `getSlotColor`, `tools/shared/SlotPreview.jsx`) pelo mesmo
 * motivo — aquele helper mora em `tools/`, este arquivo não pode
 * importar de lá.
 *
 * `AttackIcon` (5ª rodada) segue o mesmo princípio pro lado dos
 * ATAQUES/skills — dois consumidores: `tools/hud/SkillsHud.jsx` (Q/E/R)
 * e `tools/hud/ActionSlotHud.jsx` (clique, quando é criatura no
 * controle) — mesmo ícone reaproveitado por `SkillsHud.jsx`'s
 * `SkillSlot`, que por sua vez também é exportado e reaproveitado por
 * `ActionSlotHud.jsx`.
 *
 * `KeyHint` (9ª rodada) — dois consumidores: `tools/hud/PartyHud.jsx`
 * (Q/E/R invocar + 1/2/3 pilotar, nos cards do time) e `tools/hud/
 * StatusHud.jsx` (4, voltar a pilotar o treinador, no card compacto).
 */

/** "bulbasaur" → "Bulbasaur", "fox-red" → "Fox Red" — sem apelido
 * individual (nenhuma criatura tem nome próprio hoje), só a espécie
 * formatada. */
export function formatSpeciesName(id) {
  return id
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

/**
 * Barra fina (vida OU stamina) — preenchimento por `width` em
 * porcentagem, mesma técnica de "escalar por cima com %" que
 * `SkillsHud.jsx`/`DebugPanel.jsx` já usam (lá é `height`, vertical, pro
 * véu de cooldown; aqui é `width`, horizontal — convenção mais comum de
 * barra de vida/stamina).
 *
 * **Correção: barra de stamina "sumia"** — relatado: "a barra de
 * stamina sumiu dos huds e do nameplate". Causa: `height` virava classe
 * Tailwind DINÂMICA (`` `h-${height}` ``) — o scanner do Tailwind (JIT,
 * `tailwindcss` v3) só gera CSS pra classes cujo texto LITERAL apareça
 * em algum arquivo fonte; uma interpolação como `h-${height}` nunca
 * "existe" como string completa no código-fonte, só em tempo de
 * execução, então o Tailwind nunca gera `.h-1`/`.h-3` (confirmado
 * rodando `npx tailwindcss` de verdade e conferindo o CSS compilado —
 * só `.h-2`/`.h-5` saíram, porque essas duas strings, coincidência,
 * aparecem LITERAIS em outros componentes sem relação nenhuma,
 * `DebugPanel.jsx`/`SlotPreview.jsx`). Sem `.h-1`/`.h-3` de verdade, a
 * barra (o `div` de fora, que dita a altura — o de dentro só é
 * `h-full`, 100% do pai) colava em ALTURA ZERO — some. `NameplateView.
 * jsx` (stamina, `height={1}`) e `PartyHud.jsx` (vida E stamina, as
 * duas `height={1}`) caíam exatamente nesse buraco.
 *
 * Corrigido tirando `height` da classe Tailwind — vira `style={{
 * height: ... }}` calculado em REM, seguindo a MESMA escala numérica
 * do Tailwind (`1` unidade = `0.25rem`, confirmado no CSS compilado:
 * `.h-2` = `0.5rem`, `.h-5` = `1.25rem`, exatamente `altura * 0.25`) —
 * mesmo resultado visual de antes pra quem já funcionava (`h-2`/`h-5`),
 * e agora funciona pra QUALQUER valor de `height`, sem depender de
 * nenhuma outra parte do código ter usado aquele número em algum lugar
 * por coincidência.
 */
export function VitalBar({ height, value, max, colorClass, activeValue }) {
  const pct = max > 0 ? Math.max(0, Math.min(1, value / max)) * 100 : 0
  return (
    <div
      className="w-full overflow-hidden rounded bg-white/20"
      style={{ height: `${height * 0.25}rem` }}
    >
      <div className={`h-full ${colorClass}`} style={{ width: `${pct}%` }}>
         {activeValue && (
            <span>{Math.floor(value)}/{max}</span>
          )}
      </div>
    </div>
  )
}

/**
 * Fração de XP (0 a 1) — `species.xp` (opcional, `{ current, max }`,
 * mesmo espírito de `level`: sem sistema de progressão de verdade por
 * trás, só um NÚMERO de exibição pro anel — ver docstring completa em
 * `_template/index.js`). Sem `xp` configurado (nenhuma espécie tem
 * ainda), o anel nasce vazio (0%) — capacidade pronta, conteúdo depois,
 * mesmo padrão de `level`/`camera`/`sprite` nas rodadas anteriores.
 */
export function resolveXpPercent(species) {
  const xp = species?.xp
  if (!xp || !xp.max) return 0
  return Math.max(0, Math.min(1, xp.current / xp.max))
}

const RING_STROKE = 3
const RING_GAP = 3

/**
 * Anel de XP (`stroke-dasharray`/`stroke-dashoffset`, técnica clássica de
 * progresso circular em SVG — sem depender de canvas nem lib nova) ao
 * redor do retrato. `-rotate-90` no `<svg>` pra o progresso começar no
 * topo (12h) em vez da direita (0°, default de `stroke-dasharray` num
 * círculo) — convenção mais lida como "barra de progresso" pelo olho.
 */
function XpRing({ percent, size }) {
  const radius = (size - RING_STROKE) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - percent)

  return (
    <svg
      width={size}
      height={size}
      className="pointer-events-none absolute inset-0 -rotate-90"
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        strokeWidth={RING_STROKE}
        className="fill-none stroke-white/15"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        strokeWidth={RING_STROKE}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        className="fill-none stroke-amber-400"
      />
    </svg>
  )
}

/**
 * Retrato REDONDO de uma espécie, com o anel de XP ao redor — pedido do
 * usuário: "algumas [sprites] ficaram muito pequena, pode padronizar e
 * fazer todas ocupar o espaço determinado no hud e preciso que seja
 * redondo e não quadrado" + "ao redor do sprite, quero um ring que vai
 * ser a barra de XP".
 *
 * `species.sprite.path` (opcional, `_template/index.js`) — `next/image`
 * de verdade, `object-cover` (preenche o círculo, corta o excesso) DENTRO
 * de um wrapper `overflow-hidden rounded-full` (o corte redondo de
 * verdade — `next/image` em si é sempre retangular). Sem `sprite`, cai
 * no MESMO círculo colorido de sempre (`CREATURE_TINTS`).
 *
 * `species.sprite.scale` (opcional, default `1`) — pedido implícito do
 * "algumas ficaram muito pequena": sprites de fontes externas variam
 * MUITO de quanto espaço vazio/margem têm dentro do próprio arquivo
 * (confirmado nesta rodada — `object-cover` sozinho não resolve, porque
 * a margem faz parte dos PIXELS da imagem, não é espaço "cortável" pelo
 * CSS). `scale` amplia a imagem (`transform: scale(...)`) DENTRO do
 * círculo já cortado — cada espécie ajusta o próprio valor olhando o
 * resultado, mesmo "valor de partida, ajustar depois" de toda outra
 * config sem malha/medida exata (VFX, `rotationOffset`, etc.).
 */
export function SpritePortrait({ species, size = 48, xpPercent = 0 }) {
  const ringSize = size + RING_GAP * 2 + RING_STROKE
  const inset = (ringSize - size) / 2
  const path = species.sprite?.path
  const scale = species.sprite?.scale ?? 1

  return (
    <div
      className="relative shrink-0"
      style={{ width: ringSize, height: ringSize }}
    >
      <XpRing percent={xpPercent} size={ringSize} />
      <div
        className="absolute overflow-hidden rounded-full bg-black/40"
        style={{ width: size, height: size, top: inset, left: inset }}
      >
        {path ? (
          <Image
            src={path}
            alt=""
            width={size * 2}
            height={size * 2}
            className="h-full w-full object-cover"
            style={{ transform: `scale(${scale})` }}
          />
        ) : (
          <div
            className="h-full w-full"
            style={{ backgroundColor: CREATURE_TINTS[species.id] ?? '#999999' }}
          />
        )}
      </div>
    </div>
  )
}

/**
 * Ícone QUADRADO de um ataque/skill — mesmo mecanismo de `SpritePortrait`
 * (sprite de verdade quando configurado, cor de placeholder quando não),
 * mas sem o anel/corte redondo — pedido do usuário: "os slots de skill
 * vão precisar do fundo com sprite tb, de resto está bom, só preciso de
 * um bg com sprite" (não pediu pra ficar redondo — isso era específico
 * do retrato de CRIATURA — então mantém o formato quadrado que
 * `SlotPreview kind="attack"` já usava, só ganha uma imagem de verdade
 * por cima quando existir).
 *
 * `attack.sprite.path`/`.scale` (opcionais, `core/data/attacks/
 * _template/index.js`) — mesmo formato/raciocínio de `species.sprite`
 * (ver docstring de `SpritePortrait` acima): objeto com `path` +
 * `scale` opcional (default 1) pra compensar margem inconsistente
 * dentro da própria imagem. Sem `sprite` configurado, cai no quadrado
 * colorido por `ATTACK_COLORS` (`view/attackColors.js`) — mesma cor que
 * `SlotPreview kind="attack"` já resolvia, só que lida direto daqui
 * (não pode importar de `tools/shared/SlotPreview.jsx`, mesmo motivo de
 * `CREATURE_TINTS` acima). Sem `attack` (slot vazio), cai num quadrado
 * neutro transparente.
 *
 * Reaproveitado em DOIS lugares: `tools/hud/SkillsHud.jsx` (Q/E/R) e
 * `tools/hud/ActionSlotHud.jsx` (clique — ataque comum da criatura
 * controlada, "4ª rodada") — o mesmo ícone, então o mesmo componente.
 *
 * `<span className="absolute inset-0 bg-black/30" />` (edição do
 * usuário, 10ª rodada) — escurece sprites com cores muito saturadas,
 * sempre dentro do wrapper `relative` deste componente (nunca escapa
 * pra fora dele). `SkillSlot` (`tools/hud/SkillsHud.jsx`) isola este
 * componente INTEIRO num `z-0` próprio por fora — garante que esse
 * escurecimento (e qualquer outra coisa que aconteça aqui dentro,
 * inclusive o contexto de empilhamento que o `transform: scale(...)`
 * do `<Image>` abaixo já cria sozinho) nunca fique por cima da tecla/
 * véu de cooldown/contagem do slot, que têm `z-index` maior.
 */
export function AttackIcon({ attack, size = 20 }) {
  if (!attack) {
    return (
      <div
        className="shrink-0 rounded bg-white/10"
        style={{ width: size, height: size }}
      />
    )
  }

  const path = attack.sprite?.path
  const scale = attack.sprite?.scale ?? 1

  if (!path) {
    return (
      <div
        className="shrink-0 rounded"
        style={{
          width: size,
          height: size,
          backgroundColor: ATTACK_COLORS[attack.id] ?? '#999999',
        }}
      />
    )
  }

  return (
    <div
      className="relative shrink-0 overflow-hidden rounded"
      style={{ width: size, height: size }}
    >
      <Image
        src={path}
        alt=""
        width={size * 2}
        height={size * 2}
        className="h-full w-full object-cover"
        style={{ transform: `scale(${scale})` }}
      />
      <span className="absolute inset-0 bg-black/25" />
    </div>
  )
}

/**
 * "Tecla" visual pra uma ação de teclado — pedido do usuário sobre o
 * PartyHud: "os indicadores de tecla nos slots... tando o de invocar
 * (Q/E/R) quanto trocar (1/2/3/4), tão estranho, pode sugerir uma UX
 * melhor pra isso?". O problema não era só estético: `label` (Q/E/R,
 * invoca/recolhe — `keyboardInput.js`, `secondary1-3`) e `trade`
 * (1/2/3, troca QUEM você pilota — `switchSlot1-3`) eram texto solto,
 * idêntico visualmente (mesma cor/tamanho cinza) nos dois cantos do
 * card — nada comunicava que são DUAS AÇÕES DIFERENTES, e o `trade`
 * simplesmente sumia/aparecia junto com a criatura ficar invocada ou
 * não, fazendo o layout "pular". Confirmado no mapeamento de verdade
 * (`platform/input/keyboardInput.js`, `core/systems/
 * controlSwitchSystem.js`): Q/E/R = invocar/recolher; 1/2/3 = pilotar a
 * criatura DAQUELE slot (só funciona se ela já estiver invocada); 4 =
 * `returnToBot`, sempre volta o controle pro treinador — MESMA função
 * (`switchControlTo`) que 1/2/3, só que o alvo é fixo (o treinador),
 * por isso o MESMO ícone de "pilotar" serve pros dois.
 *
 * Escolhida entre duas opções (usuário confirmou via pergunta): badge
 * tipo tecla física (borda arredondada) + ÍCONE da ação (`lucide-
 * react`, já é dependência do projeto — usada até agora só no botão de
 * logout, `shared/components/button/logout.js`, reaproveitada aqui) —
 * o ícone comunica O QUE a tecla faz de relance, sem precisar ler/
 * decorar "Q é invocar, 1 é pilotar". `variant="accent"` (azul, mesma
 * família de cor da barra de stamina) pras teclas de PILOTAR (1/2/3/4)
 * — cor diferente de "invocar" (neutro/branco) já separa visualmente
 * as duas categorias de ação mesmo sem ler o ícone.
 *
 * `dim` (opcional) — em vez de SUMIR quando a ação ainda não está
 * disponível (criatura não invocada, não dá pra pilotar ela ainda), a
 * badge fica ali, só apagada (baixa opacidade) — o espaço fica
 * SEMPRE reservado (sem o layout "pular" quando a criatura é invocada/
 * recolhida) e ainda ensina a mecânica ("essa tecla vai servir pra
 * algo, quando a criatura estiver em campo").
 *
 * `img` (opcional, 10ª rodada) — alternativa a `icon`: pedido do
 * usuário, "quero poder colocar além de ícone, img tb, peguei umas
 * imagens aqui". Passa um PATH (`next/image`) em vez de um componente
 * `lucide-react` — usa `img` OU `icon`, nunca os dois (se `img` vier
 * preenchido, ele que desenha; `icon` é ignorado). Mesmo tamanho fixo
 * (9px) dos dois jeitos, pra não desalinhar o texto da tecla ao lado.
 */
export function KeyHint({
  keyLabel,
  icon: Icon,
  img,
  variant = 'neutral',
  dim = false,
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-0.5 rounded border px-1 py-0.5 text-[9px] leading-none ${
        variant === 'accent'
          ? 'border-sky-400/50 bg-sky-950/60 text-sky-300'
          : 'border-white/30 bg-white/10 text-white/70'
      } ${dim ? 'opacity-30' : 'opacity-100'}`}
    >
      {img ? (
        <Image
          src={img}
          alt=""
          width={18}
          height={18}
          className="h-[9px] w-[9px] shrink-0 object-contain"
        />
      ) : (
        <Icon size={9} className="shrink-0" />
      )}
      {keyLabel}
    </span>
  )
}
