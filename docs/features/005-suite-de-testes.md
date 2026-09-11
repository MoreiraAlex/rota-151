# 🚀 Versão 0.0.5 — Suíte de Testes (Vitest)

O objetivo desta versão é transformar os testes headless que fizemos de forma
ad hoc (câmera, movimento, física) em uma **suíte permanente**, e ativar o gate
`npm test` previsto na doc de regras.

Nenhuma mecânica nova. É consolidação: o core já é headless e determinístico —
esta versão tranca isso com testes de regressão.

> Versionamento e nome do arquivo: ver `docs/development-workflow.md`.

---

## Contexto

- Nas versões 0.0.2–0.0.4 cada entrega foi validada por um script `sim.mjs`
  descartável rodado à mão com um loader de resolução customizado. Nada disso
  ficou no repositório.
- A doc de regras (`docs/rules/README.md`) diz: o gate de teste vira ativo
  "quando houver runner", com prioridade para regras puras, actions, systems de
  simulação e geração procedural.
- O core roda em Node (inclusive o Rapier via `@dimforge/rapier3d-compat`), então
  quase tudo é testável sem browser.

## Decisões

- **Vitest** como runner (rápido, ESM nativo, sem depender do Next).
- **Ambiente `node`** por padrão — o alvo é o core headless. jsdom só entra se/quando
  testarmos componentes de view.
- Testes **co-localizados** (`arquivo.test.js` ao lado do módulo).
- Testes **importam explicitamente** de `vitest` (`import { describe, it, expect }`)
  — sem globals, para não mexer na config do ESLint.
- Systems são testados construindo um **world isolado** por teste (via
  `createWorld()` do koota + `spawn`), não o singleton `core/world/world.js`.
  Física usa `initPhysics()` / `disposePhysics()` em `beforeEach` / `afterEach`.
- Pequeno refactor alinhado às regras: extrair helpers de math reutilizados
  (`lerpAngle`, `clamp`) para `src/core/math/`, com testes próprios.

---

## Objetivos

- Configurar Vitest (config, alias `@/`, scripts, lint).
- `npm test` roda a suíte e é um gate (junto de `build` e `lint`).
- Cobrir: helpers de math, `inputSystem`, `cameraControlSystem`, `movementSystem`,
  `characterPhysicsSystem` + integração Rapier, `registry`/`pipeline`, composição
  do `world`.
- Portar os cenários do `sim.mjs` (queda, parede, rampa, pulo; movimento relativo
  à câmera; clamp de pitch/zoom) para testes versionados.
- Atualizar a doc de regras: gate de teste ativo, Vitest escolhido.

---

## Etapas

### 1. Setup do Vitest

- [X] `npm i -D vitest`
- [X] `vitest.config.js`: `test.environment = 'node'`, `test.include = ['src/**/*.test.js']`,
      `resolve.alias` mapeando `@` → `src/`
- [X] `package.json`: `"test": "vitest run"`, `"test:watch": "vitest"`
- [X] Confirmar que o `import()` dinâmico do Rapier funciona sob Vitest
      (funcionou sem config extra)
- [X] `.gitignore`: `coverage/` já estava ignorado (herdado do template do Next)

### 1.1. Cobertura como radar (informativo, não-gate)

Adicionado depois do plano original, a pedido: `npm run test:coverage` gera um
relatório — **não falha o build/CI por nenhum número**. Serve para achar arquivos
com **zero** teste tocando neles (ex.: pegou `keyboardInput.js` sem nenhum teste,
corrigido nesta mesma versão), não para perseguir uma porcentagem.

- [X] `npm i -D @vitest/coverage-v8` (pinado na mesma versão do `vitest`)
- [X] `package.json`: `"test:coverage": "vitest run --coverage"`
- [X] `vitest.config.js`: `coverage.provider = 'v8'`, `all: true` (arquivo sem
      teste aparece como 0%, não some do relatório), exclui os próprios `*.test.js`
- [X] `keyboardInput.test.js` — lacuna que o próprio radar apontou; extraído
      `src/test/fakeEventTarget.js` (compartilhado com `pointerInput.test.js`)

### 2. Helpers de math (`src/core/math/`)

- [X] `angle.js` — mover `lerpAngle` (hoje privado em `movementSystem.js`); adicionar `wrapAngle`
- [X] `clamp.js` — mover `clamp` (hoje privado em `cameraControlSystem.js`)
- [X] `angle.test.js`, `clamp.test.js` — caminho mais curto, wrap em ±π, limites
- [X] Atualizar `movementSystem.js` e `cameraControlSystem.js` para importar daqui
- [X] Barrel `src/core/math/index.js`

### 3. Utilitário de teste (`src/test/`)

- [X] `makeWorld.js` — helper que cria um `world` koota limpo e faz `spawn` das
      entidades pedidas (player com traits X, câmera com `OrbitCamera`), para os
      testes de system não dependerem do singleton
- [X] Não é código de produção — pasta `src/test/`, fora de `core/`

### 4. Testes de input

- [X] `inputSystem.test.js`:
  - sem input → intenção `{ x: 0, z: 0 }`
  - `forward` → `z = -1`; `right` → `x = 1`
  - diagonais normalizadas (magnitude ≤ 1)
- [X] `cameraControlSystem.test.js`:
  - mouse +X → `yaw` diminui; yaw é livre (sem clamp, wrap em 2π)
  - mouse +Y → `pitch` aumenta, satura em `MIN_PITCH` / `MAX_PITCH`
  - scroll → `distance`, satura em `MIN_DISTANCE` / `MAX_DISTANCE`

### 5. Testes de movimento

- [X] `movementSystem.test.js`:
  - `yaw = 0`: `W` → velocity `-z`; `D` → velocity `+x` (sem inversão)
  - `yaw = π/2`: `W` → velocity `-x` (relativo à câmera)
  - `Rotation.y` converge para a direção do movimento
  - não escreve `Position` (quem move é a física)

### 6. Testes de física

- [X] `characterPhysicsSystem.test.js`, `beforeEach(initPhysics)` /
      `afterEach(disposePhysics)`, rodando os systems do passo fixo na ordem real:
  - queda livre → repousa no chão, ganha `Grounded`
  - anda contra a parede → bloqueado
  - sobe a rampa → `y` cresce, sem travar
  - pulo → sobe e volta a repousar
  - (degrau baixo / bloco alto: cobertos indiretamente pela rampa+pulo; testes
    dedicados ficam para quando a navegação de teste for mais precisa)
- [X] `physicsWorld.test.js`: `initPhysics()` idempotente; `disposePhysics()` reseta o estado

### 7. Testes de infraestrutura

- [X] `registry.test.js` / `pipeline.test.js`: systems rodam na ordem de registro;
      fase vazia é no-op; `context` é repassado intacto
- [X] `world.test.js`: `playerEntity` compõe os traits esperados; `cameraEntity` tem `OrbitCamera`

### 8. Adapters (menor)

- [X] `pointerInput.test.js`: `snapshot()` drena os deltas (segundo `snapshot()` volta zerado);
      sem pointer lock, `mousemove` não acumula — com `document` / eventos mockados

### 9. Gate e documentação

- [X] `package.json`: bump de versão `0.0.1` → `0.0.5`
- [X] `docs/development-workflow.md`: seção "Bump de versão por feature"; `npm test` no fluxo
- [X] `docs/rules/README.md`: gate de teste **ativo** (Vitest); pasta `src/test/` e o padrão de world isolado
- [X] `npm run build && npm run lint && npm test` — os três verdes (41 testes)

### 10. Melhoria que caiu do refactor

- [X] `physicsWorld.js`: `initPhysics` / `disposePhysics` reescritos para reinicializar
      corretamente — o WASM carrega uma vez, só o `World` é recriado. Corrige
      também o risco de HMR apontado em `004-fisica-e-character-controller.md`.
- [X] `registry.js`: `clearSystems()` para isolar os testes de pipeline.

---

## Critérios de Conclusão

- `npm test` roda a suíte e passa; falha se algum comportamento coberto regredir.
- Física, câmera e movimento têm testes que reproduzem os cenários validados à mão
  nas versões 0.0.2–0.0.4.
- `lerpAngle` e `clamp` vivem em `src/core/math/` com testes; `movementSystem` e
  `cameraControlSystem` importam de lá.
- Os testes não dependem do singleton `core/world/world.js` (usam world isolado).
- `npm run build` e `npm run lint` continuam verdes.
- Doc de regras atualizada: gate de teste ativo.

---

## Fora de escopo

- Testes de renderização / componentes R3F (precisa de mock de canvas; baixo valor agora).
- Testes end-to-end / browser (Playwright).
- CI (GitHub Actions) — pode vir logo depois, mas não nesta versão.
- Cobertura mínima obrigatória (%). Foco em cobrir o que já existe, não em métrica.
