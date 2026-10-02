# 033 — Skills de combate e VFX

Versão **0.0.33**. Consolida, numa feature só, sete rodadas de trabalho que
estavam em docs separados (033 a 039) e nunca tinham sido commitadas: o
redesenho dos ataques das criaturas em básico + habilidades, as skills de status
(com precisão, golpe em si mesmo, interrupção e carga) e os efeitos visuais em
partículas traduzidos do Cobblemon (golpes, dash, pulo, carga) —, mais o que veio
depois do commit da 0.0.33: uma correção de colisão (Parte 8), o Leech Seed
(Parte 9) e o Water Gun (Parte 10).

## Resumo

| Parte | O que entrega |
|---|---|
| 1 — Ataque básico e habilidades | 4 ataques por criatura (1 básico próprio da espécie + 3 habilidades compartilhadas), animação por ataque, aviso de golpe no chão, anel de tempo da ação, cooldown no fim da ação, ataque canalizado (segurar o botão), forma desenhada = forma calculada, hit stop, mira por habilidade e direcionar durante o aviso |
| 2 — VFX de golpe por partículas | Motor de partículas (Bedrock "Snowstorm" traduzido à mão) e os efeitos de Brasa, Lança-chamas, Tackle, Scratch e Impact por tipo, com os sons do Cobblemon (impacto por tipo, atacante + alvo) |
| 3 — VFX de dash | Linhas de velocidade e poeira; o motor ganha quadro que acompanha quem se move, emissor contínuo e partícula esticada na direção do movimento |
| 4 — Skills de status (Growl) | `damage` × `effects`, estágios de atributo (-6 a +6), cone que atinge todos, texto/brilho/etiqueta por lado e tipo, ondas sonoras |
| 5 — Precisão e Smokescreen | Sorteio de precisão do Pokémon, estágio de precisão, "Errou!", fumaça no cone e no alvo |
| 6 — VFX de pulo | Poeira na decolagem e na aterrissagem |
| 7 — Skills do Bulbasaur | Growth (`area: 'self'`), interrupção de golpe de status por dano (com atordoamento), carga com visual e som, botão segurado na carga |
| 8 — Correção: presos no oponente | Personagens colados no combate não ficam mais presos: movimento em duas passadas (contorna um defeito do character controller do Rapier) e giro conferido antes de aplicar |
| 9 — Leech Seed | Primeiro golpe que age ao longo do tempo: a semente drena uma fração do HP do alvo a cada intervalo e cura quem plantou; sementes em arco, brotos e orbes indo do alvo até quem plantou |
| 10 — Water Gun | Jato de água do Squirtle canalizado em feixe: segura pra manter, pega só o primeiro corpo e dá pra mirar durante o canal (modo `area: 'line'`, genérico) |
| 11 — Divisão do `creatureAttackSystem` | O arquivo de ~1.640 linhas virou o system (só as 5 passadas) + 7 módulos em `core/battle/`, sem mudar comportamento |
| 12 — Tail Whip | Skill de status do Squirtle (baixa a Defesa no cone), com varridas e brilhos na cauda e o som do Cobblemon durando a ação inteira (`visual.actionGroup`/`audio.actionGroup`); o `positionOffset` passa a valer no jato do Water Gun |

Todos os números de balanceamento são valores de PARTIDA (ou já ajustados pelo
usuário) e nada visual foi conferido em navegador pelo assistente — cada parte
lista o que falta olhar em jogo.

## Estado final das espécies

Configuração dos slots no fechamento desta versão (conteúdo do usuário; as
partes contam a história de como cada peça entrou):

| Espécie | Q (`skills[1]`) | E (`skills[2]`) | R (`skills[3]`) |
|---|---|---|---|
| Bulbasaur | `leech-seed` (o `growth` comentado) | `tackle` (overrides) | `vine-whip` (overrides) |
| Charmander | `growl` | `tackle` (overrides) | `ember` |
| Squirtle | `tackle` (overrides) | `water-gun` (overrides) | `tail-whip` |
| Fox, Wolf | — | — | — |

O `vine-whip` foi configurado pelo usuário pro visual e o som de impacto por
tipo (`effectGroup: 'impact'`, `impactType: 'grass'`, `audio.group: 'impact'`).
O Bulbasaur, o Charmander e o Squirtle mapeiam `roar` e `hit` em
`nativeAnimations`; o Bulbasaur também `charge` (`{ loop: 'charge' }`).

---

## Parte 1 — Ataque básico e habilidades

### Resumo

Primeira parte do foco nos ataques das criaturas. Decisões do usuário,
revisadas antes de implementar:

- Cada criatura tem **4 ataques**, um por botão: **1 básico** (mouse,
  slot `primary`) e **3 habilidades** (Q/E/R, slots `secondary1-3`).
- O **básico é único de cada espécie**. Antes ele apontava para uma
  habilidade do registro (`tackle`, `punch`, `vine-whip`) — descartado.
- As **habilidades são compartilhadas** entre espécies (registro único,
  com override por espécie).
- `tackle`, `punch` e `vine-whip` continuam existindo como habilidades
  (o usuário vai revisar o conteúdo delas depois).
- Cada ataque diz **qual animação toca**, com `attack` como padrão.
- IA (time e selvagens) continua usando **só o básico**.

### Estrutura

| O quê | Onde | Forma |
|---|---|---|
| Básico | `core/data/species/<id>/basicAttack.js` → `species.basicAttack` | Definição completa (mesmo formato de uma skill), id `<espécie>-basic`. Não entra no registro. |
| Habilidades | `core/data/skills/<id>/index.js` → `species.skills` | Chave = número da habilidade (`1` = Q, `2` = E, `3` = R — slots `secondary1-3`), valor = referência por id ou `{ id, overrides }`. |

- **`core/data/attacks` virou `core/data/skills`**, com os nomes do
  registro acompanhando: `SKILL_REGISTRY`, `getSkill`, `listSkills`,
  `resolveSkill` (antes `ATTACK_REGISTRY`, `getAttack`, `listAttacks`,
  `resolveCreatureAttack`) e as constantes (`EMBER_SKILL`...).
- **`resolveCreatureAttack(species, slot)`** (novo,
  `core/battle/creatureAttack.js`) é o ponto único que responde "qual
  ataque este slot dispara": `primary` → `species.basicAttack`;
  `secondaryN` → `resolveSkill(species.skills[N])`. Todos os
  leitores passaram a usá-lo: `creatureAttackSystem`, `combatTargets`
  (alcance da IA), `attackSound`, `AttackIndicatorView`, `ActionSlotHud`,
  `SkillsHud`.
- **Básicos criados com os mesmos números que cada espécie resolvia
  antes** (base + overrides) — nada muda em jogo; o conteúdo fica pro
  usuário ajustar:

  | espécie | vinha de | `basicAttack` |
  |---|---|---|
  | bulbasaur | `vine-whip` + overrides | range 1, duration 0.8, effectAt 0.4, `confirm`, visual `vine-whip` |
  | charmander | `tackle` + overrides | range 1, duration 0.8, effectAt 0.3, rotationOffset z -15 |
  | squirtle | `tackle` + overrides | range 1, duration 0.8, effectAt 0.6, animationFrames 30 |
  | fox, wolf | `tackle` | valores do `tackle` base |

  Visual, som e sprite dos básicos reaproveitam os assets de `tackle`/
  `vine-whip` — são da view, compartilháveis; o ataque em si é da espécie.
- **Habilidades** (formato numérico, definido pelo usuário no bulbasaur e
  aplicado às outras — a configuração de então; a atual está em "Estado final
  das espécies"): bulbasaur `1: vine-whip`, `2: razor-leaf` (com
  overrides); charmander `1: ember`; squirtle `1: whirlpool`; fox e wolf
  sem nenhuma.

  ```js
  skills: {
    1: 'ember',                                              // Q
    2: { id: 'razor-leaf', overrides: { range: 4 } },         // E
  },
  ```

### Duração do básico × `speed`

`resolvePrimaryDurationOverride` (`creatureAttackSystem.js`) passou a
escalar direto o `duration` **e o `effectAt`** do `basicAttack` pelo fator
de `speed` (`calculateAttackDurationFactor`, da feature 032). Some a regra "40% da
duração quando o override não traz `effectAt`": o básico sempre declara o
seu. Skills continuam sem escala por `speed`.

### Animação por ataque

- `animation.clipKey` da definição (antes só documentado, sempre
  `'attack'`) agora vale: `creatureAttackSystem` grava
  `ActionState.animationKey` no disparo (e volta a `null` no fim, junto de
  `animationFrames`).
- `animationSystem.js` (`resolveClipId`) toca essa chave no lugar da
  animação do estado `attack` quando a espécie a tiver em
  `nativeAnimations`/`clips`; senão, `attack`. Ex.: uma skill à distância
  com `clipKey: 'attackRanged'` + `nativeAnimations.attackRanged:
  'attackRanged'` na espécie.
- Nenhuma skill foi trocada pra outra chave ainda (conteúdo do usuário).

### Aviso de golpe (telegraph)

Pedido do usuário: o mesmo leque do indicador de mira (o "smartCast" que
aparece no `castMode: 'confirm'`), mas **durante a execução** de todo
ataque — básico e habilidade, do time e das selvagens —, se preenchendo
até o golpe, pra mostrar área e alvo e permitir esquiva. Sempre ligado,
sem parâmetro por ataque. O indicador de mira do `confirm` continua igual.

- `view/scene/AttackTelegraphView.jsx` (novo): um leque por criatura com
  `ActionState.current === 'attack'`; contorno com a área inteira e
  preenchimento crescendo do ápice até a borda. Direção TRAVADA no
  disparo (`ActionState.dirX/dirZ`), mesma trajetória do golpe (para em
  parede, acompanha rampa). Pool fixo de `POOL_SIZE` leques.
- `core/battle/attackTelegraph.js` (novo, puro):
  `resolveAttackTelegraphProgress(action, attack)` — 0 → 1 até o
  instante do DANO (`effectAt`, na duração real da ação — o básico é
  escalado pelo `speed`), `null` depois (o leque some e o VFX assume).
  Decisão: completar no dano, não no fim da `duration` — senão o golpe
  acertaria com o leque pela metade (40% no básico) e o aviso não
  serviria pra esquiva.
- `view/scene/attackFan.js` (novo): geometria + `placeAttackFan`,
  extraídos do `AttackIndicatorView` e usados pelos dois.
- Config: `GAME_CONFIG.FEEDBACK.ATTACK_TELEGRAPH` (cores laranja,
  opacidades, `POOL_SIZE: 16`); altura compartilhada com o indicador de
  mira. Diferente do indicador, respeita profundidade — corpos e
  obstáculos tampam o leque (pedido do usuário).

### Anel de tempo da ação (estilo stamina do Valheim)

Pedido do usuário: uma barra circular em volta do personagem, só durante
uma ação de ataque, marcando o tempo (`duration`) da ação.

- `view/scene/ActionTimerRingView.jsx` (novo): anel deitado no chão em
  volta da criatura CONTROLADA (`InputControlled`), só enquanto ela
  executa um ataque (básico ou habilidade). Começa cheio e **esvazia** até
  o fim da `duration` real — lê como "tempo até ficar livre de novo". O
  arco restante fica centrado nas COSTAS da criatura (o anel gira com
  `Rotation.y`) e encolhe pelos dois lados, da frente pra trás — o último
  pedaço some atrás dela. Respeita profundidade (diferente dos leques):
  corpo e obstáculos tampam o anel. Raio = `capsuleRadius + PADDING`. Fundo inteiro + preenchimento cortado por
  `setDrawRange` (sem recriar geometria por frame; as duas só são
  recriadas quando o raio muda, e descartadas pelo componente).
- `core/battle/actionTimer.js` (novo, puro): `resolveAttackTimeRemaining`
  — 1 → 0 pela duração real (`1 / animationSpeed`, já com o `speed` no
  básico), `null` fora de ataque.
- Config: `GAME_CONFIG.FEEDBACK.ACTION_TIMER_RING` (cor, fundo,
  `PADDING`, `THICKNESS`, `SEGMENTS`).
- Diferença pro aviso de golpe: o aviso mede até o DANO (pra esquiva do
  alvo); o anel mede a ação inteira (pra quem ataca saber quando volta a
  agir).

### Cooldown começa no fim da ação

Bug relatado: o `ember` do charmander era praticamente infinito — o
cooldown (`AttackCooldowns.<slot>`) era travado no DISPARO e descontado
todo tick, inclusive durante a própria ação; com `duration` >= `cooldown`,
a skill saía da ação já pronta de novo. Agora, pra todo ataque (básico e
habilidade, time e selvagens), `creatureAttackSystem` trava o cooldown do
slot só quando a ação termina (fim da `duration`). Durante a ação o slot
já não dispara (ação em andamento), então nada muda antes disso.

### Ataque canalizado (`damageMode: 'channel'`)

Pedido do usuário, pra `ember` e `razor-leaf`: em vez de um impacto único
no fim da trajetória, dano em TODA a área do cone, repetido (intervalo
ainda a definir); e não é "aperta e solta" — precisa segurar o botão até
o fim, soltar cancela.

- **Definição:** `damageMode: 'channel'` + `damageInterval` (s). Ausente =
  impacto único de sempre. `ember` e `razor-leaf` marcados, com
  `damageInterval: 0.25` de partida.
- **Dano** (`core/battle/channelAttack.js` + `creatureAttackSystem`): o 1º
  tick sai no `effectAt`, depois a cada `damageInterval`, até o fim da
  `duration` (`countChannelTicks` — não depende do passo do loop). Cada
  tick acerta TODOS os alvos dentro do cone (`resolveConeTargets` +
  `isInsideAttackCone` em `attackGeometry.js`: mesmo leque do indicador,
  largura crescendo do ápice até `radius` na ponta, encurtado por parede),
  com os mesmos filtros do golpe normal (lado, HP, desmaio, plano 2.5D).
  Cada acerto emite `attackResolved`; tick sem alvo não emite nada.
- **Dano repartido** (opção C, escolhida pelo usuário): o canal INTEIRO
  vale o dano de UM golpe — segurar até o fim com o alvo no cone dá
  exatamente esse total, não o dano cheio a cada tick.
  - Orçamento por alvo = dano do golpe com o fator aleatório MÉDIO
    (`(DAMAGE_RANDOM_MIN + DAMAGE_RANDOM_MAX) / 2`) e sem crítico — o que
    um golpe único renderia em média (`resolveChannelTickDamage`,
    `calculateDamage.js`).
  - No disparo, `rollChannelWeights` sorteia uma fração por tick (mesmo
    sorteio de 85%-100% de um golpe, normalizado pra somar 1) — guardadas
    em `ActionState.channelWeights`/`channelTick`. Os ticks variam entre
    si; todos os alvos do mesmo instante levam a mesma fração (cada um
    sobre o próprio orçamento, com a própria defesa).
  - Crítico sorteado POR TICK: o tick crítico vale o dobro da sua fração
    (bônus por cima do orçamento).
  - Soltar antes, ou o alvo sair do cone, perde os ticks que não
    aconteceram.
- **Segurar:** input ganhou estado contínuo — `primaryHeld` (clique
  esquerdo, `pointerInput.js`) e `secondary1Held`–`secondary3Held` (Q/E/R,
  `keyboardInput.js`); os de Q/E/R são bloqueados no modo Scan como os
  pulsos. Soltar o botão do slot (Q/E/R também aceitam o clique segurado,
  já que o `confirm` confirma com clique) encerra a ação na hora pelo
  mesmo `finishAttack` do fim normal — o cooldown começa. Stamina não é
  devolvida. IA nunca cancela. (Na Parte 7, o golpe em si mesmo passou a
  exigir o botão segurado também, só durante a carga.)
- **Aviso laranja:** igual aos outros ataques — enche até o 1º dano e
  some (o usuário preferiu assim a manter o leque cheio durante o canal).
- Decisões tomadas sem pedido explícito (ajustáveis): direção travada no
  disparo (não dá pra "mirar" durante o canal); cancelar inicia o
  cooldown; VFX e som continuam só no 1º tick (pendente: visual contínuo
  pro canal).

### Precisão dos ataques (revisão)

Pergunta do usuário: "por que não sinto precisão, como no LoL?". O jogo
MOSTRAVA uma coisa e CALCULAVA outra em três pontos; decisões do usuário
em cada um:

1. **Forma desenhada = forma calculada** (`view/scene/AttackShape.jsx`,
   substitui `attackFan.js`): golpe normal agora desenha a CÁPSULA que
   `resolveAttackTarget` mede (retângulo de largura `2 * radius` da origem
   até onde a trajetória para, com pontas arredondadas — antes desenhava
   um leque, que é mais estreito perto do corpo e não mostra a ponta
   arredondada); canalizado continua com o LEQUE, agora em "cone de
   sorvete" — triângulo com a abertura do ataque + MEIA-LUA na ponta, com
   diâmetro igual à largura ali, encaixada pra ponta cair exatamente no
   `range` (`resolveRoundedCone`, `attackGeometry.js`). A ponta fica
   arredondada mesmo em leque estreito (um setor de círculo, tentado
   antes, parecia reto no razor-leaf: arco de raio 4m numa abertura de
   ~6°). O dano (`isInsideAttackCone`) usa a mesma forma; o desenho é
   construído da mesma função. A trajetória do canal só encurta em estrutura/
   terreno, nunca em criatura (`resolveAttackImpactPoint(..., {
   terrainOnly: true })`): o ember pega todo mundo dentro do leque,
   inclusive quem está atrás de outro. O golpe normal continua parando no
   primeiro corpo. Vale pro indicador de
   mira e pro aviso laranja (`placeAttackShape`, preenchimento da origem
   pra ponta).
2. **Assistência de mira no corpo a corpo** — mantida; o usuário controla
   por `GAME_CONFIG.BATTLE.MELEE_AIM_HALF_ANGLE`.
3. **VFX no ponto de contato**: golpe normal que acerta alguém no meio do
   caminho faz o efeito nascer no `contactPoint` do alvo (antes, sempre
   no fim da trajetória, "atrás" do alvo); errando, continua no fim.
4. **Círculo do corpo dos alvos** — em espera (backlog, "Combate").
5. **Peso do acerto**:
   - Hit stop (`view/systems/hitStopSystem.js` + `hitStopRegistry.js`):
     no acerto, a ANIMAÇÃO do atacante e do alvo congela
     `FEEDBACK.HIT_STOP.DURATION` (0.07s; 0.12s no crítico) —
     `animationSystem` multiplica o delta da entidade por
     `resolveHitStopScale`. Só visual: a simulação segue (a animação fica
     esses centésimos atrás da ação). Ticks de canal não disparam
     (`attackResolved.channel`, campo novo no evento).
   - Som de acerto × erro: feito e depois REMOVIDO a pedido do usuário
     (bastam os outros efeitos) — `attackAudioSystem` voltou ao som único
     no instante do golpe.

### Mira: assistência só no básico, e direcionar durante o aviso

Pedido do usuário: o assistente de mira só entra no **ataque básico**; as
demais habilidades saem pra onde a câmera olha; e, como melhoria, poder
**direcionar o golpe enquanto o aviso vermelho carrega**, antes de ele
acontecer de fato.

- **Assistência só no básico.** `resolveAttackDirection` ganhou o parâmetro
  `slot` (`core/battle/attackAim.js`): a assistência (puxar pro alvo dentro
  do cone de `MELEE_AIM_HALF_ANGLE`) só vale se `slot === 'primary'` **e**
  `attack.aim === 'melee'`. As habilidades (`secondary1-3`) saem sempre pra
  onde a câmera olha, mesmo com `aim: 'melee'` (ex.: `tackle` como
  habilidade). `tryStartAttack` e `AttackIndicatorView` passam o slot, então o
  indicador de mira (`castMode: 'confirm'`) e o golpe continuam iguais.
- **Direcionar durante o aviso.** Antes, a direção travava no disparo. Agora,
  da ação começar até o `effectAt`, a criatura **controlada** reaponta a cada
  tick pra onde a câmera olha (`ActionState.dirX/dirY/dirZ` e o corpo, `rot.y`);
  o aviso vermelho (`AttackTelegraphView`), que já lia `ActionState.dir*` a
  cada frame, acompanha sozinho. A direção trava no tick que cruza o
  `effectAt` — o instante do efeito e do dano —, e depois disso a câmera é
  livre.
  - Vale pra todo ataque da criatura controlada (básico — que mantém a
    assistência enquanto carrega — e habilidades, canalizadas inclusive: o
    canal só aponta durante a carga, depois fica na direção travada).
  - A IA (selvagens e time fora do controle) mira uma vez, no disparo.
  - `GAME_CONFIG.BATTLE.ATTACK_WINDUP_STEERING` (`true`) liga/desliga; `false`
    volta a travar no disparo.
- **Efeito colateral**: o corpo da criatura gira junto com a câmera durante a
  carga (era travado), porque encara sempre a direção do golpe.

### Testes

- `attackAim.test.js` — assistência só no básico (habilidade com `aim: 'melee'`
  não é puxada, segue a câmera). `creatureAttackSystem.test.js` — direcionar
  durante o aviso: gira a câmera na carga e direção/corpo/golpe acompanham,
  trava no `effectAt`, config desligada trava no disparo, só a criatura
  controlada é direcionada, o básico mantém a assistência.
- `creatureAttack.test.js` (novo) — básico por `primary`, skill com e sem
  override por `secondary`, slot/espécie vazios → `null`.
- `skills/index.test.js` — o registro, com os nomes novos.
- `creatureAttackSystem.test.js` — básico próprio respeitado de ponta a
  ponta, `duration` do básico como base do `speed`, `animationFrames` e
  `animationKey` gravados no disparo e limpos no fim, `attackId` do evento
  agora é o do básico (`bulbasaur-basic`).
- `animationSystem.test.js` — `animationKey` troca a animação do ataque e
  cai na `attack` quando a espécie não tem a chave.
- `partyBehaviorSystem.test.js`/`wildBehaviorSystem.test.js` — alcance do
  básico pelo resolvedor novo.
- `attackTelegraph.test.js` (novo) — progresso até o dano, some depois,
  acompanha a duração real (speed), casos nulos. O desenho em si
  (`AttackTelegraphView`) não tem teste automatizado — conferir em jogo.
- `creatureAttackSystem.test.js` — cooldown 0 durante a ação, inteiro no
  fim, slot travado até zerar e liberado depois (substitui o teste antigo
  "disparo trava o cooldown", que passava por acaso com cooldown 0);
  conferido falhando com a contagem no disparo.
- `channelAttack.test.js` (novo) — ticks no `effectAt` e a cada
  intervalo, total independente do passo, nada depois da `duration`.
- `attackGeometry.test.js` — `isInsideAttackCone` (eixo, abertura
  crescente, folga do alvo, cone encurtado, direção girada).
- `creatureAttackSystem.test.js` — canalizado: todos os alvos do cone
  levam dano a cada intervalo (4 ticks), fora do cone nada; soltar cancela
  (sem mais dano, ação livre, cooldown começa); ataque normal não cancela
  ao soltar; soma dos ticks = orçamento de um golpe, com ticks diferentes
  entre si (crítico desligado); crítico garantido → todo tick crítico e
  total = 2x o orçamento. Conferido falhando sem o cancelamento, sem o
  dano no cone, e com o dano cheio a cada tick.
- `channelAttack.test.js` — também `resolveChannelTickCount` e
  `rollChannelWeights` (frações diferentes que somam exatamente 1).
- `keyboardInput.test.js`/`pointerInput.test.js` — `secondaryNHeld` e
  `primaryHeld` duram até soltar; perder o foco solta.
- `AttackShape.test.js` (novo) — cápsula no golpe normal (largura,
  comprimento, tampas), leque no canalizado, preenchimento parcial com
  contorno inteiro, direção.
- `creatureAttackSystem.test.js` — VFX no contato quando acerta e no fim
  quando erra (conferido falhando com o VFX sempre no fim).
- `hitStopSystem.test.js` (novo) — acerto congela atacante e alvo, crítico
  mais longo, erro e tick de canal não congelam; `animationSystem.test.js`
  — relógio da animação parado durante o hit stop.
- `attackGeometry.test.js` — cone de sorvete: ponta no comprimento,
  borda redonda na meia-lua, leque estreito também arredondado, folga,
  cone encurtado. `AttackShape.test.js` — contorno desenhado = borda da
  área de dano (largo e estreito). `creatureAttackSystem.test.js` — com física, um
  corpo de criatura para a trajetória normal mas não a do canal
  (`terrainOnly`).
- `actionTimer.test.js` (novo) — cheio no disparo, esvazia pela duração
  real, limites, `null` fora de ataque. O anel desenhado
  (`ActionTimerRingView`) também não tem teste automatizado.

---

## Parte 2 — VFX de golpe por partículas (Brasa, Lança-chamas, Tackle, Scratch e Impact)

### Resumo

Primeiro VFX de golpe feito por **partículas** em vez de malha. A Brasa
(`ember`, skill do Charmander) era um cartão plano (`EffCommonHitFire`)
que só crescia no ponto de impacto — pouco pra um golpe canalizado à
distância (`range` 3, `effectVisualDuration` 2 s). Agora ela é uma nuvem de
fogo saindo da boca, brasas e faíscas viajando até o alvo e um estouro no
impacto.

Na sequência, o mesmo motor ganhou o **Lança-chamas** (`flamethrower`):
jato contínuo da boca, fogo e dois estouros no alvo e brasinhas subindo; e o
**Tackle** (grupo `'tackle'`, o ataque básico de Fox, Wolf, Charmander e
Squirtle): clarão e faíscas no impacto, no lugar da malha de arranhão.
Brasa e Tackle usam **só as partículas do Cobblemon**, sem malha. Os grupos
`'scratch'` (arranhão) e `'impact'` (impacto genérico por tipo) são novos,
também em partículas do Cobblemon.

Os números vêm do **Cobblemon** (`.exemple/Coblemon`, definições Bedrock
"Snowstorm" em `assets/cobblemon/bedrock/particles/moves/ember/` e a
linha do tempo em `data/cobblemon/action_effects/moves/ember.json`),
traduzidos à mão pra funções JS — não existe conversor automático.

### O golpe é instantâneo (regra pra todo efeito)

O dano acontece no `effectAt`, então o **visual também chega no impacto nesse
instante** — nada do golpe espera pra chegar. O Cobblemon faz o contrário: as
brasas viajam da boca ao alvo e o estouro vem depois (0.5 s no Brasa, 0.25 s no
Lança-chamas), o que dava um vão entre o dano e o fogo na tela. Ajuste feito no
Brasa e no Lança-chamas; vale pra todo efeito novo (Tackle, Scratch e Impact
já eram assim). Quem precisar de projétil que viaja de verdade tem a âncora
`'path'` do motor, mas o padrão é instantâneo.

- **Âncora `'line'`** (motor): a partícula nasce num ponto sorteado em todo o
  trajeto, criatura → impacto — o efeito já aparece espalhado, sem "viajar".
- **`burst` como função** (motor): a rajada pode depender do contexto (as
  faíscas do Brasa dependem do comprimento do golpe).
- **Sons**: o som do alvo tocava com atraso (0.5 s / 0.9 s); agora o do atacante
  e o do alvo tocam juntos no `effectAt` (`delay: 0` nos grupos compostos). O
  mecanismo de atraso continua pra quem precisar.

### Linha do tempo — Brasa

Segundos desde o golpe nascer (o `effectAt`, o mesmo instante do dano):

| t | Emissor | O que é | Duração |
|---|---|---|---|
| 0.00 | `actor` | nuvem de fogo saindo da boca | 0.1 s |
| 0.00 | `stream` | 27 brasas ao longo de TODO o trajeto, de uma vez | rajada |
| 0.00 | `sparks` | faíscas ao longo de todo o trajeto, de uma vez (`5 × length`, 10 a 20 por s × 0.45 s) | rajada |
| 0.00 | `burst` | estouro de fogo no alvo | 0.05 s |
| 0.10 | `linger` | brasas que ficam subindo do alvo | 0.5 s |

Termina em ~1.1 s, dentro do `effectVisualDuration` de 2 s da skill. Diferença
pro original: as brasas e faíscas do Cobblemon viajam em 0.45 s e o estouro vem
aos 0.5 s; aqui nascem espalhadas e o estouro é imediato. As brasas do trajeto
só derivam devagar (1.5 m/s e 1.2 m/s, antes `length × 1.25` e `× 0.75`):
já nasceram no lugar, e com a velocidade antiga passariam muito do alvo (a
Brasa tem alcance 8).

### Linha do tempo — Lança-chamas

| t | Emissor | O que é | Duração |
|---|---|---|---|
| 0.00 | `actor` | jato contínuo saindo da boca (150/s no original) | 1 s |
| 0.00 | `target` | fogo se espalhando no alvo | 0.95 s |
| 0.00 | `burst` | estouro no alvo | 0.15 s |
| 0.30 | `cinders` | brasinhas subindo do alvo | 0.95 s |
| 0.90 | `burst2` | segundo estouro no alvo | 0.15 s |

Termina em ~2.4 s; a skill passou a `effectVisualDuration: 2.5` e
`effectGroup: 'flamethrower'` (antes apontava pro grupo `'ember'`).
Diferenças pro original, todas comentadas em `flamethrowerVfx.js`:

- O fogo e o estouro do alvo começam no `effectAt` (no Cobblemon, 0.25 s
  depois, esperando o jato chegar). O jato em si ainda leva uma fração de
  segundo pra se estender até o alvo — é contínuo e sai da boca; só o que
  acontece NO alvo é imediato.
- O original fixa o alcance do jato (`target_deltaz = 5`); aqui as
  velocidades escalam por `length / 5`, então o jato alcança o `range`
  da skill.
- Cada partícula do alvo soltava uma brasinha aos 30% da vida (evento
  por partícula); o motor não tem isso, então virou o emissor `cinders`,
  de taxa contínua ao redor do impacto.
- Sem colisão e sem `flamethrower_target_linger` (o JSON do golpe não o
  chama).
- `DENSITY = 0.6` no componente (60% da taxa original): são ~170
  sprites vivos no pico, cada um com material próprio. Se pesar, baixe
  ali; `1` é o fiel ao Cobblemon.

### Estrutura

| O quê | Onde |
|---|---|
| Matemática pura (gradiente, curva, flipbook, nascer/mover partícula) | `view/vfx/particleSimulation.js` |
| Liga a simulação a `THREE.Sprite` (agenda emissores, pool de sprites) | `view/vfx/particleEmitter.js` |
| Texturas e gradientes que Brasa e Lança-chamas compartilham | `view/vfx/fireParticleKit.js` |
| Os 5 emissores do Ember, com o arquivo de origem de cada um | `view/vfx/emberVfx.js` |
| Os 5 emissores do Lança-chamas | `view/vfx/flamethrowerVfx.js` |
| Miolo comum dos componentes (cria/roda/descarta o sistema) | `view/scene/attackEffects/useParticleAttackEffect.js` |
| Componentes dos grupos `'ember'` e `'flamethrower'` | `view/scene/attackEffects/EmberAttackEffect.jsx`, `FlamethrowerAttackEffect.jsx` |
| Texturas (cópia do Cobblemon) | `public/assets/effects/ember/` |

- **Cada spec reproduz as expressões do JSON de origem.** As funções
  recebem `rnd` (as `v.particle_random_1..4` originais, mais 4 extras pros
  `math.random(a, b)`) e `ctx` (idade do emissor, progresso no trajeto,
  comprimento do golpe, escala, raio) — dá pra conferir linha a linha.
- **O eixo Z do Bedrock aponta pro lado oposto** (-Z = alvo). Todo `z` de
  direção/aceleração foi invertido na tradução (aqui +Z = direção do golpe).
- **Sprites com textura própria** (`clone()`, sem duplicar a imagem na GPU):
  o quadro do flipbook é um `offset`, e partículas em quadros diferentes
  ao mesmo tempo precisam de offsets diferentes. Sprites mortos voltam pra
  um pool por emissor.
- **`density`** (opcional em `createParticleSystem`) multiplica a taxa de
  todos os emissores — o jeito de aliviar um efeito pesado sem mexer nos
  specs. **`tintAt`** (opcional no spec) deixa a cor andar numa velocidade
  diferente da vida (o `interpolant` do Lança-chamas multiplica por uma
  random).
- **Fade nos últimos 15% da vida** — não vem do original; evita as faíscas
  (que não encolhem) sumirem de uma vez.
- O componente cria o sistema em `useEffect` (não `useMemo`) pra aguentar o
  mount→unmount→mount do StrictMode sem reusar um sistema já descartado.

### `AttackEffect.length`

O `AttackEffect` nasce no **ponto de impacto**, orientado pela trajetória
(+Z local = direção do golpe). Um VFX que *sai da criatura* precisa saber
onde ela está: novo campo `length` (metros, da partida do golpe — origem + `visual.positionOffset` — até onde o
efeito nasce), preenchido em `creatureAttackSystem.js` e repassado por
`AttackEffectsView` → `AttackEffectView` → componente. No espaço local a
criatura fica em `(0, 0, -length)`. Os grupos que nascem só no impacto
(`punch`, `tackle`, `vine-whip`, `whirlpool`) ignoram o prop.

Limitação: com golpe que acerta um alvo no meio do caminho, o efeito nasce
no ponto de contato (que pode ficar um pouco fora da linha da trajetória),
então a boca desenhada pode se desviar poucos centímetros da real.

### Tackle

Só o IMPACTO do Tackle do Cobblemon (o resto do golpe é a animação do corpo
da criatura). Dois emissores, ambos no ponto de impacto, no instante em que o
efeito nasce (`effectAt` do ataque) — config em `view/vfx/tackleVfx.js`:

| t | Emissor | O que é |
|---|---|---|
| 0.00 | `hit` | clarão amarelo de 1 m, 5 quadros ao longo de 0.2 s |
| 0.00 | `sparks` | 7 faíscas que saltam e caem (gravidade -9) |

- As texturas (`hit_yellow.png`, `scalingshaded.png`, em
  `public/assets/effects/tackle/`) têm os quadros **empilhados na vertical**
  (quadro 0 = o de cima); as faíscas percorrem o atlas de trás pra frente
  (3ª → 1ª linha). Isso exigiu do motor: `vertical`, `frames.step` negativo,
  `frames.stretch` (quadros distribuídos pela vida em vez de por `fps`) e
  `burst` (N partículas de uma vez).
- O original solta `max(entity_width * 5, 7)` faíscas; sem a largura do alvo
  no efeito, fica no piso de 7. Sem colisão com o chão.
- O `TackleAttackEffect.jsx` não usa mais a malha `tackle.glb` (arquivo
  mantido). `radius`, `revealDuration` e `length` não se aplicam ao clarão;
  `visual.scale` multiplica o tamanho de tudo.
- O efeito dura ~0.5 s, então o `effectVisualDuration` dos 4 ataques
  básicos que usam o grupo passou de 0.35 pra **0.6** (senão as faíscas
  sumiam no meio).
- O `rotationOffset` do básico do Charmander (`z: -15`) foi ajustado pra
  malha de arranhão; as faíscas giram junto com o referencial do efeito, então
  a gravidade fica inclinada 15°. Zerar o `z` se incomodar.

### Scratch

Grupo novo `'scratch'` — o IMPACTO do Scratch do Cobblemon, config em
`view/vfx/scratchVfx.js` (nenhum ataque o usa ainda; pra usar:
`visual.effectGroup: 'scratch'`, com `effectVisualDuration` ≥ 0.6):

| t | Emissor | O que é |
|---|---|---|
| 0.00 | `mark` | marca de arranhão amarela de 1 m, 7 quadros ao longo de 0.35 s |
| 0.05 | `sparks` | 7 faíscas que saltam e caem (iguais às do Tackle, 0.125 m) |

- Marca e faíscas nascem 0.2 m acima do impacto e `0.5 * radius` golpe
  adentro (até 1 m) — o `q.entity_radius` do alvo, no original, vira o
  `radius` do golpe. A marca gira 0° ou -90° por sorteio.
- Textura `scratch_yellow.png` (7 quadros empilhados na vertical) em
  `public/assets/effects/scratch/`; as faíscas reusam a do Tackle.
- A curva `variable.scale` do JSON das faíscas existe mas o `size` não a
  usa, então elas **não encolhem** (igual ao original).
- O motor ganhou `offset` (deslocamento fixo do ponto de nascimento, em
  metros × escala) e `spin` como função (giro inicial arbitrário, em quartos
  de volta, inclusive negativo).
- Os grupos em malha (`punch`, `vine-whip`, `whirlpool`) seguem como estão;
  a malha `EffCommonScratch` já não era usada por nenhum grupo.

### Impact (impacto genérico por tipo)

Grupo `'impact'` — o visual padrão pensado pro ataque básico das criaturas:
um clarão + uma rajada de faíscas cuja cor/forma muda pelo TIPO do golpe,
traduzido de `generic/hit*.particle.json` e `generic/impact_<tipo>.particle.json`
do Cobblemon (config dos 18 tipos em `view/vfx/impactVfx.js`, componente
`ImpactAttackEffect.jsx`). Nenhum ataque o usa ainda; pra usar:
`visual.effectGroup: 'impact'`, com `effectVisualDuration` ≥ 1.

- **Tipo**: `AttackEffect.impactType`, preenchido em `creatureAttackSystem.js`
  com `attack.visual.impactType`, senão `attack.damage.type` (hoje `null`,
  reservado pro STAB), senão `''`. Vazio ou desconhecido cai em `'normal'`.
  Os 18: normal, fire, water, grass, electric, ice, fighting, poison, ground,
  flying, psychic, bug, rock, ghost, dragon, dark, fairy, steel.
- **Clarão** (`hit.png`, 1 m, 5 quadros ao longo de 0.2 s): dragão e veneno
  usam o seu (`hit_dragon`/`hit_poison`: colorido, 0.5 s, 24 fps).
- **Faíscas**: 10 a 20 por tipo (inseto 20, dragão/fada 15, lutador/sombrio/
  aço 12, o resto 10), com tamanho, vida (0.2 a 0.9 s), velocidade,
  aceleração e cor próprios de cada tipo. Pedra e aço jorram pra cima.
- Só as 2 texturas do tipo são carregadas (`hit.png` + `impact_<tipo>.png`);
  as 19 imagens somam ~80 KB em `public/assets/effects/impact/`.
- O motor ganhou `columns`/`column` (atlas vertical com mais de uma coluna:
  o `impact_steel.png` tem 2 e usa a da direita).
- Diferenças pro original (cabeçalho de `impactVfx.js`): o Cobblemon escala o
  emissor pelo tamanho da criatura; aqui `SPEED_FACTOR = 0.4` encolhe o
  alcance das faíscas (valor de partida, ajustar em jogo) e `visual.scale`
  cresce tudo; a aceleração do inseto (sorteada a cada frame no original)
  vira uma aceleração aleatória fixa por partícula; sem colisão com o chão
  (pedra e aço quicam no original).

#### Som do impacto (por tipo)

O Cobblemon tem 8 sons de impacto pra cada tipo (`sounds/move/impact_generic/`,
ligados aos eventos `impact.<tipo>`); o tipo `normal` não tem sons próprios e
usa os do `fighting`. Entraram como grupos de som do ataque, ao lado de
`punch` e `tackle`:

- **136 arquivos** (17 tipos × 8, ~22 KB cada, `.ogg` mono, 3.3 MB no total)
  em `public/assets/audio/attack/impact-<tipo>/attack-0N.ogg`; os grupos
  `impact-<tipo>` (18, o `normal` aponta pra pasta do `fighting`) são
  gerados em `core/data/audio/attackSound.js`.
- **`audio.group: 'impact'`** no ataque resolve o grupo do TIPO dele — o mesmo
  tipo do visual (`visual.impactType` → `damage.type` → `'normal'`). A lista
  de tipos e `resolveImpactType`/`resolveAttackImpactType` foram pra
  `core/data/impactTypes.js` pra visual e som escolherem igual.
  Pra usar: `visual: { effectGroup: 'impact', impactType: 'fire' }` e
  `audio: { group: 'impact' }`.
- Cada impacto toca UMA das 8 variações, sorteada (como já era). As
  habilidades (Q/E/R) também tocam som agora — ver "Som das habilidades".
- `volume: 0.18` e `refDistance: 2` (iguais aos dos outros grupos) são
  valores de PARTIDA: as gravações têm loudness própria, ajustar de ouvido.
- Formato `.ogg` (os sons antigos do projeto são `.wav`): os navegadores
  atuais decodificam, mas Safari antigo pode não decodificar Ogg Vorbis — se
  for problema, converter pra `.wav`/`.mp3`.
- Licença: os sons vêm do Cobblemon; a licença dos assets (sons) não foi
  verificada (ver "Origem e licença das texturas").

#### Som das habilidades e dos golpes de fogo (atacante + alvo)

Antes só o ataque **básico** tocava som: havia um nó de áudio por criatura e o
`AttackPulse` era uma etiqueta sem dados. Agora:

- **`AttackPulse` carrega o `slot`** (`primary`/`secondary1-3`) que disparou;
  o `creatureAttackSystem` o preenche.
- **Uma voz por parte de som de cada slot**: `resolveAttackSounds(species)`
  (`core/data/audio/attackSound.js`) devolve `{ [slot]: [partes] }`, cada
  parte `{ clips, volume?, refDistance?, delay }`. `useAnimatedModel.js`
  cria um `THREE.PositionalAudio` por parte (duas partes se sobrepõem no
  tempo e um nó só toca um buffer por vez) e o `attackAudioRegistry` guarda
  `{ voices, pending }` por criatura.
- **`attackAudioSystem`** toca as partes do slot do pulso; as com `delay` > 0
  esperam em `pending` e tocam quando o `delta` acumulado chega lá.
- **Grupos compostos** (`ATTACK_SOUND_COMPOSITES`): `audio.group: 'ember'` e
  `'flamethrower'` viram duas partes — som do **atacante** e som do **alvo**,
  as duas no `effectAt` (`delay: 0`: o golpe é instantâneo, ver "O golpe é
  instantâneo"; no Cobblemon o do alvo esperava 0.5 s / 0.9 s). Cada
  golpe de fogo tem os SEUS sons (conferido por conteúdo: nenhum arquivo é
  igual a outro); não existe som genérico de fogo.
- **Arquivos** (1 `.ogg` por parte, em `public/assets/audio/attack/
  <golpe>-<actor|target>/attack-01.ogg`): `ember-actor`, `ember-target`,
  `flamethrower-actor`, `flamethrower-target`. As skills `ember` e
  `flamethrower` passaram a `audio: { group: '<golpe>' }`.
- O som do ALVO toca no nó da CRIATURA (não no ponto de impacto): com
  `range` de poucos metros a diferença de posição é pequena. Tocar no ponto
  de impacto exigiria um nó de áudio no `AttackEffect`.
- Outros golpes do Cobblemon (Fire Punch, Fire Spin, Fire Blast...) têm o par
  `_actor`/`_target` e entram do mesmo jeito: copiar os 2 arquivos e declarar
  um grupo composto.

### Ponto de partida do VFX (`visual.positionOffset`)

Ao lado do `visual.rotationOffset` (gira o efeito), o ataque ganhou
`visual.positionOffset: { x, y, z }` — **metros**, pra deslocar o **ponto de
partida** do golpe (de onde ele sai da criatura). O **ponto de impacto
continua o do `range`**: o efeito é reorientado e esticado da nova partida
até ele. Entra em `overrides` como o resto de `visual`.

Em `creatureAttackSystem.js`, `resolveEffectStart` (função pura exportada)
desloca a origem do golpe, e daí saem a `Rotation` e o
`AttackEffect.length` do efeito; a `Position` do efeito não muda (continua no
impacto/contato). Dano, alcance e área seguem contados da origem de sempre —
é só visual.

- **Referencial do golpe**: +Z = direção do golpe, +Y = pra cima, +X = pro
  lado — esquerda de quem olha na direção do golpe (convenção do Three;
  conferir o sinal em jogo). `{ y: 0.2 }` sobe a saída 20 cm seja qual for a
  direção do disparo.
- **Independente do `rotationOffset`**: os eixos usam só o yaw/pitch do
  golpe, não a rotação extra que gira a malha.
- **Efeitos de partícula** (Brasa, Lança-chamas): a boca do jato anda e o
  jato se inclina pra continuar acertando o impacto.
- **Efeitos de malha que nascem no impacto** (`tackle`, `punch`,
  `vine-whip`, `whirlpool`): a malha em si não muda de lugar — só gira um
  pouco (a direção agora é da nova partida ao impacto), e a que se estende
  pra trás do impacto (`alignForwardTip`) passa a se estender na direção da
  nova partida. Pra mover o *desenho* de um efeito de impacto não existe
  parâmetro (não foi pedido).
- Declarado (zerado) em todos os `visual` — `_template`, as 7 skills e os 5
  ataques básicos —, igual ao `rotationOffset`.

### Origem e licença das texturas

`cloudyfire_white.png`, `ember.png` e `powder.png` vêm de
`assets/cobblemon/textures/particle/generic/` do Cobblemon. O `LICENSE` do
código dele é MPL-2.0; **a licença dos assets (texturas) não foi
verificada** — conferir no repositório oficial antes de qualquer uso além
de projeto pessoal.

### Testes

- `particleSimulation.test.js` (novo) — gradiente, curva, flipbook,
  acúmulo de taxa, nascer na origem/caminho, raio da casca com escala,
  movimento/aceleração/arrasto, tamanho.
- `particleEmitter.test.js` (novo) — o sistema inteiro sem WebGL:
  nuvem nasce na criatura, brasas viajam até o alvo, estouro só depois de
  0.5 s perto do impacto, termina sozinho, escala, `dispose`. Lança-chamas:
  o jato alcança o alvo, escala com o comprimento do golpe, o alvo só
  acende depois de 0.25 s, dura ~2.4 s, `density` reduz as partículas.
- `attackAudioRegistry.test.js` e `attackAudioSystem.test.js` (novos) — vozes
  por slot, cleanup de todas, slot certo, atraso contado pelo `delta`, dois
  golpes seguidos, sem buffer, slot sem som, entidade destruída;
  `creatureAttackSystem.test.js` checa o `slot` do `AttackPulse` (básico e
  habilidade); `attackSound.test.js` cobre os compostos e o Charmander real.
- `impactTypes.test.js` e `audio/attackSound.test.js` (novos) — resolução do
  tipo (visual → `damage.type` → normal), os 18 grupos de som (8 variações
  `.ogg` cada), `normal` = sons do lutador, **todo caminho de som existe em
  `public/`** e `audio.group: 'impact'` resolvendo pelo tipo.
- `impactVfx.test.js` (novo) — resolução do tipo, caminhos das texturas,
  os 18 tipos (clarão + faíscas, terminam em ~1 s), quantidade por tipo,
  clarão de dragão/veneno, coluna do aço, jorro pra cima de pedra/aço,
  escala.
- `creatureAttackSystem.test.js` — `AttackEffect.impactType` (visual →
  `damage.type` → vazio); checa `AttackEffect.length` = `range`;
  `resolveEffectStart` (sem offset, yaw 0, yaw 90°, golpe inclinado,
  eixos ortonormais) e, ponta a ponta, o `AttackEffect` continuando no
  impacto com `length`/`Rotation` medidos da partida deslocada.

**Não testado em jogo** (sem navegador nesta sessão): tamanho, brilho,
mistura (aditiva/normal) e o quanto cada emissor aparece são valores de
partida pra ajustar olhando — todos em `emberVfx.js`.

---

## Parte 3 — VFX de dash

### Resumo

Efeito visual pro **dash** (a ação `dash` do `ActionState`, do treinador e das
criaturas controladas): **linhas de velocidade** enquanto o dash dura e
**poeira no chão** na saída. Feito com o mesmo motor de partículas dos golpes
(`view/vfx/`, Parte 2), adaptado pra um efeito que **acompanha quem se
move**.

O Cobblemon não tem efeito de dash de movimento (é o mod por turnos do
Minecraft). Os pedaços vêm do golpe **Quick Attack**
(`.exemple/Coblemon/assets/cobblemon/bedrock/particles/moves/quickattack/`):

- `quickattack_dashlines` → as linhas de velocidade (aqui contínuas, o dash
  inteiro; no original, 0.25 s);
- `quickattack_dust` → 12 nuvens de poeira no chão na saída.

### Como aparece

| Quando | O que | Detalhe |
|---|---|---|
| Enquanto o dash dura | **Linhas de velocidade** | 100/s, vida de 0.2 s, numa nuvem de raio 1 ao redor do corpo, 1 m à frente do centro; disparam pra TRÁS a 9 m/s; esticadas ao longo do movimento, face pra câmera; textura `dashlines.png` (14×1, 7 quadros), tom branco-azulado |
| Na saída | **Poeira** | 12 nuvens num disco de raio 1 no chão, sobem e derivam pra trás (4 m/s, aceleração `+Y` e `-Z`, arrasto 1), vida 0.5 a 1.2 s, textura `big_smoke.png` (16×192, 12 quadros na vertical), cor de terra |

Quando o dash acaba (ou a criatura some — recolhida, destruída), as linhas
param de sair e o que já existe termina sozinho (~1.2 s no máximo, a poeira
é a mais longa).

### Estrutura

| O quê | Onde |
|---|---|
| Specs das linhas e da poeira (com o arquivo de origem) | `view/vfx/dashVfx.js` |
| Cria/acompanha/encerra o efeito de CADA criatura em dash (testável sem WebGL) | `view/vfx/followEffectManager.js` (nasceu como `dashEffectManager`; ficou genérico na Parte 7, também usado pela carga de golpe) |
| Componente da cena: lê o ECS e alimenta o gerenciador | `view/scene/DashEffectsView.jsx` (montado no `GameScene.jsx`) |
| Texturas (cópia do Cobblemon) | `public/assets/effects/dash/` |
| Config | `GAME_CONFIG.FEEDBACK.DASH_EFFECT` — `ENABLED`, `SCALE`, `LINE_RATE`, `LINE_LENGTH`, `LINE_THICKNESS`, `DUST_COUNT` |

- **`DashEffectsView`** só LÊ o ECS (como o `AttackTelegraphView`): a cada frame,
  quem está com `ActionState.current === 'dash'` tem efeito. A direção do dash
  é a **travada no disparo** (`ActionState.dirX/dirZ`), não a do corpo agora; a
  origem fica nos pés (`Position.y - verticalClearance`) e a altura do corpo vem
  do `CharacterController`.
- **Um efeito por dash**: um dash novo logo depois de outro ganha um sistema
  novo, e o antigo termina ao lado.
- O efeito vive no espaço do **mundo**: as partículas nascem na posição da
  criatura naquele instante e ficam pra trás conforme ela corre.

### O que o motor de partículas ganhou

- **`system.setFrame({ origin, yaw, height })`** — o quadro do emissor: de onde as
  partículas nascem a partir de agora. Os specs falam no referencial da
  criatura (+Z = pra onde corre, origem nos pés) e a partícula nasce no mundo
  (posição, velocidade e aceleração giradas pelo `yaw`). `ctx.frame`/
  `ctx.height` chegam aos specs.
- **Emissor `continuous: true`** — solta até `system.endEmission()`; depois o que
  existe termina sozinho. Fim do sistema: `emissionEnded && isDone()`.
- **`facing: 'direction'`** — a linha de velocidade (o `lookat_direction` do
  Bedrock): em vez de um sprite que sempre encara a câmera, um quadro (`Mesh`)
  esticado na direção do movimento com a face virada pra câmera
  (`resolveBeamBasis`, `system.setCameraPosition`, atualizada a cada frame).
  `spec.size` pode devolver `[comprimento, espessura]`.
- `spec.offset(ctx, rnd)` recebe os randoms da partícula.

### Ajustes (`GAME_CONFIG.FEEDBACK.DASH_EFFECT`)

| Chave | Padrão | O que controla |
|---|---|---|
| `ENABLED` | `true` | liga/desliga o efeito todo |
| `SCALE` | `0.6` | tamanho e raio de tudo (1 = o do Cobblemon) |
| `LINE_RATE` | `100` | linhas de velocidade por **segundo** enquanto o dash dura (vivem 0.2 s, então ~`LINE_RATE × 0.2` na tela de cada vez; `0` = sem linhas) |
| `LINE_LENGTH` | `0.6` | comprimento de cada linha (m, antes da escala) |
| `LINE_THICKNESS` | `0.05` | espessura de cada linha (m, antes da escala) |
| `DUST_COUNT` | `12` | nuvens de poeira na saída (`0` = sem poeira) |

O componente monta os emissores com `buildDashEmitters(opções)` (`dashVfx.js`),
que recebe esses valores; `DASH_EMITTERS` é o mesmo com os padrões.

### Diferenças pro original (e valores de partida)

- O Cobblemon usa raio ≥ 1 m e linhas de 0.2 × 0.02 m, pensados pra câmera do
  Minecraft. Aqui: `SCALE: 0.6` multiplica tamanho e raio (config) e as linhas
  têm **0.6 × 0.05 m** (`LINE_LENGTH`/`LINE_THICKNESS` na config) pra
  aparecerem com a câmera de jogo. **Valores de partida — ajustar jogando.**
- As linhas duram o dash inteiro (no original, 0.25 s).
- A esfera de linhas é sorteada no VOLUME (como no original), não só na casca.
- Sem colisão da poeira com o chão.

### Testes

- `particleSimulation.test.js` — `rotateY`, partícula com quadro (nasce no mundo,
  velocidade/aceleração giram), `offset` com randoms, tamanho `[comprimento,
  espessura]`, `resolveBeamBasis` (ortonormal, face pra câmera, caso
  degenerado).
- `particleEmitter.test.js` — emissor contínuo e `endEmission`, taxa de ~100/s,
  `setFrame` (partículas novas na origem nova, antigas ficam no mundo), `yaw`
  gira a nuvem, linhas são `Mesh` esticados e a poeira `Sprite`, a face vira
  pra câmera.
- `dashVfx.test.js` — config das linhas/poeira (incluindo `lineRate`, tamanho e
  `dustCount` configuráveis), poeira no chão e linhas à
  meia altura, linhas pra trás, poeira sobe e deriva, escala, fim do efeito.
- `followEffectManager.test.js` — nada sem dash, um sistema por dash, fim do dash
  encerra a emissão (descarta só quando as partículas morrem), dash novo =
  sistema novo, duas criaturas, criatura que some, `dispose`.

**Não testado em jogo** (sem navegador): posição, tamanho e quantidade das linhas
e da poeira, e como a orientação das linhas lê com a câmera do jogo.

---

## Parte 4 — Skills de status (Growl)

### Resumo

Primeira skill de **status**: golpe que **não causa dano** e muda o estado do
alvo. O **Growl** (Rosnado) baixa o ataque de todos os inimigos num cone à
frente. A feature separa, na definição de uma skill, o que **machuca**
(`damage`) do que **muda o estado** do alvo (`effects`) — uma skill pode ter um,
outro ou os dois.

Decisões do usuário (perguntadas antes de implementar):

| Pergunta | Decisão |
|---|---|
| Duração do efeito | **Tempo fixo, renovável** (jogo em tempo real) |
| Intensidade | **Estágios como no Pokémon** (-6 a +6, cada estágio multiplica o atributo) |
| Quem atinge | **Todos os inimigos no cone à frente** (mesma forma do Lança-chamas) |
| Feedback | **Ondas sonoras no cone + texto "Ataque ↓" + brilho colorido no alvo + o grito da criatura** (o tremor do alvo foi tirado depois: não agradou) |

### Como separar status de dano

| | Skill de dano | Skill de status |
|---|---|---|
| `damage` | `{ power, category, type }` | `null` |
| `effects` | omitido (ou junto, p/ dano + efeito) | `[{ type: 'statStage', ... }]` |
| Quem é atingido | cápsula (primeiro corpo) ou, canalizado, cone | `area: 'cone'` (todos) ou cápsula |
| Evento | `attackResolved` com dano | `statStageChanged` + `attackResolved` com `status: true`, `damage: 0` |
| Feedback | brilho, hit stop, número de dano | texto "Ataque ↓" e brilho colorido no alvo |

- **`effects`** (`core/data/skills/<id>/index.js`): lista do que o golpe muda no alvo,
  aplicada em cada alvo no `effectAt`. Hoje um tipo, `statStage`:
  `{ type: 'statStage', stat, stages, duration }` — soma `stages` ao estágio do
  `stat` (`attack`, `defense`, `sp_atk`, `sp_def`), de -6 a +6, e o efeito dura
  `duration` segundos. Documentado no `_template`.
- **`area: 'cone'`**: um golpe de impacto único que atinge TODOS os alvos num
  cone (a mesma conta de `resolveConeTargets` do canalizado — só estrutura encurta
  o cone, criatura no caminho não). O indicador de mira e o aviso vermelho passam
  a desenhar o cone (`isConeAttack`, `channelAttack.js`, usado por `AttackShape`).
- **`visual.effectGroup: 'growl'`**: nasce um `AttackEffect` com as ondas sonoras (ver "Ondas sonoras"). `'none'` continua valendo pra skill sem nenhum visual.
- **`audio.cry: true`**: a criatura vocaliza no `effectAt` (`CryPulse`).

### Estágios de atributo

- **`StatStages`** (trait, `core/traits/components/statStages.js`): `<stat>Stage` e
  `<stat>Time` por atributo. A criatura só ganha o trait no primeiro efeito.
- **`core/battle/statStages.js`** (puro): `stageMultiplier` — a fórmula do Pokémon,
  `(2 + n) / 2` pra positivo e `2 / (2 - n)` pra negativo (-1 → ×2/3, -2 → ×1/2,
  -6 → ×1/4; +1 → ×3/2, +6 → ×4) —, `clampStage`, `readStatStages` e
  `applyStatStageEffect`.
- **Acumula e renova**: usar de novo soma ao estágio (até ±6) e volta o tempo pra
  `duration`, mesmo no limite. O estágio de cada atributo expira no próprio
  tempo; voltar a 0 não deixa tempo sobrando.
- **`statStageSystem`** (simulation): conta o `<stat>Time` pra baixo e zera o
  estágio ao fim.
- **Fórmula de dano** (`calculateDamage.js`): `resolveDamageAmount` e
  `resolveChannelTickDamage` recebem `attackerStages`/`defenderStages` e
  multiplicam o atributo de ataque do atacante e o de defesa do alvo — golpe
  físico usa `attack`/`defense`, especial usa `sp_atk`/`sp_def`. Um Growl no alvo
  faz o que ele causa de dano cair de verdade.

### O Growl

`core/data/skills/growl/index.js` (valores de PARTIDA, sem validação em jogo):
`range 3`, `radius 1.5` (cone de ~27° pra cada lado), `effectAt 0.5`,
`duration 1.2`, `cooldown 1`, `staminaCost 2`, efeito `attack -1` por 60 s
(valores atuais, já ajustados pelo usuário). Animação: `clipKey: 'roar'`, a
`roar` de `nativeAnimations` do Charmander, Bulbasaur e Squirtle. Ícone: `public/assets/sprites/abilities/
growl.png` (gerado — ondas sonoras saindo de um ponto; troque pelo seu).

Hoje está no slot 1 (Q) do Charmander.

### Feedback

O Cobblemon não tem partículas pro Growl — só uma animação do alvo tremendo, que **não foi aproveitada** (um tremor do alvo foi feito e removido depois: não agradou).

- **Texto "Ataque ↓"** (`damageNumberSystem`): um `statStageChanged` por atributo
  e por alvo cria o texto acima da cabeça (uma seta por estágio, até 3), vermelho
  pra baixa e verde pra alta, no mesmo pool dos números de dano
  (`DamageNumbersView`, novo `kind`).
- **O grito**: `CryPulse` no `effectAt`; o `voiceAudioSystem` toca uma variação da
  voz da criatura na hora (cortando a que tocava) e a boca acompanha
  (`mouthSyncSystem`).
- **Reação**: o `attackResolved` de status conta como acerto — a selvagem
  atingida se provoca (persegue ou foge) e o time defende —, mas brilho
  (`hitFlashSystem`), hit stop e número de dano o ignoram (`event.status`).

### Cores do feedback (lado × tipo)

Brilho no modelo e textos acima da cabeça usam a MESMA paleta
(`GAME_CONFIG.FEEDBACK.FEEDBACK_COLORS`, `view/vfx/feedbackColors.js`):

| Tipo | Oponente (selvagens) | Aliado (treinador e criaturas do time) |
|---|---|---|
| **Dano** | vermelho `#ff3b30` | rosa `#ff5c8a` |
| **Crítico** (texto) | dourado `#ffd23f` | rosa-claro `#ffc4e1` |
| **Status negativo** (atributo baixou) | laranja `#ff9f0a` | violeta `#b57bff` |
| **Status positivo** (atributo subiu) | verde `#32d74b` | ciano `#4dd0e1` |

- **Lado**: `resolveSide` (`Party` ou `SummonedCreature` = aliado; todo o resto,
  inclusive o que nem é entidade do ECS = oponente). O oponente usa o vermelho/
  laranja/verde pedido; o aliado usa tons frios pra bater o olho e saber de que
  lado foi.
- **Brilho no modelo** (`hitFlashSystem`): dano acende na cor de dano;
  `statStageChanged` com `delta < 0` acende laranja/violeta, `delta > 0` verde/ciano.
  Dano e status no mesmo alvo e no mesmo frame: **dano > status negativo > status
  positivo**. Um brilho novo durante outro troca a cor e reinicia o tempo, sem
  recapturar a cor base (não fica preso brilhando). O golpe de status sozinho
  (`attackResolved` com `status`) não acende — quem acende é o `statStageChanged`.
- **Texto acima da cabeça** (`damageNumberSystem` + `DamageNumbersView`): número de
  dano e texto de status (`Ataque ↓`) na cor do tipo e do lado. O crítico também é
  por lado: texto na cor `CRIT` do lado (dourado no oponente, rosa-claro no aliado) e
  contorno brilhando na cor de dano do lado.
- Tirou-se `HIT_FLASH.COLOR` (branco único): a cor agora vem da paleta.

### Indicador de status na HUD

`StatStageBadges` (`view/shared/statusDisplay.jsx`) mostra etiquetas "ATQ ↓2" /
"DEF ↑1" logo abaixo das barras de vida/energia — na etiqueta de nome flutuante
(`NameplateView`), no `StatusHud` (controlada e treinador) e no `PartyHud` (criatura
ativa). **Só aparece enquanto houver atributo alterado**; ao expirar, some. Cor =
paleta de status negativo/positivo do lado da criatura. Os estágios vêm de
`listActiveStatStages` (`core/battle/statStages.js`) lidos pelo hook `useStatStages`
(polling de 100 ms, só re-renderiza quando algo muda).

### Ondas sonoras (visual do Growl)

`GrowlAttackEffect` + `view/vfx/growlVfx.js`: 3 arcos ")" (textura própria,
`public/assets/effects/growl/wave.png`) saem da boca a cada 0,15 s, viajam até a
ponta do cone em 0,5 s e crescem em altura junto com a abertura do cone. São
quadros `facing: 'direction'` (convexidade pra frente, de frente pra câmera), em
mistura aditiva e cor neutra (branco). Efeito próprio — o Cobblemon não tem
partícula de Growl. Ajustes em `growlVfx.js`: `WAVE_COUNT`, `WAVE_INTERVAL`,
`WAVE_LIFETIME`, `TIP_HEIGHT` (2 × `radius` da skill). Valores de partida, sem
validação em jogo.

### Aviso da ação sobre o anel

O aviso do ataque (`AttackTelegraphView`, `renderOrder` 16) agora desenha por cima do
anel de duração da ação (`ActionTimerRingView`, 14/15) onde os dois se sobrepõem.

### Testes

- `statStages.test.js`, `statStageSystem.test.js` — fórmula, limite, acúmulo,
  renovação, expiração.
- `calculateDamage.test.js` — os estágios mexem no dano (físico × especial, canal).
- `creatureAttackSystem.test.js` — o Growl de ponta a ponta: só o cone (e só
  inimigos vivos), sem dano, os dois eventos, nenhum `AttackEffect`, `CryPulse`,
  acumula no 2º uso.
- `damageNumberSystem.test.js`, `hitFlashSystem.test.js`, `hitStopSystem.test.js`,
  `voiceAudioSystem.test.js` — texto, cor por tipo e lado, prioridade do brilho,
  status ignorado, grito. `feedbackColors.test.js` — lado e paleta.
- `channelAttack.test.js` (`isConeAttack`), `skills/index.test.js`.

**Não testado em jogo** (sem navegador): as cores na tela (legibilidade do rosa e do
violeta nos textos), o tamanho do cone, e o ícone gerado.

---

## Parte 5 — Precisão dos golpes e Smokescreen

### Resumo

Entrou o **sorteio de precisão** (a regra do Pokémon) e, com ele, a segunda skill
de status: o **Smokescreen** (Cortina de Fumaça), que baixa a **precisão** dos
inimigos num cone à frente — o mesmo molde do Growl (Parte 4).

Decisões do usuário (perguntadas antes de implementar):

| Pergunta | Decisão |
|---|---|
| Como a precisão funciona | **Erro por sorteio, como no Pokémon** (não desvio de mira nem nuvem no mundo) |
| Quem atinge | **Cone, como o Growl**, com as partículas do Cobblemon |
| Estágios | **Só precisão** — sem evasão |

### Como o Pokémon faz (e como ficou aqui)

Chance de acertar = **precisão do golpe × multiplicador do estágio de precisão de
quem ataca**. O estágio vai de -6 a +6: `(3 + n) / 3` se positivo, `3 / (3 - n)` se
negativo (-1 → ×3/4, -2 → ×3/5, -6 → ×1/3). Sorteia-se `rng() < chance`.

- `core/battle/accuracy.js`: `resolveMoveAccuracy` (campo `accuracy` da skill; omitido
  = **100**, `null` = nunca erra), `resolveHitChance`, `rollHit(attack, stage, rng)`.
  O `rng` é o `gameplayRng` (regra 3.5 de docs/rules).
- `accuracy` virou um **atributo com estágio** (`STAT_STAGE_KEYS`, trait `StatStages`
  com `accuracyStage`/`accuracyTime`): tem tempo, expira, acumula e é zerado ao
  desmaiar, como os demais. `accuracyMultiplier` é a fórmula própria dele.
- Como todo golpe tem 100% e o estágio padrão é 0, a chance é 1 e **nada muda no
  jogo até alguém baixar a precisão do atacante** — os golpes de hoje se comportam
  como antes.

#### Onde sorteia (`creatureAttackSystem.js`)

- **Golpe com dano** (normal): depois de achar o alvo na forma do golpe, sorteia. Errou
  → sem dano, o efeito visual cai no fim da trajetória (não no corpo) e o evento sai
  com `missed: true`. A geometria continua decidindo **quem está no alcance**; o
  sorteio decide se **acerta** quem está.
- **Golpe de status** (`applyAttackEffects`): cada alvo do cone tem o **próprio
  sorteio**; errou = nenhum efeito (sem estágio, sem brilho) naquele alvo.
- **Canalizado** (tick a tick, ex.: Brasa/Lança-chamas): **não sorteia** (um "errou" por
  tick seria ruído) — decisão a rever.
- `attackResolved` ganhou `missed`: `result` vira `'miss'` mas o `target` é mantido (o
  alvo que foi errado). Quem filtra `result === 'hit'` (brilho, hit stop, reação de
  selvagem/time) ignora sozinho — **um golpe errado não provoca a selvagem**.

#### Feedback

- Texto **"Errou!"** em cinza (`FEEDBACK.MISS_COLOR`) acima da cabeça de quem foi errado
  (`damageNumberSystem`).
- O estágio baixo aparece como os outros: texto "Precisão ↓", brilho de debuff e a
  etiqueta **PREC ↓1** na HUD (`StatStageBadges`) enquanto durar.

### O Smokescreen

`core/data/skills/smokescreen/index.js`: `damage: null`, `area: 'cone'`
(`range 3`, `radius 1.5`), efeito `{ stat: 'accuracy', stages: -1, duration: 30 }`,
`accuracy: 100`. Está no **slot 2 do Squirtle** (o Charmander tem os 3 slots ocupados) e
usa o clipe `roar`; o Cobblemon usa a animação `spray`, que ainda não tem equivalente.

#### Visual (Cobblemon → partículas) — `view/vfx/smokescreenVfx.js`

Tradução manual de `smokescreen_actor`, `smokescreen_actorspray` e `smokescreen_target`
(todos com o mesmo flipbook de fumaça de 8 quadros, tocado do último pro primeiro, e
gradiente cinza `#333233 → #0f0f0f`). Dois grupos:

- **`smokescreen`** (nasce na ponta do cone): `actor` — o sopro saindo da boca (0,7 s);
  `cone` — a nuvem ao longo do cone inteiro de uma vez (**instantânea**, regra dos
  efeitos desde o Ember; o original viaja da boca ao alvo), mais larga quanto mais longe.
- **`smokescreen-target`** (nasce no corpo de **cada alvo atingido**): a nuvem que
  engole o alvo (0,8 s). Só nasce em quem **não foi errado**, igual ao `q.missed` do
  original. Novo campo de skill: `visual.targetEffectGroup` /
  `targetEffectVisualDuration` (spawn em `applyAttackEffects`).
- **Som**: grupo composto `smokescreen` = `smokescreen-actor` + `smokescreen-target`
  (`attackSound.js`), os `.ogg` do Cobblemon em `public/assets/audio/attack/`. Textura:
  `public/assets/effects/smokescreen/generic.png`.

### Testes

`accuracy.test.js` (fórmula, sorteio, `null`); `statStages.test.js` (`accuracyMultiplier`,
efeito `accuracy`); `creatureAttackSystem.test.js` (erro determinístico com
`accuracy: 0`, estágio -6 erra e acerta, 100%/estágio 0 nunca erra); `damageNumberSystem
.test.js` ("Errou!"); `smokescreenVfx.test.js` (emissores e a skill).

**Não testado em jogo** (sem navegador): a aparência da fumaça (tamanho, densidade,
escuridão), o tamanho do cone e o alinhamento da nuvem do alvo.

---

## Parte 6 — VFX de pulo (poeira)

### Resumo

Anel de poeira no chão na **decolagem** de um pulo e na **aterrissagem** de
qualquer queda. Vale para **toda criatura** (jogador, time, selvagens).

Decisões do usuário (perguntadas antes de implementar):

| Pergunta | Decisão |
|---|---|
| Quais efeitos | **Poeira na decolagem + na aterrissagem** |
| Aterrissagem | **Qualquer uma**, inclusive a que não vem de um pulo (queda de uma borda) |
| Quem | **Qualquer criatura** |

### Como funciona

- `view/scene/JumpDustView.jsx` lê, a cada frame, `Grounded`, `Velocity.y` e a posição
  dos pés de toda criatura com `CharacterController`; `view/vfx/jumpDustManager.js`
  (testável sem WebGL) acompanha a transição de cada uma.
- **Decolagem**: saiu do chão com `vy > 0` (pulo). Sair de uma borda caindo não solta
  poeira de decolagem. Poeira fixa, mais fraca (`TAKEOFF_COUNT`).
- **Aterrissagem**: voltou ao chão depois de estar no ar. A força vem da **maior
  velocidade de queda** vista no ar (`-vy`): abaixo de `MIN_FALL_SPEED` (degrau, rampa)
  não solta nada; de `MIN_FALL_SPEED` a `MAX_FALL_SPEED` cresce em quantidade, tamanho e
  velocidade de espalhamento. Uma criatura vista pela primeira vez só registra o estado.
- **Partículas** (`view/vfx/jumpDustVfx.js`): o mesmo flipbook de fumaça do dash
  (`big_smoke`), num anel que sai radialmente no plano do chão, sobe de leve e esvazia.
  Efeito próprio — o Cobblemon não tem poeira de pulo. Cor de poeira clara
  (`#d6d0c4 → #a39b8b`), sem colisão com o chão.
- Config em `GAME_CONFIG.FEEDBACK.JUMP_DUST` (liga/desliga, `SCALE`, velocidades de queda,
  quantidade de nuvens). Valores de partida.

### Testes

`jumpDustManager.test.js` (decolagem só com `vy > 0`, aterrissagem de qualquer queda com
força proporcional, queda curta ignorada, pulo completo, descarte) e `jumpDustVfx.test.js`
(anel radial, termina sozinho).

**Não testado em jogo** (sem navegador): tamanho/densidade da poeira, e se a velocidade de
queda lida por frame (60 Hz) pega as quedas muito curtas.

---

## Parte 7 — Skills do Bulbasaur: Growth, golpe em si mesmo, interrupção e carga

### Resumo

Rodada das skills do Bulbasaur. Primeira entregue: o **Growth** (Crescimento),
a primeira skill de status em **si mesmo**. Ela sobe o Ataque e o Ataque Especial
de quem usa.

Decisões do usuário (perguntadas antes de implementar):

| Pergunta | Decisão |
|---|---|
| O que sobe | **+1 Ataque e +1 Ataque Especial** (regra da Geração 5 em diante), 60 s, renovável |
| Visual | **O statup do Cobblemon**: orbes em espiral e riscos subindo |
| Animação | **`charge`** do `.glb` |
| Slot | o usuário configura |

O Cobblemon não tem efeito próprio pro Growth. O golpe cai no `generic_move.json`, e
a subida de atributo toca o boost genérico (`misc/boost.json` → `statup_actor`, que
cria o `statup_actoraura` e toca o som `status.up.actor`). É ele que foi traduzido.

### Golpe em si mesmo (`area: 'self'`)

Até aqui os `effects` só iam em inimigos (cone ou primeiro corpo). `area: 'self'`
(`isSelfAttack`, `core/battle/channelAttack.js`, ao lado de `isConeAttack`):

| | Growl (`area: 'cone'`) | Growth (`area: 'self'`) |
|---|---|---|
| Quem recebe o efeito | inimigos no cone | quem usou |
| Sorteio de precisão | sim, por alvo | não (no Pokémon, golpe em si mesmo não erra) |
| `statStageChanged` | um por alvo e atributo | um por atributo, `attacker` = `target` |
| `attackResolved` | um por alvo (`status: true`) | **nenhum**: sem alvo, ninguém se provoca nem defende |
| Indicador de mira | cone | nenhum |
| Aviso no chão (a carga) | cone vermelho | **círculo verde nos pés** |
| Rotação | vira pra câmera e é reapontada na carga | **travada** onde estava, até o fim da ação |
| Botão | aperta e solta | **segurado durante a carga**, como o canalizado do Charmander |
| Onde o `AttackEffect` nasce | ponta do cone | **nos pés** de quem usou |

- `creatureAttackSystem.js`: no `effectAt`, `isSelfAttack` vem antes do ramo de dano.
  `applySelfEffects` aplica os efeitos no próprio atacante, e o VFX nasce em
  `pos.y - verticalClearance(controller)`.
- O `AttackIndicatorView` esconde a forma (não tem pra onde mirar).
- **Rotação travada** (pedido do usuário): no disparo, a direção do golpe vira a
  direção pra onde o corpo já estava (`resolveFacingDirection`), sem `rot.y`
  novo, e o reapontar durante a carga (`ATTACK_WINDUP_STEERING`) pula golpe em si
  mesmo. O `movementSystem` já trava o resto durante qualquer ação.
- **Botão segurado** (pedido do usuário, igual ao canalizado): `requiresHold` no
  `creatureAttackSystem` — o canalizado exige o botão o tempo todo; o golpe em si
  mesmo, só durante a CARGA (`isAttackCharging`). Soltar antes do efeito cancela
  pelo mesmo caminho do canalizado (`finishAttack`: o cooldown começa, a stamina
  não volta, sem texto "Interrompido!", que é só pra dano). Depois que o efeito
  saiu, soltar não muda nada. Um toque muito rápido (apertar e soltar antes do
  próximo tick) cancela, como no canalizado.
- O feedback que já existia vale sem mudança: o brilho verde/ciano
  (`hitFlashSystem`), o texto "Ataque ↑" e "Atq. Esp. ↑" (espalhados pelo
  `SPREAD_PATTERN`) e as etiquetas "ATQ ↑1" e "ATQ.E ↑1" na HUD.
- Lançar o Growth também põe a criatura em modo combate, como todo ataque lançado
  (`entrarEmCombate` no disparo).

### Interrupção de golpe de status

Pedido do usuário: golpe de status, positivo ou negativo, pode ser cancelado pelo
oponente com dano, mas só antes de sair. Decisões (perguntadas antes):

| Pergunta | Decisão |
|---|---|
| Janela | **A carga**: do disparo até o `effectAt`. Depois, o efeito já foi aplicado |
| Aviso do golpe em si mesmo (não tinha) | **Círculo nos pés**, enchendo até o `effectAt` |
| Penalidade | **Perde a stamina e o cooldown começa** |
| Feedback | **Texto "Interrompido!"** acima da cabeça |
| Escopo | **Só status** (`damage: null` com `effects`); golpe de dano segue igual |

- **Regra única**: interrompível = golpe de status na carga
  (`isInterruptible`, `core/battle/attackInterrupt.js`). No status negativo (Growl,
  Smokescreen) a carga é o aviso em cone que já existia; no golpe em si mesmo
  (Growth) a carga ganhou o aviso em círculo. Tudo que é interrompível mostra a
  carga no chão.
- **Instante do efeito**: `resolveAttackHitTime` (`core/battle/attackTelegraph.js`)
  — o `effectAt` real da ação, que o aviso e a interrupção usam igual.
- **No `creatureAttackSystem`**: quem leva dano no tick (golpe ou tick de canal)
  entra num conjunto, e um passo 5, depois do avanço de todos os golpes, interrompe
  quem estava carregando status (`interruptStatusAttacks`). Fica fora do
  `updateEach` pra não mexer na ação de outra entidade no meio da passada. A ação
  acaba pelo mesmo `finishAttack` do fim normal (o cooldown começa), a stamina
  gasta no disparo não volta, e sai o evento `attackInterrupted`.
- **Feedback**: `damageNumberSystem` mostra "Interrompido!" acima da cabeça, no
  esquema do "Errou!", na cor `FEEDBACK.INTERRUPT_COLOR` (amarelo).
- **Atordoamento** (pedido do usuário): quem é interrompido, além do texto, toca a
  animação de hit e não faz nada por um tempo. É a ação `'hit'`
  (`iniciarAtordoamento`, `core/actions/hitStun.js`), começada na interrupção logo
  depois do `finishAttack`. O `creatureHitStunSystem` (logo depois do
  `creatureAttackSystem`) a avança, mantém a criatura parada e a encerra no fim.
  Duração: `species.actions.hit.duration`, ou o padrão
  `GAME_CONFIG.BATTLE.HIT_STUN_DURATION` (0.67 s, a `hit` dos iniciais na velocidade
  original). Enquanto dura, movimento, ataques e outras ações já não acontecem
  (ação em andamento); o pulo, que antes não olhava a ação, agora também é
  bloqueado (`isHitStunned` no `characterPhysicsSystem`). Animação: estado `'hit'`
  em `animationStates.js`, mapeado pra animação `hit` do `.glb` em
  `nativeAnimations` do Bulbasaur, Charmander e Squirtle.
- **Círculo**: `placeAttackShape` desenha um disco de raio `attack.radius` nos pés,
  preenchendo do centro pra borda; `AttackTelegraphView` pinta cada forma do pool
  pelo tipo (`paintAttackShape`): vermelho no golpe comum,
  `ATTACK_TELEGRAPH.SELF_FILL_COLOR`/`SELF_EDGE_COLOR` (verde) na carga do golpe em
  si mesmo.
- Hoje a IA (selvagens e time fora do controle) só usa o ataque básico, então na
  prática quem tem golpe de status interrompido é a criatura que você controla.

### O Growth

`core/data/skills/growth/index.js` (valores de PARTIDA, sem validação em jogo):
`duration 5`, `effectAt 4.5` (carga longa, rebalanceada pelo usuário),
`radius 0.5`
(raio da espiral do VFX), `staminaCost 2`, `cooldown 1`, efeitos `attack +1` e
`sp_atk +1` por 60 s. Animação: `clipKey: 'charge'`; no Bulbasaur, `nativeAnimations.charge:
{ loop: 'charge' }` (a `charge` de 1 s repete durante a carga, sem esticar —
o formato `{ start, loop, end }` encaixa a sequência na duração da ação). Som: grupo `'statup'`
(`public/assets/audio/attack/statup/attack-01.ogg`, o `stat_up_actor.ogg` do
Cobblemon). Ícone: `public/assets/sprites/abilities/growth.png` (gerado: um broto e
uma seta pra cima; troque pelo seu).

Hoje está no slot 1 (Q) do Bulbasaur.

### VFX `'statup'`

`view/vfx/statupVfx.js` + `StatupAttackEffect.jsx`, textura `xsboost.png` (orbe
laranja, 9 quadros) em `public/assets/effects/statup/`.

| t | Emissor | O que é | Duração |
|---|---|---|---|
| 0.10 | `orbs` | orbes subindo numa espiral em volta do corpo (30/s) | 0.375 s |
| 0.10 | `aura` | riscos verticais disparando de baixo dos pés (60/s) | 0.3 s |

Termina em ~1 s (`effectVisualDuration: 1`). Diferenças pro original, comentadas no
arquivo:

- As expressões dependem de `entity_width`/`entity_height`, presas em mínimo 1. Pras
  criaturas daqui vale o mínimo: altura 1, e a largura vem do `radius` da skill
  (`radius 0.5` = largura 1).
- `visual.scale` (0.6 no Growth) encolhe o efeito inteiro: além de posição e tamanho
  (que o motor já escala), velocidade e aceleração são multiplicadas pela escala.
- O `lookat_y` dos riscos virou `facing: 'direction'` (quadro ao longo do
  movimento, que é vertical).

#### Correção no motor: partículas viradas pra câmera

`useParticleAttackEffect` nunca passava a câmera pro sistema, então todo emissor
`facing: 'direction'` virava a face pra +Z local fixo em vez de pra câmera. Um risco
fino visto de lado sumia. Agora o hook passa a posição da câmera no espaço local do
efeito a cada frame. **Isso muda também as ondas do Growl**, que passam a ficar de
frente pra câmera, como a Parte 4 já descrevia.

### Carga: visual e som enquanto o golpe carrega

Pedido do usuário: com a carga longa (o Growth foi pra `duration 5`, `effectAt
4.5`), a criatura só fazia a animação, sem som nem efeito, até o efeito sair.

- **Janela**: a mesma do aviso no chão e da interrupção — `isAttackCharging`
  (`core/battle/attackTelegraph.js`), do disparo até o `effectAt`. Acaba no efeito
  ou quando o golpe é interrompido (a ação some).
- **Visual** (`visual.chargeGroup` da skill): `ChargeEffectsView` (hoje `ContinuousAttackEffectsView`, ver Parte 10) roda o efeito do
  grupo em volta de quem carrega, com o quadro nos pés, e encerra no fim da carga
  (as partículas vivas terminam sozinhas). Grupo `'absorb'`
  (`view/vfx/absorbChargeVfx.js`): orbes verdes girando num anel em volta do corpo
  e se fechando no centro — o `gigadrain_actor`/`actorouter` do Cobblemon, sem o
  alvo (lá os orbes viajam do alvo pro usuário). Raio do anel = `1.5 × radius` e
  `2.1 × radius` (`radius 0.5` = o original), `visual.scale` encolhe tudo.
- **Som** (`audio.chargeGroup`): uma voz a mais por slot no áudio de ataque
  (`resolveAttackChargeSounds`), tocada em LOOP pelo `attackAudioSystem` enquanto a
  carga durar e parada quando ela acaba. Grupo `'absorb-charge'`: o
  `gigadrain_actor.ogg` (1.8 s).
- O Synthesis (golpe de "absorver sol") seria o tema mais próximo, mas no pacote
  ele não está ligado a nada e a textura dele não existe — por isso o Giga Drain.
- Growth: `visual.chargeGroup: 'absorb'`, `audio.chargeGroup: 'absorb-charge'`. No
  `effectAt` continuam o statup e o som de atributo subindo.

Mudanças no motor de partículas, pra traduzir o Giga Drain:

- **`path`** (o `particle_motion_parametric` do Bedrock): a posição é uma função da
  idade (`stepPathParticle`), em vez de velocidade e aceleração.
- **`rows`/`row`**: atlas horizontal com mais de uma linha (o orbe do Giga Drain
  tem 2).
- **`createFollowEffectManager`** (`view/vfx/followEffectManager.js`): o antigo
  `dashEffectManager` ficou genérico (`{ key, active, ... }`), e o
  `createSystem(follower)` recebe o seguidor — a carga monta o sistema pelo grupo,
  raio e escala da skill. O dash usa igual.

### Testes

Atordoamento: `hitStun.test.js` (duração padrão e por espécie, a ação "hit" do
começo, `isHitStunned`), `creatureHitStunSystem.test.js` (parada enquanto dura,
acaba no fim, não mexe em quem não está atordoada), `characterPhysicsSystem.test.js`
(atordoada não pula), `animationStates.test.js` (`'hit'` é one-shot e vence
locomoção e combate) e `creatureAttackSystem.test.js` (a interrupção termina em
`'hit'`).

Botão segurado: `creatureAttackSystem.test.js` (soltar o Q na carga cancela, sem
efeito, com cooldown e sem devolver stamina; soltar depois do efeito não cancela).
Os testes do Growth e da interrupção passaram a segurar o Q, e "apertar a mesma
tecla de novo também confirma" passou a mandar o aperto junto com a tecla segurada,
como o `keyboardInput.js` faz.

Carga: `attackTelegraph.test.js` (`isAttackCharging`), `attackSound.test.js`
(`resolveAttackChargeSounds` e o arquivo existe), `attackAudioSystem.test.js` (o som
de carga toca em loop uma vez, para no `effectAt` e quando a ação acaba),
`particleSimulation.test.js` (`path`: posição pela idade, girada pelo yaw e
escalada), `particleEmitter.test.js` (os orbes ficam no anel, na meia altura, se
fecham com a idade, terminam depois do `endEmission` e cada emissor usa a sua linha
do atlas) e `followEffectManager.test.js` (`createSystem` recebe o seguidor). Os
testes do Growth no `creatureAttackSystem` passaram a calcular quantos ticks
avançar pelo `effectAt` da skill (antes tinham um limite fixo de 4 s).

Interrupção: `attackInterrupt.test.js` (só status, só na carga, golpe de dano
nunca), `attackTelegraph.test.js` (`resolveAttackHitTime`; o golpe em si mesmo tem
aviso), `creatureAttackSystem.test.js` (a selvagem acerta na carga do Growth: sem
efeito, cooldown começou, stamina não voltou, `attackInterrupted`; acertar depois
do `effectAt` não interrompe; o Growth não gira a criatura) e
`damageNumberSystem.test.js` ("Interrompido!" acima da cabeça).

- `creatureAttackSystem.test.js` ("Growth"): sobe os dois atributos de quem usou e o
  inimigo à frente não muda; acumula e trava em +6 sem evento; `statStageChanged` com
  `attacker = target` e nenhum `attackResolved`; não erra com precisão -6; o
  `AttackEffect` nasce nos pés.
- `channelAttack.test.js` (`isSelfAttack`), `attackTelegraph.test.js` (sem aviso),
  `attackSound.test.js` (grupo `statup` e o arquivo existe), `skills/index.test.js`
  (registro e ícone), `particleEmitter.test.js` (statup: o atraso de 0.1 s, os orbes
  em volta do corpo, termina em ~1 s, a escala encolhe tudo).

**Não testado em jogo** (sem navegador): tamanho do statup no Bulbasaur, a `charge`
com o golpe, os dois textos "↑" ao mesmo tempo e o volume do som.


---

## Parte 8 — Correção: personagens presos colados no oponente

### Resumo

Problema relatado jogando: no meio do combate, colado no oponente e clicando
golpes, a criatura ficava **presa** nele — não conseguia andar pra longe; só
saía com pulo ou dash.

Eram duas causas, as duas no movimento dos personagens
(`characterPhysicsSystem.js`), e as duas medidas antes de corrigir — com o
Rapier isolado e com os systems reais do jogo numa simulação de combate:

| Causa | Quem pega | Sintoma |
|---|---|---|
| **Defeito do character controller do Rapier** com outro corpo cinemático por perto | todo personagem | preso sem sobreposição nenhuma |
| **Giro aplicado sem conferir colisão** | cápsula deitada (Bulbasaur, Fox) | a ponta da cápsula entra no oponente |

### Causa 1 — o character controller do Rapier prende quem está colado noutro personagem

Medido isolado (Rapier 0.20, o do projeto, e 0.21, o mais novo): um personagem
**apoiado no chão** — a base dentro da folga do controller (`CONTROLLER_OFFSET`,
3 cm), que é o estado normal de quem está parado — com **outro corpo cinemático**
a poucos centímetros não anda **nem pra longe nem pra perto** dele, só de lado.
Sem sobreposição nenhuma.

| Situação (vizinho a 4 cm) | Afastar | De lado | Aproximar |
|---|---|---|---|
| Vizinho cinemático (personagem), com o chão na consulta | **0** | anda | **0** |
| Vizinho fixo (parede), com o chão | anda | anda | para na folga |
| Vizinho cinemático, sem o chão na consulta | anda | anda | para na folga |
| Personagem sozinho, com o chão | anda | anda | — |

O controller deixa as criaturas que se encostam exatamente a essa distância (a
folga dele), então no combate corpo a corpo isso acontecia o tempo todo. O
pulo solta porque tira a base da folga do chão. Nos testes isolados o resultado
variava com a posição no mundo (em alguns pontos travava só um lado), o que
explica o "às vezes" do jogo. Não depende de autostep nem de snap ao chão.
Atualizar pro 0.21 não resolve.

**Correção — duas passadas**: o movimento pedido passa primeiro por um segundo
controller (`getCharacterAvoidanceController`, `core/physics/physicsWorld.js`:
mesma folga, sem autostep nem snap) que só enxerga os OUTROS personagens
(`charactersOnlyFilterFlags`, sem o chão), e o resultado passa pelo controller
de sempre, que só enxerga o terreno (`terrainOnlyFilterFlags`) e dá a palavra
final (autostep, snap, `grounded`). Com chão e personagens em consultas
separadas, o defeito não aparece:

- afastar, andar de lado e aproximar funcionam em todas as posições testadas;
- andar contra outro personagem continua parando na folga, sem entrar;
- a passada de personagens leva o movimento inteiro, inclusive o vertical (cair
  em cima de outro continua respeitando ele);
- parado no chão ou desmaiado continua só com o terreno, como antes;
- a ordem (personagens antes do terreno) deixa o terreno com a palavra final:
  desviar de uma criatura nunca empurra pra dentro de uma parede.

### Causa 2 — o giro não passava pela física

O controller confere colisão no **deslocamento**; a **rotação** era aplicada
direto (`setNextKinematicRotation`). Cápsula em pé é igual de qualquer lado, mas
a do Bulbasaur (1 m) e a do Fox (1,7 m) são **deitadas**, compridas pra frente:
ao virar colada noutra criatura, a ponta varre pra dentro dela. No combate isso
é constante — o golpe vira o corpo de uma vez pra mira no disparo
(`tryStartAttack`), a assistência de mira puxa pro alvo, a carga acompanha a
câmera, a caminhada vira a 10 rad/s.

Na simulação de combate (Bulbasaur controlado chegando no oponente na diagonal
ou de lado e clicando), o log mostrou a sobreposição começando no tick do golpe,
com o corpo girando 0,65 rad de uma vez: até **51 cm** de sobreposição, em até
1096 de 1200 ticks. Com cápsula em pé (Charmander controlado), nenhuma.

**Correção — `resolveFreeTurn`** (`core/physics/colliders.js`): antes de girar,
mede a distância da cápsula, na rotação nova, até o outro personagem mais
próximo (`characterClearance` — só personagens, só cápsula deitada). O giro não
pode deixar a cápsula mais perto que a folga do controller — ou, se ela já está
mais perto, mais perto do que está (pode girar pra sair, nunca pra entrar). Se
o giro inteiro não cabe, uma busca binária acha o maior pedaço que cabe. O
`characterPhysicsSystem` aplica esse giro e devolve o `rot.y` real pro ECS
(corpo e modelo iguais; quem pediu o giro tenta de novo no próximo tick) — o
único caso em que ele escreve `Rotation`.

Duas armadilhas encontradas no caminho, e evitadas:

- uma folga de "não piorou" a cada tick se acumula (1 mm por giro pequeno) — já
  sobreposto, não há folga nenhuma;
- deixar o giro chegar a encostar (sem a folga do controller) já basta pra
  prender: a regra usa a folga, não "não sobrepor".

### Resultado na simulação de combate

Systems reais, 20 s por cenário, chegando no oponente de frente, na diagonal e
de lado, clicando golpes com a câmera balançando e tentando ir embora a cada
4 s:

| | Antes | Depois |
|---|---|---|
| Pior sobreposição (Bulbasaur) | 51 cm | nenhuma |
| Ticks sobrepostos | até 1096/1200 | 0 |
| Consegue ir embora | não (travado) | sim, em todo ciclo |

### Não muda

- O pulo e o dash continuam como estavam.
- Desvio proativo (`creatureFollowSystem`) e a regra de que personagens não se
  atravessam continuam iguais.
- O custo: a passada extra de personagens e, só pra cápsula deitada que está
  girando, até 8 consultas de distância por tick.

### Testes

- `characterPhysicsSystem.test.js` — "colado noutro personagem": encostado e
  apoiado no chão, consegue se afastar, em 5 posições do mundo (física nova em
  cada uma); conferido **falhando** com a passada única antiga (afastava 13 cm
  em vez de andar). Andar contra o outro para na folga, sem entrar.
- `colliders.test.js` (novo) — `resolveFreeTurn`: o giro que enfiaria a ponta é
  cortado onde ainda cabe; com o vizinho na frente, virar de lado é livre;
  meia-volta é livre; sem ninguém perto gira tudo; cápsula em pé gira sempre;
  já sobreposto, gira pra sair e não pra entrar mais.
- `creatureAttackSystem.test.js` — "depois do efeito, soltar o botão não
  cancela" passou a usar um Growth com efeito antes do fim (override só no
  teste): com o balanceamento atual (`effectAt` = `duration`) não sobra
  animação depois do efeito.

---

## Parte 9 — Leech Seed (dreno ao longo do tempo)

Skill do Bulbasaur: o primeiro golpe que age **ao longo do
tempo**. Planta uma semente no alvo; a cada drenagem ela tira HP dele e cura
quem plantou.

Decisões do usuário (perguntadas antes de implementar):

| Pergunta | Decisão |
|---|---|
| Drenagem | **1/8 do HP máximo a cada 2 s** (a regra do Pokémon, com 2 s no lugar do turno) |
| Duração | **Tempo fixo, renovável** (10 s = 5 drenagens = 62,5% do HP); acaba antes se o alvo desmaiar |

Valores atuais, rebalanceados pelo usuário depois: **1/16 do HP a cada 2 s, por
6 s** (3 drenagens = 18,75% do HP). Os números abaixo são os do lançamento.
| Cura | **O mesmo valor drenado** volta pra quem plantou |
| Visual da drenagem | **Orbes do alvo até quem plantou**, mais o estouro e os brotos no alvo; número de dano no alvo e "+N" de cura em quem plantou |

O resto segue os padrões do projeto: alvo único (o primeiro corpo na trajetória,
como o básico), sorteio de precisão de 90% (como no Pokémon), interrompível na
carga (golpe de status). As espécies ainda não têm tipo, então a imunidade das
plantas não existe aqui.

### Como funciona

- **Efeito novo de skill** — `{ type: 'leechSeed', fraction, interval, duration }`
  em `effects`, aplicado no acerto por `applyAttackEffects` como os estágios de
  atributo: `plantarSemente` (`core/actions/leechSeed.js`) põe no alvo o trait
  `LeechSeed` (`timeLeft`, `tickTimer`, `fraction`, `interval`) e a relação
  `SeededBy(quem plantou)` (`core/traits/components/leechSeed.js`). Plantar de
  novo renova o tempo, mantém o ritmo e troca quem recebe a cura.
- **Relação separada da semente, de propósito**: se quem plantou some (criatura
  recolhida = entidade destruída), o Koota tira `SeededBy` sozinho e a semente
  continua drenando, só sem curar ninguém. Quem plantou desmaiado também não é
  curado.
- **`leechSeedSystem`** (simulation, logo depois do `creatureHitStunSystem` e
  antes do `faintSystem`): conta o tempo; a cada `interval` drena
  `resolveLeechDrain` (1/8 do máximo, mínimo 1, até o HP que sobra), cura quem
  plantou (`applyHeal`, até o máximo dele), emite `leechSeedDrained` e solta o
  visual da drenagem. Alvo desmaiado ou zerado perde a semente na hora; quem a
  drenagem zerar desmaia no mesmo tick.
- **A drenagem é dano passivo**: não provoca a selvagem (não sai
  `attackResolved`) nem interrompe golpe de status do alvo. O acerto em si (o
  plantio) conta como golpe de status e provoca, como o Growl.
- **Números** (`damageNumberSystem`): o dano no alvo, na cor de dano do lado
  dele, e "+N" em quem plantou, na cor de atributo que sobe do lado dele (só se
  recuperou algo).

### O Leech Seed

`core/data/skills/leech-seed/index.js` (valores de PARTIDA, sem validação em
jogo): `range 5`, `radius 0.4`, `aim: 'ranged'`, `duration 1.2`, `effectAt 0.6`,
`staminaCost 3`, `cooldown 1`, `accuracy 90`, `damage: null`, efeito
`{ type: 'leechSeed', fraction: 1/8, interval: 2, duration: 10 }`. Animação
`clipKey: 'attackRanged'` (o Bulbasaur já mapeia). Som: grupo composto
`'leech-seed'` — `leechseed_actor` na hora e `leechseed_target` 0,35 s depois,
quando a semente pousa. Ícone `public/assets/sprites/abilities/leech-seed.png`
(gerado: uma semente com um broto; troque pelo seu). O usuário já o colocou no
slot 1 do Bulbasaur (o `growth` ficou comentado).

### Visual (Cobblemon → partículas) — `view/vfx/leechSeedVfx.js`

| Grupo | t | Emissor | O que é |
|---|---|---|---|
| `'leech-seed'` (o lançamento, nasce no alvo) | 0.00 | `seeds` | ~4 sementes voando em arco de quem lançou até o alvo (0,35 s) |
| | 0.35 | `burst` | 4 orbes estourando no alvo |
| | 0.35 | `sprout` | um broto no alvo |
| | 0.35 | `sparkle` | brilhos subindo em volta |
| `'leech-drain'` (cada drenagem, nasce no alvo) | 0.00 | `hit` | 20 orbes estourando no alvo (o `megadrain_actorhit`) |
| | 0.00 | `sprouts` | brotos num anel em volta do alvo |
| | 0.00 | `stream` | orbes em espiral indo do alvo até quem plantou |
| `'leech-drain-solo'` | | `hit`, `sprouts` | a drenagem sem quem plantou: não há pra onde puxar |

- Tradução de `leechseed_actor`, `leechseed_target`, `leechseed_sprout`,
  `leechseed_sproutpassive`, `leechseed_targetsparkle` e `megadrain_actorhit`
  (o Cobblemon usa os dois últimos no dano por turno do Leech Seed). Os orbes
  indo até quem plantou são escolha do usuário — o Cobblemon não tem —, com o
  giro do Giga Drain.
- As sementes **voam** (0,35 s) em vez de nascer no alvo, como manda a regra dos
  golpes de dano (Parte 2): aqui nada acontece no `effectAt` além do plantio, a
  1ª drenagem só vem 2 s depois.
- O visual da drenagem é um `AttackEffect` que o `leechSeedSystem` solta no
  alvo, girado de quem plantou pro alvo, com `length` = a distância entre os
  dois (a convenção de sempre: "a criatura" em (0, 0, -length)). Duração em
  `GAME_CONFIG.BATTLE.LEECH_DRAIN_EFFECT_DURATION` (1,6 s).
- O motor ganhou `length` no que o `path` enxerga (`particle.emitter.length`) —
  as sementes e os orbes viajam pelo comprimento do golpe.
- Texturas em `public/assets/effects/leech-seed/` (e o orbe do Giga Drain, já em
  `effects/absorb/`); sons em `public/assets/audio/attack/leech-seed-actor/` e
  `leech-seed-target/`.

### Testes

- `leechSeed.test.js` (action): plantar (tempo, ritmo, 1ª drenagem depois de um
  intervalo, relação), renovar (mantém o ritmo, troca quem cura), efeito de
  outro tipo; `resolveLeechDrain` (1/8 arredondado, mínimo 1, até o HP que sobra).
- `leechSeedSystem.test.js`: drena e cura a cada 2 s; 10 s = 5 drenagens e seca;
  cura limitada ao máximo; quem plantou sumiu → drena sem curar; quem plantou
  desmaiado → não cura; visual `'leech-drain'` com o `length` certo e
  `'leech-drain-solo'` sem quem plantou; alvo desmaiado perde a semente.
- `creatureAttackSystem.test.js`: acertando, o alvo ganha a semente ligada a
  quem lançou, sem dano na hora; errando no sorteio, sem semente.
- `damageNumberSystem.test.js` (dano e "+N"; sem cura, só o dano),
  `particleEmitter.test.js` (sementes saem de quem lançou e chegam no alvo;
  estouro e broto só no pouso; orbes da drenagem chegam perto de quem plantou;
  sem quem plantou, sem orbes viajando; tudo termina sozinho),
  `attackSound.test.js` (atrasos do composto e os arquivos), `skills/index.test.js`
  (registro e ícone).

**Não testado em jogo** (sem navegador): o arco e o tamanho das sementes, os
brotos no Bulbasaur/alvos pequenos, e os números de cura.

---

## Parte 10 — Water Gun (jato de água canalizado em feixe)

Skill de dano à distância do Squirtle (slot 2, E). Primeiro saiu como impacto
único (como no Pokémon); em seguida o usuário pediu uma **modalidade nova**:
canalizado como a Brasa, mas sem o cone — continua com o formato do golpe normal
e pega **só o primeiro corpo**, e **dá pra mirar enquanto segura**.

### Canalizado em feixe (`area: 'line'`)

Modo genérico, pra qualquer skill: `damageMode: 'channel'` + `area: 'line'`
(`isBeamAttack`, `core/battle/channelAttack.js`).

| | Canalizado em cone (Brasa) | Canalizado em feixe (Water Gun) |
|---|---|---|
| Forma (indicador, aviso, alvos) | cone | a cápsula do golpe normal (`isConeAttack` é falso pro feixe) |
| Quem leva cada tick | todos no cone | só o **primeiro corpo** na linha (`resolveAttackTarget`); a trajetória para nele |
| Mira | só na carga (até o `effectAt`) | **o canal inteiro**: a criatura controlada reaponta pra câmera a cada tick, e o corpo junto |
| Visual | estático, nasce no `effectAt` | o jato segue a mira (`visual.channelGroup`) e respinga onde bate a cada tick (`visual.channelHitGroup`) |

O resto é o canalizado de sempre: segurar o botão, soltar corta (o cooldown
começa, a stamina não volta), o canal inteiro vale o dano de UM golpe repartido
em frações sorteadas por tick, crítico por tick, sem sorteio de precisão. Trocar
de alvo no meio do canal: cada um leva as frações dos ticks em que esteve na
frente. Golpe de dano: não é interrompido.

- **`creatureAttackSystem`**: a mira da carga (`ATTACK_WINDUP_STEERING`) segue
  valendo depois do `effectAt` quando o golpe é feixe; o tick de canal
  (`applyChannelTick`) usa a trajetória normal e o primeiro corpo, e solta o
  efeito de impacto do tick (`spawnChannelHitEffect`) no ponto de contato — ou no
  fim da trajetória, se não pegou ninguém.
- **`isAttackChanneling`** (`core/battle/attackTelegraph.js`): o canal está
  rodando (do `effectAt` até a ação acabar).
- **`ContinuousAttackEffectsView`** (era a `ChargeEffectsView` da Parte 7): os
  efeitos que duram uma fase do golpe — a carga (`chargeGroup`, nos pés) e agora
  o canal (`channelGroup`): quadro na **boca** (`resolveAttackOrigin`), virado
  pra direção do golpe de agora, com `length` = até onde a trajetória bate agora
  (`resolveAttackImpactPoint`, a mesma do dano). Cada fase tem a própria chave
  (`<entidade>:charge`/`:channel`), então a passagem de uma pra outra cria
  sistemas separados.
- **Motor de partículas**: o quadro (`setFrame`) pode trazer `length` — o
  comprimento de agora vale pra partícula que nasce (o feixe muda de tamanho a
  cada frame); o `followEffectManager` repassa.

### O Water Gun

`core/data/skills/water-gun/index.js` (valores de PARTIDA): `damageMode:
'channel'`, `area: 'line'`, `damageInterval 0.25`, `duration 2.5` (o canal),
`effectAt 0.6`, `range 5`, `radius 0.35`, `aim: 'ranged'`, `staminaCost 2`,
`cooldown 1`, `damage: { power: 40, category: 'special', type: null }` (o total
de segurar até o fim com o alvo na frente). Visual: `effectGroup: 'none'`,
`channelGroup: 'water-jet'`, `channelHitGroup: 'water-gun-hit'` (0,9 s). Som:
grupo composto `'water-gun'` (`watergun_actor` e `watergun_target` juntos, no
começo do canal). Animação `clipKey: 'attackRangedAlt'` — no Squirtle,
`{ start: 'attackRangedAltStart', loop: 'attackRangedAltLoop', end:
'attackRangedAltEnd' }` (0,67 s / 0,63 s em loop / 0,9 s): o loop repete
enquanto o botão está segurado. O `.glb` também tinha a `attackRanged` sem
mapeamento — mapeada. Ícone `public/assets/sprites/abilities/water-gun.png`
(gerado; troque pelo seu).

### Visual (Cobblemon → partículas) — `view/vfx/waterGunVfx.js`

| Conjunto | Emissores | Onde |
|---|---|---|
| `WATER_JET_EMITTERS` (grupo `'water-jet'`, o canal) | `spray` (borrifo na boca), `jet` (gotas da boca até onde o feixe bate, ondulando) — contínuos até o canal acabar | quadro na boca, seguindo a mira |
| `WATER_GUN_HIT_EMITTERS` (grupo `'water-gun-hit'`, cada tick) | `splash` (respingo), `foam` (espuma azul) | onde o feixe bateu |
| `WATER_GUN_EMITTERS` (grupo `'water-gun'`, o tiro único) | os quatro juntos | sem uso hoje (fica pra uma skill de impacto único) |

- Tradução de `watergun_spray`, `watergun_actor`, `watergun_target` e
  `watergun_targetfoam`. Texturas em `public/assets/effects/water-gun/`.
- Cada gota do jato sai na direção da mira do instante em que nasceu e segue
  reto: mirar varre o jato num arco, e o fim dele acompanha a mira em ~0,7 s.
- No canal, o jato termina onde bate (o tiro único passa 10% do alvo, como no
  original).
- Velocidades das gotas × 0,5 (criaturas menores que as do Minecraft); sem
  colisão com o chão; as cores do Bedrock (`#AARRGGBB`) entram só pelo RGB.

### Testes

- `creatureAttackSystem.test.js` ("canalizado em FEIXE"): só o primeiro corpo
  na linha leva os 4 ticks (o de trás, nenhum); a forma é a cápsula; a criatura
  controlada continua mirando depois do `effectAt` (o cone, não); cada tick solta
  o efeito de impacto no corpo atingido.
- `channelAttack.test.js` (`isBeamAttack`; feixe não é cone),
  `attackTelegraph.test.js` (`isAttackChanneling`),
  `followEffectManager.test.js` (o `length` vai pro quadro).
- `particleEmitter.test.js`: o jato vai até o `length` do quadro sem passar; o
  feixe encurtou → as gotas novas param antes; o yaw leva o jato junto; solta até
  o `endEmission` e termina; o respingo termina em menos de 0,9 s. Do tiro único:
  o jato sai da boca e passa um pouco do alvo; borrifo na boca, respingo e
  espuma no alvo.
- `attackSound.test.js` (o composto e os arquivos), `skills/index.test.js`
  (registro: canalizado em feixe, com os grupos de canal; ícone).

**Não testado em jogo** (sem navegador): a sensação de varrer o jato, a
espessura dele, o respingo por tick e a `attackRangedAlt` no Squirtle.

---

## Parte 11 — Divisão do `creatureAttackSystem`

Refactor sem mudança de comportamento: `core/systems/creatureAttackSystem.js`
tinha ~1.640 linhas (bem acima do guia de ~300–500 das regras) e misturava
trajetória, busca de alvo, disparo, impacto, canal e efeitos de status. O system
ficou só com o docstring e as 5 passadas por tick (~460 linhas); o resto foi
movido em blocos, sem reescrever, pra `core/battle/`:

| Módulo | Responde |
|---|---|
| `attackTrajectory.js` | Onde a trajetória 2.5D termina (`resolveAttackImpactPoint`) |
| `attackTargets.js` | Quem o golpe atinge — alvo único, cone, alvos de golpe só de efeito |
| `attackEffectPlacement.js` | Partida e rotação do VFX (`resolveEffectRotation`, `resolveEffectStart`, `resolveEffectPlacement` — este extraído do meio do system) |
| `attackCasting.js` | Disparo e término: `resolveAttackForEntity`, `ATTACK_SLOTS`, `tryStartAttack`, `resolveCastMode`, `handleAttackPress`, `finishAttack`, botão segurado |
| `attackImpact.js` | O instante `effectAt` (`resolveAttackImpact`, antes inline no passo 4): dano, VFX, pulsos de som/grito |
| `attackChannelTick.js` | Um tick do canalizado (cone ou feixe) |
| `attackStatusEffects.js` | Efeitos de status, golpe em si mesmo, interrupção por dano |

`AttackShape.jsx` e `ContinuousAttackEffectsView.jsx` passaram a importar
`resolveAttackImpactPoint` de `attackTrajectory.js`; o
`creatureAttackSystem.test.js` importa as funções puras dos módulos novos (os
testes continuam no mesmo arquivo). Testes relacionados: mesmas 9 falhas
antigas de antes do refactor, nenhuma nova.

## Parte 12 — Tail Whip (e o `positionOffset` no jato do Water Gun)

### `positionOffset` no efeito de canal

O override `visual.positionOffset` do Water Gun no Squirtle não fazia nada. A
mescla do override estava certa (`resolveSkill` mescla `visual` campo a campo),
mas o jato é um efeito de CANAL (`visual.channelGroup`), desenhado por
`channelFollower` (`ContinuousAttackEffectsView.jsx`), que partia sempre da boca
— o `positionOffset` só era lido no VFX de impacto único (`effectGroup`), que o
Water Gun não tem (`'none'`). Agora o canal também passa por
`resolveEffectStart`: o jato parte da boca deslocada, no mesmo referencial dos
outros golpes (+Z = pra frente, +Y = pra cima, em METROS), e o comprimento é
medido da nova partida até onde o feixe bate. O dano e o respingo continuam
contados da boca.

### O Tail Whip

Criado pelo usuário a partir do Growl; revisado:

- **Regra**: `effects` baixa `defense` em 1 estágio por 60 s no cone, igual ao
  Pokémon (todos os inimigos à frente). `accuracy: 100` explícito (passa pelo
  sorteio, como o Smokescreen). O texto "Defesa ↓", o rótulo `DEF` da HUD e a
  defesa na fórmula de dano já existiam — nada novo no core.
- **Visual** (`view/vfx/tailWhipVfx.js`, grupo `'tail-whip'`): antes reusava as
  ondas do Growl. Tradução de `tailwhip_actor` (varrida em flipbook, 8 quadros,
  alfa 0.56) e `tailwhip_actorsparkle` (brilhos azul → rosa → lilás), nos tempos
  da `animation.tailwhip.actor` menos 0.375 s (o efeito nasce no `effectAt`):
  2 varridas e 4 levas de brilhos em ~1.5 s. Nascem ATRÁS da criatura, na
  cauda — o +Z do Bedrock é pra trás, e aqui o corpo não dá as costas como no
  Cobblemon (`TAIL_SIDE` troca o lado). O `emitter_transform_xy` da varrida
  virou billboard.
- **Motor**: spec ganhou `opacity` (alfa fixo do `tinting` do Bedrock), multiplicado
  pelo fade de sempre.
- **Som**: antes `'statup'` (o som de atributo SUBINDO, errado pra um golpe que
  baixa). Agora o `tailwhip_actor.ogg` do Cobblemon (`audio.group: 'tail-whip'`).
- **Fica como estava**: `animation.clipKey: 'attack'` (o `.glb` do Squirtle não
  tem animação de abanar a cauda) e o ícone `growl.png` (sem ícone próprio).

### Testes

- `particleEmitter.test.js`: a varrida nasce atrás de quem usou com alfa 0.56;
  duas varridas e o efeito termina em ~1.5 s.
- `attackSound.test.js`: o grupo `'tail-whip'` existe e o arquivo está em `public/`.

### Segunda rodada: o efeito e o som duram a ação inteira

Testando em jogo, o usuário viu três problemas:

- **`rotationOffset` jogava o efeito pra longe**: o VFX era um `AttackEffect` de
  impacto, que num golpe de cone nasce na PONTA do cone (3 m à frente) — e o
  `rotationOffset` gira em volta desse ponto, levando a criatura (a -3 m no
  espaço local) pro outro lado.
- **Efeito invertido**: nem trocar o lado da cauda resolvia.
- **Duração e som**: tinham que ir até o fim da `duration`, não só do
  `effectAt` em diante (o efeito nascia em 0.6 s de uma ação de 1 s).

O que mudou:

- **`visual.actionGroup`** (novo, `ContinuousAttackEffectsView.jsx`): terceiro
  tipo de efeito contínuo, ao lado da carga e do canal — do DISPARO até a ação
  acabar (interrompida, acaba junto), preso à criatura (origem no centro do
  corpo, virado pra onde ela olha). Ali `positionOffset` desloca e
  `rotationOffset.y` gira o efeito EM VOLTA da criatura. O Tail Whip passou pra
  `effectGroup: 'none'` + `actionGroup: 'tail-whip'`, e o
  `TailWhipAttackEffect.jsx` (impacto) foi removido.
- **Motor — `every`** (`particleEmitter.js`): um emissor repete a própria linha
  do tempo a cada `every` s até `endEmission()`. A abanada (varrida aos 0.04 s +
  brilhos aos 0 e 0.25 s) se repete a cada 0.54 s enquanto a ação dura.
- **Motor — `mirror`** (removido na rodada seguinte): espelhava o flipbook. A
  altura passou a usar a altura real do corpo (`0.33 ×` acima dos pés, como no
  original).
- **`audio.actionGroup`** (novo): som em LOOP do disparo até a ação acabar
  (cortado no fim da `duration`). O som de carga e este viraram "sons em loop"
  com uma `phase` (`'charge'` | `'action'`): `resolveAttackChargeSounds` →
  `resolveAttackLoopSounds`, `entry.charge` → `entry.loops` no
  `attackAudioRegistry`. O Tail Whip usa `group: null` + `actionGroup:
  'tail-whip'`.
- `_template/index.js` documenta `visual.actionGroup` e `audio.actionGroup`.

Testes: varrida atrás e espelhada; uma varrida por abanada (3 em 1.5 s); depois
de `endEmission` não começa abanada nova e o sistema termina; som da ação em
loop até o fim e parando com ela; fase `'charge'`/`'action'` no resolver.

### Terceira rodada: na frente, apontando pro alvo

Em jogo o efeito continuava ATRÁS do Squirtle e apontando pra trás (os brilhos
voando pra trás), e havia dois lugares mexendo em direção (`TAIL_SIDE`/`MIRROR`
no VFX e `rotationOffset` na skill). Olhando os quadros da varrida (arco
simétrico, da direita pra esquerda e de volta), espelhar não mudava nada — o
"invertido" era a direção. Agora:

- o padrão é NA FRENTE, com os brilhos voando PRA FRENTE (na direção do alvo);
- `TAIL_SIDE`, `MIRROR` e o `mirror` do motor saíram — posição e direção se
  ajustam só na skill: `positionOffset` desloca, `rotationOffset.y` gira o
  efeito inteiro (posição e direção) em volta da criatura.

Testes: varrida na frente; brilhos na frente indo pra frente; quadro girado 180°
leva tudo pra trás, apontando pra trás.

### Quarta rodada: girar no lugar e o arco virado

Em jogo a posição na frente estava certa, mas a varrida parecia vir NA DIREÇÃO
do Squirtle (como se outra criatura à frente usasse o golpe nele), e girar pelo
`rotationOffset.y` tirava o efeito do lugar. Dois problemas de transformação:

- **Pivô errado**: o quadro do efeito tinha origem no CENTRO do corpo e os
  emissores ficavam 0.525 m à frente — o `yaw` extra fazia o efeito ORBITAR a
  criatura (90° = do lado, 180° = atrás). E a varrida é billboard: girar em Y
  nunca mudava o desenho dela, só onde ela nascia.
- **Eixo invertido = o V da textura**: o arco é um "U" (côncavo pra cima). Da
  câmera (atrás e acima), o "U" lê como um arco no chão com as pontas pra
  frente e o meio encostado no corpo — onda vindo. Espelhar na horizontal (a
  segunda rodada) não mudava isso; o que vira a leitura é o giro de 180° no
  plano da tela ("∩" = onda saindo).

O que mudou:

- `TAIL_WHIP_PIVOT` (`tailWhipVfx.js`, 0.525 m): o follower da ação põe a
  origem do quadro no pivô (`ACTION_PIVOTS` em
  `ContinuousAttackEffectsView.jsx`, somado ao `positionOffset` sem passar pelo
  `rotationOffset`) e os offsets dos emissores são contados dele — em 0° a
  posição é a mesma de antes, e `rotationOffset.y` gira no lugar.
- **Motor — `roll`** (`frame.roll`, `particleSimulation.js`/`particleEmitter.js`):
  `rotationOffset.z` gira as partículas no plano da tela (somado ao `spin`).
- Skill: `rotationOffset: { x: 0, y: 0, z: 180 }` (antes `y: 90`).

Testes: com o pivô à frente, varrida e brilhos nascem lá; quadro girado 180° em
Y não tira os brilhos do pivô e os manda pra trás; `roll` gira a varrida.

### Quinta rodada: o efeito volta pro `effectAt`

O visual tinha passado a durar a ação inteira (segunda rodada); o usuário quis
de volta só no `effectAt`, mantendo o `scale: 3`, o `rotationOffset.z: 180` e o
`positionOffset.z: 1` que ajustou na skill.

- `isAttackPastEffect` (`attackTelegraph.js`): do `effectAt` até a ação acabar,
  pra qualquer golpe (`isAttackChanneling` passou a usá-lo). O follower da ação
  (`visual.actionGroup`) só fica ativo nessa janela — interrompido antes do
  `effectAt`, o efeito não aparece.
- `tailWhipVfx.js`: sem `every`/`WAG_PERIOD` — UMA abanada (varrida aos 0.04 s,
  brilhos aos 0 e 0.25 s), que termina sozinha. O `every` continua no motor,
  sem uso por enquanto.
- O som (`audio.actionGroup`, fase `'action'` em `attackAudioSystem.js`) também
  passou a usar `isAttackPastEffect`: loop do `effectAt` até a ação acabar
  (cortado no fim da `duration`).

Testes: `isAttackPastEffect`; uma varrida só e o sistema termina sozinho; som
da ação não toca antes do `effectAt` e toca em loop dali até o fim.

### A conferir em jogo

Se o arco "∩" (`rotationOffset.z: 180`) lê como o Squirtle abanando pra frente; altura e
distância das varridas (`BODY_WIDTH`), o ritmo da abanada (`WAG_PERIOD`), o
volume do som, e o `positionOffset` do Water Gun no Squirtle — hoje `y: 10`
(10 METROS acima da boca; provavelmente queria `0.1`).

## Fora de escopo / pendências

Juntadas das sete partes, sem as que foram resolvidas dentro da própria versão
(efeito em si mesmo e precisão de golpe de status, por exemplo).

- **Conteúdo e balanceamento**: revisar as habilidades (`tackle`, `punch`,
  `vine-whip`, `ember`, `whirlpool`, `razor-leaf`, `flamethrower`) e os básicos;
  `accuracy` própria nas skills (todas 100 por omissão); escala por `speed` nas
  habilidades; estágio de `speed`.
- **IA usando habilidades** (selvagens e time só usam o básico) — inclusive
  skills de status, o que também tornaria a interrupção relevante dos dois lados.
- **Combate**: precisão dos canalizados (não sorteiam); estágio de evasão;
  outros efeitos além de `statStage` (queimar, paralisar); o bônus do sol no
  Growth (não existe clima); círculo do corpo dos alvos e regra de altura
  visível (no backlog).
- **Visual**: os golpes que ainda são malha (`punch`, `whirlpool`); a malha
  `VineWhipAttackEffect` (grupo `'vine-whip'`) ficou sem uso desde que o
  `vine-whip` passou pro `'impact'`; `ember-fire.glb` e `tackle.glb` sem uso
  (arquivos mantidos); luz pontual do fogo; animação `spray` do Smokescreen;
  linhas/poeira de dash e poeira de pulo por espécie ou terreno; som de
  aterrissagem; bancada de VFX com parâmetros ao vivo.
- **Outras skills do Bulbasaur** e habilidades restantes das outras espécies.
- **Licença**: texturas e sons vêm do Cobblemon (código MPL-2.0); a licença dos
  assets não foi verificada — conferir antes de qualquer uso além de projeto
  pessoal.

## Gates

- `npm test`: 1117 passam, **60 falham, todas já existentes** e fora desta
  feature — `applyAnimationClip` (5), `orbitCamera` (10), `world` (3),
  `items/index` (1), `species/index` (1), `stats` (1), `footstepGroups` (1),
  `faintSystem` (6), `partySummonSystem` (15), `partyVitals` (5),
  `summonBallSystem` (3) e `creatureAttackSystem` (9: indicador `castMode:
  'confirm'` cuja premissa não vale mais com a configuração atual, alvo de lado e
  cápsula deitada). Ligadas a espécies removidas/trocadas, câmera, itens e dados
  ajustados pelo usuário.
- Testes desacoplados do balanceamento: o helper `advanceUntilEffectSpawns` tem
  folga fixa de 5 s (o básico do Bulbasaur rebalanceado não cabia no tempo do
  básico do Fox); os testes do Leech Seed e do Growth leem os números da própria
  skill ou usam override.
- `npm run lint`: os arquivos desta feature estão limpos. Ficam erros que já
  existiam em arquivos fora dela (formatação/`camelcase`): `001-bulbasaur/index.js`,
  `004-charmander/index.js`, `stats.js`, `ActionSlotHud.jsx`, `PokemonsTab.jsx`,
  `roster.js`, `StatsScreen.jsx`, `CreatureView.jsx`, `PunchAttackEffect.jsx`,
  `VineWhipAttackEffect.jsx` e `statusDisplay.jsx`.
- `npm run build`: para na etapa de lint por esses erros; `next build --no-lint`
  compila (`✓ Compiled successfully`).
