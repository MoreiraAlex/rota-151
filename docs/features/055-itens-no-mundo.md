# 🚀 Versão 0.0.55 — Itens no mundo

## Resumo

Até aqui, item só vinha do kit inicial. Agora o mundo também dá itens:

- **Pokébolas no chão**, sorteadas por bioma. Cada chunk tem um teto e vai
  repondo com o tempo, contado pelo relógio do mundo. (No futuro, outros
  itens também.)
- **Frutas na vegetação**: todo arbusto e toda árvore podem ser
  vasculhados com F. A cada dia de jogo, cada um sorteia se tem a fruta do
  bioma; nada mostra qual tem.
- **Pegar e vasculhar com F**, com aviso na HUD.
- **O mundo lembra**: o que foi pego e colhido entra no save. Sair do chunk
  e voltar não enche ele de novo.

> O primeiro desenho (frutas e itens escondidos no chão, árvore de fruta
> como tipo próprio) mudou depois do primeiro teste: ver "Ajustes depois do
> primeiro teste". As seções de proposta abaixo ficam como histórico.
- **As poções saem do jogo** nesta beta: os itens da beta passam a ser só
  Pokébolas e frutas.

Versão: `0.0.55` (`package.json`). Branch: `feature/055-itens-no-mundo`.

> **Os números deste doc são fictícios (só ilustram).** O valor de verdade é
> o do campo citado (config ou dado do bioma).

---

## O que já existe (ponto de partida)

- **Catálogo de itens** (`core/data/items/`, 042): Poké Bola, Grande Bola e
  Ultra Bola; Fruta Frambo, Nanab e Pinap, todas com `.glb` em
  `public/assets/models/items/`. Poção, Super Poção e Hiper Poção
  (categoria `consumable`) só têm sprite.
- **Inventário** (041): `adicionarItem`, `hasFreeCell` e a capacidade da
  grade (`GAME_CONFIG.INVENTORY`). Cheio, a captura já deixa a bola no chão
  (043).
- **Chunks** (046): `carregarChunk`/`descarregarChunk`
  (`core/actions/chunks.js`). Objetos soltos somem quando o chunk descarrega
  (`chunkObjectCleanupSystem`).
- **Sólidos pela seed no core** (`core/vegetation/solidPlacement.js`, 049):
  árvores e pedras por tipo e bioma, com pegada, colisor e pathfinding.
- **Arbustos só na view** (`view/vegetation/vegetationScatter.js`): são
  desenho, sem colisor, e o core não sabe onde estão.
- **PRNG** (`core/rng.js`): `createRng`, `deriveSeed` e `gameplayRng`.
- **Relógio do mundo** (`WorldClock`, 048): anda em dias de jogo no passo
  fixo e vai para o save (`worldTime`).
- **Save** (044): `SAVE_VERSION` com migrações. Item que não existe mais no
  catálogo é descartado ao carregar (`trainerSave.js`).
- **Teclas**: F está livre (`platform/input/keyboardInput.js`).

---

## Decisões (com o usuário)

1. **Poções fora da beta.** Saem Poção, Super Poção e Hiper Poção, junto com
   o uso pela mão (a ação `consume` do treinador e o efeito dela). O "Usar
   item" do menu de ações **fica**, porque é por ele que o treinador dá a
   fruta à criatura: só sai o ramo das poções. A cura em si (`applyHeal`)
   fica, porque as frutas e a Semente Sanguessuga usam. A 078 (revisão das
   poções) saiu do roadmap.
2. **Cada item com o próprio modelo** no chão (os `.glb` do catálogo).
3. **Item no arbusto**: o core sorteia o item e marca que ele é "de
   arbusto". A view põe um arbusto do bioma em volta dele (opção B). Os
   arbustos de enfeite continuam só na view.
4. **Itens do chão sorteados, com teto e reposição**:
   - na primeira visita, o chunk nasce com os itens que a seed sorteia
     (sempre os mesmos);
   - cada bioma tem um teto por chunk e uma tabela de chances (exemplo
     fictício: Poké Bola comum, Grande Bola rara, Ultra Bola muito rara,
     fruta ocasional);
   - a cada intervalo *de jogo*, um chunk abaixo do teto ganha um item num
     ponto livre e aleatório, longe do jogador;
   - chunk descarregado guarda a hora em que saiu. Na volta, repõe só o que
     teria nascido nesse tempo, até o teto. Andar para longe e voltar não dá
     itens a mais.
5. **Árvore de fruta**: uma fruta por bioma (Frambo na floresta, Nanab na
   planície, Pinap na savana). É rara no chunk, dá algumas frutas por
   colheita (sorteadas) e volta a dar fruto depois de um tempo em dias de
   jogo, que corre mesmo com o chunk descarregado. Só mostra fruta pendurada
   quando tem fruto.
6. **Pegar e colher com F.**
7. **Save só do que mudou**: só vão para o save os chunks e as árvores em que
   o jogador mexeu. O resto sai da seed de novo.
8. **Árvore de fruta é uma árvore comum** com as frutas penduradas. O LGPE
   não tem árvore de fruta (ver "Busca no LGPE").
9. **Sons do Cobblemon** (ver "Sons").

---

## Busca no LGPE (levantada na abertura)

- `LGPE-FieldMaps.7z`: nenhuma árvore de fruta. Só as árvores das rotas
  (`tree05`–`tree23`, `wood*`) e a árvore de Corte (`iaigiri_tree`).
- `LGPE-Misc.7z` (`chara/data/ob/`): as frutas soltas (`ob0501`–`ob0503`,
  Frambo, Nanab e Pinap em três estágios, as que o jogo já usa) e as bolas
  (`ob0201`–`ob0204`). Não tem árvore.
- No Let's Go as frutas vêm de presente e do chão, sem árvore. Por isso a
  árvore de fruta usa o modelo da árvore folhosa do bioma (na savana, a
  árvore redonda dela), com as frutas do catálogo penduradas na copa.

---

## Arquitetura (proposta)

### Retirada das poções

- Saem `core/data/items/{potion,super-potion,hyper-potion}/` e o registro
  delas em `core/data/items/index.js`.
- Sai o caminho `consumable`: o uso pela mão (ação `consume` em
  `playerActionSystem.js` e `boy/index.js`), o efeito dela (`ConsumeEffect`,
  `consumeEffectSystem`, `ConsumeEffectView`), o ramo da poção no uso na
  criatura (`core/actions/itemUse.js`; o "Usar item" do `PartyActionMenu`
  fica só com as frutas), o rótulo, a cor e o ícone da categoria
  (`InventoryDetails.jsx`, `view/itemColors.js`, `ItemFallbackIcon.jsx`) e
  as poções do kit de teste (`startingKit.js`).
- **Save**: não precisa de migração. O carregamento já descarta id
  desconhecido, e isso ganha um teste.
- A wiki (catálogo de itens) é atualizada no fim da feature.

### Dados por bioma (`core/data/biomes/*`)

Bloco novo `worldItems` nos três biomas visíveis:

```js
worldItems: {
  maxPerChunk: 4,          // teto de itens no chão por chunk
  refillMinutes: 30,       // minutos de jogo entre uma reposição e outra
  hiddenChance: 0.3,       // chance de o item nascer num arbusto
  table: [                 // chance relativa (peso) de cada item
    { itemId: 'poke-ball', weight: 10 },
    { itemId: 'great-ball', weight: 3 },
    { itemId: 'ultra-ball', weight: 1 },
    { itemId: 'razz-berry', weight: 4 },
  ],
},
```

A árvore de fruta entra no `vegetation` como um tipo sólido novo
(`berry-tree`), com a fruta e a regra da colheita:

```js
{ kind: 'berry-tree', density: 0.02, models: [...],
  berry: { itemId: 'razz-berry', min: 1, max: 3, regrowDays: 1 } }
```

O `_template` dos biomas documenta os dois. O teste garante que todo
`itemId` existe no catálogo.

### Sorteio (core, puro: `core/worldItems/`)

- `rollChunkItems(seed, chunk, params)`: os itens da primeira visita, pela
  sub-seed do chunk (`deriveSeed(seed, 'world-items:<chave>')`). Cada item
  tem um id estável (`<chave do chunk>:<índice>`), o `itemId`, a posição e
  `hidden`.
- `findFreeSpot(chunk, solids, rng, params)`: um ponto do chunk fora da
  pegada dos sólidos, fora da água, com inclinação aceitável e longe dos
  outros itens.
- `refillCount(elapsedDays, refillMinutes, missing)`: quantos itens a volta
  ao chunk repõe.
- A árvore de fruta sai da seed com o chunk, junto dos sólidos
  (`solidPlacement.js`: tipo `BERRY_TREE_KIND`, pegada e colisor como as
  outras árvores). O id dela é `<chave do chunk>:tree:<índice>`.

### Estado (traits)

- **`WorldItemsMemory`** (trait do mundo): para os chunks em que o jogador
  mexeu, os itens que restam e `updatedAt` (hora do mundo). Para as árvores
  colhidas, `fruits` e `regrowAt`. É a fonte autoritativa.
  Escrevem: as actions abaixo. Leem: o sistema de reposição e o save.
- **`GroundItem`** (entidade, com `Position`): `{ worldId, itemId, hidden }`.
  Nasce no carregamento do chunk e morre no descarregamento. É derivado da
  memória e da seed.
- **`BerryTree`** (entidade): `{ worldId, itemId, fruits }`. Mesmo ciclo
  de vida.

### Actions (`core/actions/worldItems.js`)

- `carregarItensDoChunk(world, chunk)`: chamada por `carregarChunk`. Usa a
  memória (se houver) ou a seed, aplica a reposição do tempo fora e cria as
  entidades.
- `descarregarItensDoChunk(world, chunk)`: grava `updatedAt` (só se o chunk
  já está na memória) e destrói as entidades.
- `pegarItemDoMundo(world, trainer, entity)`: com espaço no inventário,
  chama `adicionarItem`, tira o item da memória e destrói a entidade. Cheio,
  não pega e emite o aviso.
- `colherFrutas(world, trainer, tree)`: adiciona as frutas (o que couber),
  zera `fruits` e grava `regrowAt`.
- `reporItemNoChunk(world, chunk, rng)`: um item novo num ponto livre.

### Systems (passo fixo, fase simulation)

- **`worldItemRefillSystem`**: para cada chunk carregado abaixo do teto,
  quando passa `refillMinutes` desde a última reposição, chama
  `reporItemNoChunk`. O ponto fica a pelo menos
  `WORLD_ITEMS.SPAWN_MIN_DISTANCE` do jogador. Usa o `gameplayRng`, porque a
  reposição depende do que o jogador fez.
- **`berryTreeRegrowSystem`**: árvore carregada com `regrowAt` vencido volta
  a ter fruto (sorteio entre `min` e `max`).
- **`interactionSystem`**: com o pulso `interact` (F), acha o
  `GroundItem`/`BerryTree` mais perto do treinador dentro de
  `WORLD_ITEMS.INTERACT_RADIUS` e chama a action. Só o treinador pega e
  colhe: pilotando uma criatura, F não faz nada. Mantém o alvo atual num
  trait (`InteractionTarget`) para a HUD mostrar o aviso.

### Eventos

- `ItemPego` / `FrutasColhidas` (`{ itemId, amount }`): emite a action e
  consomem o som e o aviso da HUD, drenados na fase de eventos.
- `InventarioCheio`: emite a action e consome a HUD.

### Save

- `SAVE_VERSION` sobe para 2. Domínio novo `worldItems` com serializer e
  deserializer próprios (`core/save/worldItemsSave.js`): os chunks e as
  árvores da memória. A migração 1 → 2 começa com a memória vazia.
- O schema valida na fronteira (adapter e rota da API), como os outros
  domínios.

### View

- **`WorldItemsView`**: o `.glb` de cada item no chão, instanciado por
  `itemId`. O item escondido fica dentro de um arbusto do bioma (o mesmo
  modelo dos de enfeite), com um brilho discreto.
- **Árvore de fruta**: o modelo da árvore e as frutas do catálogo penduradas
  nos pontos da copa enquanto `fruits > 0`.
- **HUD**: "F — Pegar <item>" / "F — Colher" perto do alvo; aviso de
  inventário cheio; aviso de "+N <item>" ao pegar.
- **Sons** (ver "Sons").

### Sons

Do Cobblemon (`.exemple/Coblemon/assets/cobblemon/sounds/`), copiados para
`public/assets/audio/world-items/`. Ficam num arquivo de dados como os da
Pokébola (`core/data/audio/worldItemSounds.js`), com os volumes do
`sounds.json` dele como ponto de partida:

- **Pegar item do chão**: `pickup.ogg` (`pc/pc_grab`, o "pegar" do PC).
- **Pegar item do arbusto**: o farfalhar `bush_1..3.ogg`
  (`block/berry/berry_bush_break_*`) junto do `pickup`.
- **Colher fruta**: `harvest_1..3.ogg` (`block/berry/berry_bush_harvest_*`,
  a colheita do arbusto de frutas). Uma variação sorteada por vez (RNG
  cosmético).

Alternativas para o "pegar", se o `pc_grab` não agradar no jogo:
`block/display_case/display_case_remove_item` e
`block/campfire_pot/campfire_pot_take_item_*`.

### Config (`GAME_CONFIG.WORLD_ITEMS`)

`INTERACT_RADIUS`, `SPAWN_MIN_DISTANCE`, `SPOT_CLEARANCE`, `MAX_SLOPE` e
`SPOT_ATTEMPTS` (tentativas de achar um ponto livre).

### Pronto para o multiplayer (072)

Os ids são estáveis e saem só da seed e da chave do chunk, então servidor e
clientes chegam aos mesmos. Na 072, `WorldItemsMemory` passa para o
servidor, e a coleta vira uma intenção que o servidor confirma.

### Testes (regras, sem fixar valores)

- Retirada: nenhum item `consumable` no catálogo; save com id de poção
  carrega sem ela.
- `rollChunkItems`: mesma seed e mesmo chunk dão os mesmos itens; nunca
  passa do teto; todo item está dentro do chunk, fora de sólido e fora da
  água; `itemId` sempre da tabela do bioma.
- Dados: todo `itemId` de `worldItems` e de `berry` existe no catálogo.
- Reposição: nunca passa do teto; não repõe antes do intervalo; voltar ao
  chunk repõe no máximo o que o tempo fora permite.
- `pegarItemDoMundo`: soma no inventário e some do mundo e da memória;
  inventário cheio não pega nem some.
- `colherFrutas`: soma as frutas, zera a árvore e ela volta a ter fruto
  depois de `regrowDays`, mesmo descarregada.
- `interactionSystem`: pega o mais perto dentro do raio; fora do raio,
  nada; pilotando uma criatura, nada.
- Save: ida e volta do domínio `worldItems`; migração 1 → 2.

---

## Etapas

- [x] Bump `package.json` → `0.0.55` e doc.
- [x] Roadmap renumerado (055 em diante; a 078 das poções saiu).
- [x] Revisão do doc pelo usuário.
- [x] Retirada das poções (+ testes).
- [x] Dados `worldItems` e `berry-tree` nos biomas e no `_template`
      (+ testes).
- [x] Sorteio puro: `rollChunkItems`, `findFreeSpot`, `refillCount`
      (+ testes).
- [x] Árvore de fruta como sólido (`solidPlacement.js`) (+ testes).
- [x] Traits, actions e carregar/descarregar com o chunk (+ testes).
- [x] Reposição e volta da fruta (systems) (+ testes).
- [x] Tecla F, `interactionSystem` e eventos (+ testes).
- [x] Save: domínio `worldItems`, versão 2 e migração (+ testes).
- [x] View: itens no chão, item no arbusto, árvore de fruta e HUD.
- [x] Busca da árvore de fruta no LGPE (não tem: árvore comum).
- [x] Sons do Cobblemon copiados para `public/assets/audio/world-items/`.
- [x] Sons ligados aos eventos (`worldItemSounds.js`).
- [x] Migração do banco (`worldItems` na tabela `trainer`) aplicada pelo
      usuário.
- [x] Teste no jogo pelo usuário e ajustes.
- [x] Desempenho na Intel UHD (ver "Desempenho"; a qualidade baixa desenhar
      todos os arbustos foi para a 083, desempenho no celular).
- [x] Wiki: catálogo de itens (sem poções) e itens no mundo.
- [x] Roadmap: 055 para "Já feito".
- [x] Gates: `npm test` inteiro, `npm run lint` e build.

---

## Como ficou (implementação)

- **Poções fora**: saíram os três itens, a ação `consume` do treinador e o
  efeito dela (`ConsumeEffect`, `consumeEffectSystem`,
  `ConsumeEffectView`), o ramo da poção do `usarItemNaCriatura` e a
  categoria `consumable` (rótulo, cor e ícone). O "Usar item" do menu de
  ações ficou só com as frutas.
- **Árvore de fruta** (`BERRY_TREE_KIND` em `solidPlacement.js`,
  `GAME_CONFIG.BERRY_TREES`): espécie de árvore em pé como as outras
  (colisor, navegação, vegetação e F2), mas sorteada depois das pedras —
  o resto do mundo ficou igual. Usa a árvore redonda do bioma; a fruta e a
  colheita vêm do `berry` da entrada.
- **Regras puras** (`core/worldItems/worldItems.js`): o chunk segue o
  `worldItems` do bioma dominante dele (`chunk.biome`): teto, tempo e
  tabela. `rollChunkItems` (seed + chave do chunk), `findFreeSpot`,
  `refillCount`, e o id e as frutas da seed de cada árvore (pela posição).
- **Estado**: `WorldItemsMemory` (trait do mundo, a fonte: chunks mexidos e
  árvores colhidas), `WorldItemChunks` (chunks já em entidade),
  `GroundItem`/`BerryTree` (entidades) e a tag `InteractionFocus` no alvo
  do F (em vez de guardar a entidade num trait do treinador).
- **Actions** (`core/actions/worldItems.js`): carregar e descarregar com o
  chunk, repor (um item e o tempo fora), pegar, colher, voltar a dar
  fruto. A reposição começa a contar quando o primeiro item de um chunk
  cheio é pego.
- **Systems** (passo fixo, depois do relógio): `worldItemsStreamingSystem`,
  `worldItemRefillSystem`, `berryTreeRegrowSystem` e `interactionSystem`
  (F; só o treinador controlado; no meio de uma ação, marca mas não pega;
  bloqueado no modo scanner).
- **Save**: versão 2, domínio `worldItems` (`core/save/worldItemsSave.js`),
  migração 1 → 2 (memória vazia) e a coluna `worldItems` na tabela
  `trainer` (`prisma/migrations/20261014220000_itens_do_mundo`). Ao
  restaurar, as entidades que já tinham nascido saem e nascem de novo com
  a memória.
- **View** (`view/scene/WorldItemsView.jsx`): o item no modelo dele; o
  escondido não aparece — um arbusto do bioma no lugar, com um brilho
  (`Sparkles`); pego, o arbusto fica até o chunk descarregar (estado de
  tela). As frutas penduradas em volta da copa
  (`BERRY_TREES.FRUIT_SPOTS`). Aviso "F — Pegar/Colher/Vasculhar o arbusto"
  (`tools/hud/InteractionHud.jsx`). "Pegou X!", "Colheu N× X!" e
  "Inventário cheio" vão pelo log da HUD (`battleLogFormat.js`). Sons em
  `worldItemFeedbackSystem`.

---

## Ajustes depois do primeiro teste (pedido do usuário)

**Pedido:** no chão, por enquanto, só Pokébolas; todo arbusto pode ser
vasculhado e só os sorteados dão fruta; o mesmo com as árvores; nenhum
aviso de qual tem. "Pokébolas no chão, berry na vegetação."

**Decisões (com o usuário):**

1. **Todas as árvores** podem ser vasculhadas (folhosa, acácia, pinheiro,
   antiga, morta). Sai o tipo "árvore de fruta" e as frutas penduradas.
2. **Novo sorteio a cada dia de jogo**: pela seed, pelo id do lugar e pelo
   dia. Colhido, fica vazio até o dia seguinte. O jogador não decora quais
   têm.

**Como ficou:**

- **No chão**: a tabela do `worldItems` dos biomas só tem Pokébolas; saem o
  item escondido (`hidden`, `hiddenChance`), o arbusto com brilho e o som do
  arbusto ao pegar.
- **Arbustos no core** (`core/vegetation/bushPlacement.js`): o sorteio dos
  pontos (`hash01`, `scatterArea`) passou da view para
  `core/vegetation/scatter.js` (a view reexporta). Os arbustos saem por
  bloco de sólidos, como as árvores (`block.ground.bushes`: a view desenha a
  vegetação por bloco), e cada chunk fica com os de dentro dele
  (`chunk.bushes`, os que o F vasculha). A view desenha todos, em qualquer
  qualidade (um arbusto invisível não pode dar fruta). *Correção depois do
  teste: o primeiro corte sorteava só por chunk, o relevo do bloco ficava
  sem arbustos e nenhum era desenhado — o F mostrava "Vasculhar o arbusto"
  no nada.* A densidade
  dos arbustos no F2 agora refaz o terreno.
- **Fruta da vegetação** (`forage` dos biomas: `itemId` e, para `bush` e
  `tree`, `chance`, `min`, `max`): `forageSpotsOf` (todos os arbustos e
  árvores do chunk, com id pela posição), `rollForage` (o sorteio do dia),
  `forageRulesOf` (a fruta do bioma do lugar).
- **`vasculhar`** (`core/actions/worldItems.js`): acha a fruta do dia (se
  ninguém colheu hoje) ou avisa que não achou nada; inventário cheio avisa.
  A memória guarda só o dia da colheita (`foraged`), e esquece os dias
  passados.
- **Alvo do F**: virou um trait do mundo (`InteractionTarget`: item, arbusto
  ou árvore), porque arbusto e árvore não são entidades. Só é gravado
  quando muda. A HUD mostra "Pegar X", "Vasculhar o arbusto" ou "Vasculhar a
  árvore".
- **Saem**: `BerryTree`, `berryTreeRegrowSystem`, `BERRY_TREES`, a entrada
  `berry-tree` dos biomas e do F2, as frutas penduradas.
- **Save**: continua na versão 2; `trees` vira `foraged` (opcional, para os
  saves do primeiro desenho carregarem) e o `hidden` dos itens sai.
- **Sons**: vasculhar sempre farfalha (`rustle`); achando fruta, a colheita
  e o de pegar (`pickup`) junto. "Não achou nada." vai pelo log.

### Quantidade sorteada no chão (pedido do usuário)

Com o chunk pequeno, o teto cheio em todo chunk deixava Pokébola demais. O
usuário baixa o `maxPerChunk` dos biomas, e o enchimento passa a sortear:

- **Primeira visita**: o chunk sorteia pela seed quantos itens tem, de
  nenhum até o teto (`rollTargetCount`).
- **Cada verificação da reposição** (a cada `refillMinutes` de jogo,
  `verificarTetoDoChunk`): sorteia de novo, de nenhum até o teto; se der
  mais do que já tem, completa; o que já está no chão nunca sai.
- **Chunk que ninguém mexeu também repõe**: senão o que nasceu vazio ficava
  vazio para sempre. O relógio dele conta desde que carregou
  (`WorldItemChunks.checkedAt`, não vai para o save); ele só entra na
  memória (e no save) quando ganha item.
- **Volta ao chunk**: as verificações que caberiam no tempo fora
  (`refillChecks`), parando quando enche.
- **Chance de o chunk ter item** (`chance` do `worldItems`, pedido do
  usuário): ainda sobrava Pokébola com o teto em 1 (o sorteio de nenhum a
  um dava item em metade dos chunks de 16 m). Agora cada sorteio primeiro
  decide se o chunk quer item (`chance`) e, querendo, quantos (de um até o
  teto). Com teto 1, `chance` é a fração dos chunks com item. Os testes do
  mecanismo usam regras de teste (`test/worldItemRules.js`) e não dependem
  do ajuste da config.
- **O teto vale para o que está salvo** (`aplicarTetoDaMemoria`): se o
  `maxPerChunk` baixar, o chunk que carrega com mais itens na memória fica
  só com os primeiros. Achado no teste: os chunks mexidos com o teto antigo
  continuavam com todos os itens salvos.

---

## Desempenho (fechamento, pedido do usuário)

O usuário sentiu piora. Bancada na Intel UHD (produção, A = 0.0.54 do
HEAD e B = esta, intercaladas, floresta fechada da seed):

- **Primeira medida, parado:** GPU igual; a B com mais script por quadro,
  quadros perdidos e mais memória JS (lixo para o coletor).
- **Causas, todas de CPU, a cada passo:**
  - o streaming dos itens montava as chaves dos ~360 chunks carregados e
    passava por todos;
  - a reposição passava de novo por todos;
  - o F copiava e filtrava a lista de chunks e remontava a lista de arbustos
    e árvores;
  - andando, as Pokébolas do chão de todos os chunks carregados eram
    desenhadas (duas peças e sombra cada), mesmo longe demais para aparecer.
- **Correções:**
  - `WorldItemChunks.loaded` (chave → chunk) para os systems lerem sem
    montar chave nem copiar lista;
  - o streaming só trabalha quando o relevo muda (`revision`) e compara os
    chunks pelo objeto;
  - a reposição confere os chunks a cada `REFILL_CHECK_SECONDS`, não todo
    passo;
  - o F olha só os chunks em volta do treinador, pela chave, e a lista de
    arbustos e árvores fica guardada por chunk (`forageSpotsOf`);
  - a Pokébola do chão só é desenhada até `DRAW_DISTANCE` da câmera.
- **Depois:** parado e andando, A e B empatadas dentro do ruído (FPS, GPU,
  script e desenhos por quadro).

---

## Pendências com o usuário

Nenhuma: a migração do banco foi aplicada, os sons e a quantidade de itens
foram conferidos no jogo pelo usuário (o `maxPerChunk` e a `chance` dos
biomas são os dele).

---

## Critérios de Conclusão

- [x] Nenhuma poção no jogo; save antigo com poção carrega sem erro.
- [x] Floresta, planície e savana têm Pokébolas no chão, conforme a tabela
      do bioma.
- [x] Todo arbusto e toda árvore podem ser vasculhados; só os sorteados do
      dia dão a fruta do bioma, sem nenhum aviso de qual tem.
- [x] Mesma seed, mesmos itens na primeira visita.
- [x] F pega o item e vasculha arbusto e árvore; inventário cheio avisa e
      não pega.
- [x] O chunk repõe com o tempo até o teto; sair e voltar não dá itens a
      mais.
- [x] Colhido, o lugar fica vazio até o dia seguinte, quando sorteia de
      novo.
- [x] Fechar e abrir o jogo mantém o que foi pego e colhido.
- [x] Desempenho na Intel UHD no nível de hoje (dentro do ruído).
- [x] `npm run build`, `npm run lint` e `npm test` passando.
- [x] Wiki atualizada.

---

## Fora de escopo

- **Itens no servidor** (cada item pego some para todos) — 072.
- **Estruturas e Pokécenter** — 056 (virou "Bioma cidade"; o Pokécenter funcionando foi para a 086).
- **Loja e dinheiro** — depois da beta.
- **Criatura pegar item** — não pega; só o treinador.
- **Condição dos itens** (estragar, fruta derrubada voltar a ser pegável) —
  depois da beta.
