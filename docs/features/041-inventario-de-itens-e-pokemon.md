# 🚀 Versão 0.0.41 — Inventário de itens e Pokémon

## Resumo

Cada Pokémon passa a ser **um registro próprio** (espécie, IV, nível/XP,
golpes, vida e desmaio), ligado ao treinador por `OwnedBy`. O time é feito de
até 3 desses registros; os outros ficam **no inventário**, junto dos itens.

O inventário vira uma grade única, sem abas e sem limite: itens com
quantidade e um Pokémon por célula. Pelo inventário se monta o time
(arrastar do inventário para o slot, do slot de volta para o inventário) e
se reordena (arrastar um slot sobre o outro).

Sai o kit de teste: o jogo começa só com a Pokédex e um Pokémon de cada
espécie. A caixa/PC sai da beta.

Versão: `0.0.41` (`package.json`). Branch:
`feature/041-inventario-de-itens-e-pokemon`.

---

## O que já existe (ponto de partida)

- **Itens**: `Inventory` (`core/traits/components/inventory.js`) é uma lista
  de ids em que a repetição é a quantidade. Começa com um kit de teste
  (pebble, rock, potion, elixir, pokedex). `playerActionSystem` gasta uma
  unidade ao arremessar/usar e desequipa a mão quando o item zera.
- **Time**: `Party` guarda o id da ESPÉCIE por slot. Os dados do Pokémon
  vivem no treinador, também por slot: `PartyIndividualValues`,
  `PartyProgress`, `PartyMoves`, `PartyVitals`, `PartyFaint`. Ao invocar,
  `summonBallSystem` copia desses traits para a criatura; ao recolher, a
  vida volta para `PartyVitals`.
- **Trocar a criatura de um slot** (`equiparCriatura`, `core/actions/party.js`)
  sorteia um indivíduo novo: não existe "o mesmo Pokémon de antes".
- **Grade** (`InventoryPanel`, `tools/menu/`): 5x5 fixa, com uma célula por
  item (com contagem) e uma por ESPÉCIE de Pokémon. Arrastar para um slot do
  time chama `equiparCriatura`.
- **Recolher automático**: `partySummonSystem` recolhe a criatura em campo
  quando o slot dela fica vazio.
- **Dono**: desde a 040 a criatura invocada tem `OwnedBy` para o treinador e
  os helpers de `core/actions/owner.js` buscam "a criatura do slot N deste
  treinador".

---

## Decisões (com o usuário)

1. **Cada Pokémon é um registro próprio.** Os traits `Party*` por slot saem.
2. **Itens com quantidade**, sem limite por pilha nem de espaço.
3. **Grade única, sem abas.** As abas por categoria não entram (nem na 042,
   por ora).
4. **Kit inicial**: só a Pokédex, mais um Pokémon de cada espécie. Os itens
   de teste saem do kit (continuam no registro de itens; a 042 decide o que
   fazer com eles).
5. **Sem caixa/PC.** Pokémon fora do time ficam no inventário, sem limite. A
   captura (043) manda o Pokémon para o inventário. A caixa sai da beta.
6. **O time pode ficar vazio.**
7. **Montar o time por arrastar**: inventário → slot, slot → inventário,
   slot ↔ slot para reordenar.
8. **Pokémon em campo que sai do slot é recolhido**, como já acontece hoje.
9. **Sair do time não cura**: vida e desmaio ficam como estão. A cura é do
   Pokécenter (051).
10. **No inventário, o Pokémon regenera vida e o desmaio continua contando**,
    igual a quem está no time dentro da bola. A regra vale para todo
    registro que não está em campo, esteja no time ou não.
11. **Treino de golpe só anda para quem está invocado**, como já é hoje
    (`trainingSystem` só olha criaturas em campo). Nada muda.
12. **Fica para depois**: soltar Pokémon, descartar itens, item segurado
    (pensado na 042).

---

## Arquitetura

### Registro do Pokémon

- Uma entidade do Koota por Pokémon, **sem corpo no mundo** (sem posição,
  física ou view). Tem:
  - `PokemonData` — `{ speciesId }`.
  - IV, nível/XP, golpes (com treino e domínio), vida guardada e desmaio:
    o mesmo formato que cada slot dos traits `Party*` tem hoje, agora num
    trait por registro.
  - `OwnedBy` → treinador (a relação da 040).
  - `PartySlot({ slot })` — só enquanto está no time. Sem ele, o Pokémon
    está no inventário.
- A criatura invocada aponta para o registro de onde saiu (relação
  `SummonedFrom`, exclusiva). Invocar copia do registro; recolher devolve a
  vida para o registro; XP, domínio, treino e desmaio escrevem no registro.
  Some a busca por "slot" para achar os dados: quem tem a criatura chega no
  registro direto.

### Actions (`core/actions/pokemon.js`)

- `criarPokemon(world, trainer, speciesId)` — sorteia IV, nível inicial da
  espécie e o kit de golpes; nasce no inventário. Usado no começo do jogo e,
  depois, pela captura (043).
- `colocarNoTime(trainer, pokemon, slot)` — se o slot está ocupado, quem
  estava lá troca de lugar com ele (vai para o slot de origem, ou para o
  inventário se o novo veio de lá).
- `tirarDoTime(trainer, pokemon)` — volta para o inventário.
- Helpers de leitura: `findPartyPokemon(world, trainer, slot)` e
  `listInventoryPokemon(world, trainer)`.
- `equiparCriatura` sai.

### Recolher automático

- Hoje recolhe quando o slot fica vazio. Passa a recolher quando o **registro
  no slot não é mais o da criatura em campo** (slot vazio ou outro Pokémon
  no lugar).

### Vida e desmaio fora de campo

- `vitalsRegenSystem` e `faintSystem` passam a percorrer os registros de
  Pokémon que não estão invocados (em vez dos slots do treinador). Assim o
  time e o inventário seguem a mesma regra.

### Itens

- `Inventory` vira `{ counts: { [itemId]: quantidade } }`.
- Actions `adicionarItem(trainer, itemId, quantidade)` e
  `gastarItem(trainer, itemId)`. `playerActionSystem` passa a usar
  `gastarItem`; a mão continua desequipando quando o item zera.

### Tela

- `InventoryPanel`: a grade deixa de ser 5x5 fixa e cresce com rolagem.
  Primeiro os itens, depois os Pokémon do inventário (um por célula, com
  espécie e nível).
- Arrastar: célula de Pokémon → slot do time (`colocarNoTime`), slot → fundo
  da grade (`tirarDoTime`), slot → slot (`colocarNoTime`, que troca).
- HUD do time, aba Time da Pokédex, menu de ações, diálogo de esquecer golpe,
  tela de status e `DebugPanel` leem do registro do slot em vez dos `Party*`.

### Começo do jogo (`core/world/world.js`)

- Kit: só `pokedex`, que continua na mão.
- Um `criarPokemon` por espécie `kind: 'pokemon'`; as três iniciais de hoje
  (Bulbasaur, Charmander, Squirtle) vão para os slots 1 a 3, o resto fica no
  inventário.

### Ajustes durante a implementação

- **Pedido "esquecer qual golpe?"** (`MoveLearnRequest`) virou relação
  exclusiva do treinador pro registro, com o `moveId` guardado nela. Assim a
  tela e o bloqueio de input continuam olhando só o treinador.
- **`Party` virou tag** (marca o treinador). Tag não entra no array do
  `readEach`/`updateEach` do Koota, então três queries que tinham `Party` na
  frente foram ajustadas (`partySummonSystem`, `trainerBattleSystem`,
  `attackTargets`).
- **Slots do time** são relações do treinador pro registro (`PartySlots`), e
  não um campo no registro: a interface acompanha cada slot com `useTarget`
  (`view/hooks/usePartyPokemon.js`).
- **Debug**: saiu o seletor de espécie por slot (o time se monta pelo
  Inventário); ficaram os botões de XP, treino e domínio, agora por registro.

### Testes

- Actions do registro: criar, pôr no time, trocar slots, tirar do time,
  trocar com quem veio do inventário; o time pode ficar vazio.
- Pokémon em campo é recolhido quando sai do slot ou é trocado.
- Sair do time não cura (vida e desmaio preservados).
- No inventário, a vida regenera e o desmaio conta tempo, igual ao time.
- XP, domínio, treino e desmaio caem no registro certo, inclusive com dois
  treinadores (mundo de teste da 040).
- Itens: adicionar, gastar, zerar desequipa a mão.

---

## Correções (testando no jogo)

- **Inventário só com o treinador no controle** — a tecla `I` e o botão do
  menu não abrem pilotando uma criatura; se o controle sair do treinador com
  o inventário aberto, ele fecha (`page.js`, `PauseMenu.jsx`).
- **Arrastar e soltar bagunçava slots e grade** (Pokémon sumindo de outro
  slot, ficando no slot e na grade ao mesmo tempo, Pokédex idem). Eram três
  falhas na tela, não no core:
  - as células da grade usavam como chave o número do registro (Pokémon) ou
    a posição (item/vazia) — os dois são inteiros pequenos e colidiam, e o
    React reaproveitava a célula errada. Agora a chave tem prefixo
    (`item:`, `pokemon:`, `empty:`);
  - o slot de equipamento tirava o `onDragEnd` quando ficava vazio no meio do
    arraste (soltou na grade), então o estado "arrastando" nunca limpava e o
    próximo Pokémon/item posto ali aparecia vazio. O slot agora guarda QUAL
    valor está sendo arrastado e só se esconde enquanto ainda mostra esse
    valor;
  - se o fim do arraste chegasse antes do `setTimeout` que esconde a origem,
    ela ficava escondida pra sempre — agora o `setTimeout` confere se o
    arraste ainda está ativo.

---

## Parte 2 — Inventário reformulado

Pedido do usuário depois de testar. Decisões:

- **Sem o modelo do treinador** — nesta beta nenhum item muda o treinador.
  `PlayerPreview.jsx` saiu.
- **Grade de posição livre** — cada coisa fica na célula onde foi solta (pode
  ter buracos); soltar sobre uma ocupada troca as duas. Coisa nova entra na
  primeira célula livre. Botão **Organizar**: itens primeiro (por categoria,
  na ordem de `ITEM_CATEGORY_ORDER`, e nome), depois os Pokémon (número da
  Pokédex e, na mesma espécie, maior nível primeiro), sem buracos.
- **Arrastando, a origem vira célula vazia** (não some).
- **Nome só no tooltip**, inclusive nos slots do time e da mão.
- **Clicar mostra os detalhes** (da grade, do time ou da mão), num painel à
  direita, embaixo do time e da mão. Item: ícone, nome, categoria,
  quantidade, descrição e efeito. Pokémon: retrato, nome, nível, tipos,
  vida/energia (a da criatura em campo, se invocado), desmaio e golpes.
- **Itens ganharam `name` e `description`** (textos provisórios).

Como ficou:

- **Posições**: `Inventory.positions` (célula de cada item) e `InventoryCell`
  no registro do Pokémon que está no inventário. Item cuja única unidade
  está na mão não ocupa célula.
- **Actions** (`core/actions/inventory.js`): `resolveInventoryCells`,
  `moverNoInventario`, `organizarInventario`, `equiparNaMao`,
  `desequiparMao` (com célula de destino opcional). `adicionarItem` passou a
  receber o `world` (precisa achar célula livre). `tirarDoTime` também
  (`tirarDoTime(world, trainer, pokemon, index)`); soltar um Pokémon do time
  sobre outro da grade troca os dois. `colocarNoTime` devolve quem sai do
  slot pra célula que o outro deixou.
- **Tela**: o que está sendo arrastado fica num estado só, no painel (não em
  cada célula), e todo `drop` limpa — a origem pode sumir no `drop` sem o
  `dragend` chegar. A grade redesenha quando a célula de um Pokémon muda
  (`view/hooks/useTraitVersion.js`).
- **Debug**: o seletor de item da mão passa por `equiparNaMao`/
  `desequiparMao`; item que o jogador não tem ainda vai pra mão direto.

---

## Fora de escopo

- Caixa/PC — fora da beta 0.1.
- Abas por categoria, soltar Pokémon, descartar itens, item segurado.
- Itens de verdade e o novo kit — 042.
- Salvar — 044.

---

## Etapas

- [x] Bump da versão para `0.0.41` e doc da feature.
- [x] Revisão do doc pelo usuário.
- [x] Registro do Pokémon (traits, `SummonedFrom`) e actions.
- [x] Invocar/recolher, XP, desmaio, vida, domínio e treino pelo registro;
      saem os `Party*`.
- [x] Recolher automático quando o registro do slot muda.
- [x] `Inventory` com quantidade e actions de item.
- [x] Começo do jogo: só Pokédex e um Pokémon de cada espécie.
- [x] `InventoryPanel`: grade sem limite, Pokémon individuais, arrastar para
      montar e reordenar o time.
- [x] HUD, Pokédex, menus e debug lendo do registro.
- [x] Testes.
- [x] Roadmap e wiki.

---

## Critérios de Conclusão

- [x] Nenhum trait `Party*` por slot com dados de Pokémon.
- [x] Dá para tirar todos do time, pôr de volta, reordenar e trocar com
      quem está no inventário; quem está em campo é recolhido.
- [x] Um Pokémon que sai e volta ao time continua o mesmo (nível, IV,
      golpes, vida).
- [x] O jogo começa só com a Pokédex e um Pokémon de cada espécie.
- [x] `npm run build`, `npm run lint` e `npm test` passando (suíte inteira:
      146 arquivos, 1559 testes, com `--maxWorkers=2`; build feito numa cópia,
      por causa do `next dev` rodando).
- [x] Wiki atualizada: página nova "Inventário" (em Começando) e "Seu
      time" (time montado pelo inventário, vida e desmaio correndo fora do
      time, recolher ao sair do lugar). "Itens" do catálogo segue em breve
      (042).
