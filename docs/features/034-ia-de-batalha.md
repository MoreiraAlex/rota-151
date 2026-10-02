# 🚀 Versão 0.0.34 — IA de batalha

## Resumo

Continuação da 031 (IA de combate e desmaio) e da 033 (skills de combate e
VFX). A 033 deu a cada criatura um básico e até três habilidades, mas a IA —
selvagens e criaturas do time fora do controle — ainda só usa o básico, parada
cara a cara com o alvo. Esta feature melhora a batalha da IA, um item por vez,
com o usuário testando ao vivo entre as partes.

| Parte | O quê | Estado |
|---|---|---|
| 1 — Habilidades na IA | A IA escolhe entre o básico e as habilidades da espécie, pela situação, e administra a energia | feita |
| 2 — Movimento na luta | Desviar do aviso vermelho, manter distância (à distância), rodear o alvo, dash, feixe seguindo o alvo | feita |
| 3 — Decisões com critério | Pacífica revida ou foge pela situação, fuga com HP baixo, ameaça que decai, vida do alvo na escolha do alvo | feita |
| 4 — Treinador na batalha | O treinador só vira alvo sozinho no alcance, fica longe da luta e se protege | feita |

Regra que continua valendo (031): a IA do time é **sempre defensiva** — só
entra na luta contra a selvagem que acertou alguém do grupo. As habilidades
mudam COMO ela luta, não QUANDO.

Versão: `0.0.34` (`package.json`).

---

## Parte 1 — Habilidades na IA

### Objetivos

- A IA (selvagem e criatura do time fora do controle) usa as habilidades
  Q/E/R da espécie, não só o básico.
- A escolha depende da situação: alcance, cooldown, stamina, se o efeito já
  está ativo no alvo/em si mesma, quantos inimigos cabem no cone. (A vida do
  alvo ficou de fora: com o dano proporcional ao poder, ela não muda a escolha
  — entra na Parte 3, com as decisões por critério.)
- Um caminho só de disparo: o mesmo `WantsToAttack` → passada 3 do
  `creatureAttackSystem` → `tryStartAttack`, agora levando o slot.
- Espécie sem habilidades (fox, wolf) continua exatamente como hoje.

### Como funciona

**Escolha** — `core/battle/aiAttackChoice.js`, chamado pelo
`wildBehaviorSystem` (perseguindo) e pelo `partyBehaviorSystem` (lutando):

1. **Filtra** (`planAiAttack`): só entram os slots (`primary`, `secondary1-3`)
   que a espécie tem, com stamina e cooldown livres.
2. **Dá uma nota** (`scoreAiAttack`) só pelos CAMPOS da definição — nunca pelo
   id. Uma habilidade nova feita de mecanismos que já existem não exige
   nenhuma linha na IA:

   | Campo da skill | Contribuição na nota |
   |---|---|
   | `damage.power` | o poder, por inimigo atingido (o básico vale 5, um Tackle 40). No canalizado o `power` já é o total do canal, então entra igual |
   | `area: 'cone'` / canal em cone | cada inimigo dentro do cone virado pro alvo soma de novo (`isInsideAttackCone`, a mesma forma do golpe) |
   | `effects[]` | o avaliador de cada `effect.type`, em cada atingido (registro abaixo) |
   | `area: 'self'` | efeitos avaliados em quem usou; 0 com inimigo a até `SELF_CAST_SAFE_DISTANCE` (4m) — a carga seria interrompida por dano |
   | alcance | × `IN_REACH_BONUS` (1.25) se o golpe já alcança o alvo agora |
   | `ai.weight` (opcional, novo) | multiplicador final — ajuste fino de UMA skill sem código, também via `skills[N].overrides.ai` (documentado no `_template`) |

   **Avaliadores por tipo de efeito** (`AI_EFFECT_EVALUATORS`,
   `core/battle/aiEffectEvaluators.js` — tipo de efeito novo no motor de
   batalha → avaliador novo ali; tipo sem avaliador vale 0):
   - `statStage` — só no sentido certo (baixar o do inimigo, subir o próprio).
     `STAT_STAGE_VALUE` (25) por estágio com o atributo em 0; cada estágio já
     acumulado no sentido do efeito multiplica por `STAT_STAGE_DECAY` (⅔:
     1 → 0.67 → 0.44 → ...). No limite (±6) vale 0, menos perto de expirar
     (`EFFECT_REFRESH_TIME`, 3s), quando volta a valer cheio porque usar renova
     o tempo. Efeito de vários estágios vale pelos que ainda cabem.
   - `leechSeed` — `LEECH_SEED_VALUE` (35) num inimigo sem semente; 0 com uma
     ativa, voltando a valer perto de secar. Nunca em quem usou.

3. **Sorteia** (`pickAiAttack`, `gameplayRng`) entre os golpes com nota de pelo
   menos `NEAR_BEST_FRACTION` (60%) da melhor, com chance proporcional à nota.
   Nenhuma nota positiva → sem plano.

**Plano** — o golpe sorteado fica em `attackSlot` (`WildBehavior` /
`PartyBehavior`) e é MANTIDO enquanto continuar pronto: sem sortear a cada
tick, a criatura não muda de ideia (e de distância) no meio do caminho. É
refeito depois de cada pedido, quando o golpe deixa de estar pronto, e ao
trocar de alvo (`wildBehaviorSystem` na troca; `defenderGrupo`/`voltarASeguir`
no time).

**Distância** — corre até `ATTACK_REACH_FRACTION` (80%) do alcance do golpe
PLANEJADO (`resolveReachFor`: `range + radius + corpo do alvo`; golpe em si
mesmo não precisa chegar perto). Sem plano (nada pronto), o alcance do básico,
como antes. O Charmander lança Ember de longe; com o Tackle sorteado, corre até
encostar. Sem manter distância ativamente — isso é a Parte 2.

**Ritmo** — o intervalo entre pedidos de cada lado continua
(`WILD_BEHAVIOR.ATTACK_INTERVAL` 1.2s, `PARTY_BEHAVIOR.ATTACK_INTERVAL` 1.5s),
com o cooldown de cada habilidade por cima.

**Disparo** — `WantsToAttack { target, slot }`. A passada 3 do
`creatureAttackSystem` lança `request.slot` (padrão `'primary'`) pelo mesmo
`tryStartAttack`. O canalizado da IA dura a `duration` inteira (a IA nunca
cancela); o feixe (`water-gun`) mira uma vez, no disparo — mirar durante o
canal fica pra Parte 2.

**Debug F2** — as etiquetas da selvagem (perseguindo) e da criatura do time
(lutando) mostram o golpe: o planejado (`· próximo: ember`) ou, sem plano, o
último pedido (`· último: básico`) — `attackPlanLabel`,
`tools/debug/WildBehaviorDebugView.jsx`. Campo `lastAttackSlot` nos dois traits,
só pra isso.

**Energia** (pedido do usuário depois de testar: "tive uma luta longa com o
charmander e ele só saiu spawnando skill e chegou uma hora que ele não tinha
mais energia, e sempre que entrava um pouco, ele já gastava com corrida ou
ataque básico") — todo gasto de energia (correr, qualquer golpe) reinicia o
atraso da regeneração (`staminaRegenDelayAfterUse`, 2s no Charmander): com o
básico a cada 1.2s e a corrida, ela nunca voltava a regenerar.
`core/battle/aiEnergy.js`, duas regras genéricas (nada por espécie/skill):
- **Reserva** (`fitsEnergyReserve`) — golpe mais caro que o mais barato pronto
  (normalmente o básico) só entra no plano se sobrar
  `SKILL_RESERVE_FRACTION` (25%) da energia máxima depois de pagar; plano numa
  habilidade que deixou de caber é descartado. Golpes do mesmo custo do mais
  barato (o Tackle deste Charmander custa 0.25, igual ao básico) continuam.
- **Descanso** (`resolveResting`, campo `resting` nos dois traits) — com a
  energia em `REST_ENTER_FRACTION` (15%) ou menos, a criatura para de gastar:
  sem golpe e sem correr (anda até o alvo, sem pedir) até voltar a
  `REST_EXIT_FRACTION` (60%). A folga entre os dois evita gastar de novo o
  primeiro tanto que regenerar. Com o regen do Charmander (45%/s depois de 2s),
  dura uns 3s. Fugir (selvagem) continua correndo se puder. Debug F2:
  `· descansando`.

Config nova: `GAME_CONFIG.AI_ATTACK` e `GAME_CONFIG.AI_ENERGY`.

### Decisões do usuário

1. **Selvagens e time** usam habilidades — a selvagem tem as mesmas da espécie
   (`species.skills`).
2. **Sorteio** ponderado entre os melhores golpes, não sempre o melhor.
3. **Growth sim** — só quando ninguém está batendo nela.
4. **Distância pelo golpe escolhido já nesta parte.**
5. **Regras por mecanismo, não por habilidade** (dúvida do usuário: "151
   pokémons com muitas habilidades, o ideal seria ter regras específicas?"):
   a nota sai dos campos da definição e de um avaliador por tipo de efeito;
   nenhuma regra conhece id de skill.
6. **Efeitos acumulam** (dúvida do usuário: "eles nunca vão conseguir acumular
   o efeito?"): o valor cai a cada estágio acumulado, não é proibido repetir.

### Etapas

- [x] Doc da feature e bump da versão (`package.json` → `0.0.34`)
- [x] Escolha do golpe (`core/battle/aiAttackChoice.js`) + testes
- [x] Registro `AI_EFFECT_EVALUATORS` (`statStage`, `leechSeed`) + testes
- [x] `GAME_CONFIG.AI_ATTACK` com os pesos; `ai.weight` documentado no `_template` de skill
- [x] `WantsToAttack.slot` e a passada 3 do `creatureAttackSystem` usando o slot
- [x] `wildBehaviorSystem` e `partyBehaviorSystem` escolhendo o golpe e
      correndo até o alcance dele
- [x] Etiquetas do debug F2 com o golpe escolhido
- [x] Testes dos systems mexidos (cada regra conferida desligando-a)
- [x] Energia: reserva pras habilidades e descanso com folga (`core/battle/aiEnergy.js`) + testes

### Testes

- `aiEffectEvaluators.test.js` (novo) — `statStage`: cheio no 0, sentido
  errado vale 0, acumula decrescendo, estágio contrário não reduz, limite vale
  0, perto de expirar volta a valer (mesmo no limite), vários estágios valem
  pelo que cabe; `leechSeed`: sem/com semente, perto de secar, nunca em si; o
  registro despacha pelo `type`.
- `aiAttackChoice.test.js` (novo) — alcance; nota de dano com/sem bônus, cone
  somando quem está dentro (e não quem está atrás), efeitos, golpe em si mesmo
  com e sem inimigo perto, `ai.weight`; sorteio só entre os próximos da
  melhor; com o Charmander de verdade: o Ember a 6m tem a maior chance,
  cooldown/stamina tiram golpes, o plano é mantido enquanto pronto, espécie sem
  habilidades fica no básico.
- `wildBehaviorSystem.test.js` / `partyBehaviorSystem.test.js` — os testes
  antigos de distância/intervalo travam as habilidades em cooldown (não
  dependem do sorteio; um deles só passava por sorte dele). Novos: só o Ember
  pronto → para a 6m e pede o Ember; Tackle planejado → corre até o alcance
  dele; trocar de alvo / entrar na luta descarta o plano; de ponta a ponta, a
  criatura do time usa habilidade e tira vida da selvagem.
- `creatureAttackSystem.test.js` — pedido com slot lança a habilidade pedida.
- Energia: `aiEnergy.test.js` (novo — entra no descanso no limite, só sai no
  limite de saída; o mais barato sempre cabe, habilidade só com a reserva);
  `aiAttackChoice.test.js` (com a energia na reserva, só os golpes de custo
  mínimo, e o plano numa habilidade cara é descartado); nos dois
  comportamentos, energia baixa → descansa sem pedir golpe nem correr, e volta
  a lutar ao recuperar.

Conferidos desligando a regra (cada um faz o teste dele falhar): o slot na
passada 3, o slot no pedido e a distância pelo plano, o descarte do plano na
troca de alvo (selvagem e time), a renovação perto de expirar, a reserva, o
descanso (sem golpe, sem correr — selvagem e time) e a folga do descanso.

As falhas que sobram nos arquivos relacionados são as antigas, já listadas nos
Gates da 033: `creatureAttackSystem` (9), `faintSystem` (6),
`partySummonSystem` (15), `partyVitals` (5), `summonBallSystem` (3), `world` (3).

### Critérios de conclusão

- Uma criatura com habilidades, fora do controle, usa mais de um golpe numa
  luta, respeitando cooldown e stamina.
- Status e buff acumulam com valor decrescente; semente não é replantada enquanto ativa.
- Nenhuma regra da IA cita id de skill.
- Fox e wolf (sem habilidades) lutam como antes.
- Numa luta longa a IA não fica sem energia pra sempre: descansa e volta.
- Testes dos arquivos mexidos passam; lint limpo nos arquivos da feature.

### O que olhar em jogo

- Se a variedade de golpes parece natural ou "spam".
- Se a distância pelo golpe escolhido (Ember de longe) deixa a luta melhor.
- O ritmo: com habilidades, 1.2s / 1.5s entre pedidos ainda serve?
- Se o Growth aparece (só com ninguém a 4m) e se o Growl/Tail Whip repetem
  demais. Botões em `GAME_CONFIG.AI_ATTACK` (`STAT_STAGE_VALUE`,
  `STAT_STAGE_DECAY`, `SELF_CAST_SAFE_DISTANCE`...) ou `ai.weight` numa skill.
- Luta longa: se o descanso (`· descansando` no F2) aparece na hora certa e
  dura o bastante. Botões em `GAME_CONFIG.AI_ENERGY`.

---

## Parte 2 — Movimento na luta

### Objetivos

Hoje a IA corre até o alcance do golpe planejado, para e fica parada cara a
cara até o próximo pedido. A Parte 2 faz ela se mexer na luta:

- **Desviar** do aviso vermelho de um golpe vindo nela.
- **Manter distância** quando o golpe planejado é à distância: recuar se o
  alvo encostar, em vez de deixar ele bater de graça.
- **Rodear o alvo** enquanto espera o intervalo entre golpes, em vez de ficar
  parada.
- **Feixe seguindo o alvo**: o canal da IA (`water-gun`) acompanha o alvo, como
  o jogador faz com a câmera (hoje mira uma vez, no disparo).

Tudo genérico, pelos campos da definição (`aim`, `range`, `radius`, `area`) —
nada por skill ou espécie. Vale pra selvagem e pro time.

### Como funciona

`core/battle/aiMovement.js` (`moveInFight`), chamado pelo `wildBehaviorSystem`
(perseguindo) e pelo `partyBehaviorSystem` (lutando) no lugar do trecho "corre
até o alcance / para e encara". Estado em `AiMovement` (trait novo, posto no
spawn da selvagem e da criatura invocada). Por tick, a primeira regra que
valer:

1. **Desvio** — um inimigo está CARREGANDO um golpe e ela está dentro da área
   (`resolveIncomingAttack`): a mesma forma do aviso no chão (cone em
   `isInsideAttackCone`; senão a cápsula `range` × `radius`), da posição do
   atacante na direção travada (`ActionState.dir*`). Sorteia UMA vez por golpe
   se reage (`DODGE_CHANCE`, 50% pra todo mundo); reagindo, espera
   `DODGE_REACTION_TIME` (0.2s) de carga e sai pro lado (perpendicular à
   direção do golpe, o lado em que já está) correndo. Se correndo não dá tempo
   (distância pra sair ÷ `runSpeed` > o que falta pro golpe), sai de **dash**,
   se puder. Desviando ou de dash, não pede o próprio golpe.
2. **Recuo** — golpe planejado à distância (`aim: 'ranged'`) e o alvo mais
   perto que `KEEP_DISTANCE_MIN` (50%) do alcance dele: anda pra longe
   (`RETREAT_STEP` à frente, recalculado), correndo se puder. Pode lançar
   recuando (recua e atira). Corpo a corpo continua encostando.
3. **Aproximação** — fora da distância de parada: corre até lá; faltando mais
   que `DASH_CLOSE_DISTANCE` (5m), de **dash**.
4. **Rodear** — no alcance esperando (`waiting`: intervalo entre golpes ou
   nada pronto): anda de lado em volta do alvo, virada pra onde anda (ver a
   correção do giro abaixo), a
   `STRAFE_SPEED_FACTOR` (60%) do `walkSpeed` — andando, sem gastar energia —,
   perto de `STRAFE_DISTANCE_FRACTION` (90%) da distância de parada (correção
   radial, senão andar na tangente abre o círculo), trocando de sentido a cada
   1.5–3.5s sorteados. Sem esperar (o golpe sai agora): para e encara — e só
   pede o golpe virada pro alvo (`'aim'` enquanto vira, abaixo).

**Dash da IA** (pedido do usuário: "acrescenta o dash como movimentação também,
mas lembra que ele também gasta energia") — o dash do jogador virou action
compartilhada (`core/actions/dash.js`: `iniciarDash`, `avancarDash`,
`resolveDashSpeed`, reexportado do `playerActionSystem` — o jogador não mudou).
Mesma velocidade, duração e custo (`PLAYER_ACTIONS.dash`, 1 de energia).
A IA só dá dash: sem descansar, no chão (`Grounded`), ação livre, com
`DASH_INTERVAL` (4s) desde o último, e sobrando a reserva de energia da IA
(`AI_ENERGY.SKILL_RESERVE_FRACTION`) depois de pagar. O dash em andamento é
avançado pelo próprio comportamento (sai parada no fim; o movimento decide o
tick seguinte).

**Feixe seguindo o alvo** — na passada 4 do `creatureAttackSystem`, o canal em
feixe (`isBeamAttack`) de quem não está no controle reaponta `ActionState.dir*`
pro alvo da IA (`resolveAiTarget`: `WildBehavior`/`PartyBehavior.target`) a
cada tick, girando no máximo `BEAM_TURN_SPEED` (1.5 rad/s ≈ 86°/s,
`steerAiBeam`) — acompanha, mas dá pra escapar correndo de lado.

**Energia** — desviar, recuar e aproximar correndo pagam a corrida
(`tentarCorrer`); o dash paga o custo dele. Descansando (`resting`): não
desvia, não corre nem dá dash — só anda (e rodeia).

**Debug F2** — a etiqueta ganha o movimento (`· desviando`, `· recuando`,
`· rodeando`, `· aproximando`, `· dash` — `movementLabel`).

**Correção no caminho**: `entity.get` de trait de valores no Koota devolve uma
CÓPIA — o `AiMovement` e o `ActionState` mudados fora da query do system só
valem com `entity.set` (pego pelos testes).

**Correção: o corpo não girava no dash e no desvio** (relatado jogando: "um
bulba deu um dash pra mim virado de costas" e, desviando pouco pro lado sem
girar, "pareceu que teleportou"). Dash e desvio mexiam só na velocidade: o
desvio deixava o corpo encarando o alvo, e o dash (`advanceAiDash`) nem
mexia na rotação. Agora `faceMovement` (`aiMovement.js`) gira o corpo suave
(`turnSpeed`) pra direção do movimento: no desvio correndo, no início e
durante todo o dash da IA, e no desvio do treinador (`trainerBattleSystem`).

Depois, a pedido do usuário, o **rodear** também: anda virada pra onde vai
(antes, virada pro alvo — decisão 3, revista). Como o disparo trava o corpo de
uma vez na direção do golpe (`attackCasting`), vindo de lado isso seria um
estalo de ~90°; então, com o golpe pronto, ela para e vira pro alvo
(`mode: 'aim'`, `· mirando` no F2) e só pede o golpe com o corpo a até
`AI_MOVEMENT.AIM_TOLERANCE` (0.35 rad, ~20°) dele — uns 0.1–0.2s.

Config nova: `GAME_CONFIG.AI_MOVEMENT`.

### Decisões do usuário

1. **Chance de desvio**: 50% pra todo mundo.
2. **Descansando, não desvia.**
3. **Rodear o alvo** enquanto espera: sim, andando — virada pra onde anda
   (revisto depois de jogar; antes, virada pro alvo).
4. **Feixe seguindo o alvo**: sim, com giro limitado.
5. **Dash** também como movimentação da IA, pagando energia.

### Etapas

- [x] `core/battle/aiMovement.js` (desvio, recuo, aproximação, rodear) + testes
- [x] Dash compartilhado (`core/actions/dash.js`) e usado pela IA no desvio e na aproximação
- [x] `GAME_CONFIG.AI_MOVEMENT` e trait `AiMovement` (spawn da selvagem e da invocada)
- [x] `wildBehaviorSystem` e `partyBehaviorSystem` usando o módulo
- [x] Feixe da IA seguindo o alvo (`creatureAttackSystem`, passada 4)
- [x] Etiquetas do debug F2 com o movimento
- [x] Testes dos systems mexidos (cada regra conferida desligando-a)

### Testes

- `aiMovement.test.js` (novo) — área do golpe vindo (cápsula: quanto falta,
  quanto andar, pra que lado; fora/depois/sem golpe: nada; cone); desvio
  (reage depois do tempo de reação, antes não, sorteio uma vez por golpe,
  golpe novo sorteia de novo, descansando não desvia, sem tempo correndo → dash
  pagando energia, sem chão corre); recuo (à distância recua, corpo a corpo
  não); aproximação (corre; muito longe e no chão → dash, intervalo entre
  dashes); dash respeita a reserva e o descanso (e descansando anda); rodear
  (de lado, andando, virada pro alvo; troca de sentido; golpe pronto → para);
  feixe (giro limitado, chega no alvo). Giro do corpo: desviando gira pro lado
  do desvio; dash de aproximação começando de costas vira pro alvo durante o
  dash (`trainerBattleSystem.test.js`: o treinador desviando também gira).
  Conferidos desligando o giro no desvio, no início e no avanço do dash, e no
  treinador. Rodear: virada pra onde anda; golpe pronto vindo de lado →
  `'aim'` até virar (`aiMovement.test.js`), e a selvagem/a criatura do time
  só pedem o golpe depois de virar (`wildBehaviorSystem.test.js`,
  `partyBehaviorSystem.test.js`). Conferidos desligando o giro do rodear, o
  `'aim'` e o filtro do `'aim'` nos dois systems.
- `wildBehaviorSystem.test.js` — dash em andamento continua; desviando não pede
  golpe; esperando o intervalo, rodeia. O teste "perto o bastante, para e
  encara" passou a ser com o golpe pronto (esperando, ela rodeia).
- `partyBehaviorSystem.test.js` — esperando, rodeia; dash em andamento continua
  sem o follow puxar de volta.
- `creatureAttackSystem.test.js` — o Water Gun da IA acompanha o alvo que corre
  pro lado, sem pular direto.
- Spawns de teste com `WildBehavior`/`PartyBehavior` ganharam `AiMovement`
  (`wildBehaviorSystem`, `partyBehaviorSystem`, `faintSystem`,
  `pathDebugPoints`). `playerActionSystem.test.js` passa igual (o dash do
  jogador não mudou).

Conferidos desligando a regra (cada um faz algum teste falhar): sorteio do
desvio, sorteio uma vez por golpe, tempo de reação, descansando não desvia,
dash no desvio, recuo, recuo só à distância, dash na aproximação, intervalo,
reserva e chão do dash, troca de sentido, parar sem esperar, giro do feixe,
feixe no system, dash avançando (selvagem e time), não pedir golpe desviando,
gravar o `AiMovement`.

Falhas nos arquivos relacionados: as mesmas 41 antigas da 033.

### Critérios de conclusão

- Parada no alcance, a IA se mexe (rodeia) em vez de ficar estática.
- Com um golpe vindo nela e tempo pra reagir, às vezes sai da área (correndo ou
  de dash).
- Golpe à distância planejado e o alvo encostando: ela recua.
- O feixe da IA acompanha o alvo, mas dá pra escapar.
- O dash da IA paga energia e respeita a reserva e o descanso.
- Testes dos arquivos mexidos passam; lint limpo nos arquivos da feature.

### O que olhar em jogo

- O desvio: 50% parece justo? A reação de 0.2s deixa o básico rápido acertar?
- O rodear: velocidade e troca de sentido naturais, ou "dança" demais?
- O recuo do Charmander com Ember: fica bom ou foge demais?
- O dash: aparece na hora certa (desvio de última hora, alvo longe)? 4s entre
  dashes é muito/pouco?
- O feixe do Squirtle: 86°/s acompanha demais ou de menos?
- Botões em `GAME_CONFIG.AI_MOVEMENT`.

---

## Parte 3 — Decisões com critério

### Objetivos

Trocar os sorteios "cegos" e as regras fixas por decisões que olham a
situação da luta:

- **Pacífica que apanha**: revidar ou fugir pela situação dela, não por 50%
  fixo (`RETALIATE_CHANCE`, o "critério de verdade" que a 031 deixou pendente).
- **Fuga com HP baixo**: selvagem perdendo a luta foge em vez de lutar até
  desmaiar — e não volta a provocar briga enquanto não se recuperar.
- **Ameaça que decai**: quem bateu há muito tempo pesa menos que quem está
  batendo agora (hoje a ameaça só zera quando ela volta a vagar).
- **Vida do alvo na escolha do alvo** (ficou de fora da Parte 1): alvo quase
  desmaiando chama atenção — terminar a luta com ele.

### Como funciona

1. **Pacífica revida ou foge pela "coragem"** (`resolveRetaliateChance`,
   `core/battle/wildBehavior.js`, usada pelo `wildReactionSystem`) — a
   chance de revidar parte de `RETALIATE_CHANCE` (50%) e:
   - sobe com a vida dela: `COURAGE_HP_WEIGHT` (0.6) × quanto passa de metade;
   - cai com o golpe que levou: `COURAGE_HIT_WEIGHT` (1) × dano em fração da
     vida máxima dela;
   - sobe se ela está melhor que o agressor: `COURAGE_ADVANTAGE_WEIGHT` (0.4) ×
     diferença das vidas (agressor sem `Vitals` conta como vida cheia).
   Limitada entre 5% e 95% (`COURAGE_MIN/MAX_CHANCE`) — sempre sobra surpresa.
   Ex.: cheia, golpe de 10% e agressor cheio → 70%; com 20% de vida, golpe de
   30% e agressor cheio → 5%.
2. **Fuga com HP baixo** (`wildBehaviorSystem`, `resolveMorale`) — perseguindo
   (hostil ou pacífica revidando), com a vida em `LOW_HP_FLEE_FRACTION` (25%)
   ou menos, sorteia UMA vez nessa queda (`LOW_HP_FLEE_CHANCE`, 50%) se foge.
   Fugindo assim fica **abalada** (`WildBehavior.shaken`): não persegue
   ninguém — hostil no raio não aggra, apanhando continua fugindo
   (`wildReactionSystem`) — até a vida voltar a `LOW_HP_RECOVER_FRACTION`
   (50%), quando o sorteio também volta a valer (`lowHpRolled`). Decidiu lutar:
   luta até o fim daquela queda.
3. **Ameaça que decai** (`decairAmeaca`, `core/actions/wildBehavior.js`, todo
   tick no `wildBehaviorSystem`) — cada entrada do `Threat` cai pela metade a
   cada `THREAT_HALF_LIFE` (10s); abaixo de `THREAT_MIN` (0.5) sai.
4. **Vida do alvo** (`core/battle/combatTargets.js`, `GAME_CONFIG.AI_TARGET`) —
   alvo com a vida em `FINISH_HP_FRACTION` (25%) ou menos tem peso
   `FINISH_BONUS` (2, `resolveFinishWeight`):
   - selvagem: a ameaça dele é multiplicada pelo peso; sem ameaça, a distância
     dele é dividida (`findNearestWeighted`);
   - criatura do time: ao trocar de alvo, pega a selvagem com MENOS vida entre
     as que lutam com o grupo, empate pela mais perto (`findWeakest`).

**Debug F2** — selvagem abalada: `(abalada)` na etiqueta.

**Correção: fuga em linha reta contra a parede** (relatado jogando: "se tem
objeto ou chega no limite do mapa, a presa fica correndo contra o objeto, ao
invés de calcular outra rota"). O destino da fuga era sempre `FLEE_STEP` à
frente na direção oposta a quem persegue, recalculado todo tick; dentro de
obstáculo ou fora do mapa, o `findPath` não acha caminho (devolve vazio — e
fora do mapa a coordenada ainda é presa na borda) e o `steerTowards` ia reto
contra a parede. Agora (`resolveFleeDestination`, `core/battle/flee.js`):
- testa `FLEE_DIRECTIONS` (16) direções em volta, a `FLEE_STEP` (6m) dela, só
  pontos andáveis dentro do mapa (`isWalkableAt`, novo em
  `core/pathfinding.js`);
- fica com o que deixa ela mais longe de quem persegue, + `FLEE_CLEAR_LINE_BONUS`
  (2m) se o caminho reto até ele está livre — num canto, escapa ao longo da
  parede; com obstáculo, contorna (o destino sempre tem caminho);
- o destino fica guardado (`WildBehavior.hasFleePoint/fleeX/fleeZ`) e é refeito
  a cada `FLEE_REPICK_INTERVAL` (0.75s), ao chegar (`FLEE_ARRIVE_DISTANCE`, 1m)
  ou travando (`MovementBlocked`).

**Corrida e dash custam mais com a vida baixa** (pedido do usuário depois de
testar a fuga: "se ele corre reto longe de mim, cada ação minha exige um tempo
de stop, daí eu nunca alcanço ele [...] faz o gasto de energia na corrida ser
proporcional à vida [...] isso pra tudo, selvagem, equipe e player") —
`resolveMovementCostMultiplier` (`core/actions/stamina.js`): × 1 com a vida
cheia até × `STAMINA_BY_HP.MAX_MULTIPLIER` (8) com ela em 0, pela curva
`(1 - vida) ^ EXPONENT` (2): metade da vida × 2.75, um quarto × 4.9, 10% × 6.7.
Vale na corrida (`tentarCorrer` — jogador, time seguindo, IA na luta) e no dash
(`resolveDashCost`, usado por `iniciarDash`, pelo `playerActionSystem` pra ver
se pode e pelo `canDash` da IA). Machucado cansa mais rápido, e a IA cansada
cai no descanso (só anda) — a janela pra alcançar.

Com os números de hoje o efeito é pequeno: as três iniciais têm 100 de energia
e correr custa 0.25/s (`runStaminaDrainPerSecond`), então a 25% de vida a
corrida sai ~1.2/s — mais de um minuto pra cansar. O treinador e o fox custam
2/s. O peso real vem do `runStaminaDrainPerSecond` de cada espécie
(balanceamento do usuário).

**Andar e correr mais devagar com a vida baixa** (pedido do usuário: "pode
fazer o mesmo pra velocidade também, percebi que ainda não dá pra pegar na
corrida") — `resolveSpeedMultiplier` / `resolveMoveSpeed`
(`core/actions/movementSpeed.js`): × 1 com a vida cheia até
× `SPEED_BY_HP.MIN_MULTIPLIER` (0.6) com ela em 0, pela curva
`(1 - vida) ^ EXPONENT` (2): metade × 0.9, um quarto × 0.78, 10% × 0.68. Pra
todo mundo, em todo lugar que escolhe andar/correr: jogador
(`movementSystem` e a velocidade de saída do dash), time seguindo
(`creatureFollowSystem`), selvagem vagando (`wildWanderSystem`) e
perseguindo/fugindo (`wildBehaviorSystem`), IA na luta (`aiMovement`:
aproximar, recuar, desviar, rodear e a conta de "dá tempo correndo?"). O dash
mantém o impulso cheio (só custa mais). Uma selvagem fugindo a 25% de vida
corre a ~78% — quem persegue inteiro ganha terreno.

Efeito colateral: a animação passa de correr pra andar abaixo de
`ANIMATION.RUN_MIN_SPEED` (3 m/s). As iniciais correm a 4, então abaixo de
~25% de vida (× < 0.75) a corrida toca a animação de andar — lê como
"mancando".

### Decisões do usuário

1. **Pacífica**: a coragem vira CHANCE de revidar (não decide sozinha).
2. **Fuga com HP baixo**: com chance, e vale pra hostil também.
3. **Criatura do time com HP baixo**: continua lutando (o jogador decide
   recolher).
4. **Prioridade pra alvo com pouca vida**: nos dois lados.

### Etapas

- [x] Coragem da pacífica (`resolveRetaliateChance`) + testes
- [x] Fuga com HP baixo e estado abalada (`shaken`, `lowHpRolled`) + testes
- [x] Decaimento da ameaça (`decairAmeaca`) + testes
- [x] Prioridade por vida (`resolveFinishWeight`, `findNearestWeighted`,
      `findWeakest`) + testes
- [x] `GAME_CONFIG.WILD_BEHAVIOR` (coragem, fuga, ameaça) e `GAME_CONFIG.AI_TARGET`
- [x] Debug F2 com `(abalada)`
- [x] Corrida e dash custando mais com a vida baixa, pra todos (`STAMINA_BY_HP`) + testes
- [x] Andar e correr mais devagar com a vida baixa, pra todos (`SPEED_BY_HP`) + testes
- [x] Fuga escolhendo destino andável (não corre contra a parede) — `core/battle/flee.js` + testes

### Testes

- `wildBehavior.test.js` — reação com a chance passada; coragem (base, vida,
  golpe, vantagem, agressor sem vida, limites); limites e sorteio da fuga.
- `combatTargets.test.js` (novo) — peso de terminar; selvagem prefere o quase
  desmaiando (com e sem ameaça); `findWeakest` (menos vida, empate pela mais
  perto).
- `wildBehaviorSystem.test.js` — vida baixa → foge abalada; abalada não
  persegue (nem no raio) até se recuperar; sorteio uma vez por queda; ameaça
  cai pela metade e some abaixo do mínimo. (Sorteios fixados trocando o valor
  em `GAME_CONFIG` durante o teste.)
- `wildReactionSystem.test.js` — abalada apanhando continua fugindo (mesmo
  hostil); a chance de revidar sai da vida dela e do agressor.
- `partyBehaviorSystem.test.js` — troca pra selvagem com menos vida, não a mais
  perto.
- Energia pela vida: `stamina.test.js` (multiplicador: cheio, zero, curva, sem
  vida; corrida ferida gasta mais; ferido sem fôlego pro custo maior não corre;
  dash × multiplicador), `playerActionSystem.test.js` (dash do jogador ferido
  custa mais), `aiMovement.test.js` (dash da IA ferida custa mais). Conferidos
  desligando o multiplicador, a corrida e o dash.
- Velocidade pela vida: `movementSpeed.test.js` (novo — multiplicador: cheio,
  zero, curva, sem vida; andar/correr × multiplicador), `movementSystem.test.js`
  (jogador ferido anda e corre mais devagar), `wildBehaviorSystem.test.js`
  (fugindo ferida corre mais devagar). Conferidos desligando o multiplicador, o
  jogador e a fuga. O follow, o vagar, a IA na luta e a saída do dash passam
  pela mesma `resolveMoveSpeed`, sem teste próprio.
- Fuga: `flee.test.js` (novo — `isWalkableAt`: aberto, fora do mapa, dentro de
  obstáculo; destino: campo aberto pra longe, encostada na parede escapa ao
  longo dela, canto, obstáculo no caminho com destino andável e com caminho,
  diagonal livre preferida pelo bônus, perto da parede sempre com caminho);
  `wildBehaviorSystem.test.js` (encostada na parede escolhe destino andável e
  não empurra contra ela; travando, refaz o destino na hora). Conferidos
  desligando: só ponto andável, bônus de caminho livre, refazer travando e a
  fuga antiga (ponto reto). A checagem de "fora do mapa" no `isWalkableAt` é
  redundante (a grade já diz não andável fora dela) — mantida por clareza.

Conferidos desligando a regra (cada um faz algum teste falhar): fuga com HP
baixo, abalada não persegue, recuperação, sorteio uma vez, decaimento, mínimo
da ameaça, abalada continua fugindo, coragem na reação, time pega a mais
fraca, prioridade na ameaça e na distância, vantagem na coragem.

Falhas nos arquivos relacionados: as mesmas 41 antigas da 033.

### Critérios de conclusão

- Pacífica com muita vida revida mais; machucada (ou levando golpe forte) foge
  mais.
- Selvagem perdendo a luta às vezes foge, e não volta a brigar machucada.
- Quem parou de bater perde o posto de alvo com o tempo.
- Alvo quase desmaiando atrai os golpes (dos dois lados).
- Testes dos arquivos mexidos passam; lint limpo nos arquivos da feature.

### O que olhar em jogo

- A coragem: pacíficas revidando/fugindo de um jeito que faz sentido?
- A fuga com HP baixo: 25% / 50% de chance / volta com 50% de vida — bom?
- A ameaça: 10s de meia-vida troca de alvo rápido demais ou devagar demais?
- O "terminar a luta": a selvagem largando o tanque pra pegar o fraco fica
  bom, ou injusto com a criatura do time machucada?
- Botões em `GAME_CONFIG.WILD_BEHAVIOR` e `GAME_CONFIG.AI_TARGET`.

---

## Parte 4 — Treinador na batalha

(A Parte 4 era o Bando — foi pro `docs/backlog.md` a pedido do usuário.)

### Objetivos

Hoje, com o jogador controlando uma criatura, o treinador só a SEGUE
(`creatureFollowSystem`, a uns metros dela) — ou seja, fica no meio da luta e
apanha. E a selvagem pode escolher ele como alvo mesmo com criaturas do time
ali do lado. Pedido do usuário:

- **Alvo só se for o único**: a selvagem só mira o treinador se ele for o único
  do lado do jogador dentro do alcance dela.
- **Distância da luta**: fora do controle, durante a luta, o treinador fica a
  uma distância segura em vez de colar na criatura.

### Como funciona

1. **Alvo só se for o único** (`excludeCoveredTrainer`,
   `core/battle/combatTargets.js`, usado no `resolveDecision` do
   `wildBehaviorSystem`) — com alguma criatura do time ativa dentro do raio de
   perseguição da selvagem (`resolveBehaviorRadius`: aggro vagando, de
   perseguição perseguindo), o treinador sai dos candidatos — no aggro, na
   ameaça e na proximidade. A ameaça dele continua guardada e volta a contar
   quando ele for o único. Fugindo, a selvagem foge de qualquer um.
2. **Posição segura** (`trainerBattleSystem.js`, novo; estado em
   `TrainerBehavior`, no spawn do treinador) — fora do controle e com alguma
   selvagem lutando com o grupo: já na zona segura (ver a correção abaixo),
   fica parado; senão vai pra `SAFE_DISTANCE` (7m) atrás da criatura
   controlada, do lado oposto à selvagem mais perto dela (ponto guardado);
   anda, e corre só com selvagem a `DANGER_DISTANCE` (4m) dele; chegando
   (`ARRIVE_DISTANCE`, 1m), para e encara a luta. Sem luta, ou no controle: `'follow'`, e o
   `creatureFollowSystem` segue como sempre (fora de `'follow'` ele pula o
   treinador).
3. **Treinador desvia** — dentro do aviso vermelho de um golpe
   (`resolveIncomingAttack`, a mesma área da IA), sai pro lado correndo. Sem
   sorteio.
4. **Perseguido, foge pro time** — selvagem mirando nele: corre até
   `TEAM_STOP_DISTANCE` (2m) da criatura do time mais perto.
5. **Time protege o treinador** (`findTrainerHunter`, `partyBehaviorSystem`) —
   criatura do time lutando troca de alvo pra selvagem que está mirando o
   treinador (a mais perto, dentro da coleira), mesmo no meio de outra luta.

Ordem por tick no treinador: desvio → foge pro time → posição segura. Correr
paga energia e a velocidade cai com a vida, como todo mundo. Registrado em
`registerSystems.js` depois do `partyBehaviorSystem` e antes do
`creatureFollowSystem`. Config: `GAME_CONFIG.TRAINER_BATTLE`.

**Correção: andando em círculos** (relatado jogando: "assim que entra em
combate, parece que ele fica em conflito com algo e fica andando em círculos no
mesmo ponto"). Reproduzido numa simulação de luta (posições integradas à mão):
o ponto seguro era recalculado TODO tick pela selvagem mais perto da criatura
controlada — e ela RODEIA a criatura (Parte 2), trocando de sentido a cada
1.5–3.5s. O ponto girava num círculo de 7m em volta da criatura e o treinador
corria atrás dele sem parar. Agora:
- **Zona segura com folga** (`isInSafeZone`): a pelo menos
  `SAFE_MIN_DISTANCE` (5m) de toda selvagem na luta e no máximo
  `SAFE_MAX_DISTANCE` (12m) da criatura controlada — dentro dela, fica parado
  encarando a luta.
- **Ponto guardado** (`TrainerBehavior.hasSafePoint/safeX/safeZ`): fora da
  zona, escolhe o ponto (`SAFE_DISTANCE` atrás da criatura) UMA vez e vai até
  ele; só escolhe outro se o ponto guardado sair da zona.
Teste de regressão: luta de verdade por 10s com a selvagem rodeando — nos
últimos 5s ele anda menos de 3m (com o código antigo, 7.8m).

**Correção 2: girando ao chegar perto** (ainda relatado jogando: "ao chegar
perto, parece que surta e fica girando — no debug o path dele não muda, fica
num ponto único"). Reproduzido numa simulação COM física (pipeline na ordem do
jogo, selvagem rodeando a criatura controlada). Não era obstáculo nem
pathfinding — eram duas coisas:
- **Meia-volta na borda da zona** — sair e parar usavam o MESMO limite
  (`SAFE_MIN_DISTANCE` da selvagem). A selvagem rodeando entrava nos 5m → ele
  virava de costas e andava; meio metro depois estava de novo a 5m → parava,
  apagava o ponto e virava de frente pra luta; ela chegava de novo → de
  costas... Nunca chegava no ponto (5 saídas em 15s na simulação). Agora,
  **indo pro ponto, vai até chegar** (`ARRIVE_DISTANCE`); a zona só decide se
  ele SAI estando parado. O ponto (7m atrás da criatura) fica com folga dos 5m.
  O ponto guardado é descartado quando a luta acaba (`'follow'`).
- **`PathState` que não gravava** — estava na query do `trainerBattleSystem`;
  o `steerTowards` grava com `entity.set`, e no Koota trait na query ativa não
  persiste a escrita (a mesma ressalva do `creatureFollowSystem`). O caminho no
  debug F2 era o último do follow (congelado) e o `findPath` rodava todo tick.
  Saiu da query.

Ficou de olho: atrás da criatura, ele cai na linha de tiro dos golpes da
selvagem mirando ela (Ember) e desvia (`'dodge'`, a 6 m/s pro lado) — na
simulação, 2 desvios no começo da luta antes de chegar no ponto.

Sem etiqueta no debug F2 pro treinador ainda (o estado está em
`TrainerBehavior.state`).

### Decisões do usuário

1. **"Alcance do oponente"** = raio de perseguição/aggro da selvagem.
2. **Posição segura**: 7m atrás da criatura controlada, configurável.
3. **Sugestões**: todas (desvio, fugir pro time, time protege).

### Etapas

- [x] Bando pro `docs/backlog.md`
- [x] Treinador só é alvo se for o único no raio (`excludeCoveredTrainer`)
- [x] `trainerBattleSystem` (posição segura, desvio, foge pro time) +
      `TrainerBehavior` + `GAME_CONFIG.TRAINER_BATTLE`
- [x] `creatureFollowSystem` pulando o treinador fora de `'follow'`
- [x] Time protege o treinador (`findTrainerHunter`)
- [x] Testes (cada regra conferida desligando-a)

### Testes

- `trainerBattleSystem.test.js` (novo) — sem luta e no controle: follow; já
  na zona segura: parado; perto da luta: vai pra trás da criatura; o ponto
  guardado não muda com a selvagem mudando de lado; chegando, para; no aviso: desvia pro lado;
  mirado: corre pro time; o follow não move o treinador fora de follow; ferido
  anda mais devagar. Correção 2: indo pro ponto grava o `PathState`; voltar à
  zona no caminho não faz parar antes de chegar; a luta acabando descarta o
  ponto; regressão COM física (selvagem rodeando, 15s): no máximo uma saída
  pro ponto. Conferidos desligando: a histerese, o `PathState` fora da query e
  o descarte no follow.
- `wildBehaviorSystem.test.js` — treinador só é alvo se for o único no raio
  (com a criatura no raio mira ela, mesmo o treinador no topo da ameaça; ela
  sai, sobra ele); hostil vagando não aggra nele com criatura no raio. O teste
  de ameaça "mesmo mais longe" passou a usar duas criaturas (com o treinador,
  a regra nova mudaria o alvo).
- `partyBehaviorSystem.test.js` — time troca pra selvagem mirando o treinador.
  Ajustados pela regra nova: os de ponta a ponta (a selvagem bate na criatura,
  não no treinador, que fica intacto) e o de troca pela vida (as selvagens
  lutam com outra criatura, não com o treinador).

Conferidos desligando a regra: treinador fora do alvo (na regra e no
system), time protege, desvio, foge pro time, parar na posição, lado da
posição (eixo Z — o teste não cobre o X), follow pulando o treinador.

Falhas nos arquivos relacionados: as mesmas 41 antigas da 033.

### Critérios de conclusão

- Com criatura do time por perto, a selvagem não mira o treinador.
- Pilotando uma criatura numa luta, o treinador fica longe, atrás dela.
- O treinador sai dos avisos vermelhos e, mirado, corre pro time.
- O time larga outra luta pra defender o treinador mirado.
- Testes dos arquivos mexidos passam; lint limpo nos arquivos da feature.

### O que olhar em jogo

- 7m atrás fica bom? Ele se atrapalha com obstáculos indo pra lá?
- Ele "dançando" quando a luta muda de lado (a posição segura acompanha a
  selvagem mais perto da criatura)?
- Fugir pro time: ele corre pra criatura certa?
- Botões em `GAME_CONFIG.TRAINER_BATTLE`.


---

## Gates

- `npm test` (suíte inteira, feature consolidada): 1251 passam, **60 falham,
  todas já existentes** — as mesmas 60 dos Gates da 033, arquivo por arquivo:
  `applyAnimationClip` (5), `orbitCamera` (10), `world` (3), `items/index` (1),
  `species/index` (1), `stats` (1), `footstepGroups` (1), `faintSystem` (6),
  `partySummonSystem` (15), `partyVitals` (5), `summonBallSystem` (3) e
  `creatureAttackSystem` (9). Nenhuma falha nova. (Consertá-las está no
  `docs/backlog.md`, em Combate.)
- `npm run lint`: limpo. Falhava só com erros que já existiam, corrigidos
  aqui a pedido do usuário: prettier (`eslint --fix`, só formatação — quebras
  de linha, vírgulas finais, espaços) em 12 arquivos fora da feature
  (`species/001-bulbasaur`, `004-charmander`, `007-squirtle`, `testLevel`,
  `ActionSlotHud`, `PokemonsTab`, `roster`, `StatsScreen`, `CreatureView`,
  `PunchAttackEffect`, `VineWhipAttackEffect`, `statusDisplay`) e `camelcase`
  em `sp_def` no `calculateEnergyStat` (`stats.js`) — renomeado só na
  desestruturação (`sp_def: spDef`); a chave `sp_def` dos dados continua.
- `npm run build`: passa (o Next roda o lint no build; antes falhava por ele).
