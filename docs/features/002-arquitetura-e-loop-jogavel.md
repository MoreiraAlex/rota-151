# 🚀 Versão 0.0.2 — Consolidação da Arquitetura e Primeiro Loop Jogável

O objetivo desta versão é pagar a dívida técnica identificada na revisão de regras
(`docs/rules/README.md`) e estabelecer o primeiro ciclo de gameplay real:
**Input → Movimentação → Câmera**.

O "personagem" ainda é o cubo placeholder. Nenhuma mecânica de jogo (batalha,
captura, mundo) entra aqui. Assets 3D continuam adiados.

> Versionamento e nome do arquivo: ver `docs/development-workflow.md`.

---

## Objetivos

- Eliminar violações de fronteira de camada (`core/` importando `view/`).
- Tirar o `useFrame` do `core/` — ele pertence à view.
- Padronizar a assinatura de todos os systems para `system(context)`.
- Tornar o game loop robusto contra "spiral of death".
- Centralizar as constantes ajustáveis.
- Implementar captura de input de teclado como adapter de plataforma.
- Implementar movimentação da entidade via ECS.
- Implementar câmera em terceira pessoa como system de presentation.

---

## Etapas

### 1. Consolidação da Arquitetura

- [X] Mover `SyncTransformSystem` de `core/` para `view/systems/syncTransformSystem.js`
- [X] Mover `GameLoop` de `core/app/` para `view/loop/GameLoop.jsx`
- [X] Mover o registro de systems (`bootstrap.js`) para `view/loop/registerSystems.js`
- [X] Padronizar systems para `system(context)` com `context = { world, delta, ... }`
- [X] Adicionar clamp no acumulador do loop (`MAX_FRAME_TIME`, `MAX_STEPS_PER_FRAME`)
- [X] Converter o trait `Rotation` para radianos
- [X] Renomear arquivos de módulo para camelCase (`transform.js`, `syncTransformSystem.js`)
- [X] Remover `test-system.js` (no-op)
- [X] Criar barrel `core/traits/index.js`

### 2. Configuração Central

- [X] Criar `src/core/gameConfig.js` com `GAME_CONFIG` agrupado por domínio
- [X] `LOOP`, `WORLD`, `PLAYER`, `CAMERA`
- [X] Zero número mágico em systems e componentes

### 3. Input

- [X] Criar adapter `src/platform/input/keyboardInput.js` (único ponto com DOM)
- [X] Suporte a WASD e setas
- [X] Zerar teclas ao perder foco da janela (`blur`)
- [X] Criar traits `InputState` e `InputControlled`
- [X] Criar `inputSystem` (headless — lê `context.input`, escreve `InputState`)
- [X] Registrar `inputSystem` na fase `input`

### 4. Movimentação

- [X] Criar trait `Velocity`
- [X] Renomear `cubeEntity` → `playerEntity`, compor com os novos traits
- [X] Criar `movementSystem` (headless) — `InputState` → `Velocity` → `Position`
- [X] Girar a entidade suavemente na direção do movimento
- [X] Registrar `movementSystem` na fase `simulation`

### 5. Câmera

- [X] Criar `cameraFollowSystem` em `view/systems/`
- [X] Acompanhar `playerEntity` com deslocamento fixo e suavização
- [X] Registrar na fase `presentation`, depois do `syncTransformSystem`
- [X] `GameLoop` passa a câmera default (`useThree`) no contexto de render

### 6. Cena

- [X] Renomear `CubeView` → `PlayerView`
- [X] Adicionar plano de chão + grade de referência
- [X] Adicionar luz ambiente e direcional
- [X] Atualizar import do `GameLoop` em `src/app/(auth)/page.js`

---

## Critérios de Conclusão

A versão será considerada concluída quando:

- `core/` não importar `view/`, R3F, `three` ou APIs de DOM.
- `useFrame` existir em um único arquivo (`src/view/loop/GameLoop.jsx`).
- Todos os systems seguirem a assinatura `system(context)`.
- O game loop tiver clamp de tempo funcionando (alternar de aba não causa salto).
- O cubo se mover com WASD / setas e parar ao soltar as teclas.
- O cubo girar para a direção do movimento.
- A câmera seguir o cubo com suavização, mantendo o offset configurado.
- Alterar `GAME_CONFIG` mudar o comportamento sem tocar em nenhum system.
- `npm run build` e `npm run lint` passarem.
