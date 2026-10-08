# 🚀 Versão 0.0.42 — Itens da beta

## Resumo

Sai o catálogo de teste e entram os itens de verdade da beta: **Pokébolas**
(Poké Bola, Grande Bola, Ultra Bola), **poções** (Poção, Super Poção, Hiper
Poção) e **frutas** (Fruta Frambo, Fruta Nanab, Fruta Pinap).

- **Poção** cura na hora: o treinador usa em si mesmo com o item na mão, ou
  usa na criatura invocada pelo menu de ações ("Usar item").
- **Fruta** cura aos poucos, enquanto quem come está comendo (cada fruta tem a
  sua duração). O treinador come a fruta da mão; a criatura invocada come a
  que o treinador der pelo menu de ações. Se quem come for interrompido, a
  fruta cai no chão e o resto da cura se perde.
- **Pokébola** entra só no catálogo, com o multiplicador de captura nos dados.
  Arremessar ainda não faz nada; a captura é a 043.

Item sem sprite ganha um ícone padrão por categoria.

Versão: `0.0.42` (`package.json`). Branch: `feature/042-itens-da-beta`.

> **Números deste doc são fictícios (ilustrativos).** O valor de verdade é o
> do campo citado (dados do item/config).

---

## O que já existe (ponto de partida)

- **Registro de itens** (`core/data/items/`): pasta por item, `getItem`/
  `listItems`, `ITEM_CATEGORY_ORDER`. Hoje: `pebble`, `rock` (`throwable`),
  `potion`, `elixir` (`consumable`), todos de teste, e `pokedex` (`scanner`).
- **Usar item da mão** (`playerActionSystem.js`): clique primário com
  `throwable` arremessa um `Projectile`; com `consumable` faz a ação
  `consume` e, no `effectAt`, cura o próprio treinador (`applyHeal` com
  `consumable.healAmount`) e gasta uma unidade (`gastarItem`).
- **Inventário** (041): itens com quantidade e posição livre; detalhes do item
  com ícone, categoria e descrição (`InventoryDetails.jsx`).
- **Ícone**: `item.sprite` (`SlotPreview.jsx`); sem sprite, um quadrado da cor
  da categoria (`ITEM_COLORS`, `view/itemColors.js`). Só a Pokédex tem sprite.
- **Menu de ações** (038): segurar Q/E/R abre o `PartyActionMenu` do slot, com
  as abas de treino e golpes.
- **Kit inicial** (`core/world/world.js`): só a Pokédex.

---

## Decisões (com o usuário)

1. **Poção na criatura pelo menu de ações** (segurar Q/E/R → "Usar item").
   Só cura a criatura **invocada** daquele slot: Pokémon no inventário ou não
   invocado não recebe item.
2. **O treinador continua se curando** com o item na mão (clique primário).
3. **Pokébola não faz nada** ao ser usada nesta feature. A função dela é a 043.
4. **Pokémon não segura item.** A fruta é dada pelo treinador. Muda o que o
   roadmap dizia ("o Pokémon segura e usa sozinho com HP baixo").
5. **Fruta cura enquanto come**, não na hora. Cada fruta tem a sua duração.
   Fica um estado de animação próprio (`eat`) preparado para os clipes.
6. **Treinador e criatura podem comer** (por enquanto, as duas frutas servem
   para os dois).
7. **Interrompido, derruba a comida**: a fruta cai no chão, o resto da cura se
   perde e ela não pode ser pega de volta. Condição dos itens (estragar, pegar
   do chão) fica para depois da beta.
8. **Comendo, quem come não age.** As ações próprias (andar, correr, pular,
   batalhar, usar outro item, trocar o controle, invocar/recolher), venham do
   input ou da IA do time, **nem cancelam nem acontecem**: o comando é
   ignorado até acabar de comer. Interrompem o que vem de fora: dano
   recebido, desmaio e a criatura ser recolhida pelo treinador. Exceção:
   pilotando uma criatura que está comendo, dá para devolver o controle ao
   treinador (correção depois do teste no jogo).
9. **Pedra, Pedrinha e Elixir saem de vez.** A `potion` de teste vira a Poção
   de verdade.
10. **Kit inicial definitivo é da 061.** Por enquanto, para testar, o jogo
   começa com todos os itens novos no inventário.
11. **Ícone padrão** para item sem sprite. O usuário coloca os sprites em
    `public/assets/sprites/itens/`.
12. **Funções dos itens nesta feature**: poção e fruta funcionam aqui; a
    Pokébola fica só com os dados (a função é a 043).

---

## Arquitetura

### Catálogo (`core/data/items/`)

| id | nome | categoria | dados (fictícios) |
|---|---|---|---|
| `poke-ball` | Poké Bola | `pokeball` | `pokeball.captureMultiplier: 1` |
| `great-ball` | Grande Bola | `pokeball` | `pokeball.captureMultiplier: 1.5` |
| `ultra-ball` | Ultra Bola | `pokeball` | `pokeball.captureMultiplier: 2` |
| `potion` | Poção | `consumable` | `consumable.healAmount: 20` |
| `super-potion` | Super Poção | `consumable` | `consumable.healAmount: 50` |
| `hyper-potion` | Hiper Poção | `consumable` | `consumable.healAmount: 120` |
| `razz-berry` | Fruta Frambo | `berry` | `berry.healAmount: 10`, `berry.duration: 10` |
| `nanab-berry` | Fruta Nanab | `berry` | `berry.healAmount: 20`, `berry.duration: 3` |
| `pinap-berry` | Fruta Pinap | `berry` | `berry.healAmount: 30`, `berry.duration: 4` |

- Nomes como na localização oficial em português (a confirmar na revisão).
- `name` e `description` em todos (texto para o jogador).
- `berry.healAmount` é a cura **total** da fruta, espalhada pela `duration`.
- `ITEM_CATEGORY_ORDER`: `scanner`, `pokeball`, `consumable`, `berry`.
- `pebble/`, `rock/` e `elixir/` são apagados; `_template/` documenta as
  categorias novas.

### Categorias e o clique primário (`playerActionSystem.js`)

- `consumable` — como hoje (ação `consume`, cura na hora).
- `berry` — o treinador começa a comer a fruta da mão (ver **Comer**).
- `pokeball` — nada (decisão 3). A 043 decide como ela é arremessada.
- `throwable` fica **sem nenhum item**. O caminho de arremesso continua no
  código porque a 043 vai usar; os testes dele passam a usar um item de teste
  próprio (registro injetado), não mais a `pebble`.

### Comer (fruta)

- Trait **`Eating`** em quem come (treinador ou criatura):
  `{ itemId, elapsed, duration, healTotal, healed }`. Escreve: as actions de
  comer e o `eatingSystem`.
- Action **`comecarAComer(world, eater, itemId)`** — põe `Eating` com os dados
  da fruta e gasta uma unidade do inventário do treinador (na hora em que
  começa: se for interrompido, a fruta já foi).
- **`eatingSystem`** (passo fixo, depois do combate): a cada tick cura a fração
  `healTotal × delta / duration` (com `applyHeal`, sem passar da vida máxima);
  ao chegar na `duration`, tira o `Eating`.
- Action **`derrubarComida(world, eater)`** — tira o `Eating` e spawna a comida
  caída no chão (`DroppedFood`, só visual, com tempo de vida em
  `GAME_CONFIG.ITEMS`, para não acumular na cena). Ninguém pega.
- **O que interrompe** (decisão 8): tomar dano, desmaiar e a criatura que
  come ser recolhida. O treinador comendo não invoca nem recolhe até acabar
  (o recolher automático também espera).
- **O que fica bloqueado**: com `Eating` ativo, quem come não anda, não corre,
  não pula, não dá dash, não ataca, não usa skill nem item e não troca o
  controle. Vale para o input e para a IA do time (que não manda a criatura
  andar nem atacar). O comando é só ignorado: não cancela a comida e não fica
  guardado para depois. Um guard único (`isEating(entity)`) nos pontos de
  entrada (movimento, ações do jogador, ataque da criatura, IA do time, troca
  de controle), para a regra não ficar espalhada.
- **Animação**: estado `eat` na tabela de `animationStates.js`, ativo enquanto
  existe `Eating` (quem come está parado, então não disputa com andar ou
  atacar). Sem clipe na espécie, cai no `idle` (mesmo fallback de sempre). Clipes do treinador e das criaturas ficam para quando existirem
  (procedurais, com preview).
- **Feedback**: um efeito leve de cura enquanto come (reaproveita o
  `ConsumeEffect`) e a comida caída quando interrompe. Som de comer só se já
  houver um que sirva; senão, fica pendente.

### Usar item na criatura (menu de ações)

- Aba nova **"Itens"** no `PartyActionMenu`: lista as poções e frutas que o
  treinador tem, com a quantidade.
- Só habilitada com a criatura do slot **invocada e não desmaiada**. Fora
  disso, a aba mostra o motivo ("Invoque o Pokémon para usar um item").
- Action **`usarItemNaCriatura(world, trainer, creature, itemId)`**:
  - `consumable` — cura a criatura na hora, `ConsumeEffect` nela, gasta uma
    unidade;
  - `berry` — `comecarAComer(world, creature, itemId)`.
- **Vida cheia**: não deixa usar poção nem fruta (não gasta à toa). Vale também
  para o treinador com o item na mão.
- O menu continua bloqueando o input de jogo enquanto aberto, como hoje.

### Ícone padrão (`SlotPreview.jsx`)

- Sem `sprite`, ou se a imagem não carregar, mostra um ícone genérico **por
  categoria** (bola, frasco, fruta, Pokédex; um genérico para categoria
  desconhecida), desenhado em SVG na própria view, com a cor de `ITEM_COLORS`.
- `ITEM_COLORS` ganha `pokeball` e `berry`; `CATEGORY_LABELS` dos detalhes
  idem ("Pokébola", "Poção", "Fruta").
- Os dados do item já apontam para o arquivo esperado
  (`/assets/sprites/itens/<id>.png`); enquanto o arquivo não existir, aparece
  o ícone padrão.

### Kit de teste (`core/world/world.js`)

- `STARTING_ITEMS`: a Pokédex na mão e todos os itens novos no inventário,
  com quantidades de teste. O kit de verdade é da 061.
- Debug: o seletor de item da mão lista o catálogo novo.

### Testes

- Catálogo: todo item tem `name`, `description` e a categoria com os dados que
  ela exige; não sobra item de teste no registro.
- Comer: cura a fração certa por tick (derivada de `healTotal`/`duration`),
  termina na duração, não passa da vida máxima, gasta a unidade ao começar.
- Dano, desmaio e recolher a criatura que come tiram o `Eating`, spawnam a
  comida caída e param a cura.
- O treinador comendo não invoca nem recolhe; a criatura comendo devolve o
  controle ao treinador.
- Com `Eating` ativo, andar, atacar, dash, pulo, usar item e trocar o
  controle não acontecem e não tiram o `Eating` (input e IA do time); outro
  item não é gasto.
- `usarItemNaCriatura`: só com a criatura invocada e não desmaiada; poção cura
  na hora; fruta começa a comer; vida cheia não gasta.
- Treinador: poção da mão cura na hora; fruta da mão começa a comer;
  Pokébola na mão não faz nada.
- Arremesso continua funcionando com o item de teste injetado.

### Ajustes durante a implementação

- **Comer é uma ação do `ActionState`** (`current: 'eat'`), com o `Eating`
  guardando só os dados da fruta. O bloqueio sai de graça: movimento, dash,
  ataque, IA do time, treino e o resto já esperam `current === null`. Os
  pontos que não olham o `ActionState` ganharam `isEating`: pulo
  (`characterPhysicsSystem`), troca de controle (`controlSwitchSystem`,
  bloqueia quem está no controle) e o scanner (`scannerModeSystem`).
- **Quem gasta a fruta é quem chama** (clique primário ou
  `usarItemNaCriatura`), não `comecarAComer`: quem come pode ser a
  criatura, e o item é do treinador.
- **Dano interrompe pela fase de eventos** (`eatingInterruptSystem`):
  `attackResolved` com dano, `burnDamaged` e `leechSeedDrained`. O dano de
  debug do `DebugPanel` não emite evento, então não interrompe.
- **Desmaio**: `desmaiar` derruba a comida. Como garantia, o `eatingSystem`
  também derruba a de quem tem `Eating` sem estar mais na ação `'eat'`.
- **Invocar/recolher comendo** (correção depois do teste no jogo): o
  treinador comendo não invoca nem recolhe; o botão é ignorado até acabar.
  Recolher uma criatura que está comendo continua derrubando a comida dela.
  A checagem "o botão do slot invoca ou recolhe?" virou `resolveSlotCommand`
  no `partySummonSystem`.
- **Troca de controle comendo** (correção depois do teste no jogo): o
  treinador comendo não troca; a criatura comendo pode devolver o controle
  ao treinador (`4`), mas não trocar para outra criatura.
- **Usar item na criatura**: `resolveItemUseBlock` diz o motivo do bloqueio
  (`not-summoned`, `fainted`, `full-hp`, `eating`, `busy`,
  `trainer-eating`, `no-item`), e o menu mostra o texto. A poção pode ser
  usada na criatura enquanto ela come; outra fruta, não.
- **Comida caída**: esfera na cor da fruta (`ITEM_TINTS`) no pé de quem
  comia, um pouco à frente. Some depois de
  `GAME_CONFIG.ITEMS.DROPPED_FOOD_LIFETIME`.
- **Ícone padrão** (`tools/shared/ItemFallbackIcon.jsx`): bola, frasco,
  fruta, Pokédex e uma caixa genérica. Sprite que falha ao carregar fica
  marcado e não é pedido de novo.
- **Efeito de cura**: poção na criatura reaproveita o `ConsumeEffect`. A
  fruta não tem efeito próprio ainda: a barra de vida subindo é o retorno.
  Som de comer fica pendente.
- **Imagem do arraste** (correção depois do teste no jogo): o arraste usa o
  próprio ícone da célula (sprite ou ícone padrão), não mais o quadrado
  colorido desenhado num canvas.
- **Contador** (correção depois do teste no jogo): item que acumula sempre
  mostra a quantidade, inclusive "x1"; item que não acumula
  (`stackable: false`, hoje só a Pokédex) e Pokémon nunca mostram. Regra em
  `isStackableItem`. No slot da mão aparece "x1" (a unidade da mão), e o
  resto aparece na grade; o HUD mostra o total.
- **Pokémon como a sua Pokébola** (correção depois do teste no jogo): no
  inventário e nos slots do time, o Pokémon aparece com o ícone da bola em
  que foi capturado. O registro ganhou `Pokemon.ballId` (`null` é a comum,
  `DEFAULT_POKEBALL_ID`, caso dos iniciais), `criarPokemon` aceita
  `{ ballId }` e `resolvePokemonBallId` lê. A captura (043) grava a bola
  usada, e o save (044) precisa guardar o campo.
- **A fruta aparece enquanto come** (pedido depois do teste no jogo, com a
  animação de comer do Bulbasaur): uma esfera na cor da fruta que encolhe
  conforme a cura sai e some no fim (`EatingFoodView.jsx` +
  `eatingFoodViewSystem.js`). Onde ela fica é configurado na própria espécie
  (`species.vfx.eatFood`, documentado no `_template/`), com `position`
  (deslocamento em metros no referencial do corpo: `x` direita, `y` cima,
  `z` frente) e `scale` (tamanho da fruta) pra ajustar à mão:
  - **leva à boca** (`hands`) — ponto médio das mãos, acompanhando a
    animação: Charmander e Squirtle (as duas mãos chegam à boca juntas) e o
    treinador (`RHand`);
  - **come do chão** (`ground`) — no chão embaixo da boca (`jaw`), fixada
    onde apareceu: Bulbasaur. Espécie sem entrada usa o chão também.
- **Modelos dos itens** (pedido depois do teste no jogo): `item.model` com
  `path` do `.glb`, `texture` (`path` + `flipY`), `size` (maior dimensão em
  metros — o `.glb` vem em qualquer escala) e, nas frutas, `eatStages`
  (documentado no `_template/`). As frutas viraram as que têm modelo: **Oran
  e Sitrus saíram, entraram Frambo (Razz), Nanab e Pinap**. O modelo vem em
  pedaços (`fruit_0` inteira, `fruit_1`, `fruit_2` quase acabada, e as
  folhas): fica visível um pedaço por vez, trocando conforme a cura sai, em
  vez da esfera encolher (`view/scene/ItemModel.jsx`,
  `view/itemEatStages.js`). A fruta caída guarda quanto já tinha sido comido
  (`DroppedFood.eaten`) e mostra o pedaço certo. Item sem modelo continua na
  esfera. As Pokébolas já têm `model` configurado, mas ainda não aparecem em
  lugar nenhum (o arremesso de captura é a 043).
- **Física e partículas da fruta** (pedido depois do teste no jogo: "muito
  estática"):
  - **Fruta caída com física** (`droppedFoodSystem`, só visual): sai de onde
    estava (altura das mãos ou chão) com um impulso pra frente e pra cima,
    espalhado pelo `cosmeticRng` (RNG cosmético novo, regra 3.5), cai com a
    gravidade do jogo, quica, rola com atrito e para. O chão é o terreno
    embaixo dela (raio só na geometria fixa) ou, sem física, o chão de quem
    derrubou. Na view ela gira como se rolasse (`droppedFoodViewSystem`).
    Ajustes em `GAME_CONFIG.ITEMS.DROPPED_FOOD_PHYSICS`.
  - **Mordidas** (`view/foodMotion.js`): a cada `BITE_INTERVAL` (ou
    `species.vfx.eatFood.biteInterval`) e a cada troca de pedaço, a fruta
    achata e volta numa mola que estica um pouco; a do chão pula e tomba de
    leve; a da mão gira junto com a mão (a partir de "de frente pra quem
    come").
  - **Partículas** (`view/vfx/eatFoodVfx.js`, `EatingVfxView.jsx`): suco e
    farelos na cor da fruta a cada mordida, brilhos verdes de cura subindo
    em volta de quem come enquanto come, e respingo quando a fruta caída
    quica. Texturas reaproveitadas do Water Gun e do Leech Seed. Ajustes em
    `GAME_CONFIG.FEEDBACK.EAT_FOOD`.
- **`rotation` da fruta** em `species.vfx.eatFood` (graus, em volta dos eixos
  da própria fruta), por cima da orientação de sempre.
- **Pivô no corpo da fruta** (correção depois do teste: girar mudava a
  posição): o modelo era centrado na caixa do modelo inteiro, e as folhas
  puxam esse centro pra fora do corpo (na fruta no chão, o pivô ainda ficava
  na base). Agora o modelo é centrado no corpo — `item.model.pivot`, ou o
  primeiro de `eatStages` (`view/itemModelBuild.js`) — e a rotação, o aperto
  da mordida e o rolar da fruta caída são aplicados nesse pivô, não no grupo
  de fora. No chão, o pivô fica levantado pra base continuar encostada.

---

## Fora de escopo

- Função da Pokébola (arremesso de captura) — 043.
- Pokémon segurar item.
- Pegar a comida do chão, condição/estrago de itens — depois da beta.
- Itens no mundo e árvores de frutas — 050.
- Kit inicial definitivo — 061.
- Clipes de animação de comer (o estado fica preparado; Bulbasaur, Charmander
  e Squirtle já têm, o treinador ainda não).
- Salvar — 044.

---

## Etapas

- [x] Bump da versão para `0.0.42` e doc da feature.
- [x] Revisão do doc pelo usuário.
- [x] Catálogo novo; saem `pebble`, `rock` e `elixir`; `_template/` e
      `ITEM_CATEGORY_ORDER` atualizados.
- [x] Testes de arremesso com item de teste injetado.
- [x] Clique primário por categoria (`pokeball` sem efeito, `berry` come);
      vida cheia não gasta.
- [x] `Eating`, `comecarAComer`, `eatingSystem`, `derrubarComida` e as
      interrupções (dano, desmaio, recolher a criatura); bloqueio das ações
      próprias enquanto come; `DroppedFood` na view.
- [x] Estado de animação `eat`.
- [x] Aba "Itens" no menu de ações e `usarItemNaCriatura`.
- [x] Ícone padrão por categoria, cores e rótulos.
- [x] Kit de teste e seletor do debug.
- [x] Testes.
- [x] Teste no jogo pelo usuário.
- [x] Roadmap e wiki (página "Itens" do catálogo).

---

## Critérios de Conclusão

- [x] Nenhum item de teste no registro; os 9 itens da beta no catálogo
      (3 Pokébolas, 3 poções, 3 frutas), mais a Pokédex.
- [x] O treinador se cura com poção (na hora) e com fruta (aos poucos).
- [x] Pelo menu de ações, a criatura invocada recebe poção ou fruta; não
      invocada ou desmaiada, não.
- [x] Dano, desmaio ou recolher a criatura que come derruba a fruta e corta
      a cura; comendo, as outras ações não acontecem (a criatura ainda
      devolve o controle ao treinador).
- [x] Pokébola na mão não faz nada.
- [x] Item sem sprite mostra o ícone padrão da categoria.
- [x] `npm run build`, `npm run lint` e `npm test` passando (suíte inteira:
      157 arquivos, 1634 testes, com `--maxWorkers=2`; build feito numa cópia,
      por causa do `next dev` rodando).
- [x] Wiki atualizada: página "Itens" do catálogo saiu do "em breve"
      (como usar, Pokébolas, poções, frutas — com os números lidos do jogo);
      "Inventário" (kit de teste, contador, criatura como a sua Pokébola) e
      "Seu time" (aba Itens no menu de ações).
