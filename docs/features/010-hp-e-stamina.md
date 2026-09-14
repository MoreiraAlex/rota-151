# 🚀 Versão 0.0.10 — HP e Stamina (com regeneração)

O objetivo desta versão é dar ao jogador vida (HP) e fôlego (stamina), os
dois regenerando com o tempo a uma taxa configurada por espécie, com
corrida/dash/pulo gastando stamina. Inclui um jeito de tirar HP só pra
validar visualmente que a regeneração funciona — não um sistema de dano de
verdade (isso é conteúdo de combate, fora de escopo aqui).

> Versionamento e nome do arquivo: ver `docs/development-workflow.md`.

---

## Contexto

- Nenhuma entidade tem HP/stamina hoje — não existe nem o conceito.
- Pedido: HP e stamina regeneram **% do máximo por segundo**, taxa vinda da
  espécie (mesmo padrão de `body`/`movement` já estabelecido — número por
  espécie, copiado pra um trait no spawn). Corrida, dash e pulo gastam
  stamina. Precisa de um jeito de perder HP só pra validar que a
  regeneração funciona — sem sistema de dano real ainda (fica pro backlog,
  como "Morrer" já está).

## Decisões

- **`Vitals` (trait novo)** — `{ hp, maxHp, hpRegenPercent, hpRegenDelay,
  stamina, maxStamina, staminaRegenPercent }`. Current e máximo ficam no
  mesmo trait (diferente de `MovementStats`, que é só config): toda
  operação que mexe num mexe no outro (regenerar, drenar, mostrar no
  HUD/debug sempre lê os dois juntos) — separar em dois traits só
  adicionaria indireção sem benefício aqui.
- **HP para de regenerar por um tempo depois de tomar dano** — `hpRegenDelay`
  guarda quantos segundos ainda faltam até a regeneração de HP voltar a
  valer; toda vez que HP diminui, reseta pra
  `VITALS.HP_REGEN_DELAY_AFTER_DAMAGE`. `vitalsRegenSystem` conta esse
  tempo pra baixo a cada tick e só aplica a fórmula de regen de HP quando
  chega a zero. Pra qualquer coisa que tire HP (o botão de debug agora, uma
  fonte de dano de verdade depois) resetar o delay junto é o contrato —
  centralizado numa função `applyDamage(vitals, amount)` pra não depender
  de cada chamador lembrar de fazer os dois passos certo.
- **Stamina tem o mesmo tipo de delay, a partir do último uso** —
  `staminaRegenDelay` (mesmo mecanismo de `hpRegenDelay`, mas contado a
  partir de correr/dash/pulo em vez de dano): `movementSystem`,
  `playerActionSystem` e `characterPhysicsSystem` resetam pra
  `VITALS.STAMINA_REGEN_DELAY_AFTER_USE` toda vez que drenam stamina
  (correr reseta a cada tick enquanto ativo, então segurar o modificador de
  corrida nunca deixa a regeneração entrar no meio). Sem essa pausa, correr
  perto do limite virava um loop onde a regeneração devolvia um pouquinho
  de stamina bem a tempo do próximo tick liberar a corrida de novo — o
  jogador nunca "cansava" de verdade, só oscilava perto de zero pra sempre.
- **`vitals` na espécie** (`core/data/species/<id>/index.js`) — `{ maxHp,
  hpRegenPercent, maxStamina, staminaRegenPercent }`, mesmo padrão de
  `body`/`movement`. Ao spawnar, vira o trait `Vitals` (`hp`/`stamina`
  começam cheios, no máximo).
  - **Fallback se a espécie não tiver `vitals` ainda**: spawna `Vitals` sem
    argumento, usando os defaults do próprio trait (`100/100`, regen
    `2%`/`10%`) — evita quebrar o jogo pra quem ainda não adicionou o bloco
    (ex.: `bot/index.js`, que é conteúdo seu — não vou editar sem pedido,
    mas o jogo não pode quebrar por causa disso).
- **`vitalsRegenSystem` (core, novo)** — só regeneração: a cada tick fixo,
  `hp = min(maxHp, hp + maxHp*(hpRegenPercent/100)*delta)`, mesma fórmula
  pra stamina. Um system pequeno, uma responsabilidade.
- **Drenar stamina fica em quem já decide a ação, não num 4º system
  central**: `movementSystem` (corrida), `playerActionSystem` (dash) e
  `characterPhysicsSystem` (pulo) já são donos de decidir se essas ações
  acontecem — cada um ganha a checagem/desconto de stamina no lugar onde
  já lê `input.run`/`input.dash`/`input.jump`, em vez de um system à parte
  tentando detectar "uma dessas ações começou agora" à distância (mais
  complicado e mais frágil que a alternativa).
  - **Corrida**: dreno contínuo (`VITALS.RUN_STAMINA_DRAIN_PER_SECOND`, por
    segundo), só enquanto realmente correndo (`input.run` **e** intenção de
    movimento **e** `stamina > 0`) — segurar Shift parado não gasta nada.
    Sem stamina, `movementSystem` já não aplica `runSpeed` mesmo com
    `input.run` true — volta a andar sozinho, sem travar o jogador.
  - **Dash**: custo fixo (`PLAYER_ACTIONS.dash.STAMINA_COST`), descontado no
    disparo. Sem stamina suficiente, o dash simplesmente não dispara (mesma
    lógica de precondição que já existe pra `Grounded`).
  - **Pulo**: custo fixo (`VITALS.JUMP_STAMINA_COST`), descontado no disparo. Sem
    stamina suficiente, não pula (mesma forma que `wasGrounded` já
    bloqueia hoje).
- **Custos/dreno em `gameConfig.js`, não por espécie** — só a *regeneração*
  foi pedida como por-espécie; quanto corrida/dash/pulo custam é
  comportamento do motor, não da criatura (se algum dia uma espécie
  precisar de custo próprio, é a mesma migração já feita antes pra
  `body`/`movement`, feita quando aparecer o caso real).
- **Validação de HP: botão de debug, não um sistema de dano** — o pedido
  foi "algo pra eu validar", não uma fonte de dano de jogo de verdade
  (inimigo, queda, hazard — todos ainda por desenhar). `DebugPanel.jsx`
  ganha um botão que chama `applyDamage` (desconta HP **e** reseta o delay
  de regen) via `playerEntity.set(Vitals, ...)`, ao lado das barras de
  HP/stamina — mostra a regeneração pausando e depois voltando, ao vivo,
  sem inventar uma mecânica de dano que teria que ser redesenhada depois
  de qualquer forma.
- **Sem lógica de morte** — `hp` só fica travado em `0` (não passa disso).
  "Morrer" já está no backlog como próprio item (estado terminal, precisa
  de fluxo de respawn) — não é resolvido de lado aqui.

## Objetivos

- `Vitals` (trait) + `vitalsRegenSystem`, headless e testados.
- HP e stamina regeneram a uma taxa (% do máximo/segundo) definida por
  espécie, com fallback seguro pra espécie sem esse dado ainda.
- HP para de regenerar por um tempo configurável depois de tomar dano.
  Stamina tem o mesmo tipo de pausa, configurável, a partir do último uso
  (correr, dash ou pulo).
- Correr, dar dash e pular custam stamina; sem stamina suficiente, a ação
  correspondente não acontece (corrida cai pra andar; dash/pulo não
  disparam) — sem travar o jogador em nenhum estado quebrado.
- `DebugPanel` mostra HP/stamina ao vivo e tem um botão pra tirar HP na
  mão, validando a regeneração visualmente.

---

## Etapas

### 1. Trait e dado de espécie

- [X] `traits/components/vitals.js` — `Vitals { hp: 100, maxHp: 100,
      hpRegenPercent: 2, hpRegenDelay: 0, stamina: 100, maxStamina: 100,
      staminaRegenPercent: 10, staminaRegenDelay: 0 }` + export no barrel;
      `applyDamage(vitals, amount)` (desconta `hp`, clampa em 0, reseta
      `hpRegenDelay`) exportado do mesmo arquivo
- [X] `core/data/species/fox/index.js` — adiciona `vitals: { maxHp,
      hpRegenPercent, maxStamina, staminaRegenPercent }`
- [X] `core/data/species/_template/index.js` — documenta `vitals`

### 2. Config

- [X] `gameConfig.js` — nova seção `VITALS: { HP_REGEN_DELAY_AFTER_DAMAGE,
      STAMINA_REGEN_DELAY_AFTER_USE, RUN_STAMINA_DRAIN_PER_SECOND,
      JUMP_STAMINA_COST }`; `PLAYER_ACTIONS.dash` ganha `STAMINA_COST`

### 3. Regeneração

- [X] `systems/vitalsRegenSystem.js` — conta `hpRegenDelay` e
      `staminaRegenDelay` pra baixo, independentes; só regenera cada um
      quando o respectivo delay chega a zero; ambos clampados no máximo +
      testes (regen normal, cada delay pausando e expirando)
- [X] `view/loop/registerSystems.js` — registra na fase simulation, antes
      de `movementSystem` (drenos do mesmo tick descontam por cima)

### 4. Dreno nas ações

- [X] `systems/movementSystem.js` — corrida só aplica `runSpeed` com
      `stamina >= custo do tick` (não só `> 0` — ver nota abaixo) e
      intenção de movimento; drena por segundo enquanto correndo, resetando
      `staminaRegenDelay` a cada tick de dreno
- [X] `systems/playerActionSystem.js` — dash exige `stamina >=
      PLAYER_ACTIONS.dash.STAMINA_COST`; desconta e reseta
      `staminaRegenDelay` no disparo
- [X] `systems/characterPhysicsSystem.js` — pulo exige `stamina >=
      VITALS.JUMP_STAMINA_COST`; desconta e reseta `staminaRegenDelay` no
      disparo
- [X] Testes: corrida sem stamina cai pra `walkSpeed`; dash/pulo não
      disparam sem stamina suficiente; custo é descontado uma vez só por
      disparo (não por tick); cada dreno reseta `staminaRegenDelay`
- [X] **Correção**: o gate original de corrida usava `stamina > 0` — como
      `vitalsRegenSystem` roda antes de `movementSystem` no mesmo tick, uma
      regeneração mínima sempre deixava a stamina levemente positiva a
      tempo do próximo tick liberar a corrida de novo, nunca esgotando de
      verdade (oscilava perto de zero pra sempre). Trocado pra `stamina >=
      custo do próprio tick`, igual dash/pulo já exigem `>=` custo da ação.
      Motivou a pausa de regeneração (`staminaRegenDelay`) descrita acima,
      que resolve o problema de raiz em vez de só a comparação pontual.

### 5. Spawn e debug

- [X] `world.js` / `test/makeWorld.js` — `playerEntity` ganha `Vitals`,
      inicializado a partir de `PLAYER_SPECIES.vitals` (ou default do
      trait, se a espécie não tiver)
- [X] `tools/debug/DebugPanel.jsx` — barras/números de HP e stamina ao
      vivo + botão "tomar dano (debug)"
- [X] `world.test.js` — `playerEntity` compõe `Vitals`

### 6. Gate e documentação

- [X] `package.json`: bump de versão `0.0.9` → `0.0.10`
- [X] `docs/backlog.md`: sem entrada prévia pra riscar (item não estava
      registrado lá) — nada a atualizar
- [X] `npm run lint` limpo e `npm test` (134/134) verdes (`npm run build`
      segue sujeito ao lint pré-existente em arquivos de conteúdo do
      usuário — `bot/index.js`, `roster.js` —, fora do escopo desta versão)

---

## Critérios de Conclusão

- HP e stamina regeneram sozinhos com o tempo, a uma taxa configurável por
  espécie (% do máximo por segundo).
- Tomar dano pausa a regeneração de HP por `VITALS.HP_REGEN_DELAY_AFTER_DAMAGE`
  segundos; passado esse tempo, volta a regenerar sozinho.
- Usar stamina (correr, dash ou pulo) pausa a regeneração dela por
  `VITALS.STAMINA_REGEN_DELAY_AFTER_USE` segundos a partir do último uso;
  segurar corrida continuamente nunca deixa a regeneração entrar no meio.
- Correr, dar dash e pular custam stamina; sem stamina, a ação não
  acontece (sem crash, sem travar input).
- Espécie sem `vitals` definido ainda usa defaults seguros, sem quebrar.
- `DebugPanel` permite ver HP/stamina ao vivo e tirar HP pra validar a
  regeneração.
- `npm run lint` e `npm test` continuam verdes; nenhum teste existente
  quebra.

---

## Fora de escopo

- **Sistema de dano de verdade** (inimigos, queda, hazards) — o botão de
  debug é só validação; fonte de dano real de jogo é decisão de design
  separada, ainda não tomada.
- **Morte/respawn** — `hp` trava em `0`, sem gatilho de morte. Já é item
  próprio no backlog (estado terminal, precisa de fluxo de respawn).
- **HUD real** — HP/stamina aparecem só no `DebugPanel` (atrás do toggle de
  debug) por enquanto; HUD sempre visível pro jogador já é item separado no
  backlog ("HUD real (não-debug)").
- **Custo de ação por espécie** — dreno de corrida/dash/pulo é global
  (`gameConfig`), não por criatura. Migra pra espécie quando/se aparecer
  necessidade real, mesmo caminho já percorrido por `body`/`movement`.
- **`bot/index.js` ganhar `vitals`** — conteúdo do usuário, não edito sem
  pedido; o fallback do trait cobre a espécie até isso ser adicionado.
