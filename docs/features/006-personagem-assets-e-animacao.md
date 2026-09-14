# 🚀 Versão 0.0.6 — Animação Procedural de Ossos

O objetivo desta versão é substituir a ideia de clipe gravado (`AnimationMixer.glb` com animações embutidas) por um motor de animação **procedural**:
código headless que manipula rotação/posição/escala de ossos por curva
matemática, a cada frame — sem depender de nenhuma animação pré-gravada no
modelo. Isso vale para qualquer criatura do jogo, incluindo o jogador. Inclui
também o crossfade entre estados de animação (idle/walk/run), pra trocar de
uma pra outra sem corte seco.

> Versionamento e nome do arquivo: ver `docs/development-workflow.md`.

---

## Contexto

- O jogo terá 151 criaturas jogáveis/capturáveis. Gravar clipe manual (idle,
  andar, correr, ataques...) pra cada uma não escala — e depende de ter, pra
  cada uma, um modelo já rigado com animação embutida.
- Inspiração declarada: a técnica do Cobblemon (mod de Pokémon pra Minecraft)
  de animar via expressão (Molang) em vez de clipe gravado. **Não usamos nada
  do código nem dos assets do Cobblemon** — só a ideia (osso + curva por
  código) foi adaptada em JS puro, escrita do zero.
- Nota de propriedade intelectual: os modelos reais dos 151 Pokémon não são
  gerados por mim (assistente) nem ficam sob minha responsabilidade — são
  fornecidos e mantidos pelo autor do projeto por conta própria, em pastas
  reservadas (`core/data/species/<id>/`, exceto `fox/` e `_template/`, que são
  parte do motor). O motor genérico (curvas, resolução de ossos, aplicação de
  clipe, registro de espécie) não depende do conteúdo de nenhuma criatura
  específica.
- Modelo temporário do jogador: **Fox** (Khronos Sample Assets, licença livre),
  usado só porque tem esqueleto de quadrúpede de verdade pra validar o motor
  antes das criaturas reais entrarem.

## Decisões

- **Sem `AnimationMixer`, sem clipe gravado, em lugar nenhum.** Um clipe agora
  é um JSON declarativo: por osso, por propriedade (`rotation`/`position`/
  `scale`), por eixo, uma curva (`constant`, `sine`, `clampedSine`, `absSine`,
  `sum`) — interpretada por função pura headless (`evaluateCurve`).
- **`resolveBones(skeleton)`**: sem mapa semântico de nomes. Resolve todos os
  ossos do esqueleto pelo próprio nome e guarda a pose de descanso de cada um
  (`rest`), pra qualquer clipe poder ser aplicado relativo a ela.
- **`applyAnimationClip(clip, bones, t, speed)`**: aplica um clipe por cima da
  pose de descanso. Todo osso resolvido volta pro descanso **antes** do clipe
  atual escrever por cima — necessário pra trocar de clipe (ex.: andar → parado)
  não deixar osso "preso" no último valor do clipe anterior.
- **Motor mora em `core/animation/`** (headless, sem import de React/R3F) —
  antes era um spike em `tools/`, promovido pra `core/` por deixar de ser
  experimental e passar a servir o jogo real.
- **Registro de espécie em `core/data/species/<id>/index.js`**: cada criatura
  (incluindo o jogador) é uma entrada com `id`, `dexNumber`, `model` (path +
  transform), `clips` (idle/walk/run...), `stats`, `moves`. `_template/` documenta
  o formato; `index.js` (registro) e `fox/` são as únicas entradas mantidas
  aqui — as demais espécies (Pokémon reais) são adicionadas e mantidas à parte.
- **Resolução de estado de animação é um system separado da execução**: dado
  velocidade + grounded, `resolveAnimationState` (tabela ordenada de regras)
  decide `idle`/`walk`/`run` e grava em `AnimationState`; `animationSystem` (na
  view) só lê esse estado e toca a curva correspondente — decisão e execução
  não se misturam.
- **Elapsed independente por entidade**: cada entidade animada tem seu próprio
  relógio (`elapsed += delta`) no registro de animação, não o tempo global do
  jogo — trocar de clipe não reinicia o ciclo de quem não trocou.
- **Crossfade por fotografia da pose atual, não por dois clipes tocando ao
  mesmo tempo**: ao trocar de `AnimationState`, `capturePose` congela a pose
  exibida naquele frame e `applyBlendedAnimationClip` mistura essa fotografia
  com o clipe novo ao longo de `ANIMATION.BLEND_DURATION` segundos. Uma troca
  no meio de outra troca só atualiza o alvo — a fotografia original continua
  sendo o ponto de partida, então nunca há salto, só uma curva mais curta.

---

## Objetivos

- Motor de curva + resolução de ossos + aplicação de clipe, headless e testado.
- Jogador (Fox) migrado do modelo/cápsula sem animação pra andar/correr/parado
  animados proceduralmente, com idle/walk/run autorais (idle sem pernas, pra
  ficar coerente com o fix de reset-to-rest).
- Split de velocidade `WALK_SPEED`/`RUN_SPEED` + tecla de correr (Shift).
- Ferramentas de debug na tela real do jogo: wireframe dos colliders físicos
  (Rapier `debugRender()`) e painel com estado ao vivo (posição, velocidade,
  grounded, animação, câmera) + config relevante (dimensão da cápsula,
  velocidades), atrás de um toggle — nunca requisito de gameplay.
- Crossfade entre estados de animação (idle/walk/run) — sem corte seco ao
  trocar de estado.

---

## Etapas

### 1. Motor de animação (`core/animation/`)

- [X] `curves.js` — `evaluateCurve(curve, t, freq)`: `constant`, `sine`,
      `clampedSine`, `absSine`, `sum` + testes
- [X] `resolveBones.js` — indexa `skeleton.bones` por nome, captura pose de
      descanso (`rotation`/`position`/`scale`) + testes
- [X] `applyAnimationClip.js` — aplica clipe relativo ao descanso; reseta pra
      descanso antes de aplicar (fix do bug de animação "presa", ver Correções)
      + testes, incluindo regressão do bug

### 2. Registro de espécie (`core/data/species/`)

- [X] `index.js` — `SPECIES_REGISTRY`, `getSpecies`, `listSpecies` + testes
- [X] `_template/index.js` — formato documentado (model, clips, stats, moves)
- [X] `fox/index.js` + `clips/{idle,walk,run}.json` — autoral, jogador temporário

### 3. Jogador procedural

- [X] `traits/components/animation.js` — `AnimationState { id: 'idle' }`
- [X] `traits/components/control.js` — `InputState.run`
- [X] `gameConfig.js` — `WALK_SPEED`/`RUN_SPEED`, `ANIMATION.{WALK,RUN}_MIN_SPEED`
- [X] `platform/input/keyboardInput.js` — Shift → `run`
- [X] `systems/inputSystem.js` — repassa `run`
- [X] `systems/movementSystem.js` — usa `RUN_SPEED` quando `input.run`
- [X] `data/animationStates.js` + `systems/animationStateSystem.js` — resolve
      `idle`/`walk`/`run` a partir de velocidade + grounded
- [X] `view/registry/animationRegistry.js` — registro por entidade (ossos +
      clipes + relógio próprio), substitui o registro baseado em mixer
- [X] `view/systems/animationSystem.js` — a cada frame, aplica o clipe do
      estado atual sobre os ossos registrados
- [X] `view/scene/PlayerView.jsx` — carrega o Fox (`SkeletonUtils.clone`),
      registra ossos + clipes no lugar de tocar `AnimationAction`
- [X] `world.js` / `test/makeWorld.js` — `playerEntity` ganha `AnimationState`

### 4. Debug em tela

- [X] `tools/debug/PhysicsDebugView.jsx` — `world.debugRender()` do Rapier
      desenhado como `THREE.LineSegments`, dentro do Canvas
- [X] `tools/debug/DebugPanel.jsx` — painel HTML com estado ao vivo via hooks
      do koota (`useTrait`/`useTag`), fora do Canvas
- [X] `view/scene/GameScene.jsx` — ganha slot `children`, pra ferramentas de
      `tools/` entrarem na cena sem `view/` importar de `tools/`
- [X] `app/(auth)/page.js` — checkbox "Debug físico" liga/desliga os dois

### 5. Crossfade entre estados

- [X] `gameConfig.js` — `ANIMATION.BLEND_DURATION` (0.2s)
- [X] `core/animation/applyAnimationClip.js` — reescrito em torno de uma
      amostragem de pose pura (`sampleAnimationClip`, interna); ganhou
      `capturePose(bones)` (fotografa a pose ao vivo dos ossos) e
      `applyBlendedAnimationClip(fromPose, clip, bones, t, alpha, speed)`
      (mistura a fotografia com o clipe novo); `applyAnimationClip` mantém a
      mesma assinatura e comportamento de antes
- [X] `view/registry/animationRegistry.js` — cada entidade ganha `stateId`
      (último estado visto) e `blend` (`{ fromPose, elapsed }` ou `null`)
- [X] `view/systems/animationSystem.js` — detecta troca de `AnimationState`,
      fotografa a pose e aplica a mistura enquanto `blend.elapsed <
      BLEND_DURATION`; volta a aplicar o clipe puro quando o crossfade termina
- [X] `applyAnimationClip.test.js` — testes de `capturePose`, mistura em
      alpha 0/1/intermediário, e troca de alvo no meio de um crossfade em
      andamento (a fotografia original não é perdida)

### 6. Gate e documentação

- [X] `package.json`: bump de versão `0.0.5` → `0.0.6`
- [X] `npm run build && npm run lint && npm test` verdes

---

## Correções feitas durante a versão

- **Idle travando no último frame do clipe anterior**: `applyAnimationClip`
  só escrevia os ossos mencionados no clipe atual — trocar pra um clipe que
  não menciona um osso (ex.: perna no `idle`) deixava esse osso preso no valor
  que o clipe anterior (`walk`/`run`) tinha deixado. Corrigido resetando todo
  osso resolvido pra pose de descanso antes de aplicar o clipe atual. Teste de
  regressão em `applyAnimationClip.test.js` reproduz o cenário exato
  (anima perna no `walk`, troca pro `idle`, confere volta ao descanso).

---

## Critérios de Conclusão

- Nenhum clipe gravado (`AnimationClip`/`AnimationMixer`) é usado em nenhuma
  criatura, incluindo o jogador.
- Trocar de animação (ex.: correndo → parado) devolve todo osso não usado no
  novo clipe à pose de descanso, sem congelar.
- `core/animation/` e `core/data/species/` são headless (sem import de
  React/R3F/DOM) e testados.
- Toggle de debug na tela do jogo mostra os colliders reais (Rapier) e um
  painel com estado ao vivo, sem interferir no gameplay quando desligado.
- Trocar de `AnimationState` (idle/walk/run) faz um crossfade suave, sem
  corte seco nem salto, mesmo se um novo estado chegar no meio de outra
  transição.
- `npm run build`, `npm run lint` e `npm test` continuam verdes.

---

## Fora de escopo

- Conteúdo de qualquer criatura real (Pokémon) — modelos, clipes, stats,
  golpes. Fica em pastas próprias (`core/data/species/<id>/`, exceto `fox/` e
  `_template/`), fornecidas e mantidas por fora desta versão.
- Ajuste fino do tamanho/proporção do modelo do jogador (Fox) em relação à
  cápsula de física (`gameConfig.PHYSICS.CHARACTER`) — o Fox é quadrúpede, a
  cápsula é dimensionada para humanoide; o toggle de debug físico desta versão
  serve exatamente pra visualizar essa diferença, mas o ajuste em si fica pra
  quando o modelo definitivo do jogador existir.
- Animações além de idle/walk/run (ataques, capturas, emotes).
