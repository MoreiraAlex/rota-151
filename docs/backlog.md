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
- [X] **Frenagem no fim do dash** — entregue em
      `docs/features/032-animacoes-embutidas-e-keyframes.md` (v0.0.32): nos
      últimos `DASH.EASE_OUT_TIME` segundos a velocidade desce suave até a
      de saída (0 / andar / correr, pelo input) — `resolveDashSpeed`,
      `playerActionSystem.js`. Corrigiu junto o tick parado (velocidade 0)
      no fim do dash. Fica pendente o giro no fim: o `movementSystem` volta
      a virar pro input com `turnSpeed` no mesmo tick (ver "Sensação de
      movimento" acima).
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
      não existe — desenhar quando for a vez. (O desmaio das CRIATURAS —
      selvagens e do time — saiu na `docs/features/031-ia-de-combate-e-
      desmaio.md`; o treinador a 0 de HP continua sem estado nenhum.)
- [X] **Ataque comum de criatura** — entregue em
      `docs/features/025-ataque-comum-de-criatura.md` (v0.0.25): botão
      esquerdo do mouse controlando uma `SummonedCreature` dispara a ação
      `'attack'` (`creatureAttackSystem.js`, mesmo mecanismo de
      `ActionState` de dash/arremesso/summon/recall), com efeito visual
      genérico de partículas (`AttackEffect`) e visualização de debug do
      alcance/área efetiva (`AttackRangeDebugView.jsx`, F2). Config
      (`actions.attack`) por espécie, mesmo padrão de `actions.throw`/
      `.consume` do treinador — hoje com valores idênticos em toda
      espécie, já preparado pra divergir de verdade quando golpes próprios
      existirem. Sem animação específica por criatura ainda (arquitetura
      pronta pra receber `clips.attack` quando existir — trabalho em
      paralelo). Q/E/R continuam reservados, sem comportamento. Dano e
      detecção de acerto entregues depois, em
      `docs/features/030-sistema-de-dano-de-ataques.md` (v0.0.30).

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

## Combate

- [ ] **Consertar os 60 testes que já falham** — falhas antigas (espécies
      removidas/trocadas, câmera, itens, dados ajustados — lista nos Gates de
      `docs/features/033-skills-de-combate-e-vfx.md`). Além do ruído, são a
      maior parte da saída do `npm test` (~47 KB por execução, contra ~2 KB
      com a suíte verde).
- [ ] **Círculo do corpo dos alvos** (em espera) — o acerto soma o raio do
      ataque ao raio da CÁPSULA do alvo, mas nada mostra esse tamanho; o LoL
      desenha o círculo de seleção de cada unidade no chão, e é por ele que
      se julga "encosta ou não". Ideia: círculo discreto nos pés de cada
      criatura (ou só dos inimigos em combate), com `capsuleRadius`. Saiu da
      revisão de precisão dos ataques (docs/features/033-skills-de-combate-
      e-vfx.md, Parte 1).
- [ ] **Regra de altura visível** — quem está no ar/em outro plano não é
      acertado (`isWithinCombatHeight`), sem pista visual nenhuma.

## Criaturas

- [X] **Criaturas selvagens no mundo** — entregue em
      `docs/features/020-fox-selvagens-cena-e-texturas.md`: `WildCreature`/
      `wildWanderSystem` (vagar com pathfind, sem interação com o jogador
      ainda).
- [ ] **Bando** — selvagens da mesma espécie por perto entram juntas na luta
      quando uma delas briga. Saiu da `docs/features/034-ia-de-batalha.md`
      (era a Parte 4, adiada pelo usuário).

## Animação

- [X] **Clipe por keyframes gravados (além de curva procedural)** —
      entregue em `docs/features/032-animacoes-embutidas-e-keyframes.md` (v0.0.32):
      `type: "keyframes"` no clipe escolhe um caminho de amostragem novo
      (interpola entre frames gravados — slerp/lerp), convivendo com o
      procedural de sempre (escolha por clipe inteiro, `entry.clips[id]`
      pode ser de qualquer um dos dois por estado).
- [X] **Animações embutidas no `.glb`** — entregue no mesmo doc (v0.0.32):
      `species.nativeAnimations` tocadas pelo `THREE.AnimationMixer`
      (sequências start/loop/end, lista `sequence`, corte por frames,
      `blend` por estado, encaixe na duração da ação), estados
      `battleIdle`/`appeal`/`jump`, piscar por animação.
