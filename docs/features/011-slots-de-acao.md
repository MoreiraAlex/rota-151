# 🚀 Versão 0.0.11 — Slots de Ação

O objetivo desta versão é predefinir os 4 botões de ação que qualquer
entidade jogável vai ter — hoje só o avatar do Treinador, no futuro também um
Pokémon do time, quando a troca entre eles existir — sem implementar nenhuma
ação de verdade ainda. Cada feature futura ("Arremessar objeto", "Invocar
criatura", golpes de Pokémon...) vai *atuar* num desses botões já prontos, em
vez de cada uma inventar sua própria tecla.

> Versionamento e nome do arquivo: ver `docs/development-workflow.md`.

---

## Contexto

- `docs/backlog.md` lista várias ações do jogador (arremessar/usar objeto,
  invocar/recolher criatura) que, mais cedo ou mais tarde, precisam de um
  botão. Decidir tecla por tecla conforme cada uma é implementada arrisca
  inconsistência (uma feature usa `KeyF`, outra usa clique, outra usa
  `KeyE`...) e retrabalho de input toda vez.
- Pensando além do backlog atual: o jogador de hoje (avatar do Treinador) não
  vai ser a única entidade jogável — ao ter um Pokémon no time, a ideia é
  poder alternar o controle pra ele (**não** implementado aqui, é só o
  motivo de desenhar o mapeamento de um jeito que sirva pros dois casos). Pra
  essa troca não obrigar reinventar o input depois, esta versão fixa um
  conjunto comum de 4 botões, com nomes genéricos, cujo significado varia
  pelo **tipo** de entidade controlada.
- Junto desta versão, `bot` (modelo livre do próprio usuário, com animações
  próprias em andamento) passa a ser tratado como a entidade principal — o
  avatar de verdade do treinador — e `fox` (Khronos Sample Assets) vira o
  placeholder pra Pokémon/criatura selvagem em vez de placeholder do
  jogador. `PLAYER_SPECIES_ID` já apontava pra `'bot'`; esta versão só
  formaliza o papel de cada um via `kind`.
- Hoje só existe um tipo de entidade jogável de verdade (`bot`, treinador).
  Ele cai no default `kind: 'trainer'` (não editado — é conteúdo do
  usuário); `fox` ganha `kind: 'pokemon'` explícito. Quando um Pokémon
  jogável existir de verdade (backlog "Criaturas"), os mesmos 4 botões
  passam a significar golpes em vez de itens/time, sem mudar tecla nem
  mecanismo de input.
- **Nenhuma ação usa esses botões ainda** — nem arremesso, nem item, nem
  invocar criatura. Isso é conteúdo de features futuras; aqui só existe o
  botão e, pro treinador, uma anotação de pra que ele *vai* servir.

## Decisões

- **4 botões genéricos, fixos no input**: `primary` (1) e `secondary1`/
  `secondary2`/`secondary3` (3) — nomes neutros, sem significado embutido.
  Pulso único ("apertou agora"), mesmo padrão de `dash`/`jump`/`zoom` — ação
  é disparo único, não estado contínuo.
  - `primary` = **clique esquerdo do mouse** (`pointerInput.js`), não
    teclado — só conta depois que o ponteiro já está travado (Pointer
    Lock), pra o clique que *pede* o lock não também disparar a ação. Botão
    principal de ação combina naturalmente com o botão que já é "o clique
    do jogo".
  - `secondary1/2/3` = `Digit1`/`Digit2`/`Digit3` (`keyboardInput.js`,
    `EDGE_KEY_MAP`).
- **`kind` na espécie** (`'trainer'` | `'pokemon'`) — novo campo em
  `core/data/species/<id>/index.js`. Só descreve *que tipo* de entidade
  jogável aquela espécie é; não muda nada sozinho. `fox` ganha `kind:
  'pokemon'` (mina, é placeholder de criatura agora). **Não** editado em
  `bot/index.js` (conteúdo do usuário) — espécie sem `kind` cai no default
  `'trainer'` (correto pro `bot`, que é o treinador), resolvido por
  `resolveSpeciesKind()` (`core/data/species/index.js`), não hardcoded em
  cada lugar que precisar saber o tipo.
- **`core/data/actionSlots.js` (novo, só dado, sem system nenhum)** —
  `resolveActionSlots(kind)`:
  - `'trainer'` → `{ primary: 'useHeldItem', secondary1: 'partySlot1',
    secondary2: 'partySlot2', secondary3: 'partySlot3' }`. São só
    **rótulos** (strings) do que cada botão *vai* significar — nenhum
    system lê isso ainda. "Arremessar/usar objeto" (backlog) atua em
    `primary` quando for a vez; "Invocar/recolher criatura" atua nos
    `secondaryN` quando o time existir.
  - qualquer outro `kind` (incluindo `'pokemon'`) → `null`. O comentário no
    arquivo documenta a intenção (`primary` = ataque básico, `secondaryN`
    = os 3 golpes) pra quando `kind: 'pokemon'` existir de verdade — sem
    espécie desse tipo hoje, não há o que resolver.
  - Isso é o único lugar que vai crescer quando `'pokemon'` ganhar
    conteúdo de verdade; nenhum outro arquivo precisa saber que o
    mapeamento existe até uma feature futura decidir consumi-lo.
- **Sem `playerActionSystem`, sem trait novo de ação, sem item, sem
  projétil** — esta versão não estende o mecanismo de ações da v0.0.7 nem
  cria conceito de item em mãos. É só o botão existir e, opcionalmente,
  chegar como pulso em `context.input`, pronto pra uma feature futura ler.
- **`actionSlotsDebugSystem` (temporário)** — loga um aviso no console a
  cada pulso de `primary`/`secondary1-3`, só pra confirmar visualmente que o
  input está mapeado antes de qualquer ação de verdade existir (mesmo
  espírito do botão de dano de debug da v0.0.10, mas via console em vez de
  UI — não há "efeito" nenhum pra mostrar ainda). Registrado na fase
  `input`, logo depois do `inputSystem`. Não é a ação de verdade nem conta
  como uma — some (ou vira o log da própria ação) quando "Arremessar/usar
  objeto"/"Invocar/recolher criatura" passarem a consumir esses botões.

## Objetivos

- 4 botões de ação (`primary`, `secondary1-3`) capturados como pulso de
  input, testados (não repete segurando, mesmo padrão de `dash`/`jump`).
  `primary` no clique esquerdo (só travado); `secondary1-3` em `1`/`2`/`3`.
- `kind` na espécie, com fallback seguro (`'trainer'`) pra espécie sem esse
  campo ainda; `bot` (treinador, default) e `fox` (`'pokemon'`, explícito)
  refletem os papéis reais de cada um.
- `resolveActionSlots(kind)` documentando o que cada botão vai significar
  pro treinador, testado; `'pokemon'` documentado em comentário, sem
  resolução de verdade.
- Nenhuma regressão em input/ações existentes (dash, corrida, pulo, câmera,
  zoom, pointer lock).

---

## Etapas

### 1. Input

- [X] `pointerInput.js` — clique esquerdo (`mousedown`, `button === 0`) só
      quando `locked === true` vira pulso `primary`, drenado no `snapshot()`
- [X] `pointerInput.test.js` — clique que pede o lock não dispara `primary`;
      clique esquerdo travado dispara uma vez; clique direito não dispara
- [X] `keyboardInput.js` — `Digit1/2/3` → `secondary1/2/3`, em
      `EDGE_KEY_MAP`
- [X] `keyboardInput.test.js` — cada botão gera pulso só na primeira
      leitura; segurar (auto-repeat) não repete; solta e aperta de novo
      gera novo pulso; perder o foco descarta pulso pendente

### 2. `kind` e slots de ação

- [X] `core/data/species/<id>/index.js` — novo campo `kind: 'trainer' |
      'pokemon'`; adiciona em `fox/index.js` (`'pokemon'` — placeholder de
      criatura agora, não do jogador); documenta no `_template/index.js`
      (comentário: default `'trainer'` se ausente); **não** editado em
      `bot/index.js` (cai no default, correto pro treinador)
- [X] `core/data/species/index.js` — `resolveSpeciesKind(species)`
      (`species.kind ?? 'trainer'`) + teste; comentário do arquivo
      atualizado pro papel real de `fox`/`bot`
- [X] `core/data/actionSlots.js` — `resolveActionSlots(kind)` (`'trainer'`
      fixo; qualquer outro `null`) + teste

### 3. Log de debug (temporário)

- [X] `systems/actionSlotsDebugSystem.js` — `console.warn` a cada pulso de
      `primary`/`secondary1-3`, sem tocar no `world` + testes
- [X] `view/loop/registerSystems.js` — registrado na fase `input`, logo
      depois do `inputSystem`, com comentário marcando que é temporário

### 4. Gate e documentação

- [X] `package.json`: bump de versão `0.0.10` → `0.0.11`
- [X] `docs/backlog.md`: anota que "Arremessar objeto"/"Usar objeto" atuam
      em `primary` e "Invocar/recolher criatura" nos `secondaryN`, quando
      forem a vez — sem marcar nenhum como entregue (só o botão existe)
- [X] `npm run lint` e `npm test` verdes

---

## Critérios de Conclusão

- Clicar com o botão esquerdo (com o ponteiro já travado) gera um pulso
  `primary: true` em `context.input`, uma vez só por clique; `1`/`2`/`3`
  idem pra `secondary1/2/3`. O clique que trava o ponteiro não dispara
  `primary`.
- `getSpecies('fox').kind === 'pokemon'`; espécie sem `kind` (ex.: `bot`)
  resolve `'trainer'` via `resolveSpeciesKind`, sem quebrar.
- `resolveActionSlots('trainer')` retorna os 4 rótulos; qualquer outro
  valor retorna `null`.
- No `npm run dev`, clicar (travado) ou apertar `1`/`2`/`3` imprime um
  aviso no console do navegador — confirmação visual de que o botão está
  mapeado, sem precisar ler o teste.
- `npm run lint` e `npm test` continuam verdes; nenhum teste existente
  quebra.

---

## Fora de escopo

- **Qualquer ação de verdade nos 4 botões** — arremessar/usar objeto,
  invocar/recolher criatura, golpes de Pokémon. Todas ficam pro backlog,
  cada uma "atuando" no botão já predefinido aqui quando for a vez.
- **Troca de controle pro Pokémon** — `kind: 'pokemon'` fica só
  documentado; nenhuma espécie desse tipo existe, nenhuma troca é
  implementada.
- **Item em mãos, inventário, projétil** — nenhum desses conceitos é criado
  nesta versão; entram junto da feature que primeiro precisar deles
  (provavelmente "Arremessar/usar objeto").
- **Passiva** — só os 4 botões de ação (1 primário + 3 secundários) são
  mapeados; uma "passiva" não é um botão (é efeito sempre ativo), fica pra
  quando houver conteúdo de passiva de verdade pra desenhar.
