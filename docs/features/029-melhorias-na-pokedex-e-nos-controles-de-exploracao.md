# 029 — Melhorias na Pokédex e nos controles de exploração

## Resumo

Reconstrução em várias rodadas, com o usuário testando ao vivo e
corrigindo a direção a cada uma: alcance de scan configurável por
item; um novo menu principal da Pokédex com três abas (Pokémons/Time/
Histórico); os controles do mouse do modo Scan (de "clique pra abrir,
clique pra confirmar" pra "segurar o botão direito, clicar o esquerdo
enquanto segura pra confirmar"); a câmera em primeira pessoa do modo
Scan (de um sistema com offset em 3 eixos + zoom pra só um offset pra
frente, sem zoom); restrição das ações do jogador a "só andar" durante
o Scan; visualização de debug do alcance do Scan; e a troca do botão
"voltar" pelo "X" nos menus de pausa, com a correção de um bug real no
fechamento. Este documento descreve o estado FINAL de cada parte —
tentativas anteriores que foram substituídas (não só ajustadas) estão
resumidas em "Decisões de design" pra contexto, não repetidas em
detalhe.

## 1. Alcance de scan configurável por item

`item.scanner.range` (`pokedex/index.js`, `range: 40`; `_template/
index.js` ganhou o mesmo bloco) — mesmo padrão de
`item.consumable.healAmount`. O raycast do Scan usa `item.scanner?.range
?? GAME_CONFIG.SCANNER.RANGE` (`GAME_CONFIG.SCANNER.RANGE: 5` — valor
global de fallback, pra item sem alcance próprio configurado). Sem
duplicar a detecção existente (`castRay`/`resolveCreatureAt` continuam
iguais, só o alcance passado muda).

## 2. Novo menu principal da Pokédex

`tools/menu/pokedex/` — quatro arquivos:

- **`PokedexMenu.jsx`** — casca fina, só controla a aba ativa
  (`useState`) e delega todo o conteúdo. Usa `PokedexFrame`
  (`tools/shared/`, com suporte a `tabs`).
- **`PokemonsTab.jsx`** — grade de 151 slots fixos (um por
  `dexNumber`, 1 a 151); sem lista estática de nomes/números pros
  Pokémon ainda sem espécie de verdade no registro (`core/data/
  species/index.js`) — um slot sem registro e um slot com espécie
  não-escaneada mostram o mesmo "?", então não precisava duplicar
  dado que não existe em lugar nenhum do projeto. Lê
  `PokedexEntries.speciesIds` pra decidir quais slots têm sprite/são
  selecionáveis. Painel lateral usa `StatsScreen` com
  `showIndividual={false}` — esconde IV/EV/Status/CP/Energia, mostra
  só nome/nível/atributos base + radar plotando `base` em vez de
  `stat`.
- **`TeamTab.jsx`** — sub-navegação por slot (`Q`/`E`/`R`, mesma tecla
  física de `PartyHud.jsx`), lê `Party`/`PartyIndividualValues` do
  treinador e mostra `StatsScreen` com `showIndividual={true}` (o time
  é sempre uma criatura de verdade, com IV próprio).
- **`HistoryTab.jsx`** — lista `ScanHistory.entries` (cortada em 10,
  mais recente primeiro), seleciona uma entrada e mostra `StatsScreen`
  com `showIndividual={true}` a partir do snapshot (`{speciesId,
  individualValues, level}`, não uma referência de entidade —
  sobrevive um `SummonedCreature` escaneado ser recolhido/destruído
  depois). `initialEntryId` (prop) pré-seleciona um registro — usado
  pelo fluxo de scan (seção 4).

`StatsScreen`/`StatsRadar` (`tools/shared/StatsScreen.jsx`) ganharam o
parâmetro `showIndividual` — mesmo cálculo de sempre
(`resolveCreatureStats`), só a apresentação muda por flag.

**Dados novos, ambos só no treinador:**
- `PokedexEntries` (`speciesIds: []`) — toda espécie já escaneada
  alguma vez, nunca encolhe.
- `ScanHistory` (`entries: []`) — snapshots dos últimos 10 scans, mais
  recente primeiro, sem duplicata consecutiva (rescanear algo já na
  lista move pro topo — `pushScanHistoryEntry`).
- `core/actions/scanning.js` (`registrarScan`) — única mutação dos
  dois traits, sempre junta, mesmo padrão de `equiparCriatura`
  (`core/actions/party.js`).

`StatsPanel.jsx` (tela de uma criatura só, sem abas, de uma rodada
anterior) foi removida — totalmente substituída pelo novo menu.

**Caixa do menu**: 500px de largura, altura travada em ~420px
(`PokedexFrame.jsx`, `h-[500px]` na versão final ajustada pelo usuário)
— luz superior e barra de abas fixas (`shrink-0`), só a área de
conteúdo da aba ativa é `flex-1 overflow-y-auto`, rolando por conta
própria se o conteúdo for mais alto que isso.

## 3. Controles do mouse do modo Scan

Estado final, depois de duas reconstruções motivadas por teste real em
jogo:

- **Segurar o botão direito** (`input.secondaryHeld`, contínuo — ver
  seção 5) liga o modo Scan (câmera em primeira pessoa + visor) e
  rastreia o alvo embaixo do retículo todo tick, enquanto durar o
  segurar.
- **Clique esquerdo ENQUANTO ainda segura o direito**
  (`input.primary && input.secondaryHeld`, no mesmo tick) confirma o
  scan — com `Targeting` válido e vivo, grava `Scanned` e chama
  `registrarScan` (`PokedexEntries`/`ScanHistory`). Não desliga o modo
  sozinha — a câmera continua em primeira pessoa até soltar de
  verdade.
- **Soltar o botão direito** (`input.secondaryReleased`) sempre
  desliga o modo (`ScanMode.active = false`), com ou sem confirmação
  prévia — nunca confirma de novo nesse soltar (exige `input.primary`
  no mesmo tick, que soltar sozinho não tem).
- **Clique esquerdo FORA do modo Scan** abre o menu principal da
  Pokédex (`ScanMode.menuOpenRequests`, contador monotônico — evita o
  React perder a borda de subida de um pulso de um tick só).

`src/app/(auth)/page.js` — `GameHud` reage a dois `useTrait`/
`useEffect`:
- `ScanHistory.entries` muda → `onScanned(entries[0].id)` (o mais
  recente é sempre o topo) → abre a Pokédex direto na aba Histórico
  com esse registro pré-selecionado.
- `ScanMode.menuOpenRequests` muda → `onMenuOpenRequested()` → abre a
  Pokédex na aba padrão (Pokémons).

### Por que não é mais "clicar" (histórico do bug)

A primeira versão usava clique-pulso pros dois lados (botão direito
abre/fecha, um segundo clique confirma). O usuário relatou "quando eu
scaneio um pokémon ele ainda não faz nada, só faz efeito quando eu saio
do modo scan" — investigação com log do PRÓPRIO usuário achou a causa
real: `input.secondary` (pulso, borda de subida do `mousedown`) nunca
coincidia de forma confiável com "já estava ativo" na prática. Reescrito
pra **segurar** (`secondaryHeld`/`secondaryReleased`, `pointerInput.js`
— precisou de um listener de `mouseup` novo, que não existia) — sem
toggle, sem "segundo clique". A confirmação em si (clique esquerdo
enquanto segura, não ao soltar) foi um ajuste posterior do próprio
usuário em cima dessa base.

### Menu de contexto do Chrome aparecendo

Bug relatado depois da mudança pra segurar: "o próprio menu do botão
direito do Chrome aparece". `pointerInput.js` já suprimia no evento
`contextmenu` (`preventDefault`), mas alguns navegadores decidem
mostrar o menu a partir do `mousedown` do botão direito quando ele fica
SEGURADO em vez de clicado rapidamente. Corrigido com `preventDefault`
também no `mousedown` do botão direito, e o listener de `contextmenu`
passou a existir também no `document` (não só no canvas), como rede de
segurança.

## 4. Câmera do modo Scan

Estado final: `GAME_CONFIG.CAMERA.SCAN` tem só DOIS parâmetros —

```js
SCAN: {
  CAMERA_OFFSET_FORWARD: 1.2, // desvio fixo pra FRENTE do olho
  PITCH_MIN: -0.5,
  PITCH_MAX: 1,
}
```

`cameraFollowSystem.js` (branch `scanning`): a câmera fica numa
posição FIXA — `pos + TARGET_HEIGHT` (altura do olho) deslocada
`CAMERA_OFFSET_FORWARD` unidades na direção que `orbit.yaw`/`pitch`
(clampado em `PITCH_MIN`/`PITCH_MAX`) apontam (`computeOrbitForward`).
**Sem suavização de posição neste modo** — `camera.position` é
atribuída direto (`=`, não lerp), só o branch de terceira pessoa,
abaixo, continua usando `SMOOTHING`. A direção (`lookAt`) já era
instantânea antes disso; agora a posição também é.

### Por que não tem zoom (histórico)

Passou por duas versões com zoom, ambas removidas a pedido do usuário
depois de testar:
1. Primeira versão: `orbit.distance` (o scroll compartilhado com
   terceira pessoa) virava um delta a partir de um snapshot
   (`ScanMode.distanceAtActivation`, capturado no instante em que o
   modo ligava) e SUBTRAÍA da posição — bug relatado: "ao diminuir o
   zoom a câmera acaba sendo puxada pra trás do personagem". Corrigido
   invertendo os operandos do delta e somando em vez de subtrair (zoom
   só empurrava pra FRENTE, nunca pra trás do personagem).
2. Junto com essa correção, o usuário relatou a câmera "pesada" — a
   causa (investigada, não só suposição): não havia suavização
   duplicada em lugar nenhum do projeto, só o MESMO lerp de posição
   compartilhado com terceira pessoa, onde um pequeno atraso é
   imperceptível; em primeira pessoa, qualquer atraso posicional ao
   virar a cabeça ou dar zoom é sentido como peso. Corrigida removendo
   o lerp (não aumentando a velocidade dele) só neste branch.
3. Depois de testar a versão corrigida, o usuário decidiu remover o
   zoom por completo: "não gostei do comportamento do zoom... quero
   remover essa funcionalidade completamente". `ZOOM_MIN`/`ZOOM_MAX`
   saíram do config, `ScanMode.distanceAtActivation` saiu do trait
   (só existia pro zoom), e o cálculo da câmera colapsou pro que está
   acima — sem código morto, sem parâmetro sobrando.

`resolveScanRay(pos, rig, item)` — extraída de `scannerModeSystem.js`
e exportada (mesmo padrão de `resolveAttackImpactPoint`,
`creatureAttackSystem.js`) — monta olho/direção/alcance do raio de
detecção de verdade; reaproveitada tanto pelo raycast real quanto pela
visualização de debug (seção 6), garantindo que os dois nunca podem
divergir.

## 5. Restrição de ações no modo Scan (só andar)

Pedido do usuário: "durante o modo Scan, o jogador deve poder somente
andar" — pulo, corrida, ataque, dash e Q/E/R (skills/invocar/recolher)
bloqueados, sem `if (scan)` espalhado pelos systems de ação.

`context.input` é um objeto único, compartilhado por todos os systems
da fase `simulation` no mesmo tick (`core/systems/pipeline.js`).
`inputSystem.js` (fase `input`, roda antes de tudo) já era o único
lugar do projeto com a responsabilidade de "traduzir input bruto";
ganhou a checagem "item categoria `scanner` equipado + botão direito
segurado" e, se verdadeiro, zera as flags de ação — `run`, `jump`,
`dash`, `secondary1`, `secondary2`, `secondary3` — direto em
`context.input`, ANTES de qualquer outro system do tick ler. `primary`
fica de fora (confirma o scan, ver seção 3); os controles de câmera/
movimento também. Nenhum dos systems de ação
(`movementSystem`/`playerActionSystem`/`creatureAttackSystem`/
`partySummonSystem`/`characterPhysicsSystem`) precisou mudar — nenhum
deles sabe que o modo Scan existe.

Deriva "está escaneando" do input bruto (categoria do item +
`secondaryHeld`), não do trait `ScanMode.active` — evita depender da
ORDEM entre systems (`ScanMode.active` só fica atualizado depois que
`scannerModeSystem.js` roda, que vem depois de vários systems de ação
na fila; o input bruto já dá o valor certo no mesmo tick, sem
depender de ordem nenhuma).

Não bloqueado, de propósito: troca de controle treinador↔criatura
(`switchSlot1-3`/`returnToBot`) — fora do pedido do usuário, e já
degrada bem sozinha hoje (a câmera volta pra terceira pessoa normal se
quem está controlado não tem `Party`).

## 6. Debug do alcance do Scan

`src/tools/debug/ScanRangeDebugView.jsx` (novo) — montado junto de
`PhysicsDebugView`/`PathfindingDebugView`/`AttackRangeDebugView` em
`src/app/(auth)/page.js`, mesma condição `showDebug` (tecla **F2** —
não existe F12 neste projeto). Desenha uma LINHA (não um círculo/
esfera) do olho do treinador até `eye + direction * range`, com um
pequeno anel marcando o ponto final — uma linha reta é a representação
mais fiel de como o Scan detecta de verdade (um raio pra frente na
direção da mira, não uma área ao redor do personagem). Usa
`resolveScanRay` (seção 4) — o MESMO cálculo do raycast real, não uma
cópia da fórmula, então o debug nunca pode mostrar um alcance
diferente do funcional. Visível só quando `ScanMode.active` é `true`
(some ao soltar o Scan) — como só é montado com `showDebug`, as duas
condições do pedido ficam cobertas juntas.

## 7. Menus: botão X e correção do fechamento

Pedido do usuário: trocar o "← voltar" dos menus por um "X". Levantamento
no projeto inteiro achou EXATAMENTE um componente com esse botão —
`MenuView` (privado, dentro de `src/tools/menu/PauseMenu.jsx`),
reaproveitado por Inventário/Pokédex/Configurações — trocado por um
ícone `X` (`lucide-react`, já usado no projeto).

**Bug relatado depois, corrigido**: na troca do botão, o `onClick`
continuou `() => setView('main')` por engano — isso NAVEGA pra tela
principal do menu de pausa (que continua aberta), não fecha nada.
Corrigido pra chamar `onResume` (a mesma função que "Continuar" já
usa) — fecha o menu de pausa por completo e devolve o controle pro
jogo, que é o que "fechar o menu atual" pede. A tela principal (`main`)
nunca teve "voltar" (fecha só pelo botão "Continuar", que não fazia
parte do padrão trocado) — ficou fora da mudança.

## Decisões de design

- **`Scanned` (relação) não foi removida** — ainda é escrita a cada
  confirmação, mas nenhuma tela lê mais ela pra abrir nada (isso virou
  `ScanHistory`). Removê-la seria uma refatoração mais ampla sem ganho
  funcional agora — mantida por segurança/uso futuro.
- **`menuOpenRequests` dentro de `ScanMode`, não um trait novo** — é o
  mesmo item/mesma entidade, evita mexer em `world.js`/`test/
  makeWorld.js` só pra um contador.
- **Grade dos 151 sem lista estática de nomes** — só algumas espécies
  têm dado de verdade no registro hoje; um slot sem registro e um slot
  não-escaneado são visualmente idênticos ("?"), então uma lista com
  as 151 entradas só pra preencher slots que nunca ficam disponíveis
  seria dado sem uso real.
- **Câmera do Scan sem zoom** — não é uma simplificação arbitrária:
  foi tentado com zoom duas vezes, com bugs reais de direção/peso
  corrigidos, e mesmo assim o usuário preferiu remover a
  funcionalidade inteira depois de testar. O código não guarda nenhum
  resquício (config, trait, cálculo) — se o zoom voltar a ser pedido,
  é uma feature nova, não uma reativação.
- **Restrição de ações via `inputSystem.js`, não guardas em cada
  system de ação** — pedido explícito do usuário, e único lugar do
  projeto que já tinha a responsabilidade de filtrar input bruto antes
  dos systems de jogo lerem.

## Fora de escopo

- Sprites/nomes dos Pokémon ainda sem espécie de verdade no registro —
  grade mostra "?" permanente pra eles.
- Persistir `PokedexEntries`/`ScanHistory` entre sessões (sem save
  ainda, mesmo estado de todo o resto do projeto).
- Micro-stutter de fixed-timestep sem interpolação entre ticks
  (`Position` do personagem só atualiza uma vez por tick fixo, sem
  interpolação por alpha) — pode ficar mais perceptível em telas acima
  de 60Hz agora que a câmera do Scan não tem mais lerp mascarando isso
  incidentalmente; não é uma regressão desta rodada (já existia,
  igualmente em terceira pessoa), não foi tratado.
- Verificação visual (sandbox sem navegador durante todo o
  desenvolvimento) — geometria da câmera, layout dos menus, linha de
  debug e o fluxo completo de clique foram todos validados pelo
  usuário jogando, não por este agente.

## Testes

Suíte completa (`nvm exec 20.20.2 npx vitest run`): 462 passando, 10
falhas — 9 são a baseline pré-existente de sempre (sem relação com
esta feature); a 10ª (`o player já começa com a rock equipada na mão`,
`world.test.js`) é consequência de uma edição manual do próprio
usuário em `world.js` (`HeldItem` trocado de `'rock'` pra `'pokedex'`,
pra facilitar testar o Scan), não uma regressão de código.

`scannerModeSystem.test.js` reescrito nas rodadas de "segurar" e
"confirmar enquanto segura" pra usar `secondaryHeld`/
`secondaryReleased`/`primary` em vez do clique-pulso antigo.
`pointerInput.test.js` ganhou testes pro `secondaryHeld` contínuo, o
pulso de `secondaryReleased`, e a supressão do menu de contexto tanto
no `mousedown` quanto no `document`. `inputSystem.test.js` ganhou o
`describe` de bloqueio de ações no modo Scan (corrida bloqueada,
pulo/dash/Q/E/R zerados no input, andar continua funcionando, clique
esquerdo de confirmação não é bloqueado, sem item scanner ou sem
segurar nada é bloqueado).

Lint limpo em todo código novo/editado. Componentes React
(`PokedexMenu`/`PokemonsTab`/`TeamTab`/`HistoryTab`) e visualizações 3D
de debug (`ScanRangeDebugView`) não têm teste automatizado — mesmo
padrão de todo o resto do projeto (só lint + revisão).
