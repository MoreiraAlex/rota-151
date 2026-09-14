# 🚀 Versão 0.0.13 — Criaturas de Time (placeholder)

O objetivo desta versão é ter criaturas "de Pokémon" codificadas — mesmo que
placeholder, reaproveitando o `fox` — pra que o treinador possa equipar uma
em cada slot secundário, do mesmo jeito que já equipa um item no `primary`
(v0.0.12). É só o mecanismo: nenhuma criatura aparece no mundo ainda, isso é
a próxima feature (invocar/recolher de verdade).

> Versionamento e nome do arquivo: ver `docs/development-workflow.md`.

---

## Contexto

- `resolveActionSlots('trainer')` (v0.0.11) já descreve `secondary1-3` como
  "soltar/recolher o Pokémon do slot 1/2/3 do time", mas não existe
  **nenhuma** espécie `kind: 'pokemon'` de verdade — só `fox`, sozinho, sem
  crachá de "isso é uma das 3 do meu time". Sem isso, não dá pra equipar
  nada nos `secondaryN`, do mesmo jeito que "Mecanismo de item" (v0.0.12)
  precisou existir antes de dar pra equipar algo no `primary`.
- Confirmado: assim como o `primary` varia pelo item equipado, cada
  `secondaryN` (quando o kind é treinador) vai variar pela **criatura**
  equipada naquele slot — 3 criaturas diferentes, uma por botão.
- `docs/backlog.md` já tem "Criaturas selvagens no mundo" (IA vagando,
  spawn no mundo) como item **adiado** ("até o jogador estar redondo"). Esta
  versão **não** é isso — não cria IA, não spawna nada, não é sobre
  criaturas selvagens. É só sobre o treinador ter 3 criaturas *codificadas*
  pra colocar no time, mesmo mecanismo de dado que qualquer espécie já tem.
- Reaproveitar `fox` (mina, modelo livre) evita esperar conteúdo de Pokémon
  de verdade só pra validar o mecanismo — mesma lógica de `pebble`/`potion`
  serem itens de mentira só pra testar o registro de item.

## Decisões

- **3 espécies placeholder, clones de `fox`** — `core/data/species/fox-red/`,
  `fox-green/`, `fox-blue/` (uma por `secondary1/2/3`). Cada uma é
  `{ ...FOX, id: 'fox-red' }` (só troca o `id`) — mesmo `model`/`clips`/
  `body`/`movement`/`kind: 'pokemon'` do `fox`, sem duplicar dado que ainda
  não diverge de verdade. Tint de cor por espécie (visual) fica fora de
  escopo — nada é renderizado no mundo ainda, então não há o que colorir
  (ver Fora de escopo).
- **`Party` (trait novo)** — `{ slot1: null, slot2: null, slot3: null }` no
  jogador, guardando o **id da espécie** equipada em cada slot (mesmo nível
  de indireção que `HeldItem.itemId`, não uma referência de entidade — não
  existe entidade de criatura nenhuma ainda). Começa toda vazia, mesmo
  espírito de `HeldItem`/`Vitals` começarem em default seguro.
- **Sem invocar/recolher de verdade** — nenhum system lê `Party` pra
  spawnar/despawnar nada. `secondary1-3` continuam só no log de debug da
  v0.0.11. Quando "Invocar/recolher criatura" (backlog) for implementada,
  ela consome `Party`/`getSpecies` do jeito que "Arremessar objeto" vai
  consumir `HeldItem`/`getItem`.
- **Comportamento da criatura invocada (decidido agora, construído depois)**:
  quando invocar existir de verdade, a criatura **segue o jogador** (não
  fica parada, não vaga sozinha) — registrado aqui pra a próxima feature já
  nascer com a decisão tomada, mas a lógica de seguir não é escrita nesta
  versão (não há nem entidade de criatura pra seguir nada ainda).
- **`DebugPanel` ganha 3 seletores** (slot1/2/3), cada um listando as
  espécies `kind: 'pokemon'` disponíveis (`fox`, `fox-red`, `fox-green`,
  `fox-blue`), escrevendo em `Party`. Mostra a composição atual do time.
  Mesmo padrão do seletor de item da v0.0.12, sem botão de "invocar" (isso é
  a próxima feature).

## Objetivos

- 3 espécies placeholder (`fox-red`/`fox-green`/`fox-blue`), `kind:
  'pokemon'`, no registro de espécies.
- `Party` (trait) no jogador, testado (`slot1/2/3: null` no spawn).
- `DebugPanel` permite equipar uma espécie de criatura em cada slot e ver a
  composição do time.
- Nenhuma mudança em `playerActionSystem`/`secondaryN` — continuam só no log
  de debug da v0.0.11.

---

## Etapas

### 1. Espécies placeholder

- [X] `core/data/species/fox-red/index.js`, `fox-green/index.js`,
      `fox-blue/index.js` — `{ ...FOX, id: '<nome>' }`
- [X] `core/data/species/index.js` — as 3 novas entradas no
      `SPECIES_REGISTRY`
- [X] `core/data/species/index.test.js` — as 3 resolvem `kind === 'pokemon'`
      via `resolveSpeciesKind`

### 2. Party

- [X] `traits/components/party.js` — `Party { slot1: null, slot2: null,
      slot3: null }` + export no barrel (`traits/index.js`)
- [X] `world.js`/`test/makeWorld.js` — `playerEntity` ganha `Party`
- [X] `world.test.js` — `playerEntity` compõe `Party` (todos os slots
      `null`)

### 3. Debug

- [X] `tools/debug/DebugPanel.jsx` — 3 seletores (slot1/2/3, cada um listando
      espécies `kind: 'pokemon'`) escrevendo em `Party`; exibe a composição
      atual do time

### 4. Gate e documentação

- [X] `package.json`: bump de versão `0.0.12` → `0.0.13`
- [X] `docs/backlog.md`: anota que "Invocar/recolher criatura" dependem
      agora só do wiring com `secondaryN` (criaturas de time já
      codificadas) — sem marcar como entregues; não mexe em "Criaturas
      selvagens no mundo" (item separado, continua adiado)
- [X] `npm run lint` e `npm test` verdes

---

## Critérios de Conclusão

- `getSpecies('fox-red').kind === 'pokemon'` (idem `fox-green`/`fox-blue`).
- `playerEntity` tem `Party` com os 3 slots `null` no spawn.
- No `DebugPanel`, cada seletor de slot mostra as espécies `pokemon`
  disponíveis e escrever nele reflete na composição do time exibida.
- Apertar `secondary1-3` continua só gerando o log de debug da v0.0.11 —
  nenhuma criatura aparece no mundo, nenhuma regressão.
- `npm run lint` e `npm test` continuam verdes; nenhum teste existente
  quebra.

---

## Fora de escopo

- **Invocar/recolher de verdade** (criatura aparecer/sumir no mundo) —
  próxima feature, consumindo `Party`/`getSpecies` que esta entrega aqui.
- **Comportamento de seguir o jogador** — decidido nesta versão (ver
  Decisões), construído só quando invocar existir de verdade.
- **Tint de cor / diferenciação visual** entre `fox`/`fox-red`/`fox-green`/
  `fox-blue` — nada é renderizado no mundo ainda nesta versão; quando
  invocar renderizar a criatura de verdade, aí sim faz sentido resolver
  como diferenciar visualmente 4 espécies que hoje compartilham o mesmo
  `model.path`.
- **Criaturas selvagens no mundo (IA, spawn automático)** — item separado
  do backlog, continua adiado; não é o que esta versão resolve.
- **Conteúdo de Pokémon de verdade** (substituir os placeholders por
  criaturas reais) — quando existir, é conteúdo livre pra adicionar, mesmo
  espírito de `fox`/`pebble`/`potion` serem só placeholders.
