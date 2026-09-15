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
- [X] **Câmera orbital com colisão** — entregue em
      `docs/features/016-mira-e-arremesso.md` ("Colisão da câmera"):
      raycast do alvo até a câmera (`cameraFollowSystem.js`), aproxima a
      distância quando bate em parede/obstáculo, em vez de atravessar.
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
- [X] **Criaturas de time (placeholder)** — entregue em
      `docs/features/013-criaturas-de-time.md` (v0.0.13): 3 espécies
      `kind: 'pokemon'` (`fox-red`/`fox-green`/`fox-blue`, clones de `fox`,
      sem tint de cor ainda), trait `Party` (`slot1/2/3`, id de espécie por
      slot) no jogador e 3 seletores no `DebugPanel` pra montar o time.
      Puro mecanismo — `secondaryN` continua sem comportamento de verdade,
      só o log de debug da v0.0.11. Não é "Criaturas selvagens no mundo"
      (IA/spawn automático), que continua adiado como item separado abaixo.
- [X] **Arremessar objeto** — entregue em
      `docs/features/014-arremessar-usar-e-invocar.md` (v0.0.14): `primary`
      com item `throwable` equipado dispara a ação `'throw'`
      (`playerActionSystem`), trava direção na `Rotation.y` do disparo,
      spawna um `Projectile` no instante de liberação
      (`PLAYER_ACTIONS.throw.EFFECT_AT`) e limpa `HeldItem`.
      `projectileSystem` integra posição/gravidade e destrói ao `lifetime`
      zerar — sem colisão ainda. Validado no `DebugPanel` (contagem/posição
      dos projéteis ativos), sem renderização 3D.
- [X] **Usar objeto** — entregue junto da acima (v0.0.14): `primary` com
      item `consumable` equipado dispara `'consume'`, aplica `applyHeal`
      (novo, simétrico a `applyDamage`) com `item.consumable.healAmount` no
      instante de efeito, limpa `HeldItem`. Cura visível na barra de HP já
      existente.
- [X] **Invocar criatura** — entregue junto das acima (v0.0.14):
      `partySummonSystem` (novo, fora do `playerActionSystem` — não é uma
      ação com duração do próprio corpo do treinador) lê `Party[slotN]` no
      `secondaryN` e spawna uma `SummonedCreature` perto do treinador;
      `creatureFollowSystem` (novo) faz ela seguir o treinador (decidido na
      v0.0.13), parando a `PARTY.FOLLOW_MIN_DISTANCE`. Validado no
      `DebugPanel`, sem renderização 3D — isso é feature futura (precisa de
      infraestrutura de montagem/desmontagem dinâmica de modelo que ainda
      não existe).
- [X] **Recolher criatura** — inverso da invocação, mesmo system acima:
      apertar de novo o `secondaryN` de um slot já invocado destrói a
      `SummonedCreature` daquele slot.
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

## Animação

- [ ] **Clipe por keyframes gravados (além de curva procedural)** —
      `applyAnimationClip.js` hoje só entende curva procedural por eixo
      (`sine`/`constant`/`clampedSine`/`absSine`, ver `core/animation/
      curves.js`); um clipe gravado/exportado de outra ferramenta (ex.:
      `bot/clips/throw1.json`, 40 frames, `quaternion`/`position` por osso
      como array de valores brutos, `type: "keyframes"`) não é reconhecido
      — nenhum osso sem correspondente na curva procedural recebe override,
      então o personagem cai pra pose de descanso (T-pose) inteira durante
      o clipe. Precisa de um caminho de aplicação novo, convivendo com o
      procedural (não substituindo): interpolar entre os frames gravados
      pelo tempo decorrido — slerp pra rotação (quaternion), lerp pra
      posição — em vez de avaliar uma fórmula. Acertar o mapeamento
      tempo→frame (fps/duração real do clipe) é parte do trabalho.
