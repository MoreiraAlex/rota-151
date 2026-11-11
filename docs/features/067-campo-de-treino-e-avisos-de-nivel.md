# 🚀 Versão 0.0.67 — Campo de treino e avisos de nível

## Resumo

Duas frentes da progressão do time:

1. **Campo de treino nas cidades.** O treino de golpe (038) é anterior ao
   mundo procedural: hoje só existem um tronco e uma pedra fixos do nível de
   teste perto da origem, desenhados como caixas coloridas, e longe dali não
   dá pra treinar. Eles saem; toda cidade ganha um **campo de treino** — uma
   área própria, cercada, com **bonecos de treino** — e é só lá que se
   treina.
2. **Avisos de nível e de golpe novo.** Subir de nível hoje quase passa
   despercebido (texto flutuante e linha no log que somem, e nada se a
   criatura está na bola), e o golpe que fica apto não deixa rastro. Subir
   de nível ganha **som**, a **animação happy** e um **aviso na tela**; golpe
   novo ganha aviso com som próprio e um **marcador "novo"** que fica até o
   jogador abrir o Treino daquele Pokémon (salvo na conta).

Versão: `0.0.67` (`package.json`). Branch:
`feature/067-campo-de-treino-e-avisos-de-nivel`.

> **Números deste doc são fictícios (ilustrativos).** O valor de verdade é o
> do campo citado (config/espécie).

---

## Levantamento (abertura)

### Como estava

| Momento | Feedback |
|---|---|
| Subir de nível | "Nível N!" flutuando e brilho na criatura (só em campo); linha no log que apaga. **Sem som.** Na bola, só o número do HUD do time muda. |
| Golpe fica apto | "Pode aprender X!" flutuando (só em campo); linha no log que apaga. Nada aponta pro menu de Treino depois disso. |

Os learnsets de todas as 10 espécies já têm `requires.level`, então o
evento `moveUnlocked` dispara — faltava o aviso durar.

### Som

- Nenhum som de nível no projeto. O `attack/statup` é o dos golpes que
  sobem atributo — reaproveitar confundiria com buff em luta.
- **Escolhido (com o usuário):** `gui/levelup.ogg` do Cobblemon (subir de
  nível) e `evolution/evolution_notification.ogg` (golpe novo), de
  `.exemple/Coblemon/assets/cobblemon/sounds/`.

### Animação happy

| Espécies | Origem do modelo | Clipe |
|---|---|---|
| Bulbasaur, Charmander, Squirtle, Weedle, Pidgey, Ekans, Pikachu | Legends: Z-A | `happy` (já no `.glb`, nunca mapeado) |
| Caterpie, Rattata, Spearow | Let's Go | `appeal` — o conversor do LGPE (`convert-pokemon-lgpe.py`) gera o `appeal` a partir do `kw32_happyB01`, que é o happy do Let's Go |

Nenhuma conversão nova: só declarar `nativeAnimations.happy` em cada
espécie. Nas do Z-A o `appeal` é outra animação (a da saída da bola).

### Modelo do boneco de treino

- Nas fontes locais **não há boneco**: o Let's Go (`LGPE-FieldMaps.7z`) só
  tem `sandbag01` na usina (saco de areia, não de pancada) e o tatame do
  ginásio de Fuchsia; Legends, Scarlet/Violet e o MegaKit também não têm.
- **Escolhido:** "Practice Dummy" da **Quaternius**, CC0, FBX/glTF
  (<https://poly.pizza/m/1pYOHhwjXP>) — mesmo autor dos pacotes de árvore
  da 066, entra pelo caminho de pacote de fora (`lgpeModels.js`, 066). O
  download direto do poly.pizza é bloqueado pra script: baixar pelo site.
- **Depois:** o usuário trouxe outro boneco (um "Training Dummy" do
  Sketchfab) — ver "Boneco de treino" na Arquitetura.

---

## Decisões (com o usuário)

### Campo de treino

1. **Só nas cidades**, numa **área exclusiva**: um campo de treino por
   cidade, num lote próprio, como um prédio único (`town.landmarks`).
2. **Boneco de treino** (o modelo que o usuário trouxe — ver decisão 14) no
   lugar do tronco e da pedra. O tronco, a pedra e as caixas coloridas do
   nível de teste saem.
3. Treinar continua igual à 038 (horas, domínio, "esquecer qual?", o que
   para o treino); só muda **onde** dá pra treinar.

### Subir de nível

4. **Som** de level up (canal `effects`), tocado mesmo com a criatura na
   bola — é aviso pro jogador, não som no espaço.
5. **Animação happy** na criatura em campo. Toca normalmente (em combate
   também), mas **qualquer ação do jogador corta**: andar, correr, pular,
   dash, atacar, trocar o controle, invocar/recolher, usar item, abrir menu.
6. **Aviso na tela** ("Charmander subiu para o nível 9!"), também com a
   criatura na bola. O texto flutuante e a linha do log continuam.

### Golpe novo

7. **Aviso na tela** com som próprio ("Charmander pode aprender
   Smokescreen!").
8. **Marcador "novo"** persistente: no slot do Pokémon no HUD do time e no
   golpe dentro da aba Treino. **Some ao abrir o Treino** daquele Pokémon.
9. O marcador **fica salvo** na conta (sobrevive a recarregar a página).

### Confirmadas na revisão do doc

10. **Toda cidade tem campo**, inclusive a vila — é o único lugar onde se
    treina, e a vila é o porte mais comum.
11. **Pista de que dá pra treinar**, além do próprio boneco: chão de terra
    batida no campo, como as trilhas, e uma dica curta na tela na primeira
    vez que um Pokémon do time entra no campo.
12. **Um Pokémon por boneco**: cada um treina no boneco livre mais perto
    (antes dois iam pro mesmo).
13. **Golpe apto por captura** (selvagem capturada já num nível acima do
    `requires`) **não** ganha marcador — só o que fica apto ao subir de
    nível.
14. **Boneco**: provisório até o usuário trazer um modelo; ele trouxe um
    "Training Dummy" do Sketchfab (não o da Quaternius), realista demais —
    as texturas ganharam cara de desenho na conversão.

15. **Quem precisa estar perto do boneco é o treinador** (ajuste do
    usuário): o Pokémon não precisa mais estar perto para começar. Dado o
    comando, ele vem de onde estiver até um **lugar fixo na frente do
    boneco** e começa; se estiver na Pokébola, sai dela pelo mesmo invocar
    de sempre (a bola vai rumo ao boneco) e começa ao aparecer.
16. **Nenhum golpe custa mais que a energia máxima** (achado em jogo: o
    Squirtle sentava no boneco e não treinava). O Rapid Spin, com o domínio
    baixo de quem ainda está aprendendo, custava mais energia que o máximo
    do Squirtle em qualquer nível — ele descansava para sempre; depois de
    aprender, também não daria para usar em luta. Decisão do usuário: teto
    geral, no treino e na luta — golpe caro passa a gastar tudo.
17. **O treino no campo é ao vivo: o treinador fica por perto** (decisão do
    usuário; deixar treinando em segundo plano fica para o dojo, no
    futuro). Quem treina tem um limite de distância maior que o normal —
    dá para explorar em volta —, com o mesmo aviso de afastamento da 064;
    passou do limite, ele volta para a bola e o treino acaba. Tocar o
    atalho dele avisa que vai cancelar o treino; o segundo toque recolhe.
    Trocar pelo inventário continua cancelando (só o time treina).

---

## Arquitetura

### Campo de treino (core, puro: `core/town/`)

- O campo é mais um prédio único da cidade (`town.landmarks`), o último da
  lista, com `id: 'training-field'` e `field: true` — não tem modelo. Todos
  os portes (`town.sizes`) citam o `id` dele; o índice de cidades compara
  pelo `id` ou, sem ele, pelo `model` (`landmarkIdOf`, `cityIndex.js`).
  Por ser o último, os sorteios do Pokécenter, da loja e do ginásio não
  mudam: só uma casa vira o campo.
- `placeTown` (`townPlan.js`): no lote do campo, `placeTrainingField` põe a
  cerca do tema nos quatro lados (`placeFenceLine`, a mesma das casas,
  agora genérica; a entrada só no lado da rua) e os bonecos
  (`TRAINING_DUMMY_KIND`) em `columns` × `rows`, virados para a entrada.
- Chão: `chunkTrainingFields` dá a força do campo por vértice, que entra no
  canal das estradas (`chunk.roads`, o chão pinta a terra delas) e no das
  trilhas (a vegetação não nasce nele), no chunk e no bloco de sólidos
  (`terrainChunkSet.js`, `addTrainingFields`). Não afunda o relevo.
- Config no bioma `city`: `town.trainingField` (modelo e tamanho do boneco,
  grade, espaçamento, recuo da cerca, entrada, chão).

### Bonecos de treino por chunk

- `TrainingObject` (`{ id, chunkKey, radius }`) nasce com o chunk
  carregado, um por boneco dos sólidos dele (`carregarBonecosDoChunk`), e
  sai com ele (`descarregarBonecosDoChunk`, que também para quem treinava
  num deles) — `trainingObjectStreamingSystem`, pela revisão do conjunto de
  chunks (`TrainingObjectChunks`, trait do mundo). O raio é o alcance do
  colisor do modelo no tamanho dele.
- Saíram o tronco e a pedra do nível de teste (`TEST_LEVEL.trainingObjects`,
  as caixas coloridas e o `trainingObjectSpawnSystem`). No nível plano dos
  testes de física as duas caixas ficaram, só como obstáculos.
- Um Pokémon por boneco: `findNearbyTrainingObject` devolve o livre mais
  perto (o boneco do próprio Pokémon conta como livre; o reservado por um
  treino pedido na bola, `PendingTraining`, não); com bonecos perto mas
  todos ocupados, o motivo é `'occupied'`.

### Começar o treino (decisão 15)

- `resolveTrainingBlock` mede do **treinador** até o boneco
  (`TRAINING.START_RADIUS`); o Pokémon pode estar em campo (fora de luta e
  de controle) ou na bola (não desmaiado). Saiu o motivo `'not-summoned'`.
- Lugar do treino (`resolveTrainingSpot`): na frente do boneco
  (`TrainingObject.front`, para onde ele olha — o giro do modelo,
  `trainingField.turn`, não conta), a `SPOT_GAP` m entre a borda do boneco
  e a frente do corpo do Pokémon (`resolveBodyFront`).
- `trainingSystem`: vai até o lugar pelo caminho da grade (`steerTowards`,
  o mesmo das selvagens — contorna a cerca), correndo se estiver a mais de
  `RUN_DISTANCE`; chegou (`SPOT_ARRIVAL`, `Training.arrived`), para, vira
  para o boneco e repete o golpe; empurrado além de `SPOT_LEAVE` (a
  arrancada do golpe), volta. O tempo de ir não conta no treino.
- Na bola: `iniciarTreino` guarda o treino no registro (`PendingTraining`,
  com o boneco reservado) e pede ao treinador para invocar rumo ao lugar do
  treino (`pedirInvocacao` → `SummonRequest`); o `partySummonSystem` atende
  quando ele fica livre, jogando a bola para lá em vez da mira
  (`beginSummonToward`). Quando a criatura nasce, o `pendingTrainingSystem`
  passa o treino para ela (depois da apresentação). Desiste se o boneco
  sumir ou passar `PENDING_TIMEOUT`.
- O "Parar" do menu para os dois (`pararTreinoDoPokemon`); a dica do campo
  aparece quando o treinador chega perto de um boneco.

### Treinador por perto (decisão 17)

- `followLimitSystem` (064): a criatura com `Training` usa
  `FOLLOW_LIMIT.TRAINING_WARN_DISTANCE` (aviso sem contagem) e
  `TRAINING_RECALL_DISTANCE` (contagem e volta para a bola), maiores que o
  limite normal e abaixo da distância em que o campo sai da memória; motivo
  `'trainingFar'` (textos próprios no `StrayWarningHud` e no log).
- Garantia (pergunta do usuário: o chunk do boneco pode descarregar antes?):
  na menor distância de visão, o chunk descarrega a mais de
  (`VIEW_DISTANCE.MIN` + `UNLOAD_MARGIN`) chunks; o primeiro limite de
  treino ficava no fio (com a contagem e o recolher, na velocidade mais
  rápida do jogo — o voo rápido —, sobrava pouco) e foi baixado. Um teste
  em `followLimitSystem.test.js` garante a regra com os números do config
  e das espécies: limite + contagem × velocidade máxima + distância até o
  boneco < distância de descarregar.
- Rever no Marco 4 (nota no roadmap, pedido do usuário): com o servidor
  dono do mundo e dos chunks, quem mantém o campo carregado, se o limite
  ainda faz sentido e o treino sem o treinador por perto.
- `partySummonSystem`: tocar o atalho de quem treina abre a janela
  `RecallConfirm` (`TRAINING.RECALL_CONFIRM_TIME`) e emite
  `trainingRecallWarned` (aviso na tela, "X está treinando — toque de novo
  para recolher"); o segundo toque no mesmo slot dentro dela recolhe. O
  recolher automático (afastamento, desmaio, troca pelo inventário) não
  pergunta.

### Teto do custo de energia (decisão 16)

- `resolveAttackForEntity` (`core/battle/attackCasting.js`): depois do
  domínio, o custo é limitado à energia máxima da criatura
  (`withStaminaCap`) — vale para treino, luta, IA e HUD (todos leem o
  golpe por ela).
- `resolveTrainingRest`: o descanso do treino vai até
  `REST_STAMINA_FRACTION` da máxima ou até o custo do golpe, o que for
  maior (antes saía do descanso sem energia para repetir).
- Teste de regra: nenhum golpe do learnset de nenhuma espécie, em nenhum
  nível ou domínio, custa mais que a energia máxima.

### Boneco de treino

- Primeiro foi um boneco provisório montado por script (base, poste, palha);
  saiu quando o usuário trouxe o modelo dele: o "Training Dummy" do
  Sketchfab (`.exemple/training_dummy.glb`, no lugar do da Quaternius) —
  madeira, metal, casca, miolo do tronco e corda, com texturas de foto.
- **Cara de desenho** (pedido do usuário: o modelo é realista demais): o
  `pack-lab.py` ganhou `--cartoon`, que trata só a textura de cor na
  conversão — borra o grão da foto (`blur`), puxa para a cor média do
  material (`flat`), divide a luz em faixas (`levels`, opcional), clareia
  mais os tons escuros (`gamma` — o primeiro ajuste ficou escuro demais no
  jogo), satura (`saturation`) e clareia por igual (`bright`). A normal e a rugosidade do
  original já ficavam de fora (o jogo usa só a cor, com a luz toon). Também
  passou a aceitar a categoria `street` e a só marcar transparência quando
  algum pixel é transparente de fato (o JPEG chegava com alfa todo opaco).
- Conversão (refazer para ajustar o cartoon):
  `blender --background --python scripts/lab/pack-lab.py -- --src
  .exemple/training_dummy.glb --pack treino --category street --height 1.7
  --label Treino --max-texture 512 --cartoon
  "blur=0.015,flat=0.55,gamma=1.5,saturation=1.3,bright=1.05"`, depois
  `node scripts/lab/levar-pacotes-para-o-jogo.js` e
  `node scripts/lgpe/colliders.js`. Id: `treino-training-dummy`.
- Os braços do modelo vão no eixo da profundidade: `trainingField.turn`
  gira o boneco na colocação para os braços ficarem de lado, de frente
  para a entrada (o primeiro giro deixou os bonecos de costas; virou o
  outro lado).
- Clareza (pedido do usuário, em duas voltas): escuro demais com as
  texturas de foto, claro demais com `gamma` alto; ficou no meio. Os bonecos
  também ficaram mais afastados (`trainingField.spacing`).

### Balanço do boneco ao levar o golpe

- Pedido do usuário: uma balançada leve no boneco a cada golpe do treino.
- O boneco saiu da malha instanciada dos prédios do chunk
  (`buildBuildingMeshes` pula `TRAINING_DUMMY_KIND`) e é desenhado sozinho,
  um por entidade `TrainingObject` (`TrainingDummiesView.jsx`, que leva o
  modelo, o giro e o tamanho no trait), com um grupo de inclinação na base
  registrado em `trainingDummyRegistry.js`.
- `trainingDummyWobbleSystem` (presentation): no `attackUsed` do slot de
  treino (o instante do efeito), o boneco da criatura inclina para longe
  dela e vai e volta diminuindo (seno amortecido); golpe em si mesmo
  (`area: 'self'`) e golpe que falhou ("Falhou!", `attackFailed` no mesmo
  passo — pedido do usuário) não mexem. Números em `FEEDBACK.TRAINING_DUMMY_WOBBLE`.
- F2 → Vegetação → Cidade → (bioma) → Campo de treino: espaço, colunas,
  fileiras, tamanho e giro do boneco (refazem o terreno) e "Balanço do
  boneco" (vale no próximo golpe).

### Subir de nível

- **Som:** `public/assets/audio/ui/level-up.ogg` (`gui/levelup` do
  Cobblemon) e `move-unlocked.ogg` (`evolution/evolution_notification`),
  em `core/data/audio/uiSounds.js`. Tocados sem posição no mundo, no canal
  de efeitos (`view/audio/uiSounds.js`), pelo `levelNoticeAudioSystem` — só
  do treinador desta máquina; no mesmo frame, o de golpe novo espera o de
  nível (`delayAfterLevelUp`).
- **Happy:** `nativeAnimations.happy` e `actions.happy.duration` (o tempo
  do clipe) nas 10 espécies. `ganharExperiencia` chama `pedirComemoracao`
  na criatura em campo (`PendingCelebration`); o
  `creatureCelebrationSystem` começa a ação `'happy'` quando ela fica
  livre (até `EXPERIENCE.CELEBRATION_WAIT`) e a segura parada até o fim do
  clipe. Cortam: qualquer ação do jogador (`celebrationInputSystem`, fase
  input — andar, correr, pular, dash, clique, Q/E/R tocar ou segurar,
  trocar o controle, interagir, voar; câmera e zoom não), tomar dano
  (`celebrationDamageSystem`) e desmaiar.
- **Aviso na tela:** `noticeSystem` → `noticeStore` → `NoticeHud` (canto
  superior direito, `FEEDBACK.NOTICES`). O texto flutuante e a linha do log
  continuam.

### Golpe novo

- `CreatureMoves.unseen` (ids): `anunciarGolpesAptos` acrescenta os golpes
  que ficaram aptos ao subir de nível (no registro e em campo);
  `marcarGolpesVistos` limpa; `temGolpeNovo` pergunta.
- Save versão 8: `moves.unseen` no `pokemonSaveSchema`, migração 7 → 8 (save
  antigo começa sem marcador).
- View: selo "novo" no card do slot (`PartyHud`), ponto na aba Treino e
  selo nos golpes que eram novos (`PartyActionMenu`). Abrir a aba Treino
  chama `marcarGolpesVistos`; os selos dos golpes ficam até o menu fechar.
- Dica do campo (`trainingFieldHintSystem`): na primeira vez na sessão em
  que um Pokémon do time chega perto de um boneco.

---

## Fora de escopo

- Treino dentro de prédio (dojo/ginásio) — depois da 068, se fizer sentido.
- Tutor/dojo que acelera o treino — segue no backlog.
- Jingle de vitória ao fim da luta (citado na 065).
- Evolução.

---

## Etapas

- [x] Bump da versão para `0.0.67`, doc da feature, roadmap.
- [x] Boneco provisório (pacote de fora, colisor, material toon).
- [x] Modelo do usuário no lugar do provisório, com as texturas em cara de
      desenho (`--cartoon`).
- [x] Campo de treino na cidade (`core/town/`, dados do bioma, chão, cerca)
      + testes (toda cidade tem um; bonecos dentro do lote; chão de terra só
      no lote).
- [x] Bonecos por chunk; saem o tronco, a pedra e o
      `trainingObjectSpawnSystem`; boneco livre mais perto + testes.
- [x] `nativeAnimations.happy` nas 10 espécies + ação `'happy'` (começa ao
      ficar livre, corta com qualquer ação do jogador, dano ou desmaio) +
      testes.
- [x] Sons de nível e de golpe novo.
- [x] Avisos na tela (`NoticeHud`) e dica do campo.
- [x] Balanço do boneco ao levar o golpe do treino + F2 + testes.
- [x] Marcador "novo" (`unseen`, `marcarGolpesVistos`, HUD do time, aba
      Treino) + save com migração + testes.
- [x] Wiki `0.0.x`: "Golpes e treino" (seção nova "Campo de treino"; o
      treinador por perto, a criatura vindo até o boneco ou saindo da bola,
      o balanço, o aviso de afastamento e o toque duplo para recolher, o
      progresso guardado no save), "Experiência e nível" (aviso, som,
      comemoração e o selo "novo"), "Energia e recarga" (o teto do custo),
      "Seu time" (o Treino do menu) e "O mundo" (o campo de treino nas
      cidades).

### Falta conferir em jogo (pelo usuário)

- Campo de treino: lugar na cidade, cerca e entrada, bonecos (tamanho,
  espaçamento, para onde olham, cara de desenho e clareza das texturas),
  chão de terra.
- Balanço do boneco a cada golpe do treino (golpe à distância balança no
  instante do golpe, não na chegada).
- Treino nos bonecos: o treinador perto do boneco, o Pokémon vindo de
  longe (contornando a cerca) até a frente do boneco e o que sai da bola
  rumo a ele; dois Pokémon em bonecos diferentes; texto de "ocupado".
- Subir de nível: som, aviso, happy de cada espécie (as 3 do Let's Go usam
  o `appeal`) e o corte por qualquer ação.
- Golpe novo: aviso e som, selo no HUD do time, ponto e selos no Treino,
  marcador sumindo ao abrir e voltando depois de recarregar se não abriu.
- Volume dos dois sons de aviso.
- Explorar em volta do campo com um Pokémon treinando: o aviso perto do
  limite, a contagem e a volta para a bola; o toque duplo no atalho.
- Bonecos virados para a entrada (giro de 180° no `trainingField.turn`).
- Squirtle treinando o Rapid Spin (gasta a energia toda a cada repetição e
  descansa até encher).

---

## Critérios de Conclusão

- [x] Toda cidade tem um campo de treino cercado com bonecos; fora dele não
      dá pra treinar; o tronco e a pedra do nível de teste não existem mais.
- [x] Subir de nível toca som, mostra aviso na tela (também com a criatura
      na bola) e, em campo, a animação happy — cortada por qualquer ação do
      jogador.
- [x] Golpe que fica apto mostra aviso com som e deixa o marcador "novo" no
      HUD do time e na aba Treino até abrir o Treino daquele Pokémon; o
      marcador sobrevive a recarregar.
- [x] `npm run build`, `npm run lint` e `npm test` passando (suíte inteira:
      312 arquivos, 3390 testes, com `--maxWorkers=2`; build feito numa
      cópia, por causa do `next dev` rodando — 88 páginas).

---

## Arquivos principais

- Cidade: `core/data/biomes/city/index.js` (`landmarks`, `trainingField`,
  `sizes`), `core/town/townPlan.js` (`placeTrainingField`,
  `placeFenceLine`, `chunkTrainingFields`, `TRAINING_DUMMY_KIND`),
  `core/town/cityIndex.js` (`landmarkIdOf`),
  `core/terrain/terrainChunkSet.js` (`addTrainingFields`),
  `view/vegetation/lgpeModels.js` (`townModelIds`).
- Boneco: `scripts/lab/pack-lab.py` (`--cartoon`, `street`, alfa),
  `public/assets/vegetation/packs/treino/`,
  `core/data/lgpeColliders.json`.
- Balanço: `view/vegetation/TrainingDummiesView.jsx`,
  `view/registry/trainingDummyRegistry.js`,
  `view/systems/trainingDummyWobbleSystem.js`,
  `view/vegetation/chunkMeshes.js`, `tools/debug/VegetationPanel.jsx`.
- Começar o treino: `core/actions/training.js` (`resolveTrainingSpot`,
  `pedirInvocacao`, `pararTreinoDoPokemon`),
  `core/systems/pendingTrainingSystem.js`,
  `core/systems/partySummonSystem.js` (`SummonRequest`),
  `core/traits/components/party.js`.
- Treino: `core/traits/components/training.js` (`TrainingObject`,
  `TrainingObjectChunks`), `core/actions/training.js`,
  `core/systems/trainingObjectStreamingSystem.js`, `core/data/testLevel.js`,
  `test/flatTestLevel.js`, `view/scene/GameScene.jsx`.
- Comemoração: `core/actions/celebration.js`,
  `core/systems/creatureCelebrationSystem.js`,
  `core/traits/components/celebration.js`, `core/data/animationStates.js`,
  `core/actions/experience.js`, espécies (`happy`).
- Sons e avisos: `core/data/audio/uiSounds.js`, `view/audio/uiSounds.js`,
  `view/systems/levelNoticeAudioSystem.js`, `view/systems/noticeSystem.js`,
  `view/systems/trainingFieldHintSystem.js`,
  `view/registry/noticeStore.js`, `tools/hud/NoticeHud.jsx`.
- Marcador: `core/data/species/moves.js`, `core/traits/components/
  creatureMoves.js`, `core/actions/moves.js`, `core/save/saveFormat.js`,
  `tools/hud/PartyHud.jsx`, `tools/menu/PartyActionMenu.jsx`.
