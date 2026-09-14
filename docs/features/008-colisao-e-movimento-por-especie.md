# 🚀 Versão 0.0.8 — Colisão e Movimento por Espécie

O objetivo desta versão é tirar de `gameConfig.js` os números que descrevem
o **corpo** de uma criatura (tamanho e orientação da cápsula de colisão) e
sua **locomoção** (velocidade de andar/correr/girar) — hoje globais,
pensados só pro Fox — e movê-los pra dentro de cada entrada de
`core/data/species/<id>/index.js`, de onde viram dado por entidade (trait),
não mais constante compartilhada. Inclui também deixar a cápsula deitar de
lado (`capsuleAxis`), pra servir corpo de quadrúpede — uma cápsula em pé
não funciona bem pra esse formato — e mover o offset visual do modelo
(`modelOffset`) pra dentro de `body`, junto do resto da forma do collider.

> Versionamento e nome do arquivo: ver `docs/development-workflow.md`.

---

## Contexto

- `gameConfig.PLAYER` (`WALK_SPEED`, `RUN_SPEED`, `TURN_SPEED`) e
  `gameConfig.PHYSICS.CHARACTER.{CAPSULE_RADIUS,CAPSULE_HALF_HEIGHT}` são lidos
  hoje como constantes globais por `movementSystem` e pela criação do collider
  Rapier (`physicsBootstrapSystem` → `createCharacterBody`). Fazem sentido
  enquanto só existe um personagem (o Fox), mas não escalam: as 151 criaturas
  vão ter corpos e velocidades diferentes entre si.
- `core/data/species/<id>/index.js` já existe exatamente pra guardar dado
  específico de cada criatura (`model`, `clips`, `stats`, `moves`) — é o lugar
  certo pra esses números também entrarem, não um arquivo novo.
- Só o Fox existe como entidade hoje (nenhuma criatura selvagem ainda), mas
  esse encanamento (de onde vem o número até o system que usa) precisa estar
  certo *antes* de "criaturas selvagens no mundo" (outro item do backlog)
  crescer em cima dele — senão essa fundação nasce errada e todo mundo que
  vier depois herda o problema.

## Decisões

- **Dois campos novos por espécie**: `body` (forma física) e `movement`
  (velocidades), ao lado de `model`/`clips`/`stats`/`moves` já existentes:
  ```js
  export const FOX = {
    id: 'fox',
    body: { capsuleRadius: 0.5, capsuleHalfHeight: 0.01 },
    movement: { walkSpeed: 3, runSpeed: 7, turnSpeed: 10, jumpSpeed: 9 },
    // ...model, clips, stats, moves
  }
  ```
  `jumpSpeed` entra em `movement` (não em `body`) porque é velocidade, mesma
  família de andar/correr — quão forte esta criatura pula é atributo dela,
  não um detalhe da forma física.
- **`gameConfig.js` fica só com o que é do motor, não da criatura** — a seção
  `PLAYER` inteira sai (só tinha as três velocidades, que migram). De
  `PHYSICS.CHARACTER`, saem `CAPSULE_RADIUS`/`CAPSULE_HALF_HEIGHT` e
  `JUMP_SPEED`; o resto (`CONTROLLER_OFFSET`, `MAX_SLOPE_CLIMB`,
  `MIN_SLOPE_SLIDE`, `AUTOSTEP_HEIGHT`, `AUTOSTEP_MIN_WIDTH`,
  `SNAP_TO_GROUND`, `GROUNDED_STICK`) fica global — motivo abaixo, em "Fora de
  escopo". `GROUNDED_STICK` em particular não é atributo de criatura nenhuma:
  é o epsilon técnico que mantém o snap-to-ground do Rapier engatado enquanto
  no chão, existiria igual mesmo se todas as 151 criaturas pulassem exatamente
  igual.
- **Os valores viram trait, não ficam num lookup por id a cada frame** —
  no spawn, os campos de `body`/`movement` da espécie são copiados pra dentro
  de traits da entidade. Assim `movementSystem` e a criação do collider
  continuam simples e headless, só leem trait — sem fazer
  `getSpecies(id)` a cada frame nem misturar a camada de dado (species) com a
  de execução (systems).
  - `CharacterController` (hoje uma tag vazia) ganha `capsuleRadius` e
    `capsuleHalfHeight`. Continua funcionando como tag em queries (presença),
    só ganhou dado junto.
  - `MovementStats` (trait novo) — `{ walkSpeed, runSpeed, turnSpeed,
    jumpSpeed }`.
- **`createCharacterBody` recebe as dimensões por parâmetro**, em vez de ler
  `GAME_CONFIG.PHYSICS.CHARACTER` direto — quem chama (`physicsBootstrapSystem`)
  tira o valor do trait `CharacterController` da própria entidade.
- **`movementSystem` lê `MovementStats` do próprio entity**, em vez de
  desestruturar `GAME_CONFIG.PLAYER` uma vez no topo do system.
- **`characterPhysicsSystem` lê `MovementStats.jumpSpeed` do próprio entity**
  no lugar de `GAME_CONFIG.PHYSICS.CHARACTER.JUMP_SPEED` — mesma troca, um
  system a mais. `GROUNDED_STICK` continua vindo do config global (ver acima).
- **Spawn é o único lugar que fala com `core/data/species`** — `world.js` (e
  `test/makeWorld.js`) chamam `getSpecies('fox')` e usam `.body`/`.movement`
  pra inicializar os traits acima. Isso já é uma pequena prova de conceito de
  "jogador é só mais uma entrada de espécie", que a v0.0.6 começou pro lado
  da animação e esta versão estende pro lado da física/movimento.

## Objetivos

- `gameConfig.js` sem nenhum número específico de criatura — só o que é do
  motor (algoritmo do character controller, câmera, timestep, gravidade).
- Cápsula e velocidades do Fox vêm de `core/data/species/fox/index.js`, não
  mais de `gameConfig.js`.
- `movementSystem` e a criação do collider físico lêem dado por entidade
  (trait), não constante global — pré-requisito pra qualquer segunda
  criatura ter corpo/velocidade diferentes sem tocar em system nenhum.
- Nenhuma regressão de comportamento: com os mesmos números de hoje só
  trocando de lugar, o Fox anda/corre/colide exatamente igual (cápsula em pé
  é o padrão — só muda pra quem pedir `capsuleAxis` diferente).
- Cápsula pode deitar de lado (`capsuleAxis: 'x'|'z'`) e acompanhar a frente
  da criatura ao virar, pra caber em corpo de quadrúpede.
- Offset do modelo (`body.modelOffset`) vive junto da forma da cápsula, não
  mais separado em `model.position` — um só lugar pra "onde o modelo fica
  em relação ao corpo físico".

---

## Etapas

### 1. Dado por espécie

- [X] `core/data/species/fox/index.js` — adiciona `body`/`movement` com os
      valores atuais (copiados de `gameConfig.js`, sem mudar número nenhum)
- [X] `core/data/species/_template/index.js` — documenta os campos novos

### 2. Traits

- [X] `traits/components/physics.js` — `CharacterController` ganha
      `capsuleRadius`/`capsuleHalfHeight`
- [X] `traits/components/control.js` (ou arquivo próprio) — `MovementStats
      { walkSpeed, runSpeed, turnSpeed }` + export no barrel

### 3. Systems e física

- [X] `physics/colliders.js` — `createCharacterBody(position, { radius,
      halfHeight })`, sem ler `GAME_CONFIG.PHYSICS.CHARACTER` pras dimensões
- [X] `systems/physicsBootstrapSystem.js` — repassa `capsuleRadius`/
      `capsuleHalfHeight` do trait pro `createCharacterBody`
- [X] `systems/movementSystem.js` — lê `MovementStats` da própria entidade
      em vez de `GAME_CONFIG.PLAYER`
- [X] `systems/characterPhysicsSystem.js` — lê `MovementStats.jumpSpeed` da
      própria entidade em vez de `GAME_CONFIG.PHYSICS.CHARACTER.JUMP_SPEED`;
      `GROUNDED_STICK` continua do config global

### 4. Config e spawn

- [X] `gameConfig.js` — remove `PLAYER`; remove `CAPSULE_RADIUS`/
      `CAPSULE_HALF_HEIGHT`/`JUMP_SPEED` de `PHYSICS.CHARACTER` (mantém
      `GROUNDED_STICK` e o resto dos parâmetros do character controller)
- [X] `world.js` / `test/makeWorld.js` — spawn do player usa
      `getSpecies('fox').body`/`.movement` pra inicializar `CharacterController`/
      `MovementStats`

### 5. Orientação da cápsula (quadrúpedes)

Adicionado depois do plano original, a pedido: uma cápsula em pé (a única
forma que existia até aqui) não serve pra corpo de quadrúpede.

- [X] `traits/components/physics.js` — `CharacterController` ganha
      `capsuleAxis: 'y' | 'x' | 'z'` (padrão `'y'`, em pé — comportamento
      anterior preservado)
- [X] `physics/colliders.js` — `createCharacterBody` aceita `axis`; deita a
      cápsula (`ColliderDesc.setRotation`) reaproveitando `axisQuaternion`
      (já existia, usado pelos obstáculos do nível de teste)
- [X] `systems/physicsBootstrapSystem.js` — repassa `controller.capsuleAxis`
- [X] `systems/characterPhysicsSystem.js` — corpo físico passa a girar junto
      com `Rotation.y` (`rigidBody.setNextKinematicRotation`), não só
      transladar. Necessário porque uma cápsula em pé é radialmente simétrica
      em Y (girar o corpo não muda nada na colisão), mas uma cápsula deitada
      deixa de ser simétrica — sem girar o corpo, ela ficaria travada num
      eixo do mundo em vez de acompanhar a frente da criatura ao virar
- [X] `core/data/species/fox/index.js` / `_template/index.js` — documentam
      `capsuleAxis`
- [X] Testes: cápsula deitada repousa numa altura diferente (só o raio, não
      raio+meia-altura — confirma que a rotação da forma tem efeito físico
      real); corpo físico gira de fato acompanhando `Rotation.y`

### 6. Posição do model dentro da cápsula

Adicionado depois do plano original, a pedido: o offset visual do modelo em
relação ao corpo físico morava em `model.position`, sem nenhuma relação
explícita com a forma do collider — cada vez que a cápsula mudava de
tamanho/eixo, o offset tinha que ser reajustado no escuro, num campo que
parecia só de renderização.

- [X] `core/data/species/fox/index.js` / `_template/index.js` — `position`
      sai de `model` e vira `body.modelOffset` (mesmo valor, `[x,y,z]`
      relativo ao centro da cápsula) — agora mora junto de
      `capsuleRadius`/`capsuleHalfHeight`/`capsuleAxis`, os três números que
      de fato influenciam onde o modelo deveria ficar
- [X] `view/scene/PlayerView.jsx` — lê `PLAYER_SPECIES.body.modelOffset` em
      vez de `PLAYER_SPECIES.model.position`; `model` fica só com `path`/
      `scale` (referência de asset), nada de física/posicionamento
- [X] `world.test.js` — ajustado: `FOX.body` agora tem um campo
      (`modelOffset`) que não faz parte do trait `CharacterController`
      (é renderização, não física); o teste compara só os campos que o
      trait de fato tem, em vez do objeto `body` inteiro

### 7. Testes e gate

- [X] `movementSystem.test.js` — entidades de teste ganham `MovementStats`;
      ajusta leitura de velocidade esperada
- [X] `characterPhysicsSystem.test.js` — resting height calculado a partir do
      `body` do Fox (via `getSpecies`), levando em conta `capsuleAxis`
- [X] `world.test.js` — `playerEntity` compõe `MovementStats`; `CharacterController`
      carrega as dimensões certas
- [X] `package.json`: bump de versão `0.0.7` → `0.0.8`
- [X] `docs/backlog.md`: marca "Colisão e movimento por espécie" como entregue
- [X] `npm run lint` limpo e `npm test` (111/111) verdes (`npm run build`
      segue sujeito ao lint pré-existente em arquivo de conteúdo do usuário,
      fora daqui)

---

## Correções feitas durante a versão

- **`DebugPanel.jsx` não estava no plano original e lia os mesmos caminhos
  removidos**: o painel de debug (`tools/debug/DebugPanel.jsx`, da
  v0.0.6/v0.0.7) desestruturava `GAME_CONFIG.PLAYER` e
  `GAME_CONFIG.PHYSICS.CHARACTER.{CAPSULE_RADIUS,CAPSULE_HALF_HEIGHT}`
  direto — um grep que eu não tinha rodado ao planejar. Corrigido pra ler
  `CharacterController`/`MovementStats` do próprio `playerEntity` via
  `useTrait`, igual ao resto do painel já fazia pra posição/velocidade/animação.
- **Dar campo pro `CharacterController` (antes tag vazia) desalinhou todo
  `.updateEach` que já o consultava**: no koota, uma tag sem schema
  (`trait()`) não ocupa posição no array que `.updateEach` entrega — só
  filtra a query. Ao virar `trait({ capsuleRadius, capsuleHalfHeight })`,
  passou a ocupar posição de verdade, e `animationStateSystem.js` (que
  consulta `CharacterController` só como filtro, sem usar o dado) ficou com
  a desestruturação `([vel, action, anim], ...)` deslocada em uma posição —
  `vel` recebia o valor de `CharacterController`, `action` recebia
  `Velocity`, e `AnimationState` nunca era realmente escrito. Todos os testes
  de `animationStateSystem.test.js` passaram a falhar (sempre resolvendo
  `'idle'`), o que expôs o problema imediatamente. Corrigido adicionando o
  slot vazio correspondente (`([, vel, action, anim], ...)`) — mesmo padrão
  já usado em `characterPhysicsSystem.js`/`physicsBootstrapSystem.js`, que já
  desestruturavam certo porque foram escritos depois dessa mudança.
- **Precisão do pouso depois do pulo variava por orientação da cápsula**: o
  teste "pula a partir do chão e volta a repousar" checava
  `toBeCloseTo(yGround, 1)` (±0.05) — calibrado pra cápsula quase esférica
  original. Testado isoladamente com a cápsula bem alongada (raio 0.4,
  meia-altura 0.45): em pé e deitada em X assentam com <0.001 de diferença,
  mas deitada em Z assenta ~0.06 abaixo do chão original — confirmado (com
  `setNextKinematicRotation` temporariamente desligado num teste manual) que
  não é o corpo girando, é o próprio Rapier assentando com mais folga de
  contato pra essa proporção/orientação específica de cápsula. Não é um bug
  no código deste projeto — é uma característica de precisão do motor de
  física que varia com a forma do collider, que agora é por espécie (tunável
  pelo usuário) em vez de fixa. Corrigido alargando a tolerância do teste
  pra `< 0.15`, com comentário explicando o porquê.
- **`world.js` e `PlayerView.jsx` podiam apontar pra espécies diferentes —
  e apontaram**: cada um tinha seu próprio `getSpecies('fox')`/
  `PLAYER_SPECIES_ID` hardcoded, com um comentário em `world.js` avisando
  "mesma troca de PLAYER_SPECIES_ID em PlayerView.jsx" — um lembrete manual,
  não uma garantia. Ao testar um modelo novo, trocando só o `PLAYER_SPECIES_ID`
  de `PlayerView.jsx` pra `'bot'`, o modelo visual mudou mas `world.js`
  continuou montando o corpo físico e o movimento a partir do Fox — a
  cápsula, a velocidade, tudo do `bot/index.js` era ignorado silenciosamente.
  Corrigido centralizando `PLAYER_SPECIES_ID` em `core/data/species/index.js`
  (a mesma peça que já é a autoridade sobre o registro de espécies) — `world.js`
  e `PlayerView.jsx` agora leem de lá, nunca mais divergem por construção.
  `test/makeWorld.js` continua fixado em `'fox'` de propósito (comentário
  explica): os testes precisam de uma espécie estável que eu mantenho,
  independente de qual estiver configurada como jogador no momento.

---

## Critérios de Conclusão

- Nenhum system lê `GAME_CONFIG.PLAYER` nem `GAME_CONFIG.PHYSICS.CHARACTER.
  {CAPSULE_RADIUS,CAPSULE_HALF_HEIGHT,JUMP_SPEED}` — esses caminhos deixam de
  existir.
- Cápsula (tamanho e orientação), velocidades e altura do pulo do jogador
  vêm da espécie apontada por `PLAYER_SPECIES_ID`
  (`core/data/species/index.js`) — um único lugar decide qual espécie é o
  jogador, lido tanto por `world.js` (física/movimento) quanto por
  `PlayerView.jsx` (modelo/animação).
- Comportamento inalterado com `capsuleAxis: 'y'` (padrão): mesma velocidade
  de andar/correr, mesmo tamanho de cápsula, mesmo giro — só mudou de onde o
  número vem.
- Com `capsuleAxis: 'x'`/`'z'`, a cápsula deita e continua acompanhando a
  direção que a criatura encara ao virar (o corpo físico gira com ela).
- Nenhum lugar lê `model.position` — o offset do modelo é
  `body.modelOffset`; `model` só guarda `path`/`scale`.
- `_template/index.js` documenta `body`/`movement` (incl. `capsuleAxis` e
  `modelOffset`) pra quem for criar uma nova espécie depois.
- `npm run lint` e `npm test` continuam verdes; nenhum teste existente
  quebra.

---

## Fora de escopo

- **Parâmetros do character controller** (`CONTROLLER_OFFSET`,
  `MAX_SLOPE_CLIMB`, `MIN_SLOPE_SLIDE`, `AUTOSTEP_*`, `SNAP_TO_GROUND`)
  continuam globais — existe um único `KinematicCharacterController` do
  Rapier compartilhado por todo o world (`physicsWorld.js`), configurado uma
  vez em `initPhysics()`. Dar a cada espécie seu próprio comportamento de
  rampa/degrau exigiria múltiplas instâncias de KCC — mudança maior, sem
  necessidade concreta ainda (nenhuma criatura precisa disso hoje).
- **`GROUNDED_STICK`** continua global — não é atributo de criatura, é o
  epsilon técnico que mantém o snap-to-ground do Rapier engatado (ver
  Decisões acima). `JUMP_SPEED` em si migra nesta versão (`movement.jumpSpeed`).
- **Só cápsula, só deitada em 90°** — `capsuleAxis` gira a cápsula inteira
  num dos três eixos, não dá ângulo arbitrário nem troca de forma (cuboide
  arredondado, por exemplo). Cobre quadrúpede razoavelmente; formatos mais
  exóticos entre as 151 criaturas podem pedir outra abordagem — resolve
  quando aparecer um caso real.
- Pulo continuar sem ser um `ActionState` de verdade (ver
  `007-sistema-de-acoes-do-jogador.md`) — esta versão só move o número, não
  redesenha o mecanismo do pulo.
- **`PLAYER_ACTIONS.dash`** (duração/velocidade do dash) continua em
  `gameConfig.js` — é comportamento do jogador-personagem específico, não
  presumidamente compartilhado por toda criatura; se/quando uma criatura
  precisar de dash com números próprios, é a mesma migração de novo, feita
  naquela hora.
- Criaturas selvagens de verdade no mundo (spawn, IA) — esta versão só
  prepara o encanamento de dado; continua bloqueado no backlog.
- Migrar `stats`/`moves` pra um formato fechado — segue em aberto até o
  sistema de batalha ser desenhado (nota já existente em `_template/index.js`).
