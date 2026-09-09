# Regras de Desenvolvimento — Rota 151

Este documento define a arquitetura e os padrões de desenvolvimento do projeto. Ele é feito para ser lido por pessoas e por agentes de IA **antes de implementar uma feature** e **de novo antes de revisar o resultado**.

O objetivo: o código do jogo deve ser fácil de ler, raciocinar, atualizar, depurar e estender — sem regressão acidental.

---

## 1. Contexto

**Rota 151** é um jogo 3D inspirado no universo de captura de monstros, com exploração, batalhas e captura de criaturas num mundo 3D.

**Stack atual:**

- Next.js 14 (App Router), **JavaScript** (não TypeScript)
- React Three Fiber v8 + `@react-three/drei` + Three.js
- Koota ECS
- Better Auth + Prisma (autenticação e persistência de usuário)
- ESLint (`@rocketseat/eslint-config`) + Prettier

**Evolução prevista** (não implementar antecipadamente): mundo aberto, geração procedural, multiplayer, grande quantidade de entidades, física, gerenciamento de mundo por chunks, sincronização cliente/servidor, escalabilidade.

**Princípio de escopo:** decisões arquiteturais sobre funcionalidades ainda não definidas **não são tomadas agora**. As regras deste documento existem para não criar problemas desnecessários para essa evolução — não para antecipá-la. Quando uma regra depende de uma feature que ainda não existe, ela está na seção **Checklist por feature** (seção 7) e só é ativada quando a feature começa.

Referência de framework para o multiplayer futuro: [`docs/reference/colyseus.md`](../reference/colyseus.md) — material de consulta, não regra.

---

## 2. Filosofia

Orientação de fundo. São princípios, não critérios de bloqueio em review.

1. **Simulação orientada a dados, efeitos colaterais orientados a eventos.**
   O que é contínuo (movimento, câmera, física, IA, streaming de mundo) é system lendo e escrevendo estado. O que é pontual ou cruza domínios (dano, morte, captura, som, mensagem de rede, save) é evento tipado, drenado numa fase conhecida do loop. Casos de fronteira (isto é estado ou evento?) são decididos por domínio quando surgem, não antecipadamente.

2. **O código revela o dono do estado.**
   Todo trait ou estado importante tem, anotado, quem escreve e quem só lê. Se dois systems escrevem o mesmo campo, para-se e define-se a propriedade antes de continuar. Escrita compartilhada (pools de efeitos, eventos efêmeros) é permitida quando documentada.

3. **O caminho feliz é fácil de ler.**
   Funções pequenas e nomeadas, guard clauses, fases explícitas, nomes do domínio. Nada de esperteza que economiza linhas mas esconde a intenção.

4. **Abstrações locais e sem graça.**
   Abstrai-se para remover duplicação real, nomear um conceito do domínio ou centralizar uma regra arriscada — nunca "porque talvez precise depois". Exceção: quando outra regra deste documento já exige a estrutura (PRNG seedado, serializers de save).

5. **A view renderiza estado, não é dona de gameplay.**
   Componentes renderizam, assinam estado de exibição, registram refs de cena e chamam actions em resposta a input do usuário. Regra de jogo, física e timers autoritativos ficam no core.

6. **Otimize arquitetura antes de micro-otimizar.**
   Antes de otimizar linha a linha: isto roda mais vezes que o necessário? causa re-render à toa? está na camada certa? aloca dentro de um loop quente? pode ir para system, worker, pool ou cache?

---

## 3. Regras estruturais

Estas valem **agora** e formam o núcleo da arquitetura.

### 3.1 Camadas e core headless

- Quatro camadas com fronteira clara:
  - `core/` — lógica de jogo pura
  - `view/` — renderização
  - `platform/` — adapters para o mundo externo (rede, input, áudio, persistência)
  - `tools/` — debug e editores
- Direção de dependência: `app → view → core`, `app → platform → core`, `tools → *`, `core → só utilitários e dados`.
- `core/` **não importa** React, R3F, DOM (`window`, `document`), storage do browser, APIs de áudio, cliente de rede ou painel de debug. Se precisar de um desses, emite um evento ou chama um adapter injetado.
- Brechas permitidas no `core/`:
  - `koota` puro é permitido; `koota/react` só na view.
  - Refs de cena isoladas, via registry, são permitidas.
  - A ponte ECS → Three.js mora na camada view, não no core.
- `platform/` e `tools/` só são criadas quando o primeiro adapter ou ferramenta existir. `src/app/` permanece sendo o roteador do Next.

### 3.2 Estado e systems

- Estado autoritativo de gameplay vive em traits do Koota, **um lugar só**. Store de UI guarda apenas estado de UI. Qualquer cópia duplicada (por performance ou rede) exige anotação de qual é a fonte autoritativa e qual é derivada.
- Cada system tem **um trabalho primário**: lê um conjunto claro de traits, escreve só os que são seus, roda numa fase conhecida.
- Assinatura padrão de system: `system(context)` com `context = { world, delta }`. Sem `world` importado de módulo dentro de system.
- Traits não são sacos de propósito misto. Campos mexidos por muitos systems, ou válidos só durante uma fase → dividir o trait.

### 3.3 Actions

- Toda mutação de estado reutilizável é uma `action` nomeada pelo conceito de jogo (`aplicarDano`, `capturarCriatura`, `equiparItem`), chamável de qualquer lugar: system, handler de evento, processador de mensagem de rede.
- Mais de ~2 linhas de mutação inline em um system → extrair uma action.

### 3.4 Game loop

- O loop só chama systems e phase-runners nomeados. Nunca lógica de gameplay inline.
- Passo fixo (input, movimento, física, timers, combate, IA determinística) separado de passo variável (câmera suave, interpolação, mixer de animação, partículas, áudio, debug).
- `useFrame` existe **apenas** no módulo do game loop. Exceção: um componente puramente visual (shader animado, billboard), que não toca estado de gameplay, comentado e revisado.
- Eventos são drenados numa fase conhecida, uma vez por ciclo, em ordem explícita. Não drenar evento de lugar aleatório — ordem de evento é comportamento de jogo.

### 3.5 Tempo e aleatoriedade

- Systems recebem `delta` do loop. `Date.now()` / `performance.now()` só em adapters de plataforma, profiling, telemetria e timestamps de persistência.
- Sem `Math.random()` em lógica de jogo: PRNG seedado e nomeado (RNG de gameplay, de geração procedural, do servidor, cosmético).
- Geração procedural recebe entradas explícitas (seed, coordenadas de chunk, parâmetros de bioma, versão de geração) e é determinística: mesma entrada → mesma saída.
- A infraestrutura de PRNG (helper, sub-seeds por chunk) é construída quando a primeira feature com aleatoriedade aparecer, não antes. Até lá é convenção.

### 3.6 Gates

- `npm run build` e `npm run lint` devem passar antes de considerar um trabalho concluído.
- Teste vira gate quando houver runner configurado (candidato: Vitest).
- Se um gate não pode rodar, a entrega diz por quê.

---

## 4. R3F + Koota

Padrões concretos para o stack atual.

- Estado de entidade vive em traits do Koota. `koota/react` (`useTrait`, `useQuery`) é usado **apenas na view**.
- `updateEach` / `readEach` para queries com dados. Não iterar manualmente com `for...of` + `entity.get()`.
- Componente de view é um **wrapper fino**: renderiza JSX (mesh, geometria, material) e registra a ref de cena via `useEffect` (o cleanup remove o registro). Sem lógica de jogo, sem `useFrame`, sem leitura de estado além do que a view precisa.
- Fases de entidade são **tag traits mutuamente exclusivas** (`PhaseIdle`, `PhaseBattling`, `PhaseFainted`), trocadas por uma action que limpa a fase anterior antes de aplicar a nova. Não usar pilha de booleanos (`isDead`, `isStunned`, ...).
- Grafos de entidade (posse, hierarquia, alvo, continência) usam `relation()` do Koota — não IDs string guardados em traits.
- Timers são um trait `Timer` tickado por um `timerSystem` no passo fixo. Nunca `setTimeout` em lógica de jogo: timer de frame respeita pausa, é determinístico e não dispara em entidade destruída.
- Todas as constantes ajustáveis ficam em `src/core/gameConfig.js`, num objeto agrupado por domínio (`WORLD`, `CHARACTER`, `BATTLE`, `CAMERA`, ...). Zero número mágico em systems e componentes.
- Efeitos visuais que nascem várias vezes por segundo (números de dano, faíscas, partículas, projéteis) usam pool de tamanho fixo como trait, não store de React. UI infrequente não precisa de pool.
- **Física** (Rapier, ativado em 0.0.4 — `@dimforge/rapier3d-compat`, WASM headless):
  - A lib é importada **só dentro de `src/core/physics/`**. Nenhum outro módulo — e principalmente a view — importa Rapier. O resto fala com a física por uma API fina desse pacote. Rapier-compat não toca o DOM, então `core/physics/` continua headless (roda em Node/worker/servidor).
  - O corpo do personagem é cinemático (`KinematicCharacterController`); movimento é computado por systems e resolvido pelo controller. O `world.step()` do Rapier roda uma vez por passo fixo, depois de todos os `computeColliderMovement`.
  - Colliders estáticos: hoje criados uma vez no bootstrap a partir de um dado único (`core/data/`) que também gera os meshes. Quando houver chunks, passam a ter escopo de chunk (criados no load, destruídos no unload).
  - Handlers de colisão (quando existirem) só registram o evento; systems processam no tick seguinte.

---

## 5. Regras do projeto

Regras específicas de Rota 151 que os guias genéricos não cobrem.

### 5.1 Fronteira Next.js ↔ jogo

- Todo o jogo vive sob uma fronteira `'use client'` única. O `core/` não sabe que Next.js existe.
- O bundle do jogo (Three, R3F, mundo) é carregado com `next/dynamic` / lazy — não no first paint da rota.
- Rotas Next cuidam de autenticação, matchmaking e telas fora-do-jogo. Elas passam dados para o jogo por props ou contexto, nunca o contrário.
- O jogo não depende de SSR nem de dados só disponíveis no servidor em tempo de render.

### 5.2 Assets 3D

- Assets ficam em `public/assets/`, organizados por tipo.
- Modelos em glTF / glb, comprimidos (draco ou meshopt).
- Um `assetRegistry` mapeia id lógico → caminho + metadados. Componentes referenciam o id lógico, nunca um caminho hardcoded.
- Carregamento passa por um loader central com cache (os hooks `useGLTF` / `useTexture` do drei já cacheiam — padronizar o uso deles).

### 5.3 Ciclo de vida de recursos Three.js

- Todo recurso Three criado imperativamente (fora do JSX declarativo do R3F) tem um dono responsável por chamar `.dispose()` no cleanup.
- Entidades e chunks que descarregam liberam geometria, material e textura próprios.
- Assets compartilhados (via `assetRegistry`) não são disposed por consumidor — apenas quando saem do registry.

### 5.4 Robustez do loop de tempo fixo

- O acumulador do game loop tem clamp máximo (ex.: `Math.min(delta, 0.25)`) e/ou um teto de steps por frame.
- Ticks perdidos por um stall (aba em background, GC, freeze) são descartados, não recuperados.
- O comportamento escolhido fica documentado no módulo do loop.

### 5.5 Unidades e sistema de coordenadas

- 1 unidade = 1 metro.
- Y para cima.
- Ângulos em radianos no `core/`.
- A direção "frente" das entidades é definida e documentada.

### 5.6 Estado de jogo e pausa

- Existe um estado global de fase de jogo (`loading`, `playing`, `paused`, `menu`) — é estado de app, fora do ECS.
- O game loop consulta esse estado: quando pausado, pula o passo fixo; a apresentação continua rodando.
- Transições de fase acontecem por action.

### 5.7 Anatomia de uma feature de gameplay

Uma feature de gameplay é composta por, na ordem:

1. **Traits** — o estado, com o dono de escrita anotado.
2. **System(s)** — registrados numa fase do loop.
3. **Action(s)** — para toda mutação reutilizável.
4. **Eventos** — para efeitos que cruzam domínios.
5. **Componente(s) de view** — finos, só render + registro de ref.
6. **Constantes** — em `gameConfig.js`.
7. **Testes** — onde um bug custaria caro.

Nem toda feature usa todos os passos, mas a decisão de pular um é consciente.

---

## 6. Convenções

### Organização

- Pastas por responsabilidade: `traits`, `systems`, `actions`, `events`, `data`, `world` no core; `scene`, `components`, `registry` na view; `adapters` na plataforma; `tools` / `debug` à parte.
- `utils` guarda apenas helper genérico sem dono de domínio. Um helper que conhece inventário, batalha ou chunk pertence à pasta daquele domínio.
- Um arquivo responde a uma pergunta. Sem `helpers.js`, `misc.js`, `gameStuff.js`.
- Considerar dividir um arquivo acima de ~300–500 linhas, ou quando ele mistura domínios, ou quando o review exige rolar por seções não-relacionadas. É guia, não gate.

### Nomes

- Nomes do domínio do jogo: `iniciarBatalha`, `podeCapturar`, `entrarModoCaptura`. Nunca `handleThing`, `processData`, `manager`, `updateStuff`.
- Booleanos são perguntas: `isGrounded`, `hasLineOfSight`, `canPlace`, `shouldRespawn`.
- Forma de objeto reutilizável tem nome: o `trait` do Koota é a forma canônica. Contratos que cruzam módulos (contexto de system, payload de evento, snapshot de câmera) são documentados com `@typedef` JSDoc num lugar só.

### Arquivos

- Componentes `.jsx`: **PascalCase**, arquivo = nome do componente (`CubeView.jsx`).
- Módulos `.js` (systems, actions, traits, world, utils): **camelCase** (`syncTransformSystem.js`, `eventQueue.js`).

### Estilo

- Preferir early returns e guard clauses a `if {} else {}` aninhado.
- Validar ou normalizar dado externo na fronteira (com `zod`), onde já existe fronteira (Better Auth, Prisma, params de rota).

---

## 7. Checklist por feature

Ative a regra correspondente quando começar a implementar a feature. Antes disso, ela não é uma regra ativa.

### Ao preencher a fase de eventos

- Evento é fato tipado: discriminado por `type`, com payload de forma conhecida e validada na fronteira. Nada de `{ type: string, data: any }`.
- Todo evento responde: quem emite, quem consome, em que fase drena, é consumido uma vez ou retido, o que acontece sem consumidor.
- Evento diz "aconteceu"; o estado diz "é verdade agora". Não reconstruir estado replaying eventos.
- Core emite intenção (`SomPedido`, `VfxPedido`, `MsgRedeEnfileirada`); adapters e bridges executam o efeito.

### Ao criar o primeiro adapter de plataforma

- Adapter traduz mundo externo ↔ conceito de jogo. Não é onde regra de jogo mora.
- Dado externo (rede, save, URL, storage, JSON de editor) é validado ou normalizado na fronteira com `zod` antes de entrar no core.

### Ao criar o primeiro HUD

- UI assina estado via `useTrait` / `useQuery` do Koota, ou via snapshot com throttle (máx. ~10 Hz, nunca do passo fixo). Sem `requestAnimationFrame` em componente de HUD.
- Comando de UI chama uma action; não implementa a mutação.

### Ao criar ferramentas de debug

- Vivem em `tools/`, fáceis de excluir da build de produção, não montadas por padrão, sem frame loop escondido, nunca requisito de gameplay.
- Tuning de runtime tem caminho explícito para virar config tipada.

### Ao introduzir efeitos visuais frequentes

- Números de dano, faíscas, partículas, projéteis → pool de tamanho fixo. UI infrequente não precisa.
- Loops por-frame e por-entidade evitam alocação — sem sacrificar clareza sem uma medição que justifique.

### Ao introduzir multiplayer

- Autoridade documentada por campo: o que é server-authoritative, client-predicted, client-only.
- Handler de rede valida a mensagem, converte em action ou evento, sincroniza estado autoritativo — não duplica regra de jogo.
- Consultar [`docs/reference/colyseus.md`](../reference/colyseus.md).

### Ao introduzir save de estado de jogo

- Cada domínio persistido tem serializer / deserializer explícito. Sem save varrendo estado arbitrário.
- Todo formato persistido (save de progresso, estado de mundo, config de usuário) carrega um número de versão. Carregar dado de versão anterior passa por migração explícita ou é rejeitado com mensagem clara.

### Ao configurar testes

- Priorizar: regras puras, actions, serializers, geração procedural, math de batalha, validação de mensagem de rede, migração de save.
- Visual pesado de renderer pode usar smoke test, screenshot ou verificação manual.

### Em todo review

- As fronteiras de camada foram preservadas?
- A propriedade de cada estado está clara?
- Gameplay ficou fora de UI e de stores de plataforma?
- O game loop continua legível?
- Tempo e aleatoriedade estão controlados?
- Código de debug está isolado?
- `build` e `lint` passam?
- Se um problema tende a se repetir, vale propor uma regra nova.

---

## 8. Pendências de código

Ajustes que a definição destas regras revelou no código atual. **Todas resolvidas na versão 0.0.2** (ver `docs/features/0.0.2.md`):

1. ~~Mover `SyncTransformSystem` para fora do `core/`~~ → `src/view/systems/syncTransformSystem.js`.
2. ~~Mover o `useFrame` / `GameLoop.jsx` para a camada view~~ → `src/view/loop/GameLoop.jsx`.
3. ~~Padronizar a assinatura de system para `context = { world, delta }`~~ → feito; nenhum system importa `world` de módulo.
4. ~~Adicionar clamp no acumulador do game loop~~ → `MAX_FRAME_TIME` + `MAX_STEPS_PER_FRAME` em `GAME_CONFIG.LOOP`.
5. ~~Trait `Rotation` usa valores que parecem graus~~ → convertido para radianos.
6. ~~Criar `src/core/gameConfig.js`~~ → criado.
7. ~~Renomear `Transform.js` / `SyncTransformSystem.js`~~ → `transform.js` / `syncTransformSystem.js`.
