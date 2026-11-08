# 🚀 Versão 0.0.63 — Revisão da IA selvagem

## Resumo

Com o mundo povoado (062), a IA das selvagens ficou difícil demais, ataca
sem aviso (a hostil parte para cima assim que você entra no raio de aggro) e
quem foge é quase impossível de segurar. Esta feature revê a IA das
selvagens em partes, com o usuário testando ao vivo entre elas.

| Parte | O quê | Estado |
|---|---|---|
| 1 — Dificuldade | Um parâmetro só das selvagens que deixa a luta mais fácil ou mais difícil, sem mexer na IA do time | feita |
| 2 — Percepção e alerta | A selvagem te percebe (cone de visão + raio), mostra um emote e decide pelo temperamento | feita |
| 3 — Fuga clássica | Fugir é sumir do mapa, como nos jogos; só em duas situações. Sai a fuga de hoje e a penalidade de vida baixa | feita |

Regras que continuam valendo: a IA do time é **sempre defensiva** (031) e
fica fora desta feature (é a 064). O bando é da 077.

Versão: `0.0.63` (`package.json`). Branch: `feature/063-revisao-da-ia-selvagem`.

> **Os números deste doc são fictícios (só ilustram).** O valor de verdade é
> o do campo citado (config ou dado da espécie).

---

## O que já existe (ponto de partida)

- **Temperamento** (031): `WildBehavior.temperament` é `'hostile'` ou
  `'peaceful'`, sorteado no spawn por `rollTemperament`
  (`core/battle/wildBehavior.js`) com `species.wild.hostileChance` (ou
  `WILD_BEHAVIOR.DEFAULT_HOSTILE_CHANCE`). Vai para o save.
- **Hostil vagando** (`resolveDecision`, `wildBehaviorSystem.js`): o mais
  perto do lado do jogador (`listPlayerSide`) dentro de
  `WILD_BEHAVIOR.AGGRO_RADIUS` → `perseguirJogador` na hora. Sem cone, sem
  aviso.
- **Pacífica** (`wildReactionSystem.js`): só reage apanhando — revida ou
  foge pela coragem (`resolveRetaliateChance`, `rollAttackReaction`).
- **Fuga de hoje** (034): estado `'flee'` do `WildBehavior`; corre para um
  ponto escolhido por `resolveFleeDestination` (`core/battle/flee.js`) até
  `FLEE_SAFE_DISTANCE` e volta a vagar ali. Entra por três caminhos: pacífica
  que apanha (coragem), fuga com HP baixo na luta (`LOW_HP_FLEE_*`, estado
  `shaken`/`lowHpRolled`) e captura que escapa
  (`CAPTURE.ESCAPE_FIGHT_CHANCE`, `selvagemEscapou` em
  `core/actions/capture.js`). Esse código só é usado pelas selvagens.
- **Penalidade de vida baixa** (034, Parte 3): `STAMINA_BY_HP`
  (`resolveMovementCostMultiplier`, `core/actions/stamina.js`) e
  `SPEED_BY_HP` (`core/actions/movementSpeed.js`) — com a vida baixa, correr
  e dar dash custam mais e o passo fica mais lento. Vale para todo mundo.
- **Luta da IA** (034): `planAiAttack` (`core/battle/aiAttackChoice.js`),
  `moveInFight` (`core/battle/aiMovement.js`), `resolveResting`
  (`core/battle/aiEnergy.js`). Os valores vêm de `AI_ATTACK`, `AI_ENERGY` e
  `AI_MOVEMENT`, **compartilhados com a IA do time**.
- **Mira da IA**: `creatureAttackSystem.js` (passada 3) mira com
  `resolveDirectionTo(pos, alvo)` — direto no alvo, sem erro.
- **Ritmo**: `WILD_BEHAVIOR.ATTACK_INTERVAL` entre um pedido de golpe e o
  próximo.
- **Despawn** (062): `despawnarSelvagem(world, events, entity, reason)`
  (`core/actions/wildSpawn.js`), com o motivo no log do F2.
- **Plaquinha** (027/062): `NameplateView.jsx`, DOM (`<Html>` do drei) acima
  da cabeça, some pela distância (`nameplateRange.js`).
- **Captura por trás** (043): `CAPTURE.BACK_STRIKE_ANGLE` já premia chegar
  pelas costas — combina com o cone de visão.
- **Debug** (F2): `WildBehaviorDebugView.jsx` mostra temperamento, estado,
  alvo e o raio de `resolveBehaviorRadius`.

---

## Decisões (com o usuário)

1. **Dificuldade só no config** por enquanto (sem opção no menu).
2. **Um parâmetro só das selvagens**: a IA do time não muda.
3. **Toda selvagem sinaliza que te percebeu** com uma exclamação branca.
   Depois, pelo temperamento:
   - **hostil**: o sinal vira o emote de brava e ela ataca — no que vier
     primeiro: **acabou o tempo de alerta** ou **você chegou perto demais**;
   - **pacífica**: sorteia se foge (some do mapa); se fica, o sinal some e
     ela volta a vagar.
4. **Percepção com cone de visão e raio**: de frente ela te vê de longe; de
   costas, só bem perto.
5. **Emotes escolhidos (A, A, A)** no preview
   (https://claude.ai/artifact/VEdQhMnyJCYmRRt2wdir78):
   - alerta: **"!" branco solto** com contorno escuro;
   - brava: **veia de raiva** vermelha (💢), pulsando;
   - medo: **gota de suor** azul escorrendo — usada na saída de quem foge.

   Os valores de animação do preview (tamanho, duração e exagero do pop,
   intensidade e ritmo do loop, contorno, tempo de alerta) são o ponto de
   partida do config.
6. **Fuga clássica**: fugir é **sumir do mapa**. O temperamento medroso
   (chegou a ser proposto) saiu. Só duas situações de fuga:
   - **pacífica que te percebe**, com uma chance **por espécie**;
   - **captura que escapa**: luta ou foge (some).
7. **Na luta ninguém foge**: com a vida baixa, luta até desmaiar.
8. **Pacífica que apanha sempre revida** (vira luta).
9. **A saída**: ela vira e corre por um instante com a gota de suor, some
   numa nuvem de poeira e o log mostra "O {espécie} selvagem fugiu!".
10. **Sai a penalidade de vida baixa** (custo de energia e lentidão), para
    todo mundo.
11. **Aggro descartado**: o problema do aggro era só na fuga, resolvido pela
    Parte 3. Perseguir e desistir ficam como hoje.

---

## Parte 1 — Dificuldade

### Objetivos

- Um número só (`WILD_DIFFICULTY.LEVEL`, de 0 a 1) controla o quanto as
  selvagens lutam bem. **1 = a IA de hoje**; abaixo disso, mais fácil.
- Cada efeito tem a ponta fácil e a ponta difícil no config, e o valor de
  verdade é a interpolação pelo `LEVEL` — dá para ajustar o todo por um
  número ou cada efeito à parte.
- A IA do time continua lendo os valores de hoje.

### O que a dificuldade mexe

| Efeito | Campo de hoje | Mais fácil = |
|---|---|---|
| Ritmo dos golpes | `WILD_BEHAVIOR.ATTACK_INTERVAL` | mais tempo entre um golpe e outro |
| Desvio | `AI_MOVEMENT.DODGE_CHANCE` | desvia menos do seu aviso |
| Reação | `AI_MOVEMENT.DODGE_REACTION_TIME` | demora mais para começar a desviar |
| Mira | (novo) `AIM_ERROR` | erra a mira por um ângulo sorteado no disparo |
| Escolha do golpe | `AI_ATTACK.NEAR_BEST_FRACTION` | sorteia mais entre golpes piores |
| Dash | `AI_MOVEMENT.DASH_CLOSE_DISTANCE` | usa menos dash para chegar perto |
| Rodeio | `AI_MOVEMENT.STRAFE_SPEED_FACTOR` | rodeia mais devagar (mais fácil de acertar) |
| Descanso | `AI_ENERGY.REST_ENTER_FRACTION` | para para descansar mais cedo (mais brechas) |

O tempo do aviso vermelho dos golpes é do golpe, não da IA, e não muda.

### Como funciona

```js
// Exemplo fictício — GAME_CONFIG.WILD_DIFFICULTY
WILD_DIFFICULTY: {
  LEVEL: 0.5,                                  // 0 = mais fácil, 1 = a IA de hoje
  EASY: {                                      // a ponta fácil de cada efeito
    ATTACK_INTERVAL: 2.4,                      // s
    DODGE_CHANCE: 0.1,
    DODGE_REACTION_TIME: 0.5,
    AIM_ERROR: 0.35,                           // rad, para cada lado
    NEAR_BEST_FRACTION: 0.2,
    DASH_CLOSE_DISTANCE: 10,
    STRAFE_SPEED_FACTOR: 0.35,
    REST_ENTER_FRACTION: 0.3,
  },
},
```

- **Regra pura** `resolveAiTuning(entity)` (`core/battle/aiTuning.js`):
  `WildCreature` → os valores interpolados pelo `LEVEL`; qualquer outra
  (time) → os valores de hoje (`AI_ATTACK`/`AI_ENERGY`/`AI_MOVEMENT`/
  `WILD_BEHAVIOR`). Os pontos que hoje leem o config direto passam a ler
  daqui: `moveInFight`/`decideFightMove`, `pickAiAttack`/`planAiAttack`,
  `resolveResting`, `wildBehaviorSystem` (intervalo).
- **Erro de mira**: no disparo da IA (`creatureAttackSystem.js`, passada 3),
  a direção até o alvo gira por um ângulo sorteado em `±AIM_ERROR`
  (`gameplayRng`). Só a selvagem; o time continua mirando certo.
- A ponta difícil não fica no `WILD_DIFFICULTY`: são os próprios campos de
  hoje (`WILD_BEHAVIOR.ATTACK_INTERVAL`, `AI_MOVEMENT.*` etc.), que a IA do
  time também lê — uma fonte só (ver "Como ficou").

### Etapas

- [x] `package.json` em `0.0.63`.
- [x] `GAME_CONFIG.WILD_DIFFICULTY` com `LEVEL` e as pontas de cada efeito.
- [x] `core/battle/aiTuning.js` (`resolveAiTuning`) e testes.
- [x] Movimento, escolha do golpe, descanso e intervalo lendo do tuning.
- [x] Erro de mira no disparo da selvagem.
- [x] Debug (F2): o `LEVEL` atual na etiqueta de cada selvagem.

### Testes (regras, sem fixar valores)

- `LEVEL` 1 devolve a ponta `HARD` e 0 a `EASY`; no meio, fica entre as duas.
- Criatura do time recebe os valores de hoje, seja qual for o `LEVEL`.
- Com `AIM_ERROR` zero a direção é a do alvo; com erro, o ângulo nunca passa
  de `AIM_ERROR`.
- Os testes da IA de hoje (034) continuam passando com `LEVEL` 1.

### Critérios de conclusão

- Baixar o `LEVEL` deixa a luta visivelmente mais fácil (golpes mais
  espaçados, menos desvio, erra mais).
- A IA do time luta igual a antes.

---

## Parte 2 — Percepção e alerta

### Objetivos

- A selvagem percebe quem chega: cone de visão à frente, raio curto em
  volta.
- Ao perceber, mostra a exclamação branca e para encarando quem viu.
- Decide pelo temperamento: hostil fica brava e ataca; pacífica sorteia se
  foge (Parte 3) e, se fica, volta a vagar.

### Percepção

- **Quem é percebido**: qualquer um do lado do jogador (`listPlayerSide` —
  treinador e criaturas do time, controladas ou não).
- **Vê** quem estiver a até `PERCEPTION.VIEW_DISTANCE` m **e** dentro do cone
  (`PERCEPTION.VIEW_HALF_ANGLE` para cada lado da frente dela,
  `Rotation`), **ou** a até `PERCEPTION.NEAR_RADIUS` m em qualquer direção
  (sente de perto, mesmo de costas).
- Regra pura `isPerceived(pos, yaw, otherPos)` (`core/battle/perception.js`),
  sem world — a mesma que o debug desenha.
- Sem linha de visão (árvore e pedra não escondem) nesta feature.

### Estados da percepção

Trait novo `WildAwareness` (separado do `WildBehavior`):

```
unaware ──(percebeu alguém)──► noticed ──(decidiu)──► reacted
   ▲                           [!] para e encara        hostil   → chase   [💢]
   │                           por ALERT_TIME           pacífica → fica    [! some]
   │                                                             ou foge   [💧] (Parte 3)
   └──(ninguém no raio de "esquecer")──────────────
```

- **noticed**: para de vagar (o `wildWanderSystem` pula quem está
  `noticed`), vira para quem viu e espera `ALERT_TIME`. Se essa pessoa sair
  da percepção antes, ela perde o interesse e volta a `unaware`.
- **Hostil decide**: no fim do `ALERT_TIME` **ou** antes, se o alvo chegar a
  `WILD_BEHAVIOR.AGGRO_RADIUS` (o raio de aggro de hoje vira o "perto
  demais") → `perseguirJogador`.
- **Pacífica decide**: no fim do `ALERT_TIME`, sorteia a fuga
  (`fleeChance`, Parte 3). Se fica, o emote some e ela volta a vagar.
- **reacted**: não sinaliza de novo (nem sorteia a fuga de novo) enquanto
  houver alguém do lado do jogador a até `FORGET_RADIUS` m. Saindo todo
  mundo, volta a `unaware`. Sem isso, a pacífica soltaria "!" toda hora com
  você por perto.
- **Apanhou** em qualquer estado: pula a percepção.
  - hostil: persegue na hora (como hoje), com o emote de brava;
  - pacífica: revida sempre (Parte 3), com o emote de brava.
- **Bola no meio do alerta**: a captura segue normal (`BeingCaptured` pula a
  decisão); se escapar, vale a regra da captura (Parte 3).
- A hostil que já está perseguindo segue as regras de hoje (limite e
  ameaça).

### Emotes

- **Dado no core, desenho na view**: `WildAwareness.emote` (`null`,
  `'alert'`, `'angry'`, `'fear'`) e quanto falta para ele sumir. O core não
  sabe de SVG.
- **Quanto tempo fica**:
  - alerta: enquanto `noticed`;
  - brava: `ANGRY_DURATION` depois de partir para cima (na luta, o olho bravo
    já mostra o estado);
  - medo: durante a saída de quem foge (Parte 3).
- **View**: os três SVG do preview num componente (`view/scene/WildEmote.jsx`)
  dentro da `NameplateView`, acima do nome. O emote aparece mesmo quando a
  plaquinha está escondida pela distância, para não sumir o aviso de quem
  está longe te vendo.
- **Animação**: pop com exagero na entrada, loop próprio de cada emote
  (bob, pulso, gota escorrendo), sumiço rápido na saída. Tudo por CSS com as
  variáveis do config.
- **Grito**: ao virar brava, a selvagem solta o grito da espécie (o mesmo da
  vocalização, 019) por um evento. O som próprio da exclamação fica para a
  065 (sons do mundo).

### Config

```js
// Exemplo fictício
WILD_BEHAVIOR: {
  PERCEPTION: {
    VIEW_DISTANCE: 14,
    VIEW_HALF_ANGLE: 1.0,   // rad
    NEAR_RADIUS: 4,
    FORGET_RADIUS: 18,
    ALERT_TIME: 1.2,        // s
    ANGRY_DURATION: 2,      // s
  },
  // ...o resto
},
FEEDBACK: {
  WILD_EMOTE: {
    SIZE: 56,               // px
    POP_DURATION: 320,      // ms
    POP_OVERSHOOT: 0.35,
    LOOP_AMPLITUDE: 1,
    LOOP_DURATION: 900,     // ms
    OUTLINE: 3,
  },
},
```

### Outros pontos

- **Save**: a percepção não vai para o save (volta `unaware`).
- **Laboratórios**: as selvagens do laboratório de golpes não ganham
  `WildAwareness` (ficam como hoje).
- **Debug (F2)**: cone e raio de cada selvagem, estado da percepção e quem
  ela viu.

### Etapas

- [x] `core/battle/perception.js` (`isPerceived`) e testes.
- [x] Trait `WildAwareness`, actions e `wildAwarenessSystem` (antes do
      `wildBehaviorSystem`); hostil vagando passa a decidir pela percepção.
- [x] `wildWanderSystem` parado e virado para o alvo enquanto `noticed`.
- [x] Emote no core (estado e tempo) e o grito ao virar brava (`CryPulse`).
- [x] `WildEmote.jsx` na plaquinha, com o config de animação.
- [x] Debug (F2) com cone, raio e estado.

### Testes (regras, sem fixar valores)

- Percepção: dentro do cone e da distância vê; fora do cone só dentro do
  raio curto; atrás e longe não vê.
- Hostil percebe → alerta → persegue no fim do alerta; chegar a menos do
  raio de aggro durante o alerta adianta a perseguição.
- Pacífica percebe → alerta → decide no fim do alerta e não sinaliza de novo
  até todos saírem do raio de esquecer.
- Alvo sai da percepção no meio do alerta → volta a `unaware` sem reagir.
- Apanhar pula a percepção, para os dois temperamentos.

### Critérios de conclusão

- Chegar perto de qualquer selvagem mostra a exclamação branca antes de
  qualquer reação.
- A hostil dá tempo de reagir (ou de ir embora) antes de atacar.
- A pacífica te olha e segue a vida (ou foge, Parte 3).
- Chegar por trás deixa chegar bem mais perto sem ser percebido.

---

## Parte 3 — Fuga clássica

### Objetivos

- Fugir é **sumir do mapa**, como nos jogos. Acaba o problema de não
  conseguir segurar quem foge.
- Só duas situações de fuga: pacífica que te percebe e captura que escapa.
- Na luta ninguém foge; pacífica que apanha revida.
- Sai a penalidade de vida baixa, para todo mundo.

### As duas fugas

1. **Pacífica te percebe** (Parte 2): no fim do alerta sorteia
   `species.wild.fleeChance` (sem o campo, `WILD_BEHAVIOR.DEFAULT_FLEE_CHANCE`).
   É uma vez por encontro: ficando, não sorteia de novo até todos saírem do
   raio de esquecer. A janela do alerta passa a valer: acertar um golpe ou
   jogar a bola antes do fim do alerta impede a fuga; chegar por trás sem
   ser percebido nem dá chance de sorteio.
2. **Captura que escapa** (`selvagemEscapou`): continua sorteando luta ou
   fuga por temperamento (`CAPTURE.ESCAPE_FIGHT_CHANCE`); a fuga agora é a
   saída abaixo.

A hostil nunca foge ao perceber.

### Chance de fuga por espécie

```js
// Exemplo fictício
wild: { hostileChance: 0.1, fleeChance: 0.4 },
```

Proposta de partida (confirmar no teste), no estilo da Zona Safári:

| Espécie | Chance de fugir |
|---|---|
| Caterpie | quase nunca |
| Weedle | baixa |
| Pidgey | alta |
| Rattata | alta |
| Spearow | média |
| Ekans | média |
| Pikachu | muito alta (o raro que escapa) |

### A saída

- Estado novo de saída (`WildLeaving`, com o tempo restante): ela vira para
  longe de quem está mais perto do lado do jogador e corre por
  `LEAVE_RUN_TIME` s, com o emote de medo (gota de suor).
- Durante a saída ela **não é alvo nem pode ser capturada** (fora de
  `isActiveCombatant` e da mira da bola): já decidiu ir embora.
- No fim: nuvem de poeira no lugar (o mesmo VFX de poeira do dash/pulo),
  `despawnarSelvagem(..., 'fled')` (o motivo aparece no log do F2) e o
  evento que põe "O {espécie} selvagem fugiu!" no log da tela.
- Saída em andamento não vai para o save: ao salvar, conta como já fugida.

### O que sai

- **Fuga de hoje**: estado `'flee'` do `WildBehavior`, `fugirDoJogador`,
  `core/battle/flee.js` (`resolveFleeDestination`) e os `FLEE_*` do config.
- **Fuga com HP baixo**: `LOW_HP_FLEE_*`, `LOW_HP_RECOVER_FRACTION`,
  `shaken`, `lowHpRolled`, `resolveMorale`.
- **Coragem da pacífica**: `RETALIATE_CHANCE`, `COURAGE_*`,
  `resolveRetaliateChance`, `rollAttackReaction` — pacífica que apanha
  sempre revida.
- **Penalidade de vida baixa**: `STAMINA_BY_HP` e `SPEED_BY_HP`
  (`resolveMovementCostMultiplier`, o multiplicador de
  `movementSpeed.js`) — correr, dar dash e andar custam e valem o mesmo com
  qualquer vida.
- O círculo de fuga do debug (`resolveBehaviorRadius` sem o caso `'flee'`).

### Config

```js
// Exemplo fictício
WILD_BEHAVIOR: {
  DEFAULT_FLEE_CHANCE: 0.3,
  LEAVE_RUN_TIME: 1.2,    // s
  // ...
},
```

### Etapas

- [x] `wild.fleeChance` nas 7 espécies e no `_template`;
      `DEFAULT_FLEE_CHANCE` no config.
- [x] Sorteio da fuga na decisão da pacífica (Parte 2).
- [x] Saída (`WildBehavior.state` `'leave'`): corrida de saída, fora de alvo
      e de captura, poeira, despawn com motivo `'fled'` e mensagem no log.
- [x] Captura que escapa usando a saída nova.
- [x] Pacífica que apanha sempre revida.
- [x] Remover a fuga de hoje, a fuga com HP baixo, a coragem e a penalidade
      de vida baixa (código, config, testes e debug).
- [x] Wiki (no fim da feature): passada final — percepção, emotes, a fuga
      clássica, a chance de fuga por espécie em "Onde encontrar" e o fim da
      penalidade de vida baixa. (Uma parte já entrou para a wiki compilar sem
      os dados que saíram: ver "Como ficou".)

### Testes (regras, sem fixar valores)

- Pacífica com chance de fuga máxima sempre sai; com zero, nunca.
- Golpe ou bola antes do fim do alerta impedem o sorteio.
- Ficando, não sorteia de novo até todos saírem do raio de esquecer.
- Hostil nunca sorteia fuga ao perceber.
- Saída: não é alvo nem capturável; no fim, some com o motivo `'fled'` e o
  evento da mensagem.
- Captura que escapa: luta ou saída, pela chance do temperamento.
- Pacífica que apanha persegue quem bateu.
- Com a vida baixa, perseguindo, ela continua lutando (não foge).
- Custo da corrida e do dash e velocidade iguais com qualquer vida.

### Critérios de conclusão

- Quem foge some do mapa com a poeira e a mensagem, sem perseguição sem fim.
- Selvagem na luta vai até desmaiar.
- Seu time ferido corre e dá dash como se estivesse com a vida cheia.

---

## Como ficou (implementação)

Diferenças e detalhes em relação ao plano acima:

- **Dificuldade sem duplicar valores**: `WILD_DIFFICULTY` guarda só o `LEVEL`
  e a ponta `EASY`. A ponta difícil continua nos campos de origem
  (`AI_MOVEMENT`, `AI_ATTACK`, `AI_ENERGY`, `WILD_BEHAVIOR.ATTACK_INTERVAL`),
  que a IA do time também usa — tirar de lá deixaria o time sem valor.
  `resolveHardTuning()` lê esses campos; `resolveWildTuning(level)`
  interpola; `resolveAiTuning(entity)` escolhe pela `WildCreature`. O erro de
  mira é `applyAimError` (`core/battle/aiTuning.js`), aplicado no disparo da
  IA no `creatureAttackSystem`. O `LEVEL` de partida ficou no meio e as
  pontas fáceis foram escolhidas para teste (ajustar ao vivo).
- **Testes da IA de hoje** (`aiMovement`, `wildBehaviorSystem`,
  `creatureAttackSystem`, `partyBehaviorSystem`, `trainerBattleSystem`)
  rodam com `LEVEL` 1, que é a IA de antes.
- **Saída sem trait novo**: em vez de `WildLeaving`, o `WildBehavior` ganhou o
  estado `'leave'` (com `leaveDirX`/`leaveDirZ`/`leaveTimer`) — um campo só,
  como os outros estados. `sairDoMapa` (`core/actions/wildBehavior.js`)
  começa a saída; o `wildBehaviorSystem` corre e, no fim, chama
  `despawnarSelvagem(..., 'fled')`. Quem está saindo fica fora de
  `isActiveCombatant`, dos alvos de golpe (`attackTargets.js`) e da bola
  (`captureFlight.js`), e não vai para o save.
- **Percepção**: regra pura em `core/battle/perception.js` (`isPerceived`,
  `findPerceived`) e o passo de cada tick em `core/battle/wildAwareness.js`
  (`resolveAwarenessStep`, devolve o que fazer); o `wildAwarenessSystem`
  só aplica, antes do `wildBehaviorSystem`. O `wildBehaviorSystem` não começa
  mais perseguição sozinho: só move quem persegue/sai e decide quem desiste.
- **Hostil que já reagiu** (voltou a vagar depois de desistir): parte para
  cima de novo se alguém do lado do jogador chegar a `AGGRO_RADIUS`, sem
  esperar sair do raio de esquecer.
- **Brava e grito**: `perseguirJogador` mostra a veia de raiva e põe o
  `CryPulse` (o grito da espécie que já existia, 061) sempre que ela PARTE
  para cima — pela percepção, ao apanhar ou ao escapar da bola para brigar.
- **Ameaça só perseguindo**: ela decai só enquanto a selvagem persegue (é
  zerada ao voltar a vagar, como antes).
- **Captura pelas costas**: só conta se a selvagem não tiver percebido
  ninguém (`WildAwareness.state` `'unaware'`), além das regras de antes.
- **Log**: "O {espécie} selvagem fugiu!" vem do `WILD_DESPAWNED` com motivo
  `'fled'`; a linha da bola que escapa para fugir virou só "escapou da
  Pokébola!" para não repetir.
- **Poeira**: `wildFledDustSystem` (view) pede uma nuvem nos pés de onde ela
  sumiu (`dustPuffQueue.js`) e a `JumpDustView` solta com o VFX da poeira de
  pulo.
- **Emote**: `view/scene/WildEmote.jsx` dentro da `NameplateView`, que agora
  separa a etiqueta (some pela distância e névoa) do emote (só pela névoa).
- **Velocidade**: `resolveMoveSpeed(stats, running, modifier)` perdeu o
  `vitals` (a vida não muda mais a velocidade).
- **Wiki (parte já feita)**: a página "Comportamento das selvagens" foi
  reescrita (percepção, temperamento, fuga clássica), a seção "Vida baixa"
  saiu de "Vida e energia", e "Energia" e "Captura" foram ajustadas — sem
  isso a wiki não compilava.
- **Wiki (passada final)**: "Onde encontrar" ganhou a tabela "Hostis ou
  pacíficas" (chance de ser hostil e de fugir de cada espécie); "Como as
  criaturas lutam" mostra os números do time e, entre parênteses, os das
  selvagens no nível de dificuldade da versão (ritmo, mira, desvio, escolha
  de golpe, dash e descanso); "Comportamento das selvagens" explica que a
  hostil que desistiu volta pra cima de quem chega perto demais.

---

## Gates

- [x] Testes dos arquivos mexidos, `npm run lint` nos arquivos mexidos e
      build de produção numa cópia.
- [x] `npm test` inteiro (no fim da feature), `npm run lint` inteiro e build
      de produção de novo depois da passada final da wiki.

---

## Fora de escopo

- Opção de dificuldade no menu (por enquanto só no config).
- Linha de visão (árvores e pedras escondendo o jogador).
- Som próprio da exclamação — 065 (sons do mundo).
- IA do time — 064. Bando — 077.
