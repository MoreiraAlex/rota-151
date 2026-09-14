# 🚀 Versão 0.0.12 — Mecanismo de Item

O objetivo desta versão é criar o conceito de item e a possibilidade do
jogador segurar um — sem ligar isso ao botão `primary` ainda. É só o
mecanismo (dado + trait), na mesma lógica de `core/data/species/`: eu
construo o registro, o conteúdo de item de verdade (pokébola, poção...) é
livre pra adicionar quando quiser.

> Versionamento e nome do arquivo: ver `docs/development-workflow.md`.

---

## Contexto

- A v0.0.11 (`docs/features/011-slots-de-acao.md`) reservou `primary` como
  `'useHeldItem'` pro treinador, mas não existe ainda o conceito de item nem
  de segurar um — não dá pra implementar o botão de verdade sem isso primeiro.
- Decisão de design confirmada: o treinador **nunca ataca diretamente**
  Pokémon nem outro treinador. As únicas ações do `primary` são item —
  arremessar pokébola, usar poção, etc. — então quem decide o que acontece
  é a **categoria do item equipado**, não um golpe fixo. Não existe (nem vai
  existir) categoria de arma/ataque direto.
- Coleta e farm (pegar item no mundo, loja, craft) é maior e varia muito
  dependendo do que for equipável — fica pra outra feature. Aqui o item só
  existe "na mão", equipado via debug, sem forma de conseguir um de verdade
  ainda.
- Ligar o mecanismo ao `primary` (disparar a ação certa pela categoria do
  item — arremesso, consumo) também fica pra próxima feature. Esta entrega
  só o dado e o trait; nenhum comportamento novo ao apertar botão nenhum.

## Decisões

- **`core/data/items/<id>/index.js`** — mesma forma de pasta-por-entrada de
  `core/data/species/`: este arquivo (mecanismo, `getItem`/`listItems`) e o
  `_template/` são meus; item de jogo de verdade (nome, categoria, valores)
  é conteúdo livre pra adicionar depois, mesmo split de `fox`/Pokémon.
- **Campo mínimo por item**: `{ id, category }`. **Sem** config de
  comportamento ainda (velocidade de arremesso, quantidade de cura, etc.) —
  isso entra junto da feature que implementa esse comportamento, não antes
  (mesmo raciocínio de `stats`/`moves` ficarem vazios na espécie até o
  sistema de batalha existir; adicionar número que nada lê ainda é
  especulação, não mecanismo).
- **Duas categorias nesta versão**: `'throwable'` (ex.: pokébola, pedra) e
  `'consumable'` (ex.: poção). **Sem `'weapon'`** — não existe no design (ver
  Contexto), não faz sentido reservar uma categoria pra uma coisa que a
  ideia do jogo exclui.
- **`HeldItem` (trait novo)** — `{ itemId: null }` no jogador. Começa vazio;
  nada equipa de verdade ainda (sem coleta), só o debug (abaixo).
- **Dois itens de teste, conteúdo genérico e livre** —
  `core/data/items/pebble/` (`throwable`) e `core/data/items/potion/`
  (`consumable`), nomes genéricos de RPG, sem referência a Pokémon — servem
  só pra validar o mecanismo (registro, `HeldItem`, seletor de debug), não
  são item de jogo de verdade.
- **`DebugPanel` ganha um seletor de item, só pra ver o mecanismo
  funcionando** — trocar entre nenhum/`pebble`/`potion` escreve em
  `HeldItem.itemId`; o painel mostra o id e a categoria do item atual. Sem
  botão de "usar" — isso é a próxima feature, quando `primary` passar a ler
  isso de verdade.

## Objetivos

- `core/data/items/` — registro (`getItem`/`listItems`), template e 2 itens
  de teste, testado (mesmo padrão de `core/data/species/index.test.js`).
- `HeldItem` no jogador (`itemId: null` no spawn), testado.
- `DebugPanel` permite trocar e ver o item equipado.
- Nenhuma mudança em `playerActionSystem` nem no que `primary`/`secondaryN`
  fazem — continuam só no log de debug da v0.0.11.

---

## Etapas

### 1. Dado de item

- [X] `core/data/items/_template/index.js` — molde documentado (`id`,
      `category: 'throwable' | 'consumable'`)
- [X] `core/data/items/pebble/index.js` (`throwable`) e
      `core/data/items/potion/index.js` (`consumable`) — conteúdo de teste
- [X] `core/data/items/index.js` — `ITEM_REGISTRY`, `getItem(id)`,
      `listItems()` (mesmo padrão de `core/data/species/index.js`) + teste

### 2. Held item

- [X] `traits/components/heldItem.js` — `HeldItem { itemId: null }` +
      export no barrel (`traits/index.js`)
- [X] `world.js`/`test/makeWorld.js` — `playerEntity` ganha `HeldItem`
- [X] `world.test.js` — `playerEntity` compõe `HeldItem` (`itemId: null`)

### 3. Debug

- [X] `tools/debug/DebugPanel.jsx` — seletor (nenhum/`pebble`/`potion`)
      escrevendo em `HeldItem`; exibe id + categoria do item atual

### 4. Gate e documentação

- [X] `package.json`: bump de versão `0.0.11` → `0.0.12`
- [X] `docs/backlog.md`: anota que "Arremessar/usar objeto" dependem agora
      só do wiring com `primary` (mecanismo de item já pronto) — sem marcar
      como entregues
- [X] `npm run lint` e `npm test` verdes

---

## Critérios de Conclusão

- `getItem('pebble').category === 'throwable'`; `getItem('potion').category
  === 'consumable'`; id desconhecido retorna `null`.
- `playerEntity` tem `HeldItem` com `itemId: null` no spawn.
- No `DebugPanel`, trocar o seletor muda o item equipado e o texto exibido
  (id + categoria) reflete isso.
- Apertar `primary`/`secondary1-3` continua só gerando o log de debug da
  v0.0.11 — nenhuma ação nova, nenhuma regressão.
- `npm run lint` e `npm test` continuam verdes; nenhum teste existente
  quebra.

---

## Fora de escopo

- **Ligar `primary` ao item de verdade** (arremessar/usar, projétil, efeito
  de cura) — próxima feature, consumindo o `HeldItem`/`getItem` que esta
  entrega aqui.
- **Categoria `weapon`/ataque direto** — fora do design do jogo (o
  treinador não ataca Pokémon nem outro treinador), não só desta versão.
- **Coleta, farm, inventário com múltiplos slots/quantidade, loja, craft** —
  equipar é só o seletor de debug; conseguir um item de verdade é feature
  própria depois.
- **Config de comportamento por item** (velocidade de arremesso, cura,
  alcance) — entra junto da feature que implementa o comportamento que lê
  esse número, não antes.
- **Nome/conteúdo de item de jogo de verdade** (pokébola, poção de verdade
  com valores balanceados) — conteúdo livre, por conta de quem quiser
  adicionar, mesmo espírito de `species/<id>/`.
