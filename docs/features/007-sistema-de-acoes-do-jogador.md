# 🚀 Versão 0.0.7 — Sistema de Ações do Jogador (Dash)

O objetivo desta versão é construir o mecanismo genérico que vai sustentar as
próximas ações do jogador (dash, arremesso, uso de item, invocar/recolher
criatura) — disparadas por input, com duração própria, com prioridade sobre a
locomoção enquanto ativas — e validar esse mecanismo com a ação mais simples
do grupo: **dash/rolamento**.

> Versionamento e nome do arquivo: ver `docs/development-workflow.md`.

---

## Contexto

- Hoje o jogador só tem **locomoção contínua**: idle/walk/run, resolvidos a
  cada frame a partir de velocidade/grounded (`animationStates.js`), sem
  gatilho nem duração — e pulo, aplicado direto na física
  (`characterPhysicsSystem` lê `context.input.jump` puro, sem passar pelo
  trait `InputState` nem aparecer no `AnimationState`).
- `docs/backlog.md` lista uma sequência de ações inspiradas em Pokémon: dash,
  arremessar objeto, usar objeto, invocar criatura, recolher criatura, morrer.
  Todas compartilham a mesma forma — disparo único por input, duração própria,
  precedência sobre a locomoção enquanto ativas — mas cada uma tem
  dependências diferentes (arremesso precisa de projétil, invocar precisa de
  criaturas existirem, morrer precisa de um fluxo de respawn).
- Esta versão entrega o mecanismo compartilhado e usa o **dash** pra provar
  que ele funciona de ponta a ponta, porque é a única do grupo sem
  dependência de outra peça ainda não construída (sem projétil, sem
  inventário, sem criatura).
- Arremesso, uso de item, invocar/recolher e morrer continuam no backlog,
  agora com uma peça a menos faltando quando forem a vez.

## Decisões

- **`ActionState` (trait, novo)** — `{ current: null, elapsed: 0, dirX: 0,
  dirZ: 0 }`. `current` é o id da ação em andamento (`'dash'`, e no futuro
  `'throw'`, `'useItem'`...) ou `null` quando o jogador está livre. Uma
  entidade só pode estar em uma ação por vez. `dirX`/`dirZ` guardam a direção
  travada no instante do disparo — usada pelo dash, e reaproveitável por
  qualquer ação futura que também seja "mover na direção tal por um tempo";
  ações sem direção (arremesso, uso de item) simplesmente não tocam nesses
  campos.
- **Config por ação em `gameConfig.js`** — nova seção `PLAYER_ACTIONS.dash`
  (`duration`, `speed`), mesmo padrão do resto do config: números vivem aqui,
  não espalhados pelos systems.
- **Gatilho de input por borda ("apertou agora"), não por estado contínuo** —
  `keyboardInput.js` ganha o mesmo padrão de dreno que `pointerInput.js` já
  usa pros deltas de mouse: um conjunto de teclas "apertadas agora" é
  acumulado no `keydown` (ignorando auto-repeat do SO) e drenado no
  `snapshot()`, chamado uma vez por passo fixo. Sem isso, seguraria a tecla
  dispararia dash a cada frame. Proposta de tecla: `ControlLeft`/`ControlRight`
  → `dash` (livre no mapa atual; `Shift` já é `run`).
- **`playerActionSystem` (core, headless, novo)** — na fase simulation, depois
  do `movementSystem`:
  - Se `ActionState.current === null` e `input.dash` (a borda) veio true e as
    pré-condições da ação passam (dash exige `Grounded`), inicia a ação:
    `current = 'dash'`, `elapsed = 0`, trava `dirX/dirZ` a partir da
    `Rotation.y` atual da entidade (a direção que ela está de fato encarando
    naquele frame — já resolvida pelo `movementSystem`, que roda antes).
  - Se `current !== null`, soma `delta` a `elapsed`; ao atingir a duração
    configurada, volta pra `current = null`.
  - Enquanto `current === 'dash'`, sobrescreve `Velocity.x/z` com
    `dirX/dirZ * PLAYER_ACTIONS.dash.speed` — por cima do que o
    `movementSystem` já calculou pra aquele frame. Não mexe em `Velocity.y`
    (gravidade/pulo continuam por conta do `characterPhysicsSystem`, sem
    mudança nele).
- **`animationStates.js` ganha uma entrada de prioridade** — a tabela
  continua sendo a mesma lista ordenada de `{ id, when }` desde a v0.0.6;
  entra uma linha nova no topo (`dash` vence antes de checar
  velocidade/grounded). É exatamente o crescimento "sem trocar o formato" que
  a doc da v0.0.6 já previa.
- **`animationStateSystem` passa o estado de ação pro contexto de resolução**
  (`ctx.action`), lendo `ActionState.current` — sem saber o que cada ação
  significa, só repassando o id.
- **Direção travada no disparo, não recalculada durante o dash** — evita
  "dirigir" o dash com o analógico/WASD no meio do movimento; é um impulso
  na direção que você estava olhando quando apertou, como um rolamento de
  verdade.

## Objetivos

- `ActionState` + `playerActionSystem`, headless e testados.
- Dash funcional: dispara com uma tecla dedicada, move o jogador mais rápido
  que a corrida (`PLAYER_ACTIONS.dash.speed > PLAYER.RUN_SPEED`) por uma
  duração curta e configurável, só a partir do chão.
- Segurar a tecla de dash não dispara repetidamente — só solta e aperta de
  novo gera um novo disparo.
- `animationStates.js` resolve `'dash'` com prioridade sobre `run`/`walk`/
  `idle` enquanto a ação está ativa (o clipe em si — `species/fox/clips/
  dash.json` — fica por sua conta, mesmo esquema de sempre).
- Nenhuma regressão na locomoção existente (idle/walk/run/crossfade
  continuam iguais quando nenhuma ação está ativa).

---

## Etapas

### 1. Config e trait

- [X] `gameConfig.js` — nova seção `PLAYER_ACTIONS: { dash: { duration,
      speed } }`
- [X] `traits/components/action.js` — `ActionState { current: null,
      elapsed: 0, dirX: 0, dirZ: 0 }` + export no barrel (`traits/index.js`)

### 2. Input por borda

- [X] `keyboardInput.js` — `ControlLeft`/`ControlRight` → `dash`; conjunto de
      "apertadas agora" (ignora `event.repeat`), drenado em `snapshot()`
      (mesmo padrão do `pointerInput.js`)
- [X] `keyboardInput.test.js` — apertar gera `dash: true` só na primeira
      leitura; segurar não repete; solta e aperta de novo gera novo `true`

### 3. System de ações

- [X] `systems/playerActionSystem.js` — inicia/avança/encerra `ActionState`;
      trava direção a partir de `Rotation.y`; sobrescreve `Velocity.x/z`
      durante o dash
- [X] `playerActionSystem.test.js` — dispara dash de `current: null`; ignora
      novo gatilho enquanto já em ação; encerra sozinho após a duração; não
      dispara sem `Grounded`; direção trava no valor do disparo mesmo que a
      entidade gire depois

### 4. Integração com animação

- [X] `data/animationStates.js` — entrada `dash` no topo da prioridade
- [X] `systems/animationStateSystem.js` — inclui `ActionState` na query,
      repassa `ctx.action`
- [X] `animationStateSystem.test.js` — `action: 'dash'` resolve `'dash'`
      independente de velocidade/grounded

### 5. Ligação no mundo e no loop

- [X] `world.js` / `test/makeWorld.js` — `playerEntity` ganha `ActionState`
- [X] `view/loop/registerSystems.js` — `playerActionSystem` na fase
      simulation, depois do `movementSystem` e antes do
      `characterPhysicsSystem`
- [X] `world.test.js` — `playerEntity` compõe `ActionState`

### 6. Gate e documentação

- [X] `package.json`: bump de versão `0.0.6` → `0.0.7`
- [X] `docs/backlog.md`: marca "Sistema de ações do jogador" e "Dash/
      rolamento" como entregues; deixa arremesso/uso/invocar/recolher/morrer
      como estavam (ainda bloqueados)
- [X] `npm test` (105/105) e `npm run lint` verdes pra tudo que esta versão
      tocou — `npm run build` continua bloqueado por um erro de formatação
      pré-existente em `src/tools/proceduralAnimation/roster.js` (arquivo de
      conteúdo do usuário, fora do escopo desta versão, não tocado aqui)

---

## Critérios de Conclusão

- Apertar a tecla de dash com o jogador livre (`ActionState.current ===
  null`) dispara o dash; segurando a tecla, não repete.
- Durante o dash, a velocidade horizontal é maior que `RUN_SPEED`, na direção
  travada no instante do disparo, pela duração configurada.
- Dash só dispara a partir do chão (`Grounded`).
- Ao terminar, o jogador volta ao controle normal (walk/run/idle conforme o
  input daquele momento), sem estado "preso".
- `AnimationState` resolve `'dash'` com prioridade sobre locomoção enquanto a
  ação está ativa.
- `npm run lint` e `npm test` continuam verdes; nenhum teste existente
  quebra. (`npm run build` segue bloqueado por um lint pré-existente em
  arquivo de conteúdo do usuário, alheio a esta versão.)

---

## Fora de escopo

- Arremesso, uso de item, invocar/recolher criatura, morrer — o mecanismo é
  pensado pra encaixá-los (mesma trait, mesmo system, mesma prioridade na
  tabela de animação), mas não são implementados aqui.
- Cooldown entre dashes — hoje, dá pra disparar de novo assim que o anterior
  termina; um intervalo mínimo entre disparos fica pra quando (se) fizer
  falta.
- Efeitos de dash (i-frames/invencibilidade, rastro visual, partícula, som).
- Dash aéreo — a pré-condição de `Grounded` fica fixa nesta versão; permitir
  no ar é uma decisão de design pra revisar depois, não uma limitação técnica.
- Migrar `jump` pro mesmo mecanismo de `ActionState` — ele continua como
  está (lido direto de `context.input`, fora do trait); fica pra quando a
  animação de pulo/queda (já no backlog) for feita.
- Clipe de animação do dash em si — conteúdo de espécie, por conta do autor
  (`core/data/species/fox/clips/dash.json`), fora do meu escopo.
