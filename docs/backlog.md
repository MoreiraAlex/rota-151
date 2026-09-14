# 🧭 Backlog de Features

Lugar pra depositar ideias de feature antes de virarem
`docs/features/NNN-slug.md`. Sem ordem de prioridade fixa, sem compromisso de
que vai virar feature de verdade — serve pra não perder ideia solta, e pra
destrinchar melhor cada uma (contexto, decisões, etapas) quando chegar a hora
de puxar ela pra frente.

> O formato de feature de fato — com contexto, decisões, etapas e critérios
> de conclusão — fica em `docs/features/`; aqui é só a ideia crua. Ver
> `docs/development-workflow.md` pra convenção de branch/versão/nome de
> arquivo quando uma ideia daqui virar feature.

---

## Como usar

- Adicione uma ideia como um item novo, com um título curto e 1–2 frases de
  contexto. Não precisa estar madura nem ter etapas — isso vem depois.
- Quando uma ideia for escolhida pra virar feature, ela sai daqui (ou fica
  marcada) e vira `docs/features/NNN-slug.md`.
- Uma ideia pode ficar aqui indefinidamente sem nunca ser puxada — normal.

---

## Jogador

- [ ] **Animação de pulo/queda** — `AnimationState` hoje só resolve
      idle/walk/run; pular ou cair de uma borda usa o clipe de chão errado
      até repousar de novo.
- [ ] **Sensação de movimento** — aceleração/frenagem suave em vez de
      velocidade binária (anda ou não anda na velocidade cheia); coyote time
      pro pulo (janela curta pra pular logo após sair da borda).
- [ ] **Câmera orbital com colisão** — raycast entre o alvo e a câmera pra
      aproximar a distância quando bate em parede/obstáculo, em vez de
      atravessar.
- [ ] **HUD real (não-debug)** — camada de UI sempre ligada pro jogador,
      separada do `DebugPanel` (que é ferramenta interna, atrás do toggle).
- [ ] **Persistência do jogador** — salvar/restaurar posição (e depois outros
      dados) via Prisma, reaproveitando o Better Auth já no projeto (redirect
      ainda comentado em `(auth)/layout.js`).
- [ ] **Inventario** — Inventario.

## Ações do jogador (mecanismo compartilhado)

- [X] **Sistema de ações do jogador** — entregue em
      `docs/features/007-sistema-de-acoes-do-jogador.md` (v0.0.7): trait
      `ActionState` (`{ current, elapsed, dirX, dirZ }`) + `playerActionSystem`
      (headless), config por ação em `gameConfig.PLAYER_ACTIONS`, gatilho de
      input por borda (`keyboardInput.js` drena "apertou agora", mesmo padrão
      do `pointerInput.js`) e prioridade na tabela de `animationStates.js`.
      Validado com dash; arremesso/uso/invocar/recolher/morrer encaixam no
      mesmo mecanismo quando forem a vez.
- [X] **Dash/rolamento** — entregue junto do sistema de ações acima (v0.0.7):
      tecla `Ctrl`, só a partir do chão, direção travada na `Rotation.y` do
      instante do disparo, velocidade maior que a corrida por uma duração
      curta. Sem cooldown, sem dash aéreo, sem i-frames — fica pra depois se
      fizer falta. Clipe de animação (`species/fox/clips/dash.json`) por
      conta do usuário.
- [X] **Slots de ação** — entregue em
      `docs/features/011-slots-de-acao.md` (v0.0.11): 4 botões predefinidos
      (`primary` = clique esquerdo, só com o ponteiro travado;
      `secondary1/2/3` = `1`/`2`/`3`), `kind` na espécie (`'trainer'` |
      `'pokemon'`, fallback `'trainer'`) e `resolveActionSlots(kind)`
      documentando o que cada botão vai significar — pro treinador,
      `primary` = usar item em mãos, `secondaryN` = soltar/recolher o
      Pokémon do time. Nenhum system atua nesses botões ainda; os itens
      abaixo fazem isso quando forem a vez.
- [X] **Mecanismo de item** — entregue em
      `docs/features/012-mecanismo-de-item.md` (v0.0.12): registro de itens
      (`core/data/items/`, mesma forma pasta-por-entrada de `species/`),
      categorias `'throwable'`/`'consumable'` (sem `'weapon'` — não existe
      ataque direto no design), trait `HeldItem` no jogador e seletor no
      `DebugPanel` pra equipar item de teste. Puro mecanismo — `primary`
      continua sem comportamento de verdade, só o log de debug da v0.0.11.
- [ ] **Arremessar objeto** — atua no botão `primary` (predefinido em
      "Slots de ação" acima) lendo `HeldItem`/`getItem` (mecanismo pronto
      acima) quando a categoria é `throwable`; ação com um "instante de
      liberação" no meio da duração (ex.: spawna o projétil em t=0.4 de
      uma ação de 0.6s) — o instante fica na config da ação, não em
      keyframe de clipe. Depende do sistema de ações da v0.0.7.
- [ ] **Usar objeto** — mesma forma que arremesso, também no `primary`,
      quando a categoria é `consumable` (cura). Depende do sistema de
      ações da v0.0.7.
- [ ] **Invocar criatura** — atua num dos botões `secondaryN` (predefinidos
      em "Slots de ação" acima); ação que spawna a entidade da criatura no
      mundo; bloqueado até criaturas existirem (ver seção "Criaturas"
      abaixo).
- [ ] **Recolher criatura** — inverso da invocação; mesma dependência.
- [ ] **Morrer** — estado terminal, não uma ação com fim automático; trava
      input e provavelmente dispara um fluxo de respawn/checkpoint que ainda
      não existe — desenhar quando for a vez.

## Dados por espécie

- [X] **Colisão e movimento por espécie** — entregue em
      `docs/features/008-colisao-e-movimento-por-especie.md` (v0.0.8):
      `gameConfig.PLAYER` e `CAPSULE_RADIUS`/`CAPSULE_HALF_HEIGHT`/
      `JUMP_SPEED` de `PHYSICS.CHARACTER` migraram pra `body`/`movement` de
      cada `core/data/species/<id>/index.js`, copiados nos traits
      `CharacterController`/`MovementStats` no spawn — `movementSystem` e a
      criação do collider leem dado por entidade, não config global.
      Parâmetros do character controller (rampa/degrau) e `GROUNDED_STICK`
      continuam globais — não são atributo de criatura.

## Criaturas

- [ ] **Criaturas selvagens no mundo** — entidades não-jogáveis usando o
      mesmo `core/data/species` + motor de animação procedural que o jogador
      usa, com IA simples (parada/vagando). Adiado até o jogador estar
      redondo.
