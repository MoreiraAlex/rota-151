# 🚀 Versão 0.0.15 — Menu de Pausa, HUD e Inventário

O objetivo desta versão é a primeira camada de UI de jogo de verdade
(não-debug): um menu de pausa com configurações ao vivo, um HUD sempre
visível pro time/mão principal, e um sistema de inventário completo — grade
5x5, equipar/desequipar por arrastar, preview do jogador com os slots ao
redor, e um efeito visual simples ao consumir item.

> Versionamento e nome do arquivo: ver `docs/development-workflow.md`.

---

## Contexto

- `Esc` já soltava o Pointer Lock (tratado pelo browser) sem nenhum uso
  além de devolver o cursor. Pedido inicial: aproveitar esse instante pra
  abrir um menu de pausa, do jeito que qualquer FPS faz, com uma opção de
  Configurações que edita `GAME_CONFIG` ao vivo (sem editar código nem
  recarregar a página).
- `Party`/`HeldItem` só eram equipáveis via `DebugPanel` (atrás do F2) —
  ferramenta de dev, não HUD de jogo. Faltava também um conceito de "o que
  o jogador tem" pra mão principal fazer sentido como equipamento de
  verdade (`HeldItem` apontava pra qualquer item do registro, sem noção de
  posse). Pedido: HUD sempre visível pro time, e um inventário de verdade.
- Depois de um HUD de time e um menu de Equipamento (mão + time)
  aparecerem como telas separadas, o pedido evoluiu pra consolidar tudo
  num único lugar — o Inventário — com uma grade 5x5 (itens + criaturas
  disponíveis) e um preview do jogador com os slots de equipamento ao
  redor, atualizando ao vivo.
- Equipar por clique (primeira versão da grade) virou arrastar, por
  pedido explícito, com sinalização visual de compatível/incompatível no
  slot de destino durante o arraste — e, na sequência, mais uma rodada de
  ajustes pedidos sobre essa mesma interação: atalho de teclado (`I`) pra
  abrir o Inventário direto, uma imagem de arraste "de jogo" no lugar do
  fantasma nativo do browser, desequipar arrastando de volta pra grade (o
  drag-and-drop só equipava, não tinha o caminho inverso), o item/criatura
  sumindo da origem durante o próprio arraste (só existir "no mouse"), e o
  que está equipado deixando de aparecer na grade ao mesmo tempo.
- Pedido à parte, mas na mesma janela de trabalho: um efeito visual
  simples (partículas) ao usar um item consumível.

## Decisões

### Menu de pausa e configurações

- **`Esc` abre/fecha o menu direto pelo próprio estado**, não inferindo da
  perda do Pointer Lock — `page.js` escuta `keydown` de `Escape` e
  alterna `menuOpen`; abrir também solta o mouse como efeito colateral do
  próprio browser. `pointerlockchange` só é ouvido pra **fechar** o menu
  quando o lock volta por qualquer via (ex.: clique no canvas) — nunca
  pra abrir (ver Correções, sobre o botão direito).
- **Leitura de `GAME_CONFIG` movida pra dentro da função** nos systems que
  ainda liam num `const` de topo de módulo (`movementSystem`,
  `partySummonSystem`, `creatureFollowSystem`, `playerActionSystem`) —
  sem isso, editar um valor no menu só valeria depois de um refresh de
  página. Os 7 systems que leem `GAME_CONFIG` passam a fazer isso do
  mesmo jeito (fresco a cada tick).
- **`ConfigEditor`/`ConfigPanel` (`tools/menu/`) — genérico e recursivo
  sobre `GAME_CONFIG`, sem hardcodar campo nenhum**: percorre o objeto, um
  `<input type="number">` por valor numérico (folha), uma seção por
  objeto aninhado. Cresce sozinho conforme `gameConfig.js` ganha seções.
  Escreve direto no objeto (não é `Object.freeze`d). Sem persistência
  entre reloads, sem validação/guardrails — ferramenta de dev.
- **Botão direito do mouse também solta o mouse, sem abrir o menu**
  (`pointerInput.js`) — dá pra clicar no HUD/`DebugPanel`/Inventário sem
  pausar. Suprime o menu de contexto nativo do canvas.
- **Sem pausar a simulação** — o menu é só uma camada visual por cima; o
  `GameLoop` continua rodando atrás enquanto está aberto.

### Tecla `I` abre o Inventário

- **`view`/subtela do menu sobe de `PauseMenu.jsx` (que tinha `useState`
  interno) pra `page.js`**, como `menuView`/`setMenuView` por prop — a
  tecla `I` precisa abrir direto em `'inventory'`, sem passar pela tela
  principal primeiro, então quem decide a subtela não pode mais viver
  dentro do componente que a tecla não controla.
- **`I` solta o Pointer Lock manualmente antes de abrir** — diferente do
  `Esc`, `I` não tem efeito nativo nenhum do browser sobre o lock, e o
  drag-and-drop do Inventário precisa de cursor livre. Com o menu já
  aberto mostrando Inventário, `I` fecha (mesma simetria do `Esc`); aberto
  noutra subtela, só troca pra Inventário sem fechar.

### Inventário (dado) e consumo de verdade

- **`Inventory` (trait) — `{ itemIds: [...] }`**, lista de ids de
  `core/data/items/`, repetição servindo de "quantidade" (`['potion',
  'potion']` = 2 poções), sem contador separado. É um trait **AoS**
  (schema é uma função, não um objeto) — koota não aceita array em schema
  SoA normal (`Koota: itemIds is an array, which is not supported in
  traits`). Começa com um kit de teste (itens `throwable`/`consumable`
  genéricos de RPG, sem sistema de coleta/loja ainda).
- **Arremessar/usar consome do inventário de verdade** —
  `playerActionSystem` remove uma unidade do item no mesmo instante que
  limpa `HeldItem.itemId` — mas só desequipa a mão quando o estoque
  daquele item **zera de vez**; tendo mais unidades, a mão continua
  equipada e só a pilha diminui (bug inicial: desequipava sempre, mesmo
  sobrando estoque — corrigido, ver Correções).
- **Efeito visual ao consumir — trait `ConsumeEffect`, novo, não reaproveita
  `Projectile`** — mesmo padrão de `Projectile`/`ProjectileView` (v0.0.14):
  `ConsumeEffect({ lifetime })` spawnado por `playerActionSystem` no
  instante de efeito da ação `'consume'`, na posição do jogador;
  `consumeEffectSystem` (headless) só conta `lifetime` pra baixo e destrói
  a entidade ao zerar — sem posição/velocidade pra integrar, fica parado
  onde nasceu. `ConsumeEffectView` renderiza via `<Sparkles>` do
  `@react-three/drei` (já dependência do projeto) — sem asset novo. Trait
  separado de `Projectile` porque semanticamente são coisas diferentes (um
  é físico e colide com o tempo/gravidade, o outro é só decorativo e
  parado). Duração do efeito visual é config própria
  (`PLAYER_ACTIONS.consume.EFFECT_VISUAL_DURATION`), independente da
  duração da ação em si.

### HUD sempre visível (`PartyHud`)

- **Sempre montado, fora do gate de `showDebug`** — 3 slots de time
  (`1`/`2`/`3`, mesma tecla física de invocar/recolher) + 1 slot de mão
  principal, destacando (borda verde + "fora") a criatura que estiver de
  fato invocada (`SummonedCreature`, ao vivo via `useQuery`).
- **Virou só leitura** — a primeira versão permitia clicar num slot pra
  trocar (mesmo padrão de seletor do `DebugPanel`); depois que o
  Inventário passou a cobrir equipar de forma mais completa (grade +
  preview + drag-and-drop), ter dois lugares editando o mesmo estado
  ficou confuso. `PartyHud` hoje só mostra `HeldItem`/`Party`/status ao
  vivo — equipar é responsabilidade exclusiva do Inventário.

### Grade de inventário e preview de equipamento

- **`InventoryPanel` (`tools/menu/`), única opção do menu de pausa além de
  Configurações** — grade fixa de 25 slots (5x5): uma entrada por id
  único de item (com a contagem da pilha) + uma por criatura `kind:
  'pokemon'` disponível (mesma simplificação do `Party`: toda espécie
  desse tipo conta como "disponível", sem sistema de captura/posse ainda).
  Sem ícone/modelo de verdade: item vira um quadrado colorido por
  categoria (`ITEM_COLORS`, `view/itemColors.js`), criatura vira uma
  esfera na cor dela (`CREATURE_TINTS`, `view/creatureTints.js` —
  extraído de `CreatureView.jsx` pra ser a mesma fonte usada na
  renderização 3D de verdade). Ambos os mapas de cor e o componente de
  preview (`SlotPreview`, `tools/shared/`) são compartilhados entre a
  grade e o HUD.
- **`EquipmentPreview` + `PlayerPreview` — preview do jogador com os slots
  ao redor** (time em cima, mão embaixo), ao lado da grade. `PlayerPreview`
  é um canvas 3D **isolado**, sem ligação com o loop/registries do jogo de
  verdade — mostra o modelo na pose de descanso do próprio `.glb`,
  girando devagar. De propósito **não** usa `useAnimatedModel`/
  `registerView`: esse mecanismo registra por entidade
  (`viewRegistry`/`animationRegistry`), e `playerEntity` já está
  registrado de verdade por `PlayerView.jsx` (a cena principal) —
  reaproveitar aqui tomaria o lugar desse registro e quebraria a
  sincronização de posição do jogador real.
- **Equipar por arraste (drag-and-drop nativo do browser, sem
  biblioteca)** — `draggable` + `onDragStart` na origem (célula da grade
  ou slot já ocupado, pra desequipar), `onDragOver`/`onDrop` no destino.
  **Categoria do item vai no *tipo* MIME do `dataTransfer`, não só no
  valor** (`DRAG_TYPE = { item: 'text/x-equip-item', creature:
  'text/x-equip-creature' }`) — `dataTransfer.getData()` só existe no
  `drop`; durante `dragover` (quando precisa decidir a cor do slot) só dá
  pra inspecionar quais *tipos* existem (`dataTransfer.types`).
  Codificando a categoria no tipo, dá pra saber "isso é item" ou "isso é
  criatura" ainda durante o arraste. Slot de destino fica verde
  (compatível) ou vermelho (incompatível); só chama `preventDefault()`
  no `dragover` quando compatível — é isso que de fato *permite* o drop
  ali (regra do drag-and-drop nativo).
- **Imagem de arraste custom, via canvas offscreen** — em vez do fantasma
  nativo do browser, `createDragImage(kind, id)` desenha num `<canvas>`
  40×40 o mesmo desenho do `SlotPreview` (quadrado/círculo, mesma cor por
  categoria via `getSlotColor`, extraído do `SlotPreview`), anexa fora da
  tela, chama `setDragImage`, remove em seguida.
- **Desequipar arrastando de volta pra grade** — cada slot de
  equipamento ocupado também é `draggable` (fonte, não só alvo); grava um
  tipo MIME próprio (`UNEQUIP_TYPE = 'text/x-unequip-slot'`, valor = id de
  origem — `'hand'` ou o slot de time) que a grade inteira escuta em
  `dragover`/`drop`, aceitando o drop em qualquer célula (o evento
  borbulha até o container) e limpando o slot de origem.
- **O que está equipado some da grade** — `buildSlots` recebe
  `heldItemId`/`equippedSpeciesIds` e filtra: item desconta 1 da
  contagem visível (o resto da pilha continua ali; a entrada some de vez
  se a contagem zera); criatura remove a entrada inteira se ocupa
  qualquer slot de time (sem pilha — é presença ou ausência). Deriva de
  `useTrait(HeldItem)`/`useTrait(Party)`, já reativo — sem estado
  espelhado à parte.
- **Origem fica `invisible` durante o próprio arraste** — tanto a célula
  da grade quanto o slot de equipamento ganharam um estado local
  (`dragging`) que esconde o conteúdo entre `dragstart` e `dragend`, pra
  o item "existir" só na imagem sob o cursor enquanto carregado. Crítico:
  esconder o elemento de origem **de imediato** dentro do próprio
  `dragstart` cancela o arraste (o browser perde a referência do que
  estava sendo arrastado antes de terminar de iniciar) — corrigido
  adiando com `setTimeout(..., 0)` (ver Correções).

## Objetivos

- `Esc` abre/fecha um menu de pausa sem pausar a simulação; dentro,
  Configurações edita todo `GAME_CONFIG` ao vivo, por campo numérico.
- HUD sempre visível mostra time (3 slots) + mão principal, com status de
  "fora" pra criatura invocada — sem precisar do F2.
- Tecla `I` abre o Inventário direto, de qualquer estado.
- Inventário mostra uma grade 5x5 com itens (cor por categoria + contagem)
  e criaturas disponíveis (esfera na cor certa, igual à renderização 3D),
  mais um preview do jogador com os slots de equipamento ao redor.
- Equipar e desequipar são só por arrastar — da grade pro slot, ou do
  slot de volta pra grade — com sinalização visual de compatível/
  incompatível, imagem de arraste própria do jogo (não o fantasma nativo
  do browser), e o item/criatura sumindo da origem enquanto carregado e
  enquanto equipado.
- Usar um consumível dispara um efeito de partículas simples na posição
  do jogador, que some sozinho.
- Nenhuma regressão em `Inventory`/`HeldItem`/`Party`/renderização 3D do
  jogador ou das criaturas.

---

## Etapas

### 1. Menu de pausa e configurações

- [X] Leitura de `GAME_CONFIG` movida pra dentro da função nos 4 systems
      que ainda liam num `const` de topo de módulo
- [X] `tools/menu/ConfigEditor.jsx` — `ConfigEditor`/`ConfigPanel`
      (recursivo sobre `GAME_CONFIG`)
- [X] `tools/menu/PauseMenu.jsx` — menu principal + view de configurações
- [X] `app/(auth)/page.js` — `Esc` liga/desliga `menuOpen`;
      `pointerlockchange` só fecha; botão direito solta o mouse sem abrir
      o menu (`platform/input/pointerInput.js`)

### 2. HUD de time e mão principal

- [X] `tools/hud/PartyHud.jsx` (novo) — 3 slots de time + mão principal,
      destaque de "fora" via `useQuery(SummonedCreature)`; depois virou
      só leitura (equipar saiu pro Inventário)
- [X] `app/(auth)/page.js` — `<PartyHud />` sempre montado

### 3. Inventário (dado) e efeito de consumo

- [X] `core/traits/components/inventory.js` — `Inventory` (AoS), kit de
      teste inicial (10 `throwable` + 5 `consumable`, `pebble` em pilha
      maior)
- [X] `core/systems/playerActionSystem.js` — consome uma unidade ao
      arremessar/usar; só desequipa a mão quando o estoque zera de vez
- [X] `core/traits/components/consumeEffect.js` (novo) — `ConsumeEffect`
- [X] `core/systems/consumeEffectSystem.js` (novo) — conta `lifetime` pra
      baixo, destrói ao zerar
- [X] `core/gameConfig.js` — `PLAYER_ACTIONS.consume.EFFECT_VISUAL_DURATION`
- [X] `view/scene/ConsumeEffectView.jsx` (novo) — `<Sparkles>` do drei
- [X] `view/loop/registerSystems.js`/`view/scene/GameScene.jsx` — registra
      e monta o novo system/view

### 4. Grade de inventário e preview de equipamento

- [X] `view/creatureTints.js`, `view/itemColors.js` (novos) — cor por
      espécie/categoria, compartilhados entre HUD e grade
- [X] `tools/shared/SlotPreview.jsx` (novo) — preview (quadrado/esfera +
      contagem) compartilhado; depois ganha `getSlotColor(kind, id)`
      exportado
- [X] `tools/menu/InventoryPanel.jsx` (novo) — grade 5x5
- [X] `tools/menu/PlayerPreview.jsx` (novo) — canvas 3D isolado do jogador
- [X] `tools/menu/InventoryPanel.jsx` — `EquipmentPreview` (time + preview
      + mão, só leitura, ao lado da grade)
- [X] `tools/menu/PauseMenu.jsx` — largura da caixa maior só na tela de
      Inventário; `view` sobe pra prop (`view`/`onViewChange`) vindo de
      `page.js`, pra tecla `I` abrir direto nela

### 5. Equipar e desequipar por arrastar

- [X] `tools/menu/InventoryPanel.jsx` — `InventorySlot` vira `<div
      draggable>` (sem clique); `DRAG_TYPE` por categoria;
      `createDragImage` (canvas custom) + `setDragImage`
- [X] `EquippedSlot` — alvo de drop (`onDragOver`/`onDrop`, sinalização
      verde/vermelho) e também fonte (arrastar pra fora desequipa),
      gravando `UNEQUIP_TYPE` com o id de origem
- [X] Grade inteira escuta `UNEQUIP_TYPE` em `dragover`/`drop` pra limpar
      o slot de origem ao soltar ali, com destaque visual
- [X] `buildSlots` filtra o que está equipado (desconta/omite) da grade
- [X] Estado `dragging` por célula/slot, escondendo a origem entre
      `dragstart`/`dragend` — adiado via `setTimeout(..., 0)` pra não
      cancelar o próprio arraste (ver Correções)

### 6. Gate e documentação

- [X] `package.json`: bump de versão `0.0.14` → `0.0.15`
- [X] `npm run lint` e `npm test` verdes

---

## Critérios de Conclusão

- `Esc` abre/fecha o menu de pausa sem pausar o jogo; Configurações edita
  `GAME_CONFIG` ao vivo, refletindo no próximo tick.
- HUD sempre visível mostra time + mão principal, com destaque de "fora";
  tecla `I` abre o Inventário direto, de qualquer estado.
- Inventário mostra a grade 5x5 (itens com contagem + criaturas
  disponíveis) e o preview do jogador com os slots ao redor, atualizando
  ao vivo.
- Arrastar um item/criatura da grade até o slot compatível equipa;
  arrastar de volta pra grade desequipa; slot incompatível durante o
  arraste fica vermelho e não aceita o drop.
- O que está equipado não aparece mais na grade ao mesmo tempo; a origem
  do arraste fica vazia enquanto o item está "no mouse".
- Usar um consumível dispara partículas na posição do jogador.
- `npm run lint` e `npm test` continuam verdes; nenhum teste existente
  quebra.

---

## Correções feitas durante a versão

- **`requestPointerLock()` rejeitado logo após o `Esc`** —
  `NotAllowedError: Too many pointer lock requests...`. O Chrome impõe um
  cooldown depois de um `Esc` que soltou o Pointer Lock. Corrigido
  desacoplando: fechar o menu é sempre imediato (estado direto); travar
  de novo é melhor esforço, com a rejeição silenciosamente ignorada.
- **Botão direito abria o menu sem querer** — o design original inferia
  "menu aberto" de qualquer perda de Pointer Lock (`pointerlockchange`),
  e o botão direito também solta o mouse. Corrigido trocando o gatilho de
  abertura pra `Esc` (`keydown`) direto — `pointerlockchange` só fecha.
- **Mão desequipava mesmo com estoque sobrando** — usar/arremessar
  limpava `HeldItem.itemId` sempre, mesmo tendo mais unidades do mesmo
  item. Corrigido: só desequipa quando o estoque daquele item zera de
  vez.
- **HUD/Inventário não atualizavam ao vivo ao consumir item** — o dado
  (`Inventory.itemIds`) sempre esteve certo; o problema era a notificação
  de mudança pro React nunca disparar. Causa: `Inventory` é um trait AoS
  (schema função) e `playerActionSystem` mutava o array direto num valor
  lido da própria query do system — pra esse tipo de trait, `updateEach`
  só considera "mudou" quando a referência troca (`entity.set()`), não
  quando o conteúdo muda por mutação. Tentar só trocar pra `entity.set()`
  mantendo `Inventory` na query piorou: `updateEach`, ao fim de cada
  iteração, regrava por cima o valor de **antes** do callback rodar (pra
  comparar e decidir se mudou) — um `entity.set()` no meio do próprio
  callback, pra um trait na mesma query, simplesmente some. Só funciona
  de verdade com `Inventory` **fora** da query do system, lida/escrita
  via `entity.get`/`entity.set` direto.
- **Arraste cancelava sozinho ao tentar esconder a origem** — o plano de
  "some da fonte durante o arraste" (etapa 5) inicialmente chamava
  `setDragging(true)` (escondendo o elemento via `invisible`) direto
  dentro do `dragstart`. O browser cancela o drag se a origem some (mesmo
  só `visibility: hidden`) antes dele terminar de iniciar — o efeito
  prático era "o drag parou de funcionar" de vez. Corrigido adiando o
  `setDragging(true)` com `setTimeout(..., 0)`, mesmo truque já usado pra
  limpar o canvas da imagem de arraste — o browser termina de iniciar o
  drag antes da origem sumir.

## Fora de escopo

- **Pausar a simulação de verdade / persistência de config / validação de
  valor** — o loop continua rodando atrás do menu; edições de
  `GAME_CONFIG` resetam a cada refresh; sem guardrails — ferramenta de
  dev.
- **Coleta/loja/craft de item, posse de criatura de verdade (captura)** —
  inventário começa com kit fixo de teste; toda espécie `kind: 'pokemon'`
  continua "disponível" pra qualquer um, sem sistema de posse.
- **Categorias novas de equipamento** (roupas etc.) e **renderização do
  equipamento no modelo 3D** — mencionadas como visão de futuro, não
  desenhadas nem construídas.
- **Ícone/modelo de verdade por item/criatura** — quadrado/esfera coloridos
  são placeholder; arte de verdade é conteúdo a definir depois.
- **Suporte a touch/mobile no drag-and-drop** — nativo por mouse, sem
  polyfill de toque (jogo desktop-first).
- **Testes automatizados da interação de UI/drag-and-drop** — `tools/`
  segue sem cobertura automatizada; validação é visual, no `npm run dev`.
- **Drag-and-drop do Inventário ainda não está 100% redondo** — depois de
  corrigido o cancelamento do arraste (ver Correções), o usuário sinalizou
  que a interação ainda tem arestas. Fica registrado aqui como pendência
  conhecida, a ser retomada numa feature própria, exclusiva do
  Inventário, no futuro — não faz parte do critério de conclusão desta
  versão.
- **Animação de arremesso voltando pra T-pose** — investigado durante esta
  janela de trabalho, mas é um problema à parte (formato de clipe gravado
  por keyframes, incompatível com o sistema de curva procedural hoje);
  fica só como item novo no backlog (`docs/backlog.md`, seção "Animação"),
  sem nenhuma mudança de código nesta versão.
