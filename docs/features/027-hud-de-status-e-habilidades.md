# 027 — HUD de status e habilidades

## Resumo

Família de HUDs (não-debug, sempre montadas) que dão feedback visual de
nome, nível, vida, stamina, XP, retrato e habilidades — tanto ANCORADA
no mundo 3D (etiqueta acima da cabeça) quanto como overlay 2D de tela
(canto superior esquerdo, slots do time, skills, ataque/item na mão).
Nasceu de um pedido simples ("elementos no jogo: nome, nível, vida e
stamina acima da cabeça de cada entidade") e cresceu, ao longo de
várias rodadas de ajuste, pra cobrir status do controlado, o time
inteiro, as habilidades da criatura pilotada e o botão de clique — com
transições suaves (Framer Motion) entre os estados.

## Componentes

- **`view/scene/NameplateView.jsx`** — etiqueta ANCORADA no mundo 3D
  (`<Html center>` do drei, sem `Billboard`), acima da cabeça de TODA
  entidade com `Vitals` (treinador, time, selvagens), EXCETO quem está
  `InputControlled` agora (essa já tem o `StatusHud`). Mostra nome
  formatado, nível (se a espécie tiver), e barras de vida/stamina.
  Tamanho em tela escalado por DISTÂNCIA da câmera, de propósito e na
  direção invertida de uma perspectiva 3D normal — mais perto da
  câmera, menor; mais longe, maior (`NAMEPLATE_DISTANCE_MIN_SCALE`/
  `_MAX_SCALE`, interpolados sobre o range de zoom real do jogo,
  `GAME_CONFIG.CAMERA.MIN_DISTANCE`/`MAX_DISTANCE`) — pedido explícito
  do usuário depois de tentativas de deixar o tamanho fixo não
  agradarem visualmente.
- **`tools/hud/StatusHud.jsx`** — canto superior esquerdo. Card
  principal com retrato/nome/nível/vida/stamina de QUEM ESTÁ NO
  CONTROLE agora (treinador ou criatura, troca sozinho). Quando uma
  criatura está no controle, ganha um SEGUNDO card, menor (`compact`),
  com os vitais do treinador "de lado".
- **`tools/hud/PartyHud.jsx`** — os 3 slots do time, um card por
  criatura EQUIPADA (retrato, nome, nível, vida/stamina sempre visíveis
  — mesmo fora de campo, caindo no máximo estático da espécie). O slot
  da criatura CONTROLADA some da lista (não fica ali "trocado" por
  nada). Cada card mostra duas teclas: invocar/recolher (pokébola
  aberta/fechada, reflete se a criatura está em campo) e trocar de
  controle (só ativa se a criatura já estiver invocada).
- **`tools/hud/SkillsHud.jsx`** — Q/E/R, as habilidades
  (`attacks.secondary1-3`) da criatura controlada, com véu/contagem de
  cooldown por cima do ícone. Só visível pilotando uma criatura.
- **`tools/hud/ActionSlotHud.jsx`** — o botão de clique, canto inferior
  direito. Mostra o item na mão quando o treinador está no controle, ou
  o ataque básico (`attacks.primary`) da criatura quando é ela quem
  está sendo pilotada — reaproveita o mesmo visual/cooldown de
  `SkillsHud.jsx`.

## Dados de configuração (opcionais, "capacidade primeiro, conteúdo depois")

Todos os campos abaixo são OPCIONAIS — sem eles, cada HUD cai num
fallback gracioso (campo some, ou vira um placeholder colorido) em vez
de quebrar.

- **`species.level`** (`core/data/species/<id>/index.js`) — número FIXO
  por espécie, sem XP/progressão de verdade por trás. `boy` (treinador)
  não tem, de propósito.
- **`species.sprite.path`/`.scale`** — retrato de verdade (`next/image`)
  em vez do círculo/quadrado colorido padrão (`CREATURE_TINTS`);
  `scale` compensa margem vazia inconsistente entre sprites de fontes
  diferentes.
- **`species.xp`** (`{ current, max }`) — fração de preenchimento do
  anel de XP ao redor do retrato; sem XP configurado, o anel nasce
  vazio. Nenhum sistema de progressão real por trás.
- **`species.vitals`** — máximos/regen de HP/stamina; sem isso, usa os
  defaults do trait `Vitals` (100/100).
- **`attack.sprite.path`/`.scale`** (`core/data/attacks/<id>/index.js`
  ou via `overrides` por criatura) — mesmo mecanismo, pro ícone de
  ataque/skill; sem sprite, cai na cor de `ATTACK_COLORS`.

## `view/shared/statusDisplay.jsx` — visual compartilhado

Fica em `view/shared/` (não `tools/shared/`) porque `NameplateView.jsx`
é view, e a direção de dependência do projeto é tools → view, nunca o
inverso.

- **`formatSpeciesName`** — `"fox-red"` → `"Fox Red"`.
- **`VitalBar`** — barra fina de vida/stamina, altura configurável via
  `style` (NÃO via classe Tailwind dinâmica — ver "Bugs corrigidos").
- **`SpritePortrait`** + **`XpRing`** — retrato redondo com anel de XP
  em SVG (`stroke-dasharray`).
- **`AttackIcon`** — ícone quadrado de ataque/skill, mesmo mecanismo de
  sprite/fallback do retrato.
- **`KeyHint`** — badge de tecla (borda arredondada + ícone `lucide-
  react` OU imagem própria via prop `img` + o caractere da tecla), com
  variantes de cor por categoria de ação (neutro = invocar, azul/accent
  = trocar de controle) e um estado `dim` (apagado, não escondido) pra
  ações temporariamente indisponíveis.

## Transições suaves (`tools/hud/statusMotion.js` + Framer Motion)

Dependência nova (`framer-motion`) — as transições pedidas (card da
criatura "subindo" da lista do time até virar o card principal do
`StatusHud`; card do treinador "encolhendo/crescendo" entre a posição
principal e a compacta; demais slots do time se reacomodando sozinhos)
coordenam componentes SEM parentesco React e precisam de reordenação
automática de lista — inviável de fazer à mão (técnica FLIP manual)
com confiança neste sandbox sem navegador.

Mecanismo: `statusLayoutId(slot | 'trainer')` gera um `layoutId`
COMPARTILHADO entre os dois arquivos — quando um elemento com um dado
`layoutId` sai da árvore no mesmo commit em que outro com o MESMO id
entra em QUALQUER lugar da página, o Framer Motion anima a transição
entre os dois sozinho. `CARD_TRANSITION` centraliza a física da
animação (mola), reaproveitada em todo `motion.*` da família.

## Decisões de design

- **Nível**: fixo por espécie, sem sistema de XP/progressão de verdade.
- **Nome**: só a espécie formatada — sem apelido individual por
  criatura.
- **Escopo do Nameplate**: todo mundo, incluindo o treinador.
- **Escala do Nameplate por distância**: invertida de propósito (mais
  perto, menor; mais longe, maior) — pedido explícito do usuário depois
  de tamanho fixo não bater com a expectativa visual dele; o oposto de
  perspectiva 3D normal ou do `distanceFactor` do drei.
- **Slot da party controlado**: some da lista, não vira nada no lugar
  (decisão revertida de uma tentativa anterior de "virar" o card do
  treinador ali mesmo).

## Bugs corrigidos (causas raiz, resumidas)

- **Reatividade Koota "travada"** (`NameplateView.jsx`/`PartyHud.jsx`) —
  checar `entity.has(InputControlled)` SOLTO dentro de um `.map()` não
  dispara re-render quando só ESSA trait muda de entidade (o `useQuery`
  observava outros traits). Corrigido lendo `InputControlled` com seu
  PRÓPRIO hook reativo (`useQueryFirst`) e comparando por igualdade de
  entidade.
- **`align-items: stretch` (default do flex)** — um card menor
  (`compact` no `StatusHud`, ou o slot vazio no `PartyHud`) ficava
  ESTICADO pra largura do irmão mais largo; a caixa de fora (borda/bg)
  não encolhia mesmo com o conteúdo interno menor. Corrigido com
  `items-start` nos wrappers.
- **`AnimatePresence` modo padrão "empurrando" o layout** — o elemento
  saindo continuava ocupando espaço no flex até desmontar de vez,
  fazendo os vizinhos "descerem e depois subirem". Corrigido com
  `mode="popLayout"`.
- **Ordem de pintura flex vs. `position: absolute`** (`SkillsHud.jsx`)
  — um ícone de fundo como filho NORMAL do flex podia cobrir elementos
  `absolute` por cima, dependendo de regras implícitas de contexto de
  empilhamento. Corrigido tirando TUDO do fluxo normal (tudo
  `absolute`) e dando `z-index` EXPLÍCITO por camada.
- **Override de ataque com campo fora de `overrides`** — um campo solto
  (`sprite`) como irmão de `id`/`overrides` numa referência de ataque
  por criatura é silenciosamente ignorado por `resolveCreatureAttack`
  (só lê `.id`/`.overrides`).
- **Classe Tailwind dinâmica nunca gerada** — `VitalBar` montava a
  altura como `` `h-${height}` ``; o scanner JIT do Tailwind só gera CSS
  pra classes cujo texto LITERAL apareça em algum arquivo fonte, então
  alturas como `h-1`/`h-3` nunca existiam no CSS final (confirmado
  compilando de verdade) — a barra colava em altura zero, invisível.
  Corrigido calculando a altura via `style`, não classe.

## Fora de escopo (de propósito)

- Sistema de nível/XP de verdade (progressão, atributos escalando) —
  os campos existem só como NÚMERO de exibição.
- Apelido individual por criatura.
- Oclusão do Nameplate por parede/obstáculo (`<Html>` sempre desenha
  por cima).
- Calibração fina de `sprite.scale`/timing das transições/valores de
  escala por distância — pontos de partida razoáveis, não validados
  visualmente (sandbox sem navegador nesta sessão inteira).

## Arquivos principais

- `view/scene/NameplateView.jsx` — etiqueta 3D.
- `tools/hud/StatusHud.jsx`, `PartyHud.jsx`, `SkillsHud.jsx`,
  `ActionSlotHud.jsx` — HUDs de tela.
- `tools/hud/statusMotion.js` — `layoutId`/transição compartilhados.
- `view/shared/statusDisplay.jsx` — `formatSpeciesName`/`VitalBar`/
  `SpritePortrait`/`AttackIcon`/`KeyHint`.
- `core/data/species/_template/index.js`, `core/data/attacks/
  _template/index.js` — documentam os campos opcionais novos.
- `core/physics/colliders.js` (`verticalClearance`, compartilhada com
  `summonBallSystem.js`), `view/systems/cameraFollowSystem.js`
  (`resolveControlledSpecies`, exportada) — pequenas extrações
  reaproveitadas por mais de um HUD.
- `package.json` — `framer-motion` (transições) e `lucide-react`
  atualizado (ícones novos usados em `KeyHint`).

## Testes

Sem teste automatizado — toda a família é view/UI pura (Three.js/DOM
via drei `<Html>`, ou HUD 2D sem malha/câmera real pra verificar neste
sandbox), mesmo precedente de código puramente visual do projeto. Suíte
completa (`nvm exec 20.20.2 npx vitest run` — Node local incompatível
com o `rolldown` instalado, `nvm` resolve) conferida a cada mudança:
baseline pré-existente estável (10 falhas, sem relação com esta
feature) do início ao fim. Lint (`nvm exec 20.20.2 npx eslint`)
conferido a cada mudança — erros remanescentes são formatação
preexistente em edições do próprio usuário, não tocados.

**Não verificado visualmente** — sandbox sem navegador durante toda a
sessão. Toda a lógica (queries reativas, `layoutId`, cálculo de
distância/escala, ordem de pintura CSS) foi verificada por leitura de
código — em alguns casos, lendo o código-fonte de bibliotecas
instaladas (`@react-three/drei`) ou compilando o Tailwind de verdade
pra confirmar hipóteses em vez de só teorizar. O resultado renderizado
final (tamanho, timing das transições, legibilidade) depende do
usuário conferir em jogo.
