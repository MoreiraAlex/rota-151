# 🚀 Versão 0.0.64 — Revisão da IA do parceiro

## Resumo

A IA das criaturas do time fora do controle do jogador foi pensada na 031 e
ganhou golpes e movimento na 034. Com o mundo povoado e as selvagens revistas
(063), faltam três coisas:
- um limite para quem fica para trás;
- um jeito de escolher como cada Pokémon luta;
- um ajuste de dificuldade próprio do time.

Pedido no meio da feature (Parte 4): numa luta de Pidgey contra Pidgey não dá
para saber qual é o seu, e as cores de dano dos dois lados quase não se
diferenciam.

A feature vai em partes, com o usuário testando ao vivo entre elas.

| Parte | O quê | Estado |
|---|---|---|
| 1 — Longe demais | Criatura muito longe ou presa volta sozinha para a bola; o caso inverso (a controlada larga o treinador para trás) | feita |
| 2 — Posturas | Agressiva, defensiva e neutra, escolhida por Pokémon no menu do Q/E/R | feita |
| 3 — Dificuldade do time | O mesmo mecanismo da 063, com um parâmetro só do time | feita |
| 4 — Qual é o meu | Marca do seu Pokémon (anel no chão, plaquinha) e cores de dano por quem causa/toma | feita |

Muda uma regra antiga: a 031 decidiu "sempre defensiva, sem parâmetro de
postura". Agora são três posturas, e a defensiva continua sendo a padrão.

Versão: `0.0.64` (`package.json`). Branch: `feature/064-revisao-da-ia-do-parceiro`.

> **Os números deste doc são fictícios (só ilustram).** O valor de verdade é
> o do campo citado (config ou dado da espécie).

---

## O que já existe (ponto de partida)

- **Seguir** (`creatureFollowSystem.js`, config em `boy.party`): para dentro
  de `followMinDistance`, anda até `runDistance`, corre além disso, com a
  folga de `followResumeDistance`. Usa pathfinding (`PathState`) e desvia dos
  outros personagens (`avoidance*`). **Não há limite de distância.**
- **Chunk congelado** (046): quem está num chunk descarregado fica parado
  (`ChunkFrozen`). O centro do carregamento é o treinador (`Party`) e quem
  está no controle (`InputControlled`) (`chunkStreamingSystem.js`). Então uma
  criatura largada longe pode congelar lá; o treinador nunca congela.
- **Troca de controle** (018): com o controle numa criatura, é o treinador
  quem segue (`resolveGroupLeader`).
- **Recolher sozinho** (031/041): `needsAutoRecall` (`partySummonSystem.js`)
  recolhe a desmaiada depois de `FAINT.PARTY_RECALL_DELAY` e quem saiu do
  slot. É o mesmo caminho do recolher normal (`RecallBeam`).
- **Entrar na luta** (`partyReactionSystem.js`): só quando uma selvagem
  **acerta** alguém do grupo. Quem está seguindo entra (`defenderGrupo`); a
  controlada, a desmaiada e a que treina não entram.
- **Lutar** (`partyBehaviorSystem.js`): `planAiAttack`, `moveInFight` e
  `resolveResting` (034). Protege o treinador (`findTrainerHunter`), troca
  para a selvagem de menos vida (`findWeakest`) e larga a luta além de
  `PARTY_BEHAVIOR.LEASH_RADIUS` de quem segue.
- **Dificuldade** (063): `resolveAiTuning(entity)` (`core/battle/aiTuning.js`)
  dá à selvagem os valores interpolados por `WILD_DIFFICULTY.LEVEL` e ao time
  a ponta difícil (os campos de origem). O erro de mira (`applyAimError`) é só
  da selvagem.
- **Percepção** (063): `isPerceived` / `findPerceived`
  (`core/battle/perception.js`), cone + raio curto, com os valores de
  `WILD_BEHAVIOR.PERCEPTION`.
- **Menu do Q/E/R** (038): `PartyActionMenu.jsx` (`src/tools/menu/`), com as
  abas Treino, Golpes e Itens.
- **Save** (044): `pokemonSave.js`, formato versionado (`SAVE_VERSION`, com
  migração em `saveFormat.js`).

---

## Decisões (com o usuário)

1. **Longe demais ou presa → volta sozinha para a bola.**
2. **O inverso** (a controlada vai na frente e larga o treinador, às vezes
   preso): a mesma regra vista do treinador — aviso, e depois a controlada
   volta para a bola e o controle volta para ele (Parte 1).
6. **Defensiva** entra quando a selvagem parte para cima (a veia de raiva),
   não no alerta "!".
7. **Neutra**: "atacada" é ser acertada por um golpe de selvagem; golpe que
   erra não conta.
3. **Três posturas**, configuradas **por Pokémon**, por enquanto só no menu do
   Q/E/R:
   - **agressiva**: ataca toda selvagem que entrar no raio dela (o mesmo
     campo de visão das selvagens);
   - **defensiva**: como hoje, e também entra quando uma selvagem fica hostil
     e parte para cima do grupo;
   - **neutra**: só luta se ela mesma for atacada.
4. **Comandos** ("ataca meu alvo", "volta aqui"): fora.
5. **Dificuldade do time**: o mesmo mecanismo da 063, com um parâmetro
   separado do das selvagens.

---

## Parte 1 — Longe demais

### Objetivos

- Uma criatura do time nunca fica perdida longe do grupo nem presa num lugar.
- O mesmo vale ao contrário, quando o jogador controla uma criatura rápida e
  o treinador fica para trás.

### Criatura que ficou para trás (seguindo)

Ela volta sozinha para a bola (o recolher automático que já existe) em dois
casos:
- **longe demais**: passou de `FOLLOW_LIMIT.RECALL_DISTANCE` m de quem segue
  (no plano). Esse limite fica bem acima do `LEASH_RADIUS`, para nunca
  recolher no meio de uma luta normal;
- **presa**: tentando seguir (andando ou correndo, sem lutar, treinar nem
  estar numa ação), não sai de um círculo de `FOLLOW_LIMIT.STUCK_RADIUS` m
  por `FOLLOW_LIMIT.STUCK_TIME` s.

Mais detalhes:
- Vale também em chunk congelado: a checagem não pula `ChunkFrozen` (é
  justamente o caso de quem ficou para trás).
- A mensagem no log fica parecida com "{Pokémon} voltou para a Pokébola". O
  jogador invoca de novo quando quiser.
- Lutando, ela larga a luta pelo `LEASH_RADIUS` antes de chegar no limite, e
  depois segue a regra acima.

### O inverso: a controlada largou o treinador

Com o controle numa criatura, o treinador é quem segue. Se ela corre na
frente, ele fica para trás (ou preso numa encosta).

**A mesma regra, vista do treinador.** A criatura depende do treinador:
- passou de `FOLLOW_LIMIT.WARN_DISTANCE` m do treinador: um aviso na tela
  ("Longe demais do treinador");
- passou de `FOLLOW_LIMIT.RECALL_DISTANCE` m, ou o treinador está preso há
  `STUCK_TIME` s (mesma regra de "presa" acima): ela volta para a bola e o
  controle volta para o treinador;
- assim, se o treinador estava preso, o jogador sai dali com ele.

Alternativa descartada: teleportar o treinador para perto da
criatura, fora da vista. Resolve o "preso", mas pode largar o treinador num
lugar ruim (água, encosta) e não combina com a regra de cima.

### Config

```js
// Exemplo fictício
PARTY_BEHAVIOR: {
  FOLLOW_LIMIT: {
    RECALL_DISTANCE: 40,  // m — começa a contagem para voltar à bola
    CANCEL_MARGIN: 3,     // m — folga para cancelar a contagem de "longe"
    WARN_DISTANCE: 30,    // m — aviso (só com o controle numa criatura)
    STUCK_RADIUS: 1,      // m
    STUCK_TIME: 4,        // s tentando seguir sem sair do lugar
    WARNING_TIME: 3,      // s de contagem na tela antes de puxar
  },
  // ...o resto
},
```

### Etapas

- [x] `package.json` em `0.0.64`.
- [x] Regra pura de "longe demais" / "presa" (`core/party/followLimit.js`) e
      testes.
- [x] Recolher automático por distância e por estar presa (reusa o caminho do
      `needsAutoRecall`), com a mensagem no log.
- [x] O inverso: aviso, recolher a controlada e devolver o controle ao
      treinador.
- [x] Debug (F2): o tempo "presa" na etiqueta.

### Testes (regras, sem fixar valores)

- Além do limite → volta para a bola; dentro dele, não.
- Sem sair do lugar por `STUCK_TIME` → volta; andando de verdade, o tempo
  zera.
- Lutando dentro do `LEASH_RADIUS` → não volta.
- Num chunk congelado, longe → volta.
- Controlada longe do treinador → aviso; além do limite, volta e o controle
  vai para o treinador.

### Critérios de conclusão

- Nenhuma criatura fica largada longe ou presa: ela some para a bola e dá
  para invocar de novo.
- Correr na frente com uma criatura rápida não deixa o treinador perdido.

---

## Parte 2 — Posturas

### Objetivos

- Cada Pokémon do time tem uma postura: **agressiva**, **defensiva** (a
  padrão) ou **neutra**.
- Ela é escolhida no menu do Q/E/R e fica salva no Pokémon.

### O que cada postura faz

| Postura | Entra na luta quando... | Contra quem | Protege o treinador |
|---|---|---|---|
| Agressiva | uma selvagem entra no campo de visão dela, ou qualquer caso da defensiva | qualquer selvagem que ela vê ou que briga com o grupo | sim |
| Defensiva | uma selvagem acerta alguém do grupo (hoje) **ou parte para cima do grupo** (novo) | as que brigam com o grupo (hoje) | sim |
| Neutra | ela mesma é acertada por uma selvagem | só quem a atacou | não |

- **Defensiva, o novo gatilho**: uma selvagem passa a perseguir
  (`WildBehavior.state` `'chase'`) alguém do grupo deste dono, dentro do
  `LEASH_RADIUS` de quem segue. Na prática, é a hostil que mostra a veia de
  raiva e vem para cima (063). O "!" do alerta ainda não conta.
- **Agressiva, o raio**: a mesma regra de percepção das selvagens
  (`isPerceived`, cone à frente dela + raio curto), com valores próprios em
  `PARTY_BEHAVIOR.PERCEPTION` (de partida, iguais aos de
  `WILD_BEHAVIOR.PERCEPTION`). Só vale dentro do `LEASH_RADIUS` de quem segue.
  A pacífica atacada revida (063), então vira luta.
- **Neutra**: luta contra quem a acertou (e contra quem mais a acertar
  depois). Quando essas saem da luta, volta a seguir. Não troca para outras
  selvagens do grupo nem protege o treinador.
- **Fora de alvo para qualquer postura**: a selvagem sendo capturada
  (`BeingCaptured`), a que está fugindo (`'leave'`) e a desmaiada. A
  agressiva não pode estragar uma captura.
- Como hoje: a controlada, a desmaiada e a que treina não entram em luta.
  Postura não importa enquanto ela está no controle.

### Onde fica

- **No Pokémon** (o registro dele, não a criatura em campo), como `posture`:
  `'aggressive' | 'defensive' | 'neutral'`. A criatura invocada lê dali.
- **Save**: entra no `pokemonSave.js`. `SAVE_VERSION` sobe, e a migração põe
  `'defensive'` em quem não tem.
- **Action** `definirPostura(pokemon, posture)`. O menu chama, não muta.
- **Menu do Q/E/R**: aba nova "Postura" com as três opções e uma linha
  explicando cada uma. A atual fica marcada.
- **Debug (F2)**: a etiqueta da criatura do time mostra a postura
  ("AGRESSIVA · seguindo" etc.).

### Config

```js
// Exemplo fictício
PARTY_BEHAVIOR: {
  DEFAULT_POSTURE: 'defensive',
  PERCEPTION: {            // só a agressiva usa
    VIEW_DISTANCE: 14,
    VIEW_HALF_ANGLE: 1.0,  // rad
    NEAR_RADIUS: 4,
  },
  // ...o resto
},
```

### Etapas

- [x] `posture` no Pokémon, `definirPostura`, save (versão nova + migração) e
      testes.
- [x] `partyReactionSystem` decidindo pela postura (hit no grupo / hit nela);
      gatilho novo da defensiva (selvagem perseguindo o grupo).
- [x] Agressiva: procura selvagem percebida e entra na luta.
- [x] `partyBehaviorSystem`: alvo pela postura (neutra só quem a atacou, sem
      proteger o treinador); captura e fuga fora de alvo.
- [x] Aba "Postura" no `PartyActionMenu.jsx`.
- [x] Debug (F2) com a postura.

### Testes (regras, sem fixar valores)

- Defensiva: entra quando uma selvagem acerta alguém do grupo, e quando uma
  selvagem passa a perseguir alguém do grupo; não entra no alerta ("!").
- Neutra: não entra quando o treinador ou outra do time apanha; entra quando
  ela é acertada; larga quando quem a atacou sai da luta.
- Agressiva: entra quando uma selvagem fica dentro da percepção dela; fora do
  cone e longe, não; fora do `LEASH_RADIUS`, não.
- Nenhuma postura mira a selvagem sendo capturada ou fugindo.
- Save: a postura volta igual; save antigo carrega como defensiva.
- Os testes de hoje do `partyBehaviorSystem` passam com a defensiva.

### Critérios de conclusão

- Trocar a postura no menu muda na hora como aquele Pokémon reage.
- A defensiva entra na luta quando a hostil vem para cima, sem esperar
  alguém apanhar.
- A neutra fica parada vendo a luta até ser atacada.

---

## Parte 3 — Dificuldade do time

### Objetivos

- Um número só (`PARTY_DIFFICULTY.LEVEL`, de 0 a 1), separado do das
  selvagens, controla o quanto o time luta bem. **1 = a IA de hoje.**

### Como funciona

- Igual à 063: `PARTY_DIFFICULTY` guarda o `LEVEL` e a ponta `EASY`. A ponta
  difícil são os campos de origem (`AI_MOVEMENT`, `AI_ATTACK`, `AI_ENERGY`) e,
  no ritmo, o `PARTY_BEHAVIOR.ATTACK_INTERVAL`.
- `resolveAiTuning(entity)`: `WildCreature` → `WILD_DIFFICULTY`; criatura do
  time → `PARTY_DIFFICULTY`.
- O erro de mira (`applyAimError`) passa a valer também para o time, pelo
  `AIM_ERROR` da ponta dele.
- O `LEVEL` de partida é 1, para o time lutar como hoje até o ajuste ao vivo.

```js
// Exemplo fictício
PARTY_DIFFICULTY: {
  LEVEL: 1,
  EASY: {
    ATTACK_INTERVAL: 2.4,
    DODGE_CHANCE: 0.1,
    DODGE_REACTION_TIME: 0.5,
    AIM_ERROR: 0.35,
    NEAR_BEST_FRACTION: 0.2,
    DASH_CLOSE_DISTANCE: 10,
    STRAFE_SPEED_FACTOR: 0.35,
    REST_ENTER_FRACTION: 0.3,
  },
},
```

### Etapas

- [x] `PARTY_DIFFICULTY` no config; `resolveAiTuning` escolhendo pelo lado;
      ritmo do time lendo do tuning.
- [x] Erro de mira no disparo da IA do time.
- [x] Debug (F2): o `LEVEL` do time na etiqueta.

### Testes (regras, sem fixar valores)

- Criatura do time segue o `PARTY_DIFFICULTY`, e a selvagem o
  `WILD_DIFFICULTY`; mudar um não mexe no outro.
- `LEVEL` 1 do time dá os valores de hoje; 0, a ponta `EASY`.
- Com `AIM_ERROR` do time zero, ela mira certo.

### Critérios de conclusão

- Baixar o `LEVEL` do time deixa ele visivelmente pior na luta, sem mudar as
  selvagens.

---

## Parte 4 — Qual é o meu

### Objetivos

- Bater o olho e saber qual criatura é sua, mesmo contra outra da mesma
  espécie e mesmo de longe.
- O brilho e o número de dano dizerem de que lado foi o golpe.

### Decisões (com o usuário)

1. **Anel no chão + plaquinha marcada**: os dois.
2. **O anel aparece sempre**, não só na luta.
3. **Cores de dano pela regra de jogo de ação**: o dano que você causa é
   claro (branco; crítico dourado), o que você toma é vermelho. Os status
   continuam por lado, com os pares mais separados.

### Como era

Brilho e número na mesma paleta, por lado: dano vermelho na selvagem e rosa
no time (quase iguais num brilho curto), status laranja/verde × violeta/
ciano. A plaquinha era igual para todo mundo.

### Critérios de conclusão

- Numa luta de duas criaturas da mesma espécie, a sua se destaca (anel e
  plaquinha).
- Dá para saber pelo brilho se quem apanhou foi a sua ou a selvagem.

---

## Wiki (no fim da feature)

- [x] "Seu time": a aba Postura no menu de ações; "Seguindo"; "Posturas"
  (as três, a padrão, o que fica fora de alvo); "Quem fica para trás" (a
  contagem e o caso inverso); "Qual é o seu" (o anel, a plaquinha e as
  cores do dano).
- [x] "Como as criaturas lutam": os números do time vêm da dificuldade dele
  (`partyAi`), com os das selvagens entre parênteses; a mira de cada lado.
- [x] Dados (`wikiData.js`): `partyAi`, a postura padrão, o campo de visão
  da agressiva e os números de quem fica para trás.

---

## Como ficou (implementação)

### Parte 1

- **Preso = não sai do lugar**, não "não chegou mais perto": uma criatura
  lenta atrás de um treinador correndo se afasta mesmo andando, e seria
  recolhida à toa. Conta só quem está tentando seguir (marcha do seguir
  diferente de parada, sem luta, treino, ação nem o treinador fora do
  seguir).
- **Trait** `FollowWatch` (âncora, tempo preso, aviso dado) na criatura
  invocada (`summonBallSystem`) e no treinador (`world.js`). Dono:
  `followLimitSystem.js`, antes do `partySummonSystem`.
- **Pedido** `StrayRecall` (tag) posto por `voltarParaABola`
  (`core/actions/followLimit.js`), que emite `partyStrayed` uma vez;
  `needsAutoRecall` atende quando o treinador está livre.
- **Controle de volta**: `devolverControleAoDono` (`core/actions/control.js`)
  saiu do desmaio (`faint.js`) e agora também roda no recolher — recolher a
  controlada por qualquer motivo devolve o controle ao treinador.
- **Contagem antes de puxar** (pedido do usuário no teste: "tudo muito
  instantâneo e pouco visual"): bater no limite (longe ou presa) começa uma
  contagem de `WARNING_TIME`; resolvido no meio (voltou para perto,
  desprendeu), cancela. Contando por "longe", só cancela abaixo de
  `RECALL_DISTANCE - CANCEL_MARGIN` (sem a folga, andar na borda ligava e
  desligava). Regras puras: `isTooFar`, `resolveRecallCountdown`.
- **Aviso na tela**: trait `StrayWarning` (`stage` `'warn'`/`'recall'`,
  motivo, tempo em degraus de `FEEDBACK.RECALL_WARNING.DISPLAY_STEP`) na
  criatura que VAI voltar. Dois lugares:
  - banner no topo (`tools/hud/StrayWarningHud.jsx`): "Puxando {Pokémon} de
    volta para a Pokébola" (parceiro) ou "Você vai ser puxado para a
    Pokébola" (a controlada), com o motivo, o número e a barra de tempo;
  - a Pokébola balançando e piscando acima da plaquinha do parceiro
    (`view/scene/RecallWarningIcon.jsx`), mais rápido na reta final
    (`BLINK_SLOW` → `BLINK_FAST` abaixo de `FAST_BELOW`). A controlada não
    tem plaquinha: para ela é só o banner.
- **"Longe demais do treinador"** saiu do log e virou o banner amarelo sem
  contagem (`stage` `'warn'`), ligado entre `WARN_DISTANCE` e
  `WARN_RESET_DISTANCE`.
- **Log** só no fim, quando ela volta: "{Pokémon} se afastou demais e voltou
  para a Pokébola.", "{Pokémon} ficou preso e voltou...", "{Pokémon} se
  afastou demais do treinador e voltou...", "O treinador ficou preso —
  {Pokémon} voltou..." (`FEEDBACK.STRAYED_COLOR`).
- **Recém-invocada**: com o limite ajustado no teste abaixo do voo da esfera
  (`summonOffset`), a distância só conta depois de ela ter chegado perto do
  grupo uma vez (`FollowWatch.joined`); antes disso, só o "presa" vale.

### Parte 2

- **Onde fica**: `Pokemon.posture` no registro (`null` = a padrão,
  `normalizePosture`). A criatura em campo lê pelo `SummonedFrom` a cada
  tick (`resolveCreaturePosture`), então trocar no menu vale na hora.
  Regras em `core/party/posture.js` (`joinsOnHit`, `defendsGroup`,
  `seeksWilds`); a action é `definirPostura` (`core/actions/posture.js`).
- **Save**: `SAVE_VERSION` 5, migração 4 → 5 põe a padrão em todo Pokémon.
  No banco, a coluna `pokemon.posture` (texto, vazia nas linhas antigas —
  migração Prisma `20261108120000_postura_do_pokemon`).
- **Quem a acertou** (para a neutra): trait `PartyAttackers` (lista de
  selvagens), gravado por `registrarAgressor` no `partyReactionSystem` e
  esvaziado no `voltarASeguir`. Vale para toda postura, então trocar para
  neutra no meio da luta já sabe contra quem ela luta.
- **Um só caminho de decisão** (`resolvePostureTarget`, no
  `partyBehaviorSystem`): lutando, decide o alvo do tick; seguindo, a mesma
  conta com alvo vazio é o gatilho de entrar. Assim a defensiva entra quando
  uma selvagem persegue alguém do grupo (`listWildsFightingParty`, a veia —
  o "!" é outro trait, `WildAwareness`) e a agressiva entra também com a
  selvagem à vista (`isPerceived` com `PARTY_BEHAVIOR.PERCEPTION`). Seguindo,
  só entra quem está dentro da coleira — senão largaria no tick seguinte.
- **Fora de alvo**: a selvagem sendo capturada, fugindo ou desmaiada já não
  era combatente (`isActiveCombatant`); o teste cobre as posturas novas.
- **Menu**: aba "Postura" no `PartyActionMenu.jsx`, com a atual marcada e
  uma linha de cada (`view/shared/postureText.js`). **Debug (F2)**: a
  etiqueta mostra a postura do registro.

### Parte 3

- **`aiTuning.js`**: `resolveHardTuning(side)` — a ponta difícil é a mesma
  para os dois lados, menos o ritmo (`WILD_BEHAVIOR.ATTACK_INTERVAL` ou
  `PARTY_BEHAVIOR.ATTACK_INTERVAL`). `resolvePartyTuning` interpola pelo
  `PARTY_DIFFICULTY` como o `resolveWildTuning` pelo `WILD_DIFFICULTY`; o
  `resolveAiTuning` escolhe pelo lado (selvagem ou não).
- **O que passou a ler o tuning do time**: desvio, dash e rodeio
  (`aiMovement.js`) e a escolha do golpe (`aiAttackChoice.js`) já liam
  `resolveAiTuning`, e o time recebia a ponta difícil. Agora recebe o dele.
  O `partyBehaviorSystem` passou a ler o ritmo e o limite de descanso do
  tuning (antes vinham fixos). O erro de mira já era aplicado em todo pedido
  da IA (`WantsToAttack`, `creatureAttackSystem`), com zero no time; agora
  usa o `AIM_ERROR` do time.
- **Debug (F2)**: a etiqueta do time mostra "dif." com o `LEVEL`, como a das
  selvagens.

### Parte 4

- **Anel** (`view/scene/PartyMarkerView.jsx`, `FEEDBACK.PARTY_MARKER`):
  um por criatura do jogador local (`OwnedBy(playerEntity)`), inclusive a
  controlada. Deitado pela normal do chão (um raio para baixo por frame,
  só no nível), com o raio pelo corpo (`resolveBodyExtent`). No ar, some
  além de `MAX_GROUND_GAP`.
- **Plaquinha**: tecla do slot (Q/E/R) num selo na cor do anel e o nome em
  `NAME_COLOR`. A regra de "é seu" é `resolveMineSlotKey`
  (`view/shared/partyMarker.js`); a criatura de outro treinador não ganha.
- **Cores** (`FEEDBACK_COLORS`): dano claro no oponente e vermelho no time;
  o crítico ganhou o próprio brilho de contorno (`CRIT_GLOW`) em vez da
  cor de dano (que, no oponente, agora é branca). Buff do time foi para o
  azul, longe do verde. `HIT_FLASH` um pouco mais longo e forte.
- **Testes de cor** viraram regra (o dano do oponente mais claro que o do
  time, o do time vermelho), sem fixar os hex.

---

## Gates

- [x] Testes dos arquivos mexidos, `npm run lint` nos arquivos mexidos e
      build de produção numa cópia (a cada parte).
- [x] `npm test` inteiro (no fim da feature), `npm run lint` inteiro e build
      de produção de novo depois da wiki.

---

## Fora de escopo

- Comandos ao parceiro ("ataca meu alvo", "volta aqui").
- Trocar a postura fora do menu do Q/E/R (inventário, atalho).
- Opção de dificuldade no menu (por enquanto só no config).
- Bando — 077.
