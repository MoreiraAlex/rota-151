# 🚀 Versão 0.0.68 — Interior dos prédios

## Resumo

Entrar nos prédios das cidades. Na primeira rodada **só o Pokécenter**, para
o usuário avaliar a sala e a transição antes de decidir o resto; depois de
avaliado, a **loja** entrou do mesmo jeito (Parte 4). Ginásio e casas ficam
para depois da beta 0.1:

1. **A porta de fora é o gatilho.** Perto da porta do Pokécenter aparece o
   aviso "F — Entrar no Pokécenter" (ícone de porta, o mesmo aviso de pegar
   item e vasculhar). Com F, a tela escurece, o treinador passa para dentro
   e a tela clareia.
2. **A sala é um lugar à parte.** O interior do Pokécenter do Let's Go
   (`t003pc01`, igual em todas as cidades) é cerca de três vezes maior que o
   prédio de fora: não cabe dentro dele. A sala fica bem acima da porta, sem
   nada em volta; o mundo de fora some da tela enquanto o treinador está
   nela.
3. **Colisão própria.** O mapa da sala não traz colisão: piso, paredes,
   barreira na frente aberta (o diorama) e caixas para os móveis saem de um
   script novo.
4. **Sair** pelo tapete de luz da entrada, com o mesmo aviso ("F — Sair do
   Pokécenter") e a mesma transição; o treinador para à frente da porta,
   virado para a rua.

Sem NPC e sem função: o Pokécenter curando é a 095 (Marco 5); a loja
vendendo, junto do dinheiro, também fica para depois.

Versão: `0.0.68` (`package.json`). Branch: `feature/068-interior-dos-predios`.

> **Números deste doc são fictícios (ilustrativos).** O valor de verdade é o
> do campo citado (config/dados).

---

## Levantamento (abertura)

Pacote `LGPE-FieldMaps.7z` (`.exemple/ambient/LGPE/`), pasta `field/`:

| Prédio no jogo | Sala no Let's Go | Observação |
|---|---|---|
| Pokécenter | `tNNNpc01` | o mesmo arquivo em toda cidade (o de Pewter se chama `t002pc01` por dentro) |
| Loja | `tNNNfs01` | idem |
| Ginásio | `t003gym` (Pewter), `t004gym`, `t006gym` | Pallet e Lavender não têm |
| Casas | `t001r01`/`r02`, `t003r02`/`r03`, `t004r01–r06`, `t005r01–r04`, `t006r01`… | uma por tema |
| Museu, laboratório, fã-clube | `t003r01`, `t001r03`, `t006r01` | museu com 2 andares |

- Cada sala é um modelo só (piso, paredes, móveis e o fundo escuro em
  volta), leve (o Pokécenter tem ~11 mil triângulos).
- Shaders da sala (`FieldObjectShader_room`, `_Emission`,
  `FieldWindowShader`) usam as mesmas texturas que o conversor já trata. Só
  o ginásio de Pewter usa rocha/chão.
- **Sem colisão** e **sem ponto de saída** marcados no modelo.
- Vidro, bolhas e a luz do chão são misturados (alfa); o manifesto não
  guardava isso.
- Máquina de cura (`buildmodel/pc_machine`, `pc_poke`) e NPCs
  (`LGPE-Trainers.7z`: `tr0069_00_pc` enfermeira etc., **sem animação**)
  existem — ficam para depois.

## Decisões (com o usuário)

1. Só o **Pokécenter** por dentro na primeira rodada; o resto se decide
   depois de avaliar este. Avaliado, a **loja** veio em seguida, igual
   (Parte 4).
2. **Sala separada** (cena à parte), não o prédio aberto.
3. **Sem NPC** por enquanto.
4. Gatilho na **porta de fora**; o aviso fica a meu critério → o aviso de
   F na tela (o mesmo de itens e arbustos, com ícone de porta), nos dois
   sentidos. Entrar só com F (sem entrar sem querer ao passar perto).

## Arquitetura

### Conversão (scripts)

- `scripts/lgpe/pack-lgpe.js` ganhou `all: true` (o mapa inteiro, não um
  nó) e grava `blend` no material misturado (`'add'` com alfa
  pré-multiplicado, `'alpha'` sem). A sala sai com `--extra
  scripts/lgpe/interiors.json --only-extra --out public/assets/interiors/lgpe`.
- `scripts/lgpe/interior-colliders.js` (novo) gera
  `src/core/data/interiorColliders.json` no espaço do `.glb`: o piso andável
  e a altura dele, as paredes (lados, fundo e a barreira da frente com o vão
  da entrada), os móveis (peças ligadas do que não é estrutura, juntadas
  quando se encostam — uma caixa por objeto) e o ponto de saída (o meio do
  tapete de luz). O que a geometria não diz sozinha (a borda da frente e o
  vão) fica na lista de salas do script.

### Core

- **Dados** `core/data/interiors/`: cada sala com nome, frases do aviso,
  modelo, prédio da cidade cuja porta leva a ela e onde fica a porta na
  frente dele (`doorX`). A sala usa a escala do prédio de onde se entrou.
- **Posicionamento** `core/interior/interiorPlacement.js` (puro): a porta no
  mundo (frente da caixa do modelo, girada com o prédio), a porta mais
  perto, o ponto de saída do lado de fora, a sala `INTERIOR.ALTITUDE` m
  acima da porta (mesmo XZ: os chunks em volta continuam os da cidade, e
  cair da sala só leva de volta à rua).
- **Traits**: `InteriorTransition` (do mundo: fase `out`/`in`, ação,
  porta), `Indoors` (no treinador: sala, origem, escala, porta, corpo da
  colisão) e `CameraSnap` (na câmera: um quadro sem suavização).
- **Actions** `core/actions/interior.js`: `abrirPorta`/`pedirSaida` começam;
  `entrarNoPredio`/`sairDoPredio` trocam de lugar no escuro. Entrando, o
  time volta para a bola na hora (com vida, condições e desmaio —
  `guardarForaDeCampo`, que saiu do `partySummonSystem` para
  `actions/pokemon.js`).
- **Systems**: `interiorSystem` (novo, depois do `interactionSystem`) avança
  a transição; `interactionSystem` acha a porta (fora) e o tapete (dentro —
  itens e arbustos lá embaixo, no mesmo XZ, ficam de fora); `inputSystem`
  segura o treinador parado durante a transição (a câmera continua).
- **Colisão** `createInteriorColliders` (`physics/colliders.js`): corpo fixo
  próprio; o piso é uma laje com dois triângulos por cima (malha de
  triângulos é chão para a câmera); paredes e móveis em caixas.
- **Dentro**: as selvagens não alcançam o treinador (`isActiveCombatant`);
  soltar Pokémon só avisa (`summonBlockedIndoors`); o save guarda a sala
  (Parte 2).

### View

- `InteriorView`: a sala com o material toon dos prédios
  (`buildLgpeModels`), vidro e brilho misturados, montada desde o começo
  (escondida) para os arquivos já estarem prontos.
- `GameScene`: relevo, vegetação, água, fundo, clima, itens e selvagens num
  grupo escondido enquanto o treinador está dentro (`OutdoorOnly`).
- `DayNightView`: dentro, sem céu, fundo escuro (`INTERIOR.BACKGROUND`) e a
  luz da sala (`INTERIOR.LIGHT`, com sombra); `FogView` empurra a névoa para
  longe (sem tirá-la, o que recompilaria todos os materiais).
- `cameraFollowSystem`: com `CameraSnap`, vai direto para o lugar (pela
  posição crua — a interpolada ainda fica no meio do caminho).
- `InteriorFadeHud`: o preto da transição; `InteractionHud`: os avisos de
  entrar e sair.
- Som: o ambiente de fora some, a chuva e o vento ficam abafados
  (`INTERIOR.RAIN_VOLUME`), os passos dentro não são de grama nem de água.

## Fora de escopo

- Ginásio por dentro: fica para depois da beta 0.1 (roadmap, "Depois da
  beta 0.1"). Chegou a ser feito em teste nesta feature e foi descartado.
- Casas e prédios especiais por dentro: também para depois da beta 0.1
  (roadmap, "Depois da beta 0.1").
- NPCs (enfermeira, vendedores) e a máquina de cura funcionando (as bolas
  e a animação dela); o Pokécenter curando (095); a loja vendendo.
- Os temas de verdade do Pokécenter e da loja (as músicas de agora são
  provisórias).
- Segundo andar das casas e do museu.
- Multiplayer: hoje a sala é de um jogador só (rever no Marco 4).

## Etapas

- [x] Bump da versão para `0.0.68` e doc da feature.
- [x] Levantamento das salas do Let's Go.
- [x] Conversor: `all` e `blend` no `pack-lgpe.js`; sala do Pokécenter em
      `public/assets/interiors/lgpe/`.
- [x] Colisão da sala (`interior-colliders.js` →
      `interiorColliders.json`) + testes (saída livre, móveis no piso,
      paredes fechando o piso; com o Rapier: o piso é chão da câmera,
      móveis colidem, a sala some ao sair).
- [x] Core: dados, posicionamento, traits, actions, `interiorSystem`, F na
      porta e no tapete, input parado na transição, selvagens, invocar e
      save + testes.
- [x] View: sala, mundo de fora escondido, luz e névoa, transição na tela,
      câmera sem arrasto, sons.
- [x] Parte 2: salvar dentro, colisão justa dos móveis (balcão), máquina de
      cura, câmera de frente para a sala + testes.
- [x] Parte 3: só andar e correr lá dentro, som da porta, passo do piso,
      música da sala + testes.
- [x] Parte 4: a loja por dentro — sala, colisão, dados, música; todas as
      salas montadas escondidas + testes.

### Falta conferir em jogo (pelo usuário)

- Aviso na porta do Pokécenter (alcance, lugar) e o F entrando.
- Transição: tempo de escurecer/clarear, a câmera já no lugar ao clarear.
- A sala: tamanho em relação ao treinador, luz e sombra, vidro e brilhos,
  o fundo escuro em volta.
- Colisão: paredes, balcão, sofás, mesas, bancos e vasos; a frente aberta
  segurando o treinador; a câmera girando em volta.
- Sair pelo tapete: aviso, para onde o treinador olha do lado de fora.
- Dentro: o time não sai (aviso), sons de fora calados, chuva abafada.
- Parte 2: salvar dentro e recarregar a página; o balcão colidindo só onde
  está; a máquina de cura no fundo (lugar e tamanho); a câmera de frente
  (enquadramento, `FOLLOW`, zoom).
- Parte 4 (loja): o aviso e o F na porta da loja; a sala (luz, vidro das
  vitrines, a luz do chão na entrada); colisão do balcão, das gôndolas do
  meio, das estantes e do vaso da frente; a câmera de frente numa sala
  menor (o mesmo `INTERIOR.CAMERA` do Pokécenter — se sobrar vazio em
  volta, uma câmera por sala); a música; salvar dentro da loja.

## Parte 2 — Ajustes depois do primeiro teste (pedido do usuário)

1. **Salvar dentro do Pokécenter.** O save ganhou `trainer.indoors`
   (opcional, sem subir a versão: fora, ou save de antes, sem ele) — a sala
   e a porta por onde entrou; a posição salva é a de dentro. Ao carregar,
   `voltarParaDentro` põe o treinador de volta na sala (fora do piso dela,
   no tapete da entrada) e a colisão da sala nasce no primeiro passo com a
   física pronta (`garantirColisaoDaSala`, no `interiorSystem` — também
   refaz a colisão se o mundo da física for refeito). Sair de lá leva para
   a frente da porta salva.
   - No banco, a coluna `indoors` (JSONB, vazia fora) na tabela `trainer`
     (migração `20261111120000_save_dentro_do_predio`, tradução em
     `saveRepository.js`) — na primeira versão o campo ia no save mas o
     banco não tinha onde guardar, e o F5 voltava do lado de fora.
   - Entrar e sair pela porta pedem um save (ponto de save).
2. **Colisão do balcão justa.** O balcão é um arco em U, e a caixa única
   cobria os cantos da frente e o miolo. Agora todo móvel colide pela
   pegada dele numa grade vista de cima (`GRID_CELL` no
   `interior-colliders.js`), com o miolo fechado quando o objeto é oco e as
   células juntadas em retângulos — o balcão segue o arco.
3. **Máquina de cura.** `buildmodel/pc_machine` (o aparelho, o telão na
   parede e o tampo; sem as bolas e caixas de efeito da animação, `skip`)
   entra no pacote da sala (`interiors.json`, prop solto com `file`) e vai
   encostada no meio do fundo, dentro do balcão (`props` na colisão: o lugar
   do `.glb` e a caixa dela). Sem função.
4. **O vazio em volta da sala.** A câmera fica **de frente para a sala**,
   como nos jogos da série (`INTERIOR.CAMERA`): o giro e a inclinação ficam
   travados (`YAW_RANGE`/`PITCH_RANGE` dão uma folga, se quiser), o zoom só
   chega mais perto (`MIN_DISTANCE` até `DISTANCE`), e ela olha para um
   ponto entre o meio da sala e o treinador (`FOLLOW`) — a sala fica
   enquadrada e a borda não entra na tela num canto. Outras saídas, se não
   bastar: fechar o vazio com paredes/teto escuros em volta do diorama, ou
   um degradê no fundo no lugar do preto liso.

## Parte 3 — Só curar lá dentro e os sons (pedido do usuário)

1. **A sala é só para curar o time.** Dentro de um prédio só valem andar,
   correr e o F (que lá só sai pelo tapete) — `INDOOR_ALLOWED_FLAGS` no
   `inputSystem`; pulo, esquiva, voo, usar/arremessar item, Pokébola,
   soltar Pokémon, golpes, mira e trocar o controle ficam desligados (a
   câmera continua). Os menus abrem fora do input do jogo e continuam.
   Com isso some também o caso da Pokébola/fruta caindo "na água" do mapa
   lá embaixo.
2. **Som da porta** (`INTERIOR_SOUNDS.door`, `interiorAudioSystem`): toca
   quando a passagem começa, entrando ou saindo. Feito por síntese
   (`scripts/audio/sons-do-pokecenter.sh`: ruído rosa filtrado descendo — o
   "pssh" da porta automática —, o deslizar grave e um toque curto), sem
   arquivo de origem: o depósito não tinha porta e o site da Kenney recusou
   o download automático. Depois o usuário trocou pelo som dele (o script
   não gera mais a porta) e o volume baixou para caber com o resto.
3. **Passo no piso de dentro** (`INTERIOR_SOUNDS.step`, `indoorBuffers` do
   registro de passos): `AI_Walk/Run_Concrete` da biblioteca, com um eco
   curto de sala, na intensidade do passo do treinador; só para quem pisa.
4. **Música** (`MUSIC_TRACKS.pokecenter`, `music` da sala): em loop
   enquanto o treinador está lá, no lugar da de exploração e da de batalha
   (`createLoopedMusic` no `musicPlayer`, a mesma da batalha); começa a
   carregar quando a porta abre; ao sair, some e o silêncio de sempre
   começa. **Provisória**: "Jubilife City (Night)" do BDSP (o tema do
   Pokécenter não está no depósito), com o trecho que repete medido.

## Parte 4 — A loja por dentro (pedido do usuário)

O mesmo do Pokécenter, para a loja (`poke-mart`): F na porta, a sala à
parte, colisão própria, saída pelo tapete de luz, salvar dentro, só andar
e correr, passo do piso, som da porta e música própria. Sem vendedor e sem
vender.

1. **A sala** é a `t003fs01` do Let's Go (a mesma em quase toda cidade; a
   de Viridian, `t002fs01`, é outra), no mesmo pacote das salas
   (`interiors.json` → `poke-mart-interior`). Uma textura dela vem em BC7,
   que o `dds.js` ainda não lia — passou a ler, pelo mesmo `bc7.js` dos
   Pokémon. O pacote saiu de novo inteiro; o Pokécenter e a máquina de cura
   saíram iguais.
2. **Colisão** (`interior-colliders.js`):
   - Na loja o piso passa por baixo das paredes, então a borda dele não é
     a parede: a sala ganhou `inner`, a face de dentro dos lados e do fundo
     (sem ele, segue a borda do piso, como no Pokécenter).
   - A frente da loja é um degrau chanfrado com o vão da entrada no meio:
     `frontZ` na beira do degrau e `doorway` no vão; os cantos chanfrados
     ficam dentro do retângulo (o treinador pisa na beirada ali).
   - A janela (`glass01_com_fs`) é estrutura; o vidro das vitrines
     (`glass01_com_fs1`) é móvel.
   - Retângulo de móvel inteiro atrás de uma parede (a prateleira no nicho
     do fundo da loja) não entra mais: a parede já fecha ali. No Pokécenter
     isso tirou quatro caixas enterradas no fundo; o resto ficou igual.
   - O balcão da loja é em L e fecha o canto do caixa com as paredes: o
     miolo fica cheio (ninguém chega ali mesmo). O relógio no canto
     chanfrado do fundo, junto de um quadro, vira uma coluna até o chão —
     que tapa o chanfro da parede.
3. **Dados**: a sala `poke-mart` em `core/data/interiors/` (aviso "Entrar
   na loja"/"Sair da loja", porta no meio da fachada). O resto (porta,
   transição, save, câmera, sons) já era por sala.
4. **Música** (`MUSIC_TRACKS['poke-mart']`): **provisória** também —
   "Jubilife City (Day)" do BDSP, a versão de dia da do Pokécenter, com o
   trecho que repete medido do mesmo jeito; mesmo volume
   (`sons-do-pokecenter.sh`).
5. **As salas na tela** (`InteriorView`): antes só a primeira ficava
   montada e escondida; agora todas ficam (os arquivos de cada uma já
   chegam antes do primeiro F) e só aparece a sala em que o treinador está.
6. **Teste na vila** (já desfeito): a primeira cidade é uma vila, e vila
   não tem loja; para o usuário testar sem viajar, a loja entrou na vila por
   um tempo e saiu depois do teste. A loja segue só na cidade e na cidade
   grande.

## Critérios de Conclusão

- [x] Entrar e sair do Pokécenter e da loja de qualquer cidade pela porta,
      com a transição.
- [x] Sala do Let's Go com colisão, sem o mundo de fora à mostra.
- [x] Ninguém de fora alcança o treinador lá dentro; o time fica na bola.
- [x] Salvar dentro volta dentro da sala.
- [x] `npm run build`, `npm run lint` e `npm test` passando.
- [x] Wiki atualizada.

## Para a wiki (no fechamento)

- "O mundo": dá para entrar no Pokécenter e na loja das cidades (F na
  porta, F no tapete para sair); lá dentro o time fica na Pokébola, nada de
  fora alcança o treinador e o jogo salva ali mesmo. O que eles fazem
  (curar, vender) segue "em breve".

## Arquivos principais

- `scripts/lgpe/pack-lgpe.js`, `scripts/lgpe/interiors.json`,
  `scripts/lgpe/interior-colliders.js`, `scripts/lgpe/dds.js`,
  `scripts/audio/sons-do-pokecenter.sh`
- `public/assets/interiors/lgpe/`, `src/core/data/interiorColliders.json`
- `src/core/data/interiors/`, `src/core/interior/interiorPlacement.js`
- `src/core/traits/components/interior.js`, `src/core/actions/interior.js`
- `src/core/systems/interiorSystem.js`, `src/core/systems/interactionSystem.js`
- `src/view/interior/`, `src/tools/hud/InteriorFadeHud.jsx`
