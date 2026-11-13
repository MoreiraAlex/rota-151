# 🚀 Versão 0.0.69 — Revisão do bioma cidade

## Resumo

A cidade (056, depois a 058, a 067 e a 068) estava no escopo da revisão dos
biomas (066) e ficou de fora. Esta feature revê a cidade ao lado dos biomas
já revistos. Pontos levantados pelo usuário na abertura:

1. **A cidade está vazia.** Mesmo antes dos NPCs, falta detalhe: hoje cada
   lote é casa ou prédio único, e a rua só tem poste, banco e cerca.
2. **A escala dos prédios não casa com as entidades.** A casa é pouco maior
   que o treinador; aumentar a escala para ficar coerente deixa a porta, os
   postes e os bancos gigantes.

Versão: `0.0.69` (`package.json`). Branch: `feature/069-revisao-do-bioma-cidade`.

> **Os números deste doc são fictícios (só ilustram).** O valor de verdade é
> o do campo citado (config ou dado do bioma).

---

## Decisões (com o usuário)

1. **Primeiro os detalhes** e o **item 1 da escala** (o tamanho próprio dos
   objetos de rua); o usuário vê no jogo e decide como seguir.
2. **Avaliar o jardim** (o que ficou no estilo antigo, ver abaixo).
3. **Desempenho só no fim da feature.**

---

## A escala (por que uma escala só não resolve)

O Let's Go usa a escala "de brinquedo" dos jogos da série: a porta e os
objetos de rua estão na escala do jogador, e o corpo da casa é pequeno (umas
duas portas de altura). A proporção errada está dentro do modelo, então
nenhuma escala uniforme acerta as duas coisas.

Opções levantadas:

1. **Escala própria dos objetos de rua** (feita): poste, banco, cerca e os
   detalhes deixam de seguir o tamanho dos prédios (`town.propScale`, à
   parte do `town.scale`). Aumentar os prédios não aumenta mais o resto.
2. **Esticar o prédio sem esticar a porta**: deformação por partes no
   conversor (a faixa da porta intacta, as paredes crescendo e o telhado
   subindo). Risco: janelas e textura esticam.
3. **Aumentar o prédio e reduzir só a porta**, cobrindo a sobra do vão
   (parede ou moldura). Mais limpo, mas modelo a modelo.
4. **Aceitar a escala estilizada** e subir pouco, com a opção 1 junto.

*(a seguir decidido pelo usuário depois de ver no jogo)*

---

## O jardim (avaliação)

O jardim da cidade não está todo no estilo antigo. As moitas, os tufos e as
flores (`round-bush`, `flower-bush`, `tuft-route`, `flower-*`) são os mesmos
do Let's Go que a planície e a savana revistas ainda usam. O que difere:

- **As árvores**: a cidade usa as árvores redondas do Let's Go
  (`round-tree`, `round-tree-b`); floresta, planície e savana passaram para
  as dos pacotes da Quaternius com as folhas do Let's Go (`usn-normaltree-*`,
  `megakit-commontree-*`, 066).
- **A grama em fios**: os outros biomas têm manchas de mato; a cidade não
  tem nenhuma (faz sentido num jardim aparado, mas um canteiro de mato alto
  em lote vazio ou na praça é uma opção).
- **Ressaltos**: a cidade é quase plana de propósito (o chão plano de
  verdade é a 090).

Proposta: trocar as árvores do jardim pelas folhosas dos pacotes (as
`usn-normaltree-*`, menores que as da planície) e, se ficar bom, as
`usn-mapletree-*` (já no jogo) como variação de rua. As árvores de rua
(abaixo) usam o modelo da folhosa do jardim, então mudam junto.

*(a decidir pelo usuário)*

---

## Os detalhes

Objetos novos tirados das cidades do Let's Go (`scripts/lgpe/pack-lgpe.js`):

| Objeto | De onde | Onde entra |
|---|---|---|
| Caixa de correio (`mailbox`) | Saffron, `posts/minka_post` | quintal, perto da rua |
| Hidrante (`hydrant`) | Saffron, `firehiderants` | esquinas |
| Floreira (`planter`) | Saffron, `flower_bed` | encostada na frente da casa |
| Vaso (`potted-plant`) | Celadon, `gardening02` | encostado na frente da casa |
| Pedra de caminho (`stepping-stone`) | Pewter, `tobi_ishi/tobi_ishi01` | da porta até a rua |
| Fonte (`fountain`) | Celadon, `fountain01` | praça |
| Canteiro de tronco (`log-flower-bed`) | Viridian, `kadan02_002_00` | cantos da praça |
| Bicicleta (`bike`) | Cerulean, `bike_03` | ao lado das casas de Cerulean |
| Tambor (`drum`) | Vermilion, `obj006_00/can006` | ao lado das casas de Vermilion |

Ficaram de fora: a fonte de Cerulean (traz um shader de água que o jogo não
trata), o canteiro de Lavender (é o bairro inteiro), a topiaria de Celadon
(saiu deformada) e o bueiro (decalque no chão, sem chão plano).

### Como ficou

- **Quintal das casas** (`placeYard`, `core/town/townPlan.js`), cada coisa
  com a chance dela (`town.details`): caixa de correio perto da rua (dentro
  da cerca, nas casas que têm), floreira encostada na parede de um lado da
  porta, vaso do outro, o objeto do tema ao lado da casa (`theme.yard`) e o
  caminho de pedras da porta até a rua. O corredor da porta fica livre; o
  que não cabe escorrega para fora (`YARD_SLIDE`) ou fica de fora. Só as
  casas (os prédios únicos têm o banco).
- **Pedras de caminho**: enfeite chato (`DECOR_KIND`, categoria `decor` no
  conversor), sem colisão nem pegada (o `colliders.js` só faz casco das
  categorias sólidas).
- **Hidrantes**: cada esquina de dentro do quarteirão tem a chance de um,
  a `HYDRANT_GAP` m do poste ao longo de uma rua, sem encostar em nada
  (`put` com `avoid`).
- **Árvores de rua**: nas divisas entre os lotes, a `treeInset` m da rua. A
  planta só escolhe os pontos (`treeSpots`); quem põe a árvore é o
  `placeChunkSolids` (`placeStreetTrees`), como as outras folhosas — mesma
  folga da borda, mesma regra de copa e de não encostar, modelo do bioma do
  ponto. Entram antes das árvores do jardim.
- **Praça**: um prédio único novo (`{ id: 'plaza', plaza: true }`), em
  todo porte. O lote ganha a fonte no meio, um banco de cada lado virado
  para ela e um canteiro em cada canto (`town.plaza`). O chão é calçado com
  a rua da cidade (`chunkPlazas`, no canal das ruas e no das trilhas, como
  o chão de terra do campo de treino — os dois saem de `chunkLotGround`).
- **Escala dos objetos de rua**: `town.propScale` (o `put` usa ele por
  padrão; a cerca mede as peças por ele). Os prédios seguem no
  `town.scale`.
- **F2**, pasta Cidade: "Tamanho dos prédios" e "Tamanho dos objetos de
  rua"; subpastas "Detalhes" (as chances, o passo e o tamanho das pedras, a
  distância das árvores de rua) e "Praça".

### Depois do primeiro teste (pedidos do usuário)

1. **Objetos de rua menores** (`town.propScale`, escolhido no F2).
2. **Sem hidrante e sem tambor por enquanto**: a chance do hidrante foi a
   zero (o código fica) e o tambor saiu do tema de Vermilion (o modelo fica
   no pacote).
3. **Água na fonte**, no material dos rios (`view/water/fountainWater.js`,
   desenhada junto da água no `WaterView`): um disco dentro da bacia
   (`town.plaza.water`, no tamanho do modelo), rasa como a beirada dos
   rios, com a espuma rente à parede. Só o desenho: não atrasa quem anda
   nela (a água dos rios atrasa pelo relevo).
4. **O fundo da fonte brigava com o chão calçado**: a fonte saiu sem o piso
   da bacia (`dropFloor` no conversor) — o chão da praça é o fundo.
5. **Colisão só na borda** (a primeira volta subia o casco inteiro acima do
   pulo, e um Pokémon voador pousava em cima dele): `ring` no colisor da
   fonte (`RINGS` no `scripts/lgpe/colliders.js`), que a física monta em
   caixas em volta (`ringBoxesOf`, `core/physics/colliders.js`). Dentro,
   nada: dá para entrar na água. A borda tem a altura do modelo — os
   Pokémon que pulam pouco (Caterpie, Weedle) não passam dela. A pegada
   (navegação) segue sendo a fonte inteira: a IA dá a volta.
6. **Ir para uma cidade pelo F2** (ferramenta para avaliar): Vegetação →
   Cidade → "Ir para a cidade" — as cidades mais perto do treinador (porte,
   tema, distância e direção), "Ir" e "Atualizar lista" (`irPara`,
   `core/actions/travel.js`): o time volta para a bola, o treinador cai em
   pé na rua do meio da cidade (`cityArrivalPoint`, a linha da grade mais
   perto) e a câmera vai junto. A física segura o treinador parado até o
   chunk de lá carregar. (Na primeira volta o seletor ficou no painel de
   texto do canto, sem dar para clicar.)

7. **Todo Pokémon entra na fonte, e a água é rasa para eles**: a fonte
   afunda no chão (`plaza.fountainSink`, a partir do ponto mais alto
   debaixo dela — `onHighest` no `put`), e a borda que sobra cabe no degrau
   do character controller: qualquer um passa andando. A água fica
   `water.depth` acima desse chão, abaixo do que o menor Pokémon entra
   andando pela regra dos rios (`WATER.WADE_FRACTION`; o Caterpie é o
   menor). A cor e a espuma leem outra profundidade (`colorDepth` no meio,
   `edgeDepth` na beira), senão a água rasa viraria espuma inteira.
8. **Efeitos e sons da beirada dos rios na fonte**: a consulta da água do
   nível (`levelWaterDepthAt`, `core/actions/water.js`) passa a contar a
   água das fontes dos chunks carregados (`core/town/fountains.js`, com a
   profundidade dos dados), e a nova `levelWaterSurfaceAt` diz a altura da
   superfície (a da fonte ou o nível dos rios). Com isso, quem anda na
   fonte tem o passo na água e a marolinha nos pés (`footstepAudioSystem`),
   o respingo do pulo e do dash (`JumpDustView`, `DashEffectsView`) e o
   atraso do raso. O som de fundo da água fica só com lagos e rios
   (`levelTerrainWaterDepthAt`). A IA segue contornando a fonte (a pegada
   dela é a fonte inteira).

---

## Nova organização: as cidades de verdade do Let's Go

Ideia do usuário (depois dos ajustes acima): em vez dos portes (vila,
cidade, cidade grande) com casas sorteadas por tema, cada cidade do mundo
passa a ser montada **a partir de uma cidade específica do Let's Go**. As 11
serão revistas **uma por uma**, nesta ordem de conversa (a primeira é
Pallet).

| # | Cidade | Mapa (`LGPE-FieldMaps`, pasta `field/`) | Ginásio | O que já usamos (até a 069) |
|---|---|---|---|---|
| 1 | Pallet Town | `area02/town001_00` | não | cerca de madeira (o laboratório saiu na 056) |
| 2 | Viridian City | `area02/town002_00` | sim | canteiro de tronco |
| 3 | Pewter City | `area03/town003_00` | sim | tema: casas de pedra, museu, poste, banco, pedra de caminho |
| 4 | Cerulean City | `area04/town004_00` | sim | tema: 4 casas, loja de bicicleta, poste, bicicleta |
| 5 | Lavender Town | `area08/town005_00` | não | tema: casa roxa, Torre Pokémon |
| 6 | Vermilion City | `area09/town006_00` | sim | tema: casas, fã-clube (tambor tirado) |
| 7 | Celadon City | `area06/town007_00` | sim | fonte, vaso |
| 8 | Fuchsia City | `area02/town008_00` | sim | nada |
| 9 | Cinnabar Island | `area02/town009_00` | sim | nada |
| 10 | Indigo Plateau (Liga) | `area01/town010_00` | não (a Liga) | nada |
| 11 | Saffron City | `area07/town011_00` | sim | caixa de correio, hidrante, floreira |

A numeração dos mapas não segue a ordem da jornada (Lavender é a `town005`,
Vermilion a `town006`, Saffron a `town011`). Fuchsia e Cinnabar ainda não
foram levantadas; Celadon e Saffron só por cima.

### 1. Pallet Town — cidade tutorial

**Decisões do usuário:**

- É uma **cidade copiada de fato** do jogo (depois veio Viridian, abaixo):
  a cidade tutorial, com algumas missões nela; depois o jogador sai para
  explorar o mundo procedural.
- Primeiro passo: montá-la numa **cena separada**, como os interiores dos
  prédios (068: o mapa inteiro convertido com `all: true`/`whole: true` no
  `--extra`, colisão própria, o mundo de fora escondido).
- Levantada e montada nesta feature (a primeira ideia era deixar para
  outra sessão; o usuário pediu para seguir depois do levantamento).

**Levantamento do mapa** (`area02/town001_00.gfbmdl`, medido em
2026-11-12 com o leitor do conversor, `scripts/lgpe/gfbmdl.js`; tamanhos do
original em metros, sem a escala do jogo):

- **Tamanho e peso**: uns 132 mil triângulos, 69 malhas, 36 materiais e 58
  texturas. A caixa do mapa tem 80 × 41 m no chão, mas a cidade em si (o
  chão `grand01_5`, na altura 0) é um retângulo de uns **21 × 33 m**; o
  resto é o morro de árvores em volta. As árvores (`town001_00_tree/tree36/
  tree001`…`tree006`, redondas do Let's Go fundidas, `FieldTreeShader04/05`,
  com o tronco `area02_tree2_tree_miki`) são uns 79 mil triângulos, até
  7 m de altura.
- **Orientação**: os mapas da `area02` dividem o mesmo sistema de
  coordenadas. A Rota 1 (`road001_00`) fica em −Z e o mar (`sea_00`) em +Z:
  **+Z é o sul**. As portas dos três prédios dão para o sul (+Z), como no
  conversor.
- **Relevo**: a cidade é rebaixada. O chão de dentro fica na altura 0, a
  borda sobe meio metro (onde ficam as cercas de fora, `fence08`…`fence014`)
  e o morro das árvores sobe até uns 3 m (`FieldCliffShader01`, as malhas
  sem nome e `cliff01_44`/`cliff01_61_DUP`). A saída para a Rota 1 é o vão
  de uns 3,5 m entre a `fence04` e a `fence05`, no norte.
- **Prédios** (com os filhos: telhado, janela, enfeites):
  - `masaratown_house_house1` (casa do jogador) e `masaratown_house_house2`
    (casa do rival): 5 × 3,5 m no chão e 4,2 m de altura, lado a lado no
    norte.
  - `masaratown_house_labo` (laboratório do Prof. Carvalho): 5,3 × 4 m e
    4,5 m com a chaminé (`masaratown_house_entotsu`); `masaratown_house_
    kazari` é o enfeite com janela da fachada. Fica a leste, mais ao sul.
  - **Pegadinha**: uma parte do telhado da casa do rival
    (`masaratown_house_home3_35_DUP3`) está debaixo do nó da casa do
    jogador. Tirar por nó (`whole`) põe esse pedaço no prédio errado —
    separar por posição ou levar o mapa inteiro junto.
- **Portas**: o nó `inndoor` não é marcação. São os três vãos escuros das
  portas (1 m de largura, 1,8 m de altura e 0,9 m de fundo), um por
  prédio, e servem para achar a posição das entradas. As portas são
  modelos à parte do mesmo tamanho (`buildmodel/town001_door01`, `_door02`,
  1 × 1,8 m).
- **Caixas de correio**: `masaratown_house_home3_post` são **duas** (uma
  na frente de cada casa, 0,4 × 1,3 m), não só a da casa do jogador.
- **Cercas**: `fence01`…`fence020` (sem a `fence03`), cada uma num nó e já
  no lugar. A `fence01` fica ao lado da placa da cidade, no meio; a
  `fence02`, ao sul do laboratório; o resto fecha a borda e o jardim do
  sul.
- **Placas**: `signboard_town001` (a placa da cidade, 1,7 m de largura, no
  meio da praça) e `signboard01_01` + `signboard01_02`, que juntas são
  **uma placa só** ao sul do laboratório, ao lado da `fence02`.
- **Chão**: `grand01_5` (o chão da cidade), `grand01_7` (o chão baixo do
  sul, até −2 m, pedra `block04`), `grand01_8_DUP` (grama na beira da
  água), `road022_00_yuka_002_DUP` (chão de terra do sudeste, nome
  aproveitado da Rota 22) e as malhas sem nome do morro.
- **Cercas-vivas**: `town001_00_tree07`/`tree08` (`FieldTreeShader01`),
  junto das cercas do sul.
- **Grama e flores**: `town001_00_grass/grass01`…`grass07`. A `grass02`
  são as flores (uns 5,7 mil triângulos), a `grass05` os tufos maiores e
  as `grass01`/`grass07` (`grass_s03`/`s04`, `FieldGrassShader04/05`)
  provavelmente o mato alto.
- **Pedras**: `town001_00_rock` são seis (quatro de 1,4 a 2,1 m e duas
  pequenas): uma na borda oeste, uma a leste do laboratório e o resto no
  jardim do sul.
- **Água**: o `town001` não tem água. Ela está no `sea_00`, da mesma área:
  o mar começa no sul da cidade (a linha da praia é a cerca `fence019`/
  `fence020`), com a superfície meio metro abaixo do chão e o fundo a
  −2 m. Também tem um **braço de água** de uns 2 m de largura no sudoeste,
  que desce do meio da cidade até o mar (fundo `grand01_10_DUP`, no
  `sea_00`). O shader de água do Let's Go (`FieldWaterShader01/02`) o jogo
  não trata: usar a água dos rios, como na fonte.
- **Salas** (já no pacote de mapas, ainda não no jogo): `t001r01`
  (casa do jogador, os dois andares em `t001r0101`/`t001r0102`), `t001r02`
  (casa do rival) e `t001r03` (laboratório, uns 29 mil triângulos).
- **Já no jogo**: só a cerca (`fence-wood`, a `fence02`). O laboratório
  (`house-lab`) segue no pacote, mas saiu da cidade na 056.

**Planta** (quadrados de 1 m, de x = 8 a 35; o número da linha é o z; o
norte fica em cima):

```
  -4           F   F          ###
  -3           F   F          ###
  -2           F   F         TT##
  -1  T  T   TTF   FTT    TT +T##
   0 TT::T::FTTF...FTTF:::TT:+###
   1 +:F:.................:FTT##T
   2 +:F...HHHHH...HHHHH...FTT++T
   3 T:F..HHHHHHH.HHHHHHH..F:+++T
   4 TTF..HHHHHHH.HHHHHHH..:TT++#
   5 +:F..HDDHHHH.HDDHHHH..FTT++#
   6 +:F..HHHHHHH.HHHHHHH..F:+++#
   7 TTF...................F:+++T
   8 TTF...................FTT+TT
   9 +:F...FFFFS.....LLLL..FTT++T
  10 TRR...........LLLLLL..::+TT#
  11 RRF...........LLLLLL..F:+TT+
  12 +:F...........LLLDDL..FTT+++
  13 +:F.............LLLL..FTT+++
  14 +:F...................F:T++T
  15 +:::FF................RRT+TT
  16 +TT:::.~~.....FFFSS...RR+++T
  17 +TT:::.~~.............::++++
  18 +++:::.~~.............::TT::
  19 +++TT:.~~.............::TTTT
  20 +++TT:.~~.............::::TT
  21 +++:::.~~.FFFFhhFFFFhh:TT###
  22 TT+TT:.~~.FFFFhhFFFFRhRTT###
  23 TT+TT:.~~......hF:TTRRRR:###
  24 +++:::.~~.......F::RRR:::###
  25 +++:::.~~.......F:::R::::###
  26 +TTTT:.~~.......FhTT:::TT###
  27 +TT:::.~~.......hh::TT:TT:::
  28 +++:::.~~.......F:::::::::TT
  29 ::::::.~~.......FTT:::::::TT
  30 :::TT:.~~.......F:::TT::TT::
  31 ::::T:.~~.......Fh::hT::TTh:
  32 ::TT::.~~.......hFFFFFFFFFh:
  33   T   ~~~...................
  34       ~~~~~~~~~~~~~~~~~~~~~~
  35       ~~~~~~~~~~~~~~~~~~~~~~
  36       ~~~~~~~~~~~~~~~~~~~~~~
```

Legenda: `H` casa, `L` laboratório, `D` porta, `M` caixa de correio, `F`
cerca, `S` placa, `R` pedra, `h` cerca-viva, `T` tronco de árvore, `~`
água; chão `.` na altura 0, `:` até 0,75 m, `+` até 1,5 m, `#` acima.

**Referências** (layout, em texto e imagens nas páginas):

- [Bulbapedia — Pallet Town](https://m.bulbapedia.bulbagarden.net/wiki/Masara)
  — cidade quadrada com três prédios (casa do jogador, casa do rival e
  laboratório), a menor de Kanto; Rota 1 ao norte, Rota 21 ao sul.
- [Bulbapedia — walkthrough do Let's Go, parte 1](https://bulbapedia.bulbagarden.net/wiki/Walkthrough:Pok%C3%A9mon:_Let%27s_Go,_Pikachu!_and_Let%27s_Go,_Eevee!/Part_1)
- [Thonky — Pallet Town (Let's Go)](https://thonky.com/pokemon-lets-go/pallet-town)
- [Game Guides — Pallet Town](https://www.gamerguides.com/pokemon-lets-go-pikachu-and-lets-go-eevee/guide/walkthrough/gym-1-boulder-badge/pallet-town)
- [The Cutting Room Floor — mapas de protótipo](https://tcrf.net/Proto:Pok%C3%A9mon:_Let%27s_Go,_Pikachu!_and_Let%27s_Go,_Eevee!/Early_Maps)
- A referência exata é o próprio mapa: convertido, ele já é a cidade do
  jogo (posições, cercas, placas e prédios no lugar).

**Notas para a montagem** (o que pesou no levantamento):

- Colisão: o mapa não traz colisão (como as salas). O chão e os barrancos
  podem virar malha de triângulos (chão para a câmera); prédios, cercas,
  placas e troncos, cascos ou caixas; grama, flores e folhas (corte de
  alfa) ficam de fora.
- Cena à parte com céu: diferente da sala, Pallet é ao ar livre — manter o
  céu, a luz do dia e o clima, e a câmera livre (a das salas é travada).
- Acesso por enquanto: um botão no F2 (como o "Ir para a cidade").
- **Escala**: no original a porta tem 1,8 m, e a cápsula do treinador tem
  uns 2 m. Em escala 1 ele não passa pela porta. As salas da 068 usam a
  escala do prédio de fora (`building.scale`), então Pallet e as salas
  dela (`t001r01`…`r03`) devem sair na mesma escala.
- **Mar e braço de água**: tirar do `sea_00` só o pedaço que encosta na
  cidade (ou desenhar com a água dos rios) e dar a beira do mar como
  limite.
- Pontos de integração que a sala já resolveu e que aqui também contam:
  selvagens de lá embaixo, save da posição, passos (chão do mapa, não do
  relevo), som ambiente.

**Decisões do usuário para a primeira volta:**

- **Escala**: a dos prédios da cidade (`town.scale`), com um controle no F2
  para ajustar vendo no jogo. As salas de Pallet depois saem nessa escala.
- **Árvores do morro**: as originais do mapa, fiéis (trocar depois se
  destoarem ou pesarem na Intel UHD).
- **Água**: entra, no material dos rios; a beira do mar é o limite no sul.
- **Escopo**: só o exterior e o botão no F2. As portas ficam fechadas e as
  três salas vêm depois da avaliação.

**Como ficou (primeira volta):**

- **Conversão** (`scripts/lgpe/town-maps.json`, `pack-lgpe.js --extra …
  --only-extra --out public/assets/town-maps/lgpe`): o mapa inteiro num
  `.glb` (`pallet-town`), sem as sombras falsas e sem o efeito de vento da
  grama (`skipShaders`: `FieldGrassShader05`). As três portas da
  `buildmodel/` entram nos vãos escuros (`doors`, uma por vão, de oeste
  para leste: as casas com a `town001_door01`, o laboratório com a
  `_door02`). O manifesto guarda a `origin` (onde o centro do modelo ficava
  no original).
- **Chão misturado**: nos shaders de chão, barranco e pedra do Let's Go
  (`FieldGroundShader01`, `FieldCliffShader01`, `FieldRockShader`), o
  canal vermelho da cor do vértice é o **peso** da camada de cima, não cor:
  0 é a grama (no UV plano do mundo), 1 é a terra, o barranco ou a pedra
  (o barranco e a pedra no segundo UV, o chão no mesmo da grama). O
  conversor grava a `layer` do material e o material toon mistura as duas
  (`layerMap`, `LGPE_LAYER`) sem a cor por vértice. Os props que já
  estavam no jogo não mudam (o manifesto deles não tem `layer`).
- **Colisão** (`scripts/lgpe/town-map-colliders.js` →
  `src/core/data/townMapColliders.json`, no espaço do modelo): o chão numa
  grade de alturas (heightfield do Rapier, como o relevo dos chunks — chão
  para a câmera), com o ponto mais alto do chão, dos barrancos e das
  pedras; caixas para os prédios, as caixas de correio, as cercas, as
  placas, os troncos e as cercas-vivas; paredes na borda do mapa. Os cantos
  fora do chão viram um paredão (atrás do morro). A grade guarda também
  onde é grama (o passo) e onde o mar cobre (a profundidade é a superfície
  menos o chão: a água funda barra como a dos rios). A chegada é à frente
  da porta da casa do jogador, virado para o sul.
- **Core**: `OnTownMap` no treinador (o mapa, o lugar, de onde veio e o
  corpo da colisão); `irParaMapaDaCidade`/`sairDoMapaDaCidade`
  (`core/actions/townMap.js`): o mapa fica `TOWN_MAP.ALTITUDE` m acima do
  relevo de onde o treinador estava, no mesmo XZ, e a saída devolve ele lá.
  Enquanto ele está no mapa, as consultas do nível (água e chão,
  `core/townMap/activeTownMap.js`) são as do mapa; as selvagens não o
  alcançam; o F não acha nada (portas fechadas, os itens lá de baixo fora);
  o "Ir para a cidade" não leva; e o time fica na bola (o caminho das
  criaturas é o do relevo lá embaixo), com aviso próprio. O save guarda o
  mapa (`townMap`) e volta para ele.
- **View**: `TownMapView` (só monta com o treinador lá); o mundo procedural
  some (`OpenWorldOnly`), o céu, o clima e os efeitos ficam. O mar é uma
  grade na superfície do mapa, no material dos rios, com um pedaço de mar
  fundo além da borda sul (`townMapWater.js`).
- **F2**: Vegetação → Cidade → Pallet: "Ir para Pallet", "Sair de Pallet" e
  "Tamanho (na próxima ida)" (`TOWN_MAP.SCALE`, começa no dos prédios).

**Ficou para depois** (o usuário revê o que Pallet precisa a mais no tutorial, 076 no Marco 3): as salas e as portas abrindo; soltar Pokémon em
Pallet; a saída a pé pela Rota 1; a música própria da cidade; o
desempenho (o mapa tem uns 108 mil triângulos, a maior parte das
árvores).

### 2. Viridian City — a cidade inicial

**Decisões do usuário:**

- **Cópia exata** do mapa, como Pallet: é a cidade inicial do jogo e é
  **única**. Ela não é gerada pelo procedural em outros pontos do mundo.
- **No mundo procedural, não numa cena à parte**: no lugar da primeira
  cidade procedural, fixa no ponto inicial do mapa, onde o treinador nasce.
- **Escala, árvores e água como em Pallet**: a escala dos prédios da cidade
  (`town.scale`), com um controle no F2; as árvores originais do mapa; a
  água no material dos rios.
- **Escopo da primeira volta**: só o exterior (portas fechadas).

**Levantamento do mapa** (`area02/town002_00.gfbmdl`, medido em
2026-11-12 com os mesmos scripts de Pallet; tamanhos do original em metros,
sem a escala do jogo):

- **Tamanho e peso**: uns 154 mil triângulos (Pallet tem 132 mil), 93
  malhas, 61 materiais e 98 texturas. A caixa do mapa tem 60 × 52 m no
  chão. A cidade jogável (do paredão oeste até a mata do leste, e da saída
  norte até a saída sul) tem uns **40 × 42 m**, quase o dobro de Pallet.
  As árvores são uns 100 mil triângulos: as redondas do Let's Go
  (`town002_00_tree/tree33/tree001`…`tree007`, `FieldTreeShader02/04/05`,
  tronco `area02_tree2_tree_miki`, até 7 m de altura), as moitas
  (`town002_00_tree05`) e as cercas-vivas (`town002_00_tree08`).
- **Onde fica**: no mesmo sistema de coordenadas de Pallet (`area02`, com
  **+Z para o sul**). A Rota 1 (`road001_00`, z de −40 a 0) liga as duas:
  a saída sul de Viridian (x ≈ 19–23) bate com a saída norte de Pallet.
  A Rota 2 (`road002_1_00`) fica ao norte (z < −82) e a Rota 22
  (`road022_00`) a oeste (x < −1). Todas as portas dão para o sul.
- **Relevo**: o chão da cidade fica na altura 3,5 do sistema da `area02`
  (Pallet fica na 0), e a planta abaixo mede tudo a partir dele. O
  ginásio fica num patamar meio metro acima, no nordeste, e atrás dele o
  chão sobe mais um pouco. A faixa sul (de z −49 até a saída) fica meio
  metro abaixo. A oeste tem um paredão de barranco com pedra
  (`town002_00_cliff01/02/03`, `town002_00_block01`, `town002_00_rock`),
  até uns 5 m acima do chão. Ele só se abre na **saída para a Rota 22**,
  um vão de uns 5 m em z ≈ −66 a −60,5. A **saída norte** (Rota 2) é o
  vão entre a cerca do noroeste e as árvores, em x ≈ 16,5–21, e a **saída
  sul** (Rota 1) é o vão de uns 4 m entre as cercas-vivas, em x ≈ 19–23
  (medidas na borda do chão, na montagem). Ao leste, uma faixa de mata
  (x ≈ 37–50) fecha a cidade, e o gramado atrás dela fica fora do
  alcance.
- **Prédios** (cada um num nó, com os filhos: telhado, janela, enfeites):
  - `bldg_gym_002` (ginásio): 6 × 3,4 m no chão e 4 m de altura, no
    patamar do nordeste. A entrada (`gym_ent_002`) fica na frente.
  - `bldg_pc_002` (Pokécenter): 5 × 3,7 m, ao sul, no meio. O piso da
    entrada (`enter_floor_pc_002`) e a placa (`signboard_pc_002`) ficam à
    parte.
  - `bldg_shop_002` (loja): 4,2 × 2,9 m, a leste, com o símbolo
    (`mark_shop_002`) no telhado.
  - `bldg_minka` são **duas casas iguais** num nó só (5 × 2,8 m e 3,2 m
    de altura), uma em cima da outra na planta, em x ≈ 21–26 (z ≈ −76 e
    −65). Como em Pallet, separar por posição se um dia for preciso.
- **Portas**: o nó `town002_00_doorway` tem os **cinco** vãos escuros. As
  portas são modelos à parte da `buildmodel/`: `town002_door01` (1 ×
  1,8 m) nas duas casas e as portas comuns dos prédios de serviço
  (`combldg_pc_door01`, `combldg_gym_door01` e `combldg_shop_door01`, de
  1 a 1,2 m de largura). Na ordem do conversor (oeste para leste, depois
  norte para sul), os vãos são: casa do norte, casa do sul, Pokécenter,
  ginásio e loja.
- **Lago**: um laguinho de 5 × 4,5 m a oeste do Pokécenter, com borda de
  pedra (`block002_00`, 6 × 5 m) e a água uns 0,8 m abaixo do chão
  (`water002_00`, `FieldWaterShader01/02`, os mesmos de Pallet que o jogo
  não trata). Fazer com a água dos rios, como no mar de Pallet. O fundo
  é `floor002_00/sea_ground002_00`.
- **Ruas**: `floor002_00/road002_00` (asfalto `asphalt01_area02`). Uma rua
  desce do norte até o Pokécenter. Uma rua leste–oeste passa na frente
  das casas e da loja e segue para a saída da Rota 22, e outra contorna o
  Pokécenter e o canteiro. O chão de grama e terra é
  `floor002_00/ground002_01_…` (chão misturado `FieldGroundShader01`, como
  em Pallet).
- **Cercas**: `fence_01_002_00` (cerca de rota, `roadfence01_com`), num
  nó só com quatro trechos: o cercado do jardim do noroeste (dois trechos)
  e dois atrás da loja.
- **Objetos de rua**: **7 postes** (`lamp_town002`, 2,7 m, a luz em
  `FieldObjectShader_Emission`), **2 bancos** (`obj002_01`, 1,9 m), o
  **canteiro de tronco** (`kadan02_002_00`, 4,6 × 3,2 m, a leste do
  Pokécenter, o mesmo do `log-flower-bed` que já está no jogo) e
  **vasos** (`plant002_00`: três na frente da casa do sul e um ao lado do
  Pokécenter).
- **Placas** (`signbord/…`): a da cidade (`signboard_town002`, 1,7 m, a
  oeste das casas, na rua da Rota 22), a do ginásio (`signboard04`, ao
  lado da entrada), uma ao lado da casa do sul (`signboard05`) e uma na
  faixa baixa do sul (`signboard02`, com vidro).
- **Moitas e cercas-vivas**: 20 moitas redondas (`town002_00_tree05`, uns
  2,2 m e 1,6 m de altura, `tree07_01`) na frente do ginásio, no cercado
  do noroeste, ao sul e no canto do sudoeste. As cercas-vivas
  (`town002_00_tree08`, blocos de 1,5 m e 0,85 m de altura) fazem uma fila
  a oeste da rua do norte e ficam em volta das casas.
- **Grama e flores**: `town002_00_grass/grass01`…`grass07`. A `grass02`
  são as flores, a `grass01` (`grass_s03`, `FieldGrassShader04`) é o
  mato alto e a `grass07` (`grass_s04`, `FieldGrassShader05`) é a grama
  com vento, que em Pallet ficou de fora (`skipShaders`).
- **Decalques no chão**: `road016_1_00_ground_plane_01_*` (20 pedras
  chatas de 1 × 1 m, `roadstone01_com`) e `road016_1_00_blend*`
  (manchas). São quadrados rentes ao chão, e o chão pode brigar com eles
  (z-fighting).
- **Pedras**: `town002_00_rock` são 14 pedrinhas (até 1,2 m) em cima do
  paredão oeste. No chão da cidade não tem pedra.
- **Shaders que Pallet não tinha**: `FieldTreeShader02` (duas das
  árvores), `FieldObjectShader_Emission` (a luz dos postes) e
  `FieldWaterShader01/02` (o lago). Conferir no conversor como eles
  saem.
- **Fora do mapa**: `buildmodel/town002_reduction` é a versão de longe
  (uns 5,6 mil triângulos, para ser vista de outro mapa). Não entra.
- **Salas** (no pacote de mapas, ainda não no jogo): `t002r01`
  (`t002r0101`, uns 10 mil triângulos) e `t002r02` (`t002r0201`, uns 14
  mil), as duas casas; `t002pc01` (Pokécenter, uns 11 mil); `t002fs01`
  (a loja de Viridian, diferente da genérica da 068, uns 44 mil); e
  `t002gym` (`t002gym01`, uns 51 mil, com as peças de mecanismo
  `buildmodel/t002gym_gimmick01`…`03`).
- **Já no jogo**: o canteiro de tronco (`log-flower-bed`) e, para as
  salas, o Pokécenter e a loja genéricos da 068.

**Planta** (quadrados de 1 m; o número da linha é o z; o norte fica em
cima; as copas das árvores não aparecem):

```
   x     0         10        20        30        40        50
         |         |         |         |         |         |
 -83  ## ##   T TT TT                   TTT   T
 -82  #######+::TT::T:::FF....:::::TT::::T::::::::::::::::::::::::
 -81  #######+:::::::TT:FF....TTTT:+++TT+++++++++++TT+++++++++++++
 -80  #######+:TT:TT:TT:FF===.::TT:+++T++++++++++++TT+++++++++++++
 -79  #######T:T::TTTT::FF===.:::::+TTGGGGGGG++++++TT+++++++++++++
 -78  ######TTFFFFFFFFFFFF===.TT:TT+++GGGGGGG+++++++++++++++++++++
 -77  #######+............===.:T:TT+TGGGGGGGGG++++++++++++++++++++
 -76  #######+FFFFFFFFFFFF==hhHHHHHTTTGGDDDGGGTT++++++++++++++++++
 -75  #######+FFbb:bb:bbFF===hHDHHHH+bGGDDDGGbT++TT++T++++++++++++
 -74  #######+FFbb:bb:bbFFh=hhHDHHHH:bbbGGGblbb++TT+TTT+++++++++++
 -73  #######+FFbb:bb::bFF===......::SSS::::llb+++++TTT+++++++++++
 -72  #######+FF:TT:::T:FFh==......::::::::::bb+T+++++++++++++++++
 -71  #######+FF:TT:::T:FF===hhhhhh::::::::::bb+TT++++++++++++++++
 -70 ########+FF:T:TT:::FFh=hhhhhhh::::::::::bb+++++++++++++++++++
 -69  #######+FF:T:TT:::FF===hhhhhh............:::::::::::::::::::
 -68  #####+++FF::::::::FFh==..................:TT::::::::::::::::
 -67  #####+++FF:T:T:TTTFF===..................:TT::TT::::::::::::
 -66  ++++++..FF:::T::T:FFh==h....FFFFFFFFFFFFF::::TTT::::::::::::
 -65  ........FFFFFFFFFFFF==hhHHHHHHFFFMMMMMMTF:::::T:::::::::::::
 -64  .............====lSS===hHDHHHHbBBMMDDMTTT:TT::::::::::::::::
 -63  .............=========hlHDDHHH...MMDDMMFF::TT:::::::::::::::
 -62  .............==========lS.ppp......MM....:::::::::::::::::::
 -61  +++++++..........bbb=====================::T::::::::::::::::
 -60  ######+..........bbb=====================::T::TTT:::::::::::
 -59  ######+bbbb.......bb=====================:::::TTT:::::::::::
 -58 +######+bbbb.........===bbbbbbb===.....===::::::T::::::::::::
 -57 +######+::::.........==bbCCbCCb===KKKKK===:TT::::::::::::::::
 -56 +######+:T::..TTBB..ll=pCCCCCCC===KKKKK===:TT::::::::::::::::
 -55 +######+......TT....l==pCCCCCCC===KKKKK===:bb::::::::::::::::
 -54  ######+....RRRRRR...==pCCDDDCC===KKKKK===:bbb::T::::::::::::
 -53 +######+....R~~~~R...====CCDCC============:bb::TTT:::::::::::
 -52 +######+....R~~~~R...======C==============::TT::TT:::::::::::
 -51  ######+....R~~~~R...====================l::TT:::::::::::::::
 -50 +######+....R~~~~RR............bbb.bbb..blb::::::::::::::::::
 -49 +######+.---RRRRRR------SS-----bbb-bbb--bbb.TT...............
 -48 +######+.-----------------------bb--bb--bb...T...............
 -47 +######+l---------------------------------......T............
 -46  ######+.b.....---------------------------.TT..TTT...........
 -45 +######+bbb....---------------------------.TT..TTT...........
 -44 +######+bbb..bb......bb----bb......bbb.....T.................
 -43  ######+.....bb.....bbb----bb......bbb.......................
 -42 +######+T..T.bbbb....bb----bb.T......bbbTbb.TT...............
 -41 +######+...T..TbbTT....----.......TT.bbTTTb.TT...............
 -40                    TT   --  TT TT     b T   TT
```

Legenda: `G` ginásio, `C` Pokécenter, `M` loja, `H` casa, `D` porta, `F`
cerca, `S` placa, `B` banco, `l` poste, `K` canteiro de tronco, `p` vaso,
`R` borda de pedra do lago, `h` cerca-viva, `b` moita, `T` tronco de
árvore, `~` água, `=` rua; chão (a partir do chão da cidade) `.` na
altura dele, `-` meio metro abaixo, `:` até 0,75 m acima, `+` até 1,75 m
acima, `#` mais alto.

**Referências**: o próprio mapa, que convertido já é a cidade do jogo.
Para o layout em texto e imagens:
[Bulbapedia — Viridian City](https://bulbapedia.bulbagarden.net/wiki/Viridian_City)
e o [walkthrough do Let's Go na Bulbapedia, parte 1](https://bulbapedia.bulbagarden.net/wiki/Walkthrough:Pok%C3%A9mon:_Let%27s_Go,_Pikachu!_and_Let%27s_Go,_Eevee!/Part_1).

**Como ficou (primeira volta):**

- **Conversão**: o mapa inteiro num `.glb` (`viridian-city`, no mesmo
  `scripts/lgpe/town-maps.json` de Pallet), sem as sombras falsas, sem a
  grama com vento (`FieldGrassShader05`) e sem a água do Let's Go
  (`FieldWaterShader01/02`: o jogo desenha a dele). As cinco portas entram
  nos vãos escuros, na ordem do levantamento.
- **Colisão** (`scripts/lgpe/town-map-colliders.js`): a mesma de Pallet,
  com o que Viridian pede a mais. A grade do chão cobre só o chão
  (`gridFromGround`), e a beira dela copia o chão vizinho. A cerca em L
  vira uma caixa por trecho reto (`fenceCells`). Postes, bancos, canteiro e
  vasos viram caixas (`props`), e as moitas entram com as cercas-vivas. A
  água é a do próprio mapa (`waterSurface`). A chegada fica à frente do
  Pokécenter (`arrivalDoor`). As paredes da borda têm os vãos das três
  saídas (`exits`) e são baixas (`wallAbove`: barram quem anda, a câmera
  passa por cima). O JSON guarda o meio de cada saída.
- **No mundo** (`core/town/fixedTown.js`, `CITIES.FIRST_TOWN`): a chegada
  do mapa vai para a origem, com o chão dela no chão da cidade da seed.
  - **Relevo**: dentro da área do chão do mapa, a altura é a do chão dele.
    Numa faixa em volta (`FIRST_TOWN.BLEND`), vai da altura da borda até a
    da seed (`fixedTownHeight`, no fim do `createTerrainSampler`). Quem
    pergunta a altura (colisor do chunk, navegação, quem nasce, o save)
    pisa no chão do mapa. Mudar o mapa ou o tamanho muda o mundo:
    `GENERATION_VERSION` subiu.
  - **A cidade da seed**: a da origem vira a fixa (`fixed`, em
    `citySites.js`), com o raio do disco cobrindo a área toda. Ela não tem
    lote (`cityIndex.isFixedAt`), rua, poste nem árvore de rua
    (`chunkStreets`, `placeTown`). Os prédios únicos da primeira cidade
    procedural (Pokécenter, loja, ginásio e o campo de treino da 067)
    saíram com ela.
  - **Estradas**: a ponta na cidade fixa é a saída do mapa que mais dá para
    a outra cidade (`gateToward`), e a estrada some só dentro da área.
  - **Vegetação**: a área vai no canal das ruas e das trilhas
    (`chunkFixedTown`), então nada nasce no chão do mapa. As caixas da
    colisão são obstáculos do sorteio (`placeChunkSolids`, `obstacles`).
  - **Colisão**: as caixas entram no bloco de sólidos do centro delas
    (`fixedTownSolidsIn`), no corpo do relevo de cada chunk
    (`chunk.solids.boxes`), com pegadas para a navegação. O chão é o do
    relevo.
  - **Água e passos**: dentro da área, as consultas do nível
    (`townMapAt`, em `water.js` e `groundSurface.js`) usam a água e a
    grama do mapa. O laguinho barra como a água funda dos rios.
- **View**: o `FixedTownView` desenha o mapa no mundo aberto, com a água de
  dentro (a do lago, sem o mar além da borda). Ele usa o mesmo
  `TownMapScene` de Pallet. O relevo debaixo do mapa não é desenhado
  (`chunk.hiddenRect`, `terrainGeometry.js`): as células todas dentro
  somem, e a faixa da borda desce um pouco para o chão do mapa ficar por
  cima.
- **F2**: Vegetação → Cidade → Viridian, "Tamanho (refaz o mundo)"
  (`CITIES.FIRST_TOWN.SCALE`, começa no dos prédios). No "Ir para a
  cidade", a primeira aparece como "Viridian" e leva à chegada.

**Ficou para depois:** as portas e as salas (`t002r01`/`r02`, `t002pc01`,
`t002fs01`, `t002gym`); um campo de treino perto de Viridian (a primeira
cidade procedural tinha o dela); a ligação a pé com Pallet pela Rota 1;
o desempenho (o mapa tem uns 129 mil triângulos, a maior parte das
árvores).

#### Mudança de rumo: Viridian montada à mão (lab-cidade)

Depois da primeira volta, o usuário decidiu que o que serviu para Pallet
(o modelo inteiro do mapa) **não serve para Viridian**. Ela é **montada à
mão**, mas fiel ao layout do Let's Go, num laboratório novo
(`/tools/lab-cidade`), e só depois vai para o jogo. Pallet fica como está,
e o usuário revê ela no tutorial (076).

**Decisões do usuário:**

- **O lab é a cena do jogo** (como o lab-bioma): o mundo com Viridian na
  origem e o treinador andando nela para sentir a escala.
- **Começa só pelo chão**, no layout de Viridian.
- **Um degrau do original = um platô nosso**: os degraus de meio metro
  (meio-fio, que se sobe andando) viram o degrau dos nossos platôs, com
  barranco, e ganham rampa onde o caminho passa.
- **Montanha só no paredão oeste**, fiel ao original: a nossa montanha no
  lugar do paredão, aberta na saída da Rota 22. Norte, leste e sul seguem
  abertos (lá o original tem árvores).

**Como ficou (lab, primeira volta: o chão):**

- **Layout** (`core/data/cityLayouts/viridian.js`): uma grade de níveis,
  uma célula por metro do original. Ela saiu do chão do mapa (a altura
  média de cada célula) e daqui em diante é editada à mão. Os níveis são
  um degrau abaixo (a rua rebaixada do sul e a saída para a Rota 1), o
  chão, um acima (o jardim do noroeste, o patamar do ginásio e a mata do
  leste) e dois acima (o nordeste, atrás do ginásio). Além deles, o
  paredão (`#`) e o lago (`~`). A grade também guarda a chegada (à frente
  do Pokécenter), as três saídas e as rampas. Limpeza feita à mão: o pé do
  paredão entrou nele, a faixa da saída da Rota 22 ficou no chão e saiu um
  montinho de 2 × 2 m debaixo de duas árvores.
- **Rampas** (no original não há, sobe-se o meio-fio andando): do chão
  para a rua rebaixada (ao lado do lago), da ponta leste da rua rebaixada
  para o chão do sudeste e da rua para o patamar do ginásio (na frente
  dele).
- **O chão** (`core/town/cityLayout.js`): cada nível é um platô (o
  `terraceHeight` dos biomas, com o barranco na divisa entre as células).
  A rampa é uma subida reta de um nível ao outro. A montanha sobe da beira
  para dentro em patamares com barranco, até a altura dela, e segue além
  da borda da grade. O lago é uma bacia, ainda sem água. O chão acompanha
  de leve o relevo da seed, para o topo nunca ficar plano de todo (090).
- **No mundo** (`core/town/fixedTown.js`): com `FIRST_TOWN.LAYOUT`, a
  primeira cidade fixa é a montada à mão, mesmo com `MAP`. A chegada fica
  na origem e o chão vem do layout. O relevo aparece, porque não há modelo
  por cima. A área só afasta a vegetação (`chunk.bare`, que o `trailAt`
  conta) e não pinta rua. Por enquanto não há caixas, e a água e os passos
  são os do relevo. **O jogo segue com o modelo** (`LAYOUT: null`): só o
  lab liga.
- **Os números do chão** ficam em `CITIES.FIRST_TOWN.GROUND`: os degraus
  (como o `relief.terraces` da planície), a montanha (como o
  `relief.mountains` da floresta, mais a altura e a subida), o fundo do
  lago e a beirada das rampas.
- **O lab** (`tools/cityLab/`): a cena do jogo sem login, save, HUD,
  time nem selvagens, com o relógio parado e o tempo limpo. O treinador
  nasce na chegada. O painel tem:
  - hora, "Voltar para a chegada" e as câmeras prontas (as do lab-bioma e
    uma de cima, para ler a planta; o zoom vai mais longe no lab);
  - o chão: o tamanho da cidade, os degraus, a montanha, o lago, as
    rampas e a mistura com o mundo, e cada mudança refaz o mundo;
  - "Copiar valores do chão", para levar ao config.

  O F2 liga os painéis do jogo por cima.

**Segunda volta no lab: sem névoa e as texturas do chão** (pedidos do
usuário):

- **Sem névoa no lab** (`CityLabRig`): a cada quadro ela vai para longe,
  como dentro dos prédios. A borda do mundo carregado fica à vista.
- **O que cobre o chão** (`ground` no layout, a mesma grade dos níveis):
  `g` grama, `t` terra batida, `a` asfalto e `p` pedras de pisar. Saiu do
  mapa original pelo `scripts/lgpe/city-layout.js`: em cada célula, o chão
  de cima (o asfalto, as pedras de pisar ou, nos shaders de mistura, a
  camada que vence pelo canal vermelho). O script também imprime os níveis
  e serve às outras cidades. No original: a rua de asfalto que desce da
  saída norte, a leste–oeste até a saída da Rota 22 e o anel em volta do
  Pokécenter; a terra batida em volta dos prédios e na rua rebaixada do sul
  (com as pedras de pisar); grama no resto.
- **Os barrancos com a rocha do original** (`paint` no layout): os degraus
  da cidade com a rocha deles (`cliff01_com`, a `gake` do mapa). A montanha
  usa, de baixo para cima, a rocha com grama (`cliff03_com`) e a rocha com
  terra (`cliff04_com`), como as faixas do paredão. Cada barranco fica
  inteiro numa só (pelo patamar dele).
- **No relevo**: o conjunto de chunks leva o desenho por vértice
  (`chunk.townPaint`, `chunkTownPaint`), e o `terrainGeometry` põe as
  camadas dele por cima das do bioma e a rocha dele na encosta (a encosta
  por pixel da 066).
- **Camadas novas** (`terrainLayers.js`): `lgpe-town-cliff`,
  `lgpe-wall-rock` e `lgpe-wall-soil`. As texturas foram para
  `public/assets/vegetation/lgpe/textures/` e para a lista do
  `pack-lgpe.js`. Para caber no limite de camadas, saiu a `lgpe-rock` (a
  rocha da floresta), que nenhum bioma usava. O asfalto e as rochas novas
  repetem no tamanho do original vezes a escala da cidade
  (`TERRAIN_LOOK.COLOR_LAYER_SIZES`).

**Escolher as texturas no lab** (pedido do usuário): pasta "Texturas" do
painel, com uma lista das camadas de cor do relevo para cada letra do chão
(grama, terra batida, asfalto, pedras de pisar), para o barranco dos
degraus e para cada rocha da montanha. Cada mudança refaz o mundo. O lab
troca o `paint` do layout direto, e o "Copiar valores do chão" leva ele
junto. Para isso o layout preparado guarda a letra de cada célula, e a
camada dela é lida na hora de desenhar (`chunkTownPaint`).

**Escolhas do usuário no lab** (aplicadas): degraus mais altos, com
barranco largo (quase rampa) e sem inclinação no topo (`GROUND.terraces`).
Os barrancos dos degraus e os da montanha ficam de terra de trilha
(`lgpe-trail-soil`) no lugar das rochas do original. Com o barranco largo
apareceu um erro: a conta que centraliza o degrau na divisa só valia com o
barranco estreito, e com ele largo todos os platôs subiam um pedaço do
degrau. Agora a subida fica centrada na divisa, na largura do barranco dos
biomas (`cliffBand`, de `terraces.js`), com qualquer valor.

**Pedras de pisar com fundo preto**: a textura delas tem transparência (no
original são quadrados por cima do chão), mas o chão só lia a cor, e o
transparente vinha preto. Agora uma camada pode ter uma camada de baixo
(`TERRAIN_LOOK.COLOR_LAYER_UNDER`): onde ela é transparente, o shader do
chão mostra a de baixo (`coveredLayerAt`). As pedras ficam sobre a terra
batida.

**O que falta na cidade** (listado com o usuário, por grupos): 1. chão
(acabamento); 2. prédios; 3. cercas e limites; 4. árvores e natureza;
5. objetos de rua; 6. funcionamento no jogo (colisão, navegação, passos,
música); 7. levar para o jogo. A correção do asfalto (borda nítida e a
mistura das duas texturas do original) fica para a revisão final da
feature.

**Item 1, o acabamento do chão** (menos o asfalto):

- **A água do lago, com o material e a lógica da água do mundo**: o lago
  (`~`) tem a superfície da água abaixo do chão (`GROUND.lakeWater`) e o
  fundo mais abaixo (`lakeDepth`), os dois do original vezes a escala da
  cidade. A profundidade é a superfície menos o chão, a mesma regra dos
  lagos e rios (`fixedTownWaterDepthAt`), e entra nas consultas do nível
  (`levelTerrainWaterDepthAt`, `levelWaterSurfaceAt`). Com isso valem a
  barreira de quem não alcança o fundo, a lentidão do raso, os passos e a
  marolinha, os respingos, a pokébola que afunda e o som de fundo da água.
  O pathfinding desvia da água funda dele como desvia da dos lagos. O
  desenho é uma grade na superfície no material dos rios
  (`TownLakeView`/`buildTownLakeWaterGeometry`, no `FixedTownView`), com
  a profundidade de cada ponto pelo relevo (o material recorta onde o
  chão passa da água e faz a onda da margem).
- **A borda de pedra** (`viridian-lake-rim`, o `block002_00` do mapa, no
  `pack-lgpe.js`): a bacia de pedra, com o topo rente ao chão. Vai como
  enfeite, sem colisão; quem barra é a água funda. Os objetos da cidade
  montada à mão ficam em `props` no layout (o modelo, o meio da base e a
  base a partir do chão), entram nos blocos de sólidos
  (`fixedTownSolidsIn`, `buildings`) e são desenhados como os objetos das
  cidades. A beira do lago desce quase reta na divisa das células
  (`cityLayoutLakeAt`), onde fica a parede da bacia.
- **As manchas de terra** (`m` no chão, camada `lgpe-patch-soil`, o
  `soil12_com`): os remendos com máscara do original
  (`road016_1_00_blend*`) em volta das pedras de pisar, na frente do
  ginásio, na saída da Rota 22 e na rua rebaixada do sul. Saíram pelo
  extrator e entraram no lugar da grama das rotas de campo, que nenhum
  bioma usava. Dá para escolher a textura no painel.
- **Ondulação do chão** (`GROUND.swell`, separada da inclinação dos
  degraus): o topo dos platôs nunca fica plano de todo (090), mesmo com a
  inclinação em zero.
- **O piso da entrada do Pokécenter** fica para o item 2: no original ele
  é parte do nó do prédio (`bldg_pc_002/enter_floor_pc_002`) e entra junto
  com o Pokécenter.

**Item 2, os prédios:**

- **Quais modelos**: o Pokécenter, a loja e o ginásio de Viridian são os
  mesmos de Pewter que o jogo já usa (mesmo tamanho, mesmas texturas):
  entram os `pokecenter`, `poke-mart` e `gym` do pacote. Só a casa é nova
  (`viridian-house`, no `pack-lgpe.js`). As duas casas do mapa são iguais,
  então é uma casa só, posta duas vezes.
- **As portas**: em Viridian o vão escuro das portas fica num nó à parte
  (`town002_00_doorway`), fora dos prédios. O conversor pega o pedaço desse
  nó que fica debaixo da casa (`doorways`) e encaixa a porta
  (`town002_door01`) nele, como nos outros prédios. O manifesto guarda a
  `origin` da casa (`keepOrigin`), que é onde ela ficava no original.
- **No layout** (`props`, com `kind: 'building'`): cada prédio fica onde
  ficava no original, com a porta para o sul. Sem `y`, a base vai para o
  chão do layout debaixo dele, no ponto mais baixo da pegada (como o `put`
  das cidades procedurais). Isso acontece quando o bloco de sólidos é
  montado (`fixedTownSolidsIn` com o relevo do bloco), porque lá o chão já
  tem a ondulação. O ginásio fica no patamar do nordeste.
- **O chão debaixo deles**: as células debaixo de cada prédio ficam no
  nível da base dele. A casa do norte estava sobre células de degrau
  (copiadas da vizinha no extrator, porque debaixo do prédio não há chão),
  e atrás do ginásio subia um degrau duplo encostado na parede. As duas
  foram acertadas à mão no layout.
- **Colisão, pegada e porta**: os prédios colidem pelo casco do modelo e
  têm a pegada da caixa dele (navegação e vegetação), como os das cidades
  procedurais. Como o Pokécenter e a loja são os modelos de sempre, as
  portas deles já dão nas salas genéricas da 068. As salas de Viridian
  (`t002pc01`, `t002fs01`) ficam para depois.
- **A view carrega os objetos dos layouts**: ela só carregava os modelos
  que os biomas usam (`usedLgpeIds`), então a borda de pedra do lago (item
  1) não aparecia. Agora entram os `props` dos layouts também.
- **A escala**: os prédios saem no tamanho da cidade (o mesmo do chão do
  layout). A escala em relação ao treinador (as opções no começo do doc)
  o usuário decide depois de ver no lab.

**O chão verde e a beira da rua (depois do teste dos prédios):** o
usuário comparou com o Let's Go. O chão da cidade é verde, e as ruas têm
uma borda marrom com cara de guia.

- **Por que a cidade saía de terra**: nos lotes, o canal vermelho da cor
  por vértice do original fica cheio, e o extrator lia isso como terra.
  Mas o shader de mistura do Let's Go só mostra a camada de cima onde a
  máscara deixa (`BlendTex`, a `glassmask01_com`, lida no terceiro UV). No
  miolo do lote a máscara é grama; só na beira ela abre para a terra. O
  extrator (`scripts/lgpe/city-layout.js`) passou a fazer essa conta, e a
  grade `ground` saiu de novo: só a terra virou grama (nenhuma edição à
  mão se perdeu). A terra batida ficou nas manchas, nas pedras de pisar e
  em poucos pontos.
- **A beira da rua no original**: o chão é plano, e a guia é só desenho.
  São duas faixas estreitas na divisa (`GROUND.curb.width`, mais finas que
  a célula), lidas nas máscaras do original pela distância até a beira.
  Do lado do lote, terra na beira, com a grama entrando em franja e um tom
  quente. Do lado da rua, um fio de terra e a linha clara da guia
  (`asphaltmask01_area02`).
- **Como ficou**: a rua (`road` no layout, a letra `a`) é desenhada por
  pixel. Por vértice vai a distância com sinal até a beira
  (`cityLayoutRoadDistanceAt`, `chunkTownPaint` → `curb`), que é exata nas
  beiras retas e interpola sem erro entre os vértices. No shader do relevo,
  a rua sai da mistura por vértice e entra de um lado da beira, com a troca
  num pixel (a borda nítida que estava na revisão final). As duas máscaras
  pintam a faixa de cada lado, e a coordenada ao longo da beira é a soma de
  x e z (`GROUND.curb.along`). A borda de terra tem textura própria
  (`paint.curb`).
- **Limite de atributos**: a GPU aceita 16 atributos por vértice, e o
  relevo já usava 14. A beira cabe num vec4 só (`groundCurb`): as camadas
  da rua e da terra vão num número só (`packCurbLayers`), porque são as
  mesmas no chunk inteiro. A compilação do shader foi conferida na GPU, sem
  erro.
- **No lab**: a pasta "Beira da rua (guia)" tem a largura da faixa e a
  repetição da máscara, e "Texturas" ganhou a borda de terra da rua. Os
  dois entram no "Copiar valores do chão".

**A escala dos prédios**: o usuário viu no lab e aprovou o tamanho da
cidade (o mesmo do chão do layout). Fica assim.

**Item 3, cercas e limites:**

- **Peça por peça**: o nosso degrau é mais alto que o do original, e a
  ondulação desloca um pouco o chão do layout, e o desvio cresce ao longo
  de uma peça comprida. Um modelo inteiro com a cerca
  ou as moitas do mapa flutuaria numa ponta. Por isso sai um **kit** do
  mapa (`pack-lgpe.js`), e cada peça é posta e assentada sozinha:
  - **a cerca** (`fence_01_002_00`, a cerca de rota): um módulo por
    comprimento de trilho, de poste a poste, com os postes do começo e do
    meio (`viridian-fence-3`, `-2`, `-1`, `-2-4`), e o poste da ponta
    (`viridian-fence-post`). O conversor ganhou `crop`, que recorta uma
    janela do nó;
  - **as cercas-vivas** (`town002_00_tree08`): o bloco, o duplo e o
    comprido, como no mapa (`viridian-hedge`, `-2`, `-4`). Os trechos
    compridos não se separam em blocos com segurança. O conversor ganhou
    `objectAt`, que escolhe o objeto que cobre um ponto, juntando as folhas
    soltas;
  - **a moita redonda** (`town002_00_tree05`): uma só (`viridian-bush`),
    posta em cada miolo do mapa no tamanho dele. São 28 (o levantamento
    contava 20: as grudadas pareciam uma).
- **Onde cada peça fica**: o `scripts/lgpe/city-props.js` lê o mapa e
  imprime os `props` do layout. A cerca sai com um módulo por trilho,
  girado pelo eixo, e um poste em cada ponta que nenhum módulo cobre. As
  cercas-vivas saem uma por grupo de folhas. As moitas saem uma por miolo,
  pela `origin` de cada peça do kit. São 27 módulos, 4 postes, 9
  cercas-vivas e 28 moitas.
- **No jogo**: são objetos de rua (`street-prop`), com o casco do modelo e
  a pegada (navegação e vegetação). A cerca e as cercas-vivas assentam no
  ponto mais baixo da pegada. As moitas assentam pelo meio
  (`rest: 'center'`): a do barranco afunda do lado de cima, em vez de
  descer até o pé dele. O tamanho de cada peça é o da cidade vezes o dela
  (`scale`).
- **O jardim do noroeste**: no original a cerca fica no pé do degrau, e o
  nosso barranco largo a deixaria em cima dele. O degrau recuou uma célula
  da cerca (a borda oeste e a sul do jardim, e a faixa ao norte da cerca de
  cima), e cada trecho de cerca fica num nível só.

**Item 4, árvores e natureza:**

- **O kit** (`pack-lgpe.js`, um exemplar solto de cada tipo do mapa, por
  `objectAt`; `objectMargin` quando a folga padrão junta vizinhos):
  - **árvores**: as redondas 1 e 2 (`tree001`, `tree002`), as pontudas 1
    e 2 (`tree004`, `tree005`, a mesma forma com outra folha) e a pequena
    (`tree007`) — `viridian-tree-a` a `-e`;
  - **pedrinhas**: a grande e a pequena (`viridian-rock`, `-small`);
  - **mato e grama**: o mato alto (`grass01`, `viridian-tall-grass`), a
    mancha de tufos (`grass05`, `viridian-tufts`), a touceira baixa
    (`grass06`, `viridian-grass-clump`) e os raminhos rentes ao chão
    (`grass03`, `viridian-sprigs`);
  - **flores**: as três manchas do mapa (`grass02`, `viridian-flowers`,
    `-b`, `-c`).
- **Onde cada peça fica** (`scripts/lgpe/city-props.js`, agora lido de um
  arquivo por cidade, `scripts/lgpe/city-props/viridian.json`): cada grupo
  acha as cópias de um de dois jeitos.
  - **Por assinatura** (`core`): uma peça que aparece uma vez em cada
    cópia (o tronco da árvore, o miolo da moita, a primeira folha do
    mato), em qualquer tamanho. Com os lados trocados, a cópia vem girada
    um quarto de volta. Onde a peça se repete dentro da cópia (as duas
    faces do tronco da pontuda, as duas folhas do raminho), `merge` junta
    as que ficam perto.
  - **Por grupo de peças** (`objects`): o formato do kit mais perto, ou,
    nas pedrinhas, a altura mais perto, no tamanho dela.

  A cerca, as cercas-vivas e as moitas do item 3 passaram para o mesmo
  arquivo e saem iguais.
- **A mata grande do leste** (`tree003`): as árvores vêm grudadas num
  bloco só e não dá para separar uma. O tronco tem a proporção do da
  redonda 2, maior, e a copa usa o mesmo material. Então entra a
  `viridian-tree-b` no tamanho do tronco de cada uma.
- **Contagem**: 54 árvores, 14 pedrinhas, 292 touceiras de mato alto, 22
  manchas de tufos (o levantamento contava só as de tamanho cheio), 12
  touceiras baixas, 23 raminhos e 5 manchas de flores. Com a cerca e as
  cercas-vivas, o layout tem 490 peças.
- **No jogo**: as árvores e as pedrinhas são objetos de rua, com o casco
  do modelo (o tronco, na árvore). A pegada delas é um círculo do alcance
  do casco, porque não têm caixa no chão. O mato, os tufos, os raminhos e
  as flores são enfeites, sem colisão. Todos assentam pelo meio
  (`rest: 'center'`): o enfeite também assenta no chão quando não tem `y`.
  As pedrinhas ficam na nossa montanha, que é mais alta que o paredão.
- **Ficou de fora**: os raminhos irregulares (`grass04`, sem cópias
  repetidas) e a grama com vento (`grass07`, o efeito `FieldGrassShader05`
  que também ficou de fora em Pallet).

**Ajuste do item 4 (pedido do usuário): a vegetação do mundo.** Depois
de ver o item 4, o usuário decidiu:

- **Grama e flores**: a grama em fios e as flores do mundo procedural, só
  elas, no lugar do mato, dos tufos, dos raminhos e das flores do Let's
  Go.
- **Árvores**: as do mundo (já otimizadas), no lugar das redondas do Let's
  Go.
- **O foco é o miolo da cidade** (layout, prédios). Os platôs e as
  montanhas não precisam ser fiéis ao original: podem se ajustar e se
  integrar ao mundo procedural.

Como ficou:

- **O bioma da cidade** (vale também para as cidades procedurais; era a
  proposta pendente do jardim): as árvores dele passam a ser as folhosas
  dos pacotes com as folhas do Let's Go (`usn-normaltree-*`, as da
  planície). Ele ganha a grama em fios da planície, em manchas.
- **Na Viridian montada à mão** (`FIRST_TOWN.GROWS`): só a grama em fios e
  as flores nascem, e só no gramado (`lawn` no layout, a letra `g`). Fora
  dele (as ruas, a terra, as pedras de pisar) e no lago, não nascem
  (`chunkTownBareOpen` → `chunk.bareOpen`; o `trailAt` olha o tipo). O
  resto (árvores, moitas, tufos e pedras sorteados) segue sem nascer na
  cidade. A grama e as flores já desviam das pegadas dos prédios, cercas
  e árvores.
- **As árvores** (`trees` no layout): o meio do tronco de cada árvore do
  original e o tamanho dela (a mata grande do leste maior;
  `city-props.js` com `spots`). No jogo são a folhosa do bioma da cidade
  (`TREE_KIND`), com o modelo e o giro sorteados pelo lugar, no tamanho
  médio do sorteio do mundo vezes o do ponto. Entram nos sólidos do bloco
  como as do mundo: a mesma pegada (o tronco), a mesma base
  (`groundedBaseY`) e o mesmo desenho (vento, sumir perto da câmera).
- **Saíram**: o kit da natureza do Let's Go (as árvores, as pedrinhas, o
  mato, os tufos, os raminhos e as flores) do conversor, do pacote e do
  layout. As pedrinhas não voltam: a montanha fica com o que o mundo
  puser.

**Item 5, objetos de rua:**

- **O kit** (`pack-lgpe.js`, do mapa de Viridian): o poste
  (`viridian-lamp`, `lamp_town002`), o banco (`viridian-bench`,
  `obj002_01`), o vaso (`viridian-pot`, um dos três da frente da casa do
  sul) e a floreira comprida (`viridian-pot-long`, o quarto vaso, esticado,
  ao lado do Pokécenter). Entram também as quatro placas, cada uma única no
  mapa: a da cidade (`viridian-sign-town`), a do ginásio
  (`viridian-sign-gym`), a da casa do sul (`viridian-sign`) e a da rua de
  baixo (`viridian-sign-glass`, com vidro). O canteiro de tronco já estava
  no pacote (`log-flower-bed`). As cópias de cada objeto no mapa estão
  viradas para o mesmo lado (a frente do banco dá para o sul), então o kit
  sai sem giro.
- **Onde cada peça fica** (`city-props/viridian.json`, grupos por objeto):
  7 postes, 2 bancos, o canteiro, 3 vasos, a floreira e as 4 placas. Todos
  são objetos de rua (`street-prop`), com o casco do modelo e a pegada da
  caixa dele (`colliders.js`), e assentam no ponto mais baixo da pegada. O
  poste da rua de baixo e a placa de vidro descem junto com ela, e o poste
  do patamar do ginásio fica em cima dele.
- **A luz dos postes à noite**: o conversor marca os materiais que acendem
  (`glow` no manifesto: o vidro do poste de Viridian e o do poste de
  Pewter, o das cidades procedurais). O material toon deles
  (`createToonMaterial`, `glow`) vai da luz da cena para a cor da textura
  vezes a da luz (`LGPE.LAMP_GLOW`), conforme a noite chega
  (`setNightGlow`, pelas estrelas do ciclo no `DayNightView`, sem o clima).
  Não é uma luz de verdade: o chão em volta não clareia. O F2 (Let's Go
  (toon)) tem a cor e a força. O poste de Cerulean acende por outra
  textura (`EmissionMap`) e ficou de fora.
- **Pacote**: como nas outras voltas, o conversor roda numa pasta à parte, e
  só as entradas novas (e o `glow` do poste de Pewter) vão para o
  manifesto do jogo. Rodar tudo de novo mudaria os props antigos (a `layer`
  do chão, que eles não têm de propósito).

**Item 6, funcionamento no jogo:**

- **O que já vinha pronto** (revisto com o usuário, sem mudança): a
  colisão e a pegada de prédios, cercas, moitas, árvores e objetos de rua
  (itens 2 a 5); a navegação, pelas pegadas e pela altura dos platôs e
  rampas (a mesma regra dos degraus dos biomas), com o lago fundo
  bloqueando; a música e o som ambiente da cidade (a área de Viridian fica
  no bioma cidade); as portas do Pokécenter e da loja (as salas genéricas
  da 068).
- **O passo no calçamento** foi tentado (um passo de pedra de fora, no
  asfalto e nas pedras de pisar) e desfeito: o usuário não gostou. O passo
  segue o do relevo em toda a cidade.
- **Teste de passos que falhava**: o da água usava a origem, onde agora
  fica a cidade fixa (a água vinha dela). Passou para um ponto longe dela.

**Item 7, Viridian no jogo** (a montada à mão no lugar do modelo inteiro):

- **Ligada no jogo**: `CITIES.FIRST_TOWN.LAYOUT` é `'viridian'` e o `MAP`
  saiu do config. O relevo da origem mudou, então o
  `TERRAIN.GENERATION_VERSION` subiu.
- **Saiu o caminho do mapa inteiro** (só Viridian usava): em
  `fixedTown.js`, a cidade fixa é sempre a montada à mão (sem `mapId`,
  `colliders` e as caixas da colisão, `boxes`). Saíram as caixas no corpo
  do relevo (`colliders.js`), o relevo escondido debaixo do modelo
  (`chunk.hiddenRect`, `terrainGeometry.js`), a cidade fixa no
  `townMapAt` (a água e o passo leem o mapa só no lugar à parte,
  `activeTownMapAt`) e o modelo no `FixedTownView` (fica só o lago). O
  F2 da Viridian (o tamanho) passou a valer para a montada à mão.
- **Saíram os arquivos do modelo**: o `viridian-city.glb`, as texturas que
  só ele usava, as entradas dele no manifesto dos mapas, no
  `townMapColliders.json`, no `town-maps.json`, no `town-map-colliders.js`
  e no `core/data/townMaps/`. Pallet segue igual. As opções do
  `town-map-colliders.js` que só Viridian usava ficaram, para as próximas
  cidades copiadas.
- **Os scripts da cidade montada à mão** liam a origem do mapa no
  manifesto do modelo. Agora ela vai direto: `origin` no
  `city-props/viridian.json` e `--origin` no `city-layout.js`. A saída dos
  dois não mudou.
- **Laboratório de golpes**: o chão dele é próprio, mas a água vem do mundo
  em volta da origem, e o lago de Viridian caía na área. A página tira a
  cidade fixa enquanto está aberta (`tirarCidadeFixa`) e põe de volta ao
  sair.
- **Testes**: os do caminho do mapa saíram. Os que usavam pontos perto da
  origem passaram para lugares livres da cidade (o save, na chegada). A
  regra da encosta que o personagem sobe deixa de fora a faixa de mistura
  da cidade (o barranco da rua rebaixada da saída sul segue um pouco por
  ela). A água da cidade fixa é testada no lago do layout.
- **A conferir no jogo pelo usuário**: as estradas da seed nas três saídas
  e a cidade inteira. O desempenho na Intel UHD fica para o fim da feature.

**Viridian no jogo: primeiros ajustes** (pedidos do usuário, já direto
no jogo, sem passar pelo lab):

- **Flores nos vasos e no canteiro**: os modelos do Let's Go (os vasos, a
  floreira comprida e o canteiro de tronco) vêm só com a terra, e o
  sorteio da vegetação não entra na pegada deles. Agora cada um ganha as
  flores do bioma (as mesmas do gramado), numa grade em cima da terra
  (`core/town/plantings.js`: a terra, a altura dela, o passo da grade e o
  tamanho da flor por modelo, em `PLANTINGS`). As flores são enfeites, sem
  colisão nem pegada, e entram junto dos objetos do bloco
  (`withPlantings`, no `terrainChunkSet`). Vale onde o modelo for posto:
  os canteiros das praças procedurais também florescem.
- **O canteiro de tronco colide só na moldura**: como a fonte, mas
  retangular. O colisor ganhou `frame` (o vão de dentro e a altura,
  `FRAMES` no `scripts/lgpe/colliders.js`), que a física monta em quatro
  caixas em volta (`frameBoxesOf`, `core/physics/colliders.js`). Dentro,
  nada: dá para entrar e pular lá dentro. A pegada (navegação) segue
  sendo o canteiro inteiro: a IA dá a volta.
- **Menos árvores**: primeiro metade, depois o usuário pediu 15. O
  `trees` do layout ficou com as mais espalhadas do original (escolhidas
  uma a uma, cada uma a mais longe das já escolhidas). O `city-props.js`
  segue imprimindo todas: o corte é à mão no layout.
- **Luz de verdade nos postes à noite, sem sombra**
  (`view/vegetation/StreetLampLights.jsx`): um número fixo de luzes
  pontuais (`LGPE.LAMP_LIGHT`) vai para os postes mais perto de quem o
  jogador controla (`nearestLampLights`, refeito de tempos em tempos), no
  meio do vidro de cada um (as partes que acendem do modelo, `part.glow`).
  A força segue a noite do vidro (`uNightGlow`). Na primeira volta eram
  poucas luzes, nos postes mais perto da câmera, e o usuário viu os postes
  acendendo só ao olhar ou chegar perto. Agora as luzes bastam para todos
  os postes de Viridian, a câmera girando não troca nada, e cada luz fica
  no poste dela enquanto ele segue entre os mais perto
  (`assignLampSlots`); a que troca de poste apaga e acende aos poucos. Nas
  cidades procedurais grandes, com mais postes que luzes, os de longe
  ficam só com o vidro aceso. As luzes ficam sempre na cena, apagadas
  de dia: mudar o número de luzes recompilaria os materiais quando a
  noite chega. Vale para todo poste que acende (o de Viridian e o das
  cidades procedurais). No F2 (Let's Go (toon)): cor, força, alcance e
  queda. O custo na Intel UHD entra na medição do fim da feature (se
  pesar, o número de luzes vira opção do menu "Gráficos").
- **O lago saiu de Viridian** (decisão do usuário, depois de ver a água
  vazando para a rua de baixo, dar para pular dentro e a parede do sul
  sumir de frente): as células dele viraram chão da cidade (grama), e a
  borda de pedra (`viridian-lake-rim`) saiu do layout, do conversor, do
  manifesto e dos arquivos. O lago das cidades montadas à mão segue no
  código (`~` no layout, `fixedTown.lake`, `TownLakeView`), para outra
  cidade que precisar; o teste usa uma cópia de Viridian com lago
  (`FIRST_TOWN.LAYOUT` aceita também o layout em si). O `city-layout.js`
  ainda imprime o `~` do original: tirar à mão se rodar de novo.

**O que a cidade original não tem: o laboratório e o campo de treino**
(pedido do usuário, no jogo):

- **Onde**: nas partes que pouco afetam o miolo — o usuário apontou o
  platô do leste (no original, só mata) e o paredão do oeste, que não
  precisam ser fiéis. Os dois foram para o **platô do leste**, um degrau
  acima do chão da cidade: o oeste é estreito na grade e teria que ser
  cavado na montanha, e o leste já é plano.
- **A rampa**: a rua leste–oeste (a da loja) termina no pé do platô; uma
  rampa nova (`ramps`) continua dela e sobe até ele. Mudou o relevo, então o
  `TERRAIN.GENERATION_VERSION` subiu.
- **O laboratório**: o `house-lab` (o de Pallet, que estava no pacote desde
  a 056), um prédio do layout (`props`), no norte do platô e de frente para
  o sul. Porta fechada (não tem sala).
- **O campo de treino**: `trainingField` no layout (o meio dele e o lado da
  entrada, `facing`). Os bonecos são os do campo das cidades procedurais
  (`town.trainingField`: modelo, tamanho, giro, grade e espaçamento, os
  mesmos números), postos pelo `fixedTown.js` (`layoutDummies`, a mesma
  conta do `placeTrainingField`) e virados para a entrada. Entram nos
  sólidos do bloco depois dos objetos do layout (`dummies`), e daí viram
  bonecos de treino como os das cidades procedurais (o chunk carregado,
  `carregarBonecosDoChunk`). A cerca é a de Viridian (o kit da cerca do
  item 3, em `props`), com a entrada no lado oeste, de frente para a rampa.
- **O chão**: terra batida (`t` no `ground`) dentro do campo e nos caminhos
  da rampa até a entrada do campo e até a porta do laboratório. A grama em
  fios não nasce nela (só no gramado).
- **Uma árvore saiu do lugar**: a da mata do leste que caía dentro do campo
  foi para a beira leste do platô (seguem 15).
- **F2**: o "Campo de treino" do bioma da cidade muda os bonecos daqui
  também (mesma config); a cerca e o chão são do layout.

**Depois do teste (pedidos do usuário):**

- **A porta do laboratório**: o `house-lab` saía sem o vão escuro e sem a
  porta — em Pallet o vão fica num nó à parte (`inndoor`), fora do prédio,
  como em Viridian. O conversor ganhou `doorways` e `door`
  (`town001_door02`, a porta do laboratório no mapa) nessa entrada. Só ela
  foi convertida de novo (numa pasta à parte), e o modelo, a textura nova
  da porta e a entrada do manifesto foram para o jogo. A caixa da colisão
  não mudou.
- **Postes no platô do leste**: três postes de Viridian, no alto da rampa,
  ao lado da porta do laboratório e na entrada do campo.
- **Platôs mais naturais**: fora do miolo, as bordas retas do original
  ficaram recortadas: o `+` do nordeste (a borda de baixo e dentes na de
  cima), o platô do leste (a borda oeste e a sul, que também deu mais
  folga ao campo), o canto oeste do patamar do ginásio, arredondado, e a
  faixa norte. Prédios, cercas e rampas seguem em células de um nível só.
- **Sem a montanha do oeste**: o paredão (`#`) virou chão da cidade, com
  dois morrinhos baixos (um degrau) nos cantos, o do noroeste emendado na
  faixa norte, e quatro árvores no lugar. A rua rebaixada do sul termina
  num degrau na ponta oeste, onde antes encostava no paredão. O código da
  montanha fica (`GROUND.mountain`, `paint.mountain`) para outra cidade
  que precisar. O relevo mudou: `TERRAIN.GENERATION_VERSION` subiu.

**Barrancos suaves** (pedido do usuário, depois das bordas recortadas):

- **Como**: antes do degrau, os níveis da grade são borrados
  (`GROUND.soften.radius`, em células: cada célula mistura as vizinhas,
  com peso que cai com a distância). O degrau continua centrado na divisa,
  mas o barranco fica mais largo e a borda dele arredonda, sem seguir a
  grade (`softLevelsOf`, `core/town/cityLayout.js`).
- **Onde não**: as células debaixo dos objetos do layout que assentam no
  chão (prédios, cercas, postes, placas) e até `soften.keep` células em
  volta ficam no nível delas, e o barranco vai para o outro lado
  (`pinnedCellsOf`). O campo de treino inteiro também (`size` no
  `trainingField`, o lado da cerca). Ali o chão é o do degrau cru.
- **No lab**: "Suavizar barrancos" e "Folga presa nos objetos", na pasta
  dos degraus. O relevo mudou: `TERRAIN.GENERATION_VERSION` subiu.

**O que ainda falta, grupo por grupo** (na ordem sugerida; as posições e
os nós estão no levantamento de Viridian, acima; os objetos entram em
`props` no layout):

2. **Prédios**: feito (acima). Falta a decisão da escala dos prédios em
   relação ao treinador (as opções no começo do doc), depois do teste no
   lab.
3. **Cercas e limites**: feito (acima).
4. **Árvores e natureza**: feito (acima).
5. **Objetos de rua**: feito (acima).
6. **Funcionamento no jogo**: feito (acima).
7. **Levar para o jogo**: feito (acima). O desempenho na Intel UHD fica
   para o fim da feature.

**Fica para a revisão final da feature**: a mistura das duas texturas do
asfalto (`asphalt01_area02`, `asphalt02_area02`). A borda nítida já está
feita, com a beira da rua.

**Ficou para depois** (fora desta volta): as portas abrindo e as salas
(a do laboratório também) e a ligação a pé com Pallet pela Rota 1. O
campo de treino de Viridian entrou (acima).

---

## Só Viridian no mundo (fim da revisão das cidades)

**Decisões do usuário** (Viridian finalizada; Pallet fica para o tutorial,
076, no outro marco):

- **Nesta beta, duas cidades só**: Pallet, a cidade do tutorial (o lugar à
  parte, ainda pelo F2), e Viridian, a cidade inicial, fixa na origem. As
  cidades procedurais saem **por enquanto**.
- **Sem as estradas** que ligavam uma cidade a outra.
- **O nível das selvagens** segue quase o mesmo: perto da cidade inicial
  elas são mais fracas e, com a distância, vão ficando mais fortes até o
  teto da versão.

**Como ficou** (interruptores no config, o código das procedurais fica
para quando elas voltarem):

- **`CITIES.ONLY_FIRST`**: o mundo só tem a primeira cidade
  (`citySites.js`): a mais próxima de qualquer ponto é ela
  (`nearestCity`, `nearestCities`). Com isso o bioma da cidade só existe
  em volta de Viridian, e não há lotes, ruas nem prédios procedurais em
  lugar nenhum. O "Ir para a cidade" do F2 só lista Viridian.
- **`ROADS.ENABLED`**: sem estradas (`terrainHeight.js`: `roads` é
  `null`), nem o vau delas nos rios.
- **O nível** (`wildLevel.js`, `levelFromStart`): com só a cidade inicial,
  o nível base é o do começo (`LEVEL.FIRST_CITY`) até a borda dela e sobe
  em linha reta com a distância, até o teto da versão
  (`EXPERIENCE.LEVEL_CAP`) a `LEVEL.CAP_DISTANCE` m da borda; além, o
  teto. A variação de cada indivíduo segue a mesma (`SPREAD`). Com as
  procedurais ligadas, volta a regra antiga (cada cidade com o seu nível,
  misturando no caminho).
- **Relevo**: as cidades e as estradas são parte da receita, então o
  `TERRAIN.GENERATION_VERSION` subiu.
- **Testes**: os das procedurais e das estradas ligam os interruptores
  neles (seguem valendo para quando voltarem); novos para a cidade única e
  o nível pela distância.
- **Wiki**: a regra do nível (página das selvagens) muda no fim da
  feature.

---

## Etapas

- [x] Bump `package.json` → `0.0.69` e doc.
- [x] Roadmap: 069 no Marco 2 (renumeração da antiga 069 em diante).
- [x] Conversor: os objetos dos detalhes; colisores.
- [x] Escala própria dos objetos de rua (+ testes).
- [x] Quintal das casas, hidrantes e árvores de rua (+ testes).
- [x] Praça: objetos e chão calçado (+ testes).
- [x] F2: pastas "Detalhes" e "Praça".
- [x] Avaliação do jardim.
- [x] Pallet: levantamento do mapa.
- [x] Pallet: cena à parte com o exterior, colisão, mar e F2 (+ testes).
- [x] Pallet: teste no jogo pelo usuário (revisão no tutorial, 076).
- [x] Viridian: levantamento do mapa.
- [x] Viridian: fixa no mundo procedural no ponto inicial, com relevo,
  colisão, estradas, água e F2 (+ testes).
- [x] Viridian: montada à mão — o lab-cidade e o chão do layout
  (degraus em platôs, rampas, paredão em montanha, lago) (+ testes).
- [x] Viridian: lab sem névoa; texturas do chão e dos barrancos do
  original (+ testes).
- [x] Viridian: escolher no lab a textura de cada parte do chão.
- [x] Viridian: valores do usuário no lab; degrau centrado com qualquer
  barranco; pedras de pisar transparentes sobre a terra (+ testes).
- [x] Viridian: item 1 do chão — a água do lago (material e lógica da
  água do mundo), a borda de pedra, as manchas de terra e a ondulação
  (+ testes).
- [x] Viridian: teste do chão no lab pelo usuário e ajustes.
- [x] ~~Revisão final: a mistura das duas texturas do asfalto.~~
  Desconsiderada pelo usuário no fechamento.
- [x] Viridian 2: prédios e portas no layout, o chão debaixo deles e a
  view carregando os objetos dos layouts (+ testes).
- [x] Viridian: o chão verde (extrator com a máscara do original) e a
  beira da rua por pixel, com a borda de terra e a guia (+ testes).
- [x] Viridian 2: teste dos prédios e da beira da rua no lab pelo usuário;
  a escala dos prédios (aprovada como está).
- [x] Viridian 3: cercas, cercas-vivas e moitas (o kit, o
  `city-props.js` e o jardim recuado da cerca) (+ testes).
- [x] Viridian 3: teste no lab pelo usuário.
- [x] Viridian 4: árvores, pedrinhas do paredão, mato, tufos e flores (o
  kit, o `city-props.js` por arquivo da cidade) (+ testes).
- [x] Viridian 4 (ajuste): a grama em fios e as flores do mundo no
  gramado, as árvores do mundo nos pontos do original; o bioma da cidade
  com as folhosas e a grama em fios (+ testes).
- [x] Viridian 4: teste no lab pelo usuário.
- [x] Viridian 5: postes, bancos, canteiro, vasos e placas; o vidro dos
  postes acende à noite (+ testes).
- [x] Viridian 5: teste no lab pelo usuário.
- [x] Viridian 6: revisão do funcionamento (colisão, navegação, música e
  som ambiente já prontos; o passo no calçamento tentado e desfeito).
- [x] Viridian 7: aplicar no jogo (o layout no lugar do modelo; o caminho
  e os arquivos do modelo inteiro saíram) (+ testes).
- [x] Teste no jogo pelo usuário e ajustes.
- [x] Ajustes no jogo: flores nos vasos e canteiros; o canteiro de tronco
  colidindo só na moldura; metade das árvores de Viridian (+ testes).
- [x] Ajustes no jogo: 15 árvores; a luz de verdade dos postes à noite,
  sem sombra; o lago fora de Viridian (+ testes).
- [x] Escala dos prédios: a da cidade, como está (decisão do usuário).
- [x] Jardim: as árvores e a grama do mundo (decisão do usuário, ajuste do
  item 4).
- [x] Viridian: o laboratório e o campo de treino no platô do leste, com
  a rampa da rua da loja e o chão de terra (+ testes).
- [x] Viridian: a porta do laboratório, postes no platô do leste, bordas
  dos platôs recortadas e o oeste sem a montanha (+ testes).
- [x] Viridian: barrancos suaves (o borrão dos níveis, preso nos
  objetos) (+ testes).
- [x] Viridian: teste do laboratório e do campo no jogo pelo usuário.
- [x] Só Viridian no mundo: sem as cidades procedurais e as estradas
  (interruptores no config) e o nível das selvagens pela distância da
  cidade inicial (+ testes).
- [x] ~~Desempenho na Intel UHD (cidade vs. fora dela).~~ Desconsiderado
  pelo usuário no fechamento.
- [x] Wiki: a cidade (só Viridian) e sem as estradas na página "O
  mundo"; o nível das selvagens pela distância; o campo de treino de
  Viridian.
- [x] Roadmap: 069 para "Já feito".
- [x] Gates: `npm test` inteiro, `npm run lint` e build. Dois testes
  pesados que já existiam (`chunkStreamingSystem`, `waterBodies`)
  estouravam o tempo padrão com a suíte em paralelo (o do streaming leva o
  mesmo tempo na 068): ganharam tempo próprio.

---

## Critérios de Conclusão

- [x] A cidade tem detalhe: quintais, praça, hidrantes e árvores de rua
  (nas procedurais, hoje desligadas); Viridian com o detalhe do original.
- [x] Prédios e objetos de rua em escalas que casam com o treinador (a
  escala da cidade, aprovada pelo usuário).
- [x] O jardim no estilo dos biomas revistos (as árvores e a grama do
  mundo).
- [x] ~~Desempenho na Intel UHD no nível de hoje.~~ Desconsiderado pelo
  usuário no fechamento.
- [x] `npm run build`, `npm run lint` e `npm test` passando.
- [x] Wiki atualizada.

---

## Fora de escopo

- **NPCs** na cidade.
- **Meio-fio e calçada** (uma faixa de chão própria entre a rua e o lote):
  pede mais uma camada de cor no chão.
- **Placa da cidade** na entrada das estradas.
- **Pokémon de enfeite** na cidade (a cidade não tem espécie).
