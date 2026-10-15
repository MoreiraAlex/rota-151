# 🚀 Versão 0.0.56 — Bioma cidade

## Resumo

Um bioma novo, a **cidade**: manchas pequenas e raras no mundo, com chão
quase plano, ruas calçadas em grade e quarteirões com prédios e objetos de
rua do Pokémon Let's Go — Pokécenter, loja, ginásio, casas, cercas, postes
e bancos.

Por enquanto a cidade **não tem funcionalidade**: os prédios são sólidos
(colidem e o pathfinding desvia), mas não abrem, não curam e não vendem.
Também não tem selvagens nem itens no chão; a vegetação é só de jardim.

> Esta feature era "Estruturas e Pokécenter". O usuário trocou o escopo na
> abertura: primeiro a cidade como bioma, sem funcionalidade. A cura e o
> reaparecimento no Pokécenter foram para o Marco 5 (ver "Fora de escopo").

Versão: `0.0.56` (`package.json`). Branch: `feature/056-bioma-cidade`.

> **Os números deste doc são fictícios (só ilustram).** O valor de verdade é
> o do campo citado (config ou dado do bioma).

---

## O que já existe (ponto de partida)

- **Registro de biomas** (`core/data/biomes/`, 047): uma pasta por bioma,
  molde em `_template/`. A ordem do registro é o índice nos pesos por
  vértice do chunk: bioma novo entra **no fim**, com
  `TERRAIN.GENERATION_VERSION` subindo junto.
- **Mapa de biomas** (`core/terrain/biomeMap.js`): disputa por clima e por
  manchas próprias do tamanho (`size`) do bioma; o menor fica por cima. Os
  escondidos estão em `BIOMES.HIDDEN`.
- **Relevo por bioma** (`relief`: `baseHeight`, `hillHeight`, `flatness`...)
  com mistura suave na fronteira (`terrainHeight.js`).
- **Trilhas** (`core/terrain/trails.js`): força por vértice no chunk; o
  relevo afunda nelas, o chão pinta e a vegetação não nasce nelas. É o
  modelo para as ruas.
- **Sólidos pela seed no core** (`core/vegetation/solidPlacement.js`, 049):
  pegada em círculos (`Footprint`), colisor por chunk e pathfinding
  (`footprintsIn`). Os colisores dos props do LGPE vêm de
  `scripts/lgpe/colliders.js` (`core/data/lgpeColliders.json`).
- **Conversor do Let's Go** (`scripts/lgpe/pack-lgpe.js`): tira props de
  mapas por nó, separa malhas fundidas (`splitObjects.js`), grava `.glb`,
  texturas e `manifest.json` em `public/assets/vegetation/lgpe/`.
- **Material toon** dos props do LGPE (052–054), com sombra e luz de borda
  por material.
- **Itens no mundo** (055) e **fruta na vegetação** saem dos campos
  `worldItems` e `forage` do bioma: bioma sem eles não tem nenhum.
- **Selvagens**: hoje nascem uma vez, em pontos fixos do nível de teste
  (`wildCreatureSpawnSystem`). O spawn por bioma é da 058.

---

## Decisões (com o usuário)

1. **A cidade é um bioma da seed**, com tamanho próprio e a mesma mistura
   de borda dos outros (não é mancha dentro da planície).
2. **Chão quase plano, só suavizado.** Relevo baixo e liso, sem aplainar de
   verdade: a pendência do chão plano no heightfield (080) fica para depois.
   Prédio em chão inclinado afunda a base no chão em vez de aplainar o
   terreno.
3. **Layout procedural**: grade de quarteirões pela seed, com ruas entre
   eles e prédios sorteados nos lotes (não é cópia de uma cidade de Kanto).
4. **Prédios e objetos**: Pokécenter, loja, ginásio, casas de Pallet e de
   Pewter, cercas, postes, placas e bancos.
5. **Sem selvagens e sem itens** na cidade; só vegetação de jardim
   (canteiros, flores, árvores de rua).
6. **Sem funcionalidade**: porta fechada, sem interior, sem interação.

---

## Busca no LGPE (levantada na abertura)

`LGPE-FieldMaps.7z` tem as cidades inteiras (`field/areaNN/townNNN_00`):
`town001` Pallet, `town002` Viridian, `town003` Pewter, `town004` Cerulean,
`town008` Fuchsia, `town009` Cinnabar (e outras). Os **prédios vêm em nós
próprios** (`bldg_pc`, `bldg_shop`, `bldg_gym`, `masaratown_house_*`,
`bldg_nibi_minka*`...), então saem um a um pelo caminho do nó, como os
props das rotas.

| Objeto | Nó (cidade) | Tamanho no original (L × A × P) |
|---|---|---|
| Pokécenter | `bldg_pc` (Pewter; igual em todas) | 5,2 × 3,7 × 4,1 m |
| Loja | `bldg_shop` (Pewter; igual em todas) | 4,5 × 2,7 × 3,0 m |
| Ginásio | `bldg_gym` (Pewter ou Viridian) | 7,1 × 4,0 × 4,3 m |
| Casa de Pallet (2 tipos) | `masaratown_house_house1`/`house2` (Pallet) | ~5 × 4,2 × 3,4 m |
| Casa de pedra | `bldg_nibi_minka01`/`02` (Pewter) | 5,0 × 3,3 × 3,0 m |
| Cerca de madeira | `fence01`… (Pallet, peça solta) | 2,4 × 0,8 m |
| Placa de casa | `signboard01_01` (Pallet) | 1,6 × 0,6 m |
| Placa da cidade | `signboard_town00N` | — |
| Poste | `buildmodel/streetlight01` (solto) ou `lamp01` (Pewter, fundido) | — |
| Banco | `benchi_1` (Pewter, fundido) / `bench01` (Cerulean) | — |
| Canteiro e flores | `kadan02` (Pewter), `town004_00_plant_flower` | — |

Texturas de chão para as ruas e calçadas: `asphalt01_area02`,
`roadtile01–04_area02`, `tile01_*_area03`, `tile02_*_area02`,
`roadstone01_com`.

**Pegadinhas:**
- Escala: o treinador do jogo é maior que o do Let's Go em relação aos
  prédios; os prédios ganham um fator de escala próprio (ajustável no F2).
- Postes e bancos de Pewter vêm fundidos numa malha só: separar com
  `splitObjects.js` e ficar com um (como as árvores da 052).
- As portas dos prédios são modelos à parte em `buildmodel/`
  (`combldg_pc_door01`, `combldg_shop_door01`, `combldg_gym_door01`):
  entram fechadas, só como desenho.

---

## Arquitetura (proposta)

### Dados do bioma (`core/data/biomes/city/`)

- `id: 'city'`, `size` pequeno (a cidade é a menor mancha, fica por cima) e
  clima ameno (perto da planície). Entra no **fim** do registro.
- `relief`: chão médio próximo da planície, `hillHeight` bem baixo,
  `roughness` zero e `flatness` alto — quase plano e liso, sem célula
  perfeitamente plana.
- `ground`: grama de jardim de base e calçamento nas ruas
  (`ground.colors` com as texturas do LGPE).
- `vegetation`: só jardim (flores, moitas, árvores de rua, poucas), longe
  das ruas e dos prédios.
- Sem `worldItems`, sem `forage`; `tags: ['urban']` (a 058 não põe
  selvagem em bioma sem espécie dele).
- Campo novo `town` com os números da grade e a tabela de prédios (o que
  sorteia com que peso, o recuo da rua, a escala) — molde no `_template`.

### Ruas e lotes (core, puro: `core/town/`)

- **Grade pela seed**: quarteirões de tamanho fixo
  (`town.blockSize`, ex. fictício 40 m) alinhados ao mundo, com um
  deslocamento e um giro sorteados por cidade; ruas de largura fixa
  entre eles.
- `streetAt(x, z)`: força da rua (0 a 1), no mesmo esquema das trilhas —
  vai por vértice no chunk (`chunk.streets`), o chão pinta, a vegetação
  não nasce e o relevo suaviza nela.
- Só vale onde o peso da cidade passa de um corte (`town.minWeight`): perto
  da borda as ruas somem aos poucos e o bioma vizinho entra.
- `lotsOfBlock(block)`: cada quarteirão vira lotes; cada lote sorteia um
  prédio da tabela (`town.buildings`, pesos) ou fica vazio (jardim).
  Pokécenter e ginásio são raros por cidade (no máximo um de cada por
  cidade, pelo quarteirão mais central).
- Determinístico: mesma seed e mesmo quarteirão, mesmos prédios.

### Prédios como sólidos

- Prédio é um tipo de sólido (`building`) no mesmo caminho das árvores e
  pedras: sai da seed com o chunk (`placeChunkSolids`), tem colisor e
  pegada.
- **Pegada retangular**: `Footprint` hoje é círculo; o prédio ganha uma
  caixa (`{ x, z, halfX, halfZ, yaw }`). O pathfinding e o teste de vizinho
  passam a aceitar os dois (ou a caixa vira uma fileira de círculos — a
  decidir na implementação pelo que mexer menos).
- **Colisor**: caixa (`cuboid`) do tamanho do prédio, em
  `core/physics/` — sem casco gerado.
- **Chão**: o prédio fica na altura do canto mais baixo do lote e a base
  desce (`town.foundationDepth`) para não sobrar vão — o terreno não é
  aplainado (080 fica para depois).
- Cercas, postes, placas e bancos: sólidos pequenos (círculo) no recuo
  entre o prédio e a rua, sorteados por lote.

### View

- Os prédios e objetos de rua usam o material toon dos props do LGPE e o
  mesmo instanciamento da vegetação (um prédio igual em vários lotes = uma
  malha instanciada).
- Texturas do calçamento entram nas camadas de chão
  (`view/terrain/terrainLayers.js`).
- F2: escala dos prédios, densidade de lotes vazios e cores do chão da
  cidade, com o "Copiar valores" de sempre.

### Conversor (`scripts/lgpe/pack-lgpe.js`)

- `MAP_PROPS` ganha os prédios e os objetos de rua (categoria `building` e
  `street`), tirados de `town001`, `town002` e `town003`; as portas vêm de
  `buildmodel/`.
- `colliders.js` não gera casco para prédio (a caixa sai do tamanho do
  `.glb`).

### Config

- `GAME_CONFIG.BIOMES.HIDDEN`: a cidade **não** entra (aparece no mundo).
- `GAME_CONFIG.TERRAIN.GENERATION_VERSION` sobe (bioma novo).
- Números da grade que não são do bioma (corte de suavização das ruas,
  folga do pathfinding em volta do prédio) em `GAME_CONFIG.TOWN`.

### Testes (regras, sem fixar valores)

- O bioma cidade aparece na seed, é a menor mancha e o registro continua
  com os índices antigos no lugar.
- Mesma seed, mesmos quarteirões, ruas e prédios.
- Nenhum prédio em cima de rua nem sobrepondo outro; nenhuma vegetação na
  rua nem dentro de prédio.
- Um Pokécenter, uma loja e um ginásio por cidade (a mesma de qualquer
  quarteirão dela); o resto, casas.
- O relevo da cidade não tem célula perfeitamente plana.
- Pathfinding contorna o prédio; o colisor bloqueia o treinador.
- Cidade sem itens no chão e sem fruta na vegetação.

---

## Etapas

- [x] Bump `package.json` → `0.0.56` e doc.
- [x] Roadmap: 056 vira "Bioma cidade"; cura e reaparecimento do
      Pokécenter para o Marco 5.
- [x] Revisão do doc pelo usuário.
- [x] Conversor: prédios e objetos de rua do LGPE; texturas do
      calçamento.
- [x] Bioma `city` (dados, `_template` com `town` e `coverage`, registro,
      `GENERATION_VERSION`) (+ testes).
- [x] Grade, ruas e lotes em `core/town/` (+ testes).
- [x] Prédios como sólidos: pegada, colisor e pathfinding (+ testes).
- [x] Chão: ruas no canal das trilhas e calçamento (+ testes).
- [x] View: prédios, objetos de rua e jardim; pasta "Cidade" no F2.
- [x] Teste no jogo pelo usuário e ajustes (ver "Ajustes depois do
      primeiro teste").
- [x] Desempenho na Intel UHD (cidade vs. fora dela).
- [x] Wiki: a cidade na página "O mundo".
- [x] Roadmap: 056 para "Já feito".
- [x] Gates: `npm test` inteiro, `npm run lint` e build.

---

## Como ficou (implementação)

**Conversor e assets** (`scripts/lgpe/`):
- `pack-lgpe.js` ganhou o modo `whole` (o nó com os filhos — telhado,
  janela, placa — num modelo só) e os props das cidades: `pokecenter`,
  `poke-mart`, `gym` (Pewter), `house-lab` (Pallet; a `house-pallet`
  saiu depois, ver "Ajustes"),
  `house-pewter`, `house-pewter-b` (Pewter) — categoria `building` —, e
  `fence-wood` (Pallet), `bench`, `street-lamp` (Pewter,
  separados das malhas fundidas) — categoria `street`. Todas as portas
  ficam no +Z do modelo original (conferido pela malha `doorway01_com`):
  nada precisou girar. As portas soltas da `buildmodel/` não entraram
  (as dos prédios já vêm no nó).
- Texturas do calçamento: `roadtile01_area02`, `roadtile02_area02`,
  `asphalt01_area02`. Os props antigos saíram iguais (só o nome do
  gerador no cabeçalho do `.glb` mudaria; eles não foram regravados).
- `colliders.js`: prédio e objeto de rua ganham o casco do modelo inteiro
  sem as peças achatadas (o piso da entrada virava rampa) e a caixa no
  chão (`box`), de onde sai a pegada.

**Core:**
- `core/data/biomes/city/`: o bioma, no fim do registro;
  `TERRAIN.GENERATION_VERSION` subiu.
- `coverage` (opcional, por bioma) no mapa de biomas (`biomeMap.js`): a
  fração do clima que as manchas cobrem — a cidade é rara.
- `core/town/townPlan.js`: `chunkStreets`/`withStreets` (ruas),
  `placeTown` (lotes, prédios, objetos de rua), `rectFootprints` (caixa →
  círculos). Números de todas as cidades em `GAME_CONFIG.TOWN`.
- `placeChunkSolids` põe a cidade primeiro e devolve `buildings`; árvores e
  pedras desviam das pegadas dela. O colisor (`addSolidColliders`) usa o
  casco do modelo (`lgpeColliderOf` aceita `model`).
- As ruas vão para `chunk.trails` (no chunk e no bloco de sólidos) depois
  de afundar as trilhas — pintam e afastam a vegetação, sem afundar.
  `paintsTrails(biome)` (trilha ou cidade) diz quem pinta o canal.

**View:**
- `buildBuildingMeshes` (uma malha instanciada por modelo), no
  `BlockVegetation`; "Cidade" no "Mostrar" do F2.
- Camada de cor `lgpe-street` (calçamento) no lugar da `lgpe-soil-damp`,
  que nenhum bioma usava (o shader tem teto de camadas).
- F2, pasta "Cidade": tamanho e cobertura das manchas, tamanho dos
  modelos, rua, lotes, recuo, base no chão, lotes vazios, borda, região do
  Pokécenter e quarteirão (só os lados que dividem o bloco de sólidos).
  Refaz o terreno ao soltar. O "Copiar valores" ainda não leva o `town`:
  os números escolhidos no F2 precisam ser passados para o código.

**O que mudou da proposta:**
- **Grade sem giro nem deslocamento por cidade**: alinhada ao mundo, com o
  quarteirão dividindo o bloco de sólidos — nenhum prédio cruza bloco, e a
  navegação por chunk continua valendo.
- ~~Um Pokécenter e um ginásio por região de quarteirões~~ — trocado por
  um de cada por cidade (ver "Ajustes depois do primeiro teste").
- **Pegada em círculos** (grade de células da caixa): todo o resto
  (pathfinding, sub-bosque, itens) já entendia círculos.
- **Ruas não afundam** o chão (as trilhas afundam).

**Desempenho** (Intel UHD, `next dev`, intercalado A B / B A): na cidade
(380, 140) contra um ponto sem cidade à mesma distância da origem
(-380, -140): 57 contra 55 FPS, GPU 11,7 contra 14,1 ms — a cidade tem
menos vegetação densa. (Perto da origem a medição sai suja: os selvagens
de teste lutam com o treinador.)

**Na seed do jogo** há uma cidade a uns 80 m da origem (Pokécenter perto de
(52, 48)) e outra perto de (370, 150).

---

## Ajustes depois do primeiro teste (pedido do usuário)

1. **Sem a casa de Pallet** (`house-pallet`): o modelo tem uma faixa vazia
   no meio (provavelmente a porta, que no jogo original é um modelo à
   parte). Saiu do conversor, do jogo e as 5 texturas só dela foram
   apagadas. Ficam `house-lab`, `house-pewter` e `house-pewter-b`.
2. **Um Pokécenter, uma loja e um ginásio por cidade**, qualquer que seja o
   tamanho; o resto dos lotes são casas (não há mais lote vazio de
   propósito nem "um por região"):
   - `core/town/cityIndex.js`: a cidade vira o conjunto de quarteirões
     vizinhos (lado com lado) com lote aberto — lote inteiro no bioma, em
     terra seca e longe da origem —, achado por busca a partir de qualquer
     quarteirão dela. O id é o quarteirão de menor coordenada; os três
     prédios únicos (`town.landmarks`) ficam nos lotes mais perto do meio
     (sorteados entre os `centralLots` mais centrais, pela seed e pelo
     id). A resposta não depende de chunk carregado: o mapa vem do relevo
     da seed (`shareAt`, `heightAt`), e o conjunto de chunks guarda um
     índice por seed e receita (`worldCityIndex`, refeito no
     `reconfigure`).
   - Sem o índice do mundo (testes de um chunk só), `placeTown` monta um
     preso ao chunk.
   - Banco ao lado da porta do Pokécenter e da loja (`bench` na entrada).
   - Teto de busca (`TOWN.MAX_CITY_BLOCKS`): só trava um mundo inteiro de
     cidade (os testes).
   - F2: saíram "Lotes vazios" e "Região do Pokécenter"; entrou "entre os N
     lotes do meio".
3. **Mais texturas para as ruas**: as camadas de cor do chão foram de 12
   para 16 (um `vec4` a mais por vértice, `groundColors3`), com os chãos
   das cidades do Let's Go: `lgpe-asphalt` (asfalto de Viridian),
   `lgpe-pewter-tile`, `lgpe-cerulean-tile` e `lgpe-fuchsia-tile`. Com o
   `lgpe-street` (ladrilho amarelo) e o `lgpe-path-stone` (pedra de
   caminho), são 6 opções — no F2, "Terreno → Texturas do chão → Cidade →
   Trilha".

4. **Sem a placa** (`sign-house`): saiu do conversor, do jogo (modelo e
   textura) e do código das casas; o banco ao lado da porta continua.

5. **Tamanho da textura da rua**: cada camada de cor pode ter o próprio
   tamanho (`TERRAIN_LOOK.COLOR_LAYER_SIZES`, nome da camada → m; as
   outras usam o `COLOR_TEXTURE_SIZE`), num array de uniform compartilhado
   que vale na hora (`setColorLayerSizes`). O calçamento ficou menor que a
   grama. F2, pasta Cidade: "Textura da rua (m)" (mexe no tamanho da
   camada que a rua usa).
6. **Candidatas a casa** (levantamento): o conversor ganhou `--extra
   <json>` (props a mais, para olhar sem mexer na lista) e `object: n`
   (o n-ésimo prédio de um nó fundido, com os filhos do nó). Folha de
   contato com 48 candidatas de todas as cidades do Let's Go.

7. **Temas por cidade** (decisão do usuário: Pewter, Cerulean, Vermilion e
   Lavender; prédio especial já; rua por tema). `town.themes`: cada
   cidade sorteia um tema (pela seed e pelo id dela, `weight`) e segue ele
   inteira:
   - **casas** do tema (Pewter: as 2 de pedra; Cerulean: 4 de telhado
     azul; Vermilion: 2 de telhado laranja; Lavender: a casa roxa);
   - **prédio especial**, mais um prédio único: museu de Pewter (escala
     própria, `scale`, por ser grande), loja de bicicleta de Cerulean,
     fã-clube de Vermilion, Torre Pokémon de Lavender;
   - **rua**: o calçamento da cidade de verdade (`street`: lajota de
     Pewter, chão de Cerulean, lajota de Vermilion, asfalto de Lavender).
     O chunk guarda a rua do tema da cidade perto dele
     (`chunk.streetLayer`, `cityIndex.themeNear`) e o chão troca a textura
     da trilha do bioma por ela (`withStreetLayer`, terrainGeometry.js);
   - **poste e cerca** opcionais (Cerulean tem poste próprio).
   Pokécenter, loja e ginásio seguem iguais em todo tema (o ginásio por
   tema fica para o futuro — a cidade já sabe o tema). O laboratório de
   Pallet (que o usuário tinha posto como prédio único) saiu: não é de
   nenhum dos quatro temas.
   - Camadas de cor do chão de 16 para 20 (as ruas de Vermilion e
     Lavender); o número de `vec4` sai do teto (`COLOR_WEIGHT_GROUPS`), sem
     atributo escrito à mão.
   - Conversor: 12 modelos novos (`object` nos nós fundidos de Cerulean e
     Vermilion).
   - F2, pasta Cidade: uma subpasta por tema (peso no sorteio, rua e
     tamanho da textura da rua).
8. **Lascas da borda**: pedaços de cidade com menos de
   `TOWN.MIN_CITY_LOTS` lotes abertos (na borda da mancha) não ganham
   prédio único — só casas do tema (antes nascia um Pokécenter sozinho).
9. **Seixos fora da rua**: a rua vai no canal das trilhas, e os seixos
   (`place: 'trail'`) nasciam nela. O chunk guarda as ruas à parte
   (`chunk.streets`) e o que é só de trilha usa `naturalTrailAt` (o canal
   sem a rua).

10. **Portas**: no Let's Go a porta é um modelo à parte (`buildmodel/`,
    posto pelo mapa); no prédio só fica o vão escuro (material `doorway`).
    O conversor encaixa a porta da própria cidade na boca do vão
    (`withDoor`: o meio do vão em X, o chão dele, a frente dele em Z) —
    Pokécenter, loja e ginásio com as portas deles; casas de Pewter,
    Cerulean (A, B, loja de bicicleta) e Vermilion (A, fã-clube) com as da
    cidade. A casa de Lavender não tem vão (a porta é um buraco na parede,
    achado pela fachada): `door.x` diz onde. O laboratório, Cerulean C/D e
    Vermilion B não têm porta na frente (casas fechadas no jogo original) e
    ficam assim; o museu tem a porta do lado e também ficou sem.
11. **Cor do ginásio por tema**: o ginásio (`paint` na entrada dele em
    `landmarks`) leva a cor do tema (`gymColor`: Pewter pedra, Cerulean
    azul, Vermilion amarelo, Lavender roxo) só no telhado, nos frisos e na
    porta (`paint.materials`), pela tinta do material toon (`aRecolor`, que
    troca o tom e mantém o claro e escuro). O core guarda o tema em cada
    prédio (`SolidPlacement.theme`); a view pinta por parte
    (`buildModelMeshes` com `recolorOf`, `part.materialName`). F2, pasta
    Cidade: a cor do ginásio por tema e a força da cor (refazem só as
    malhas).

**Na seed do jogo** (exemplos): Vermilion perto da origem (Pokécenter em
(69, 69)), Pewter em (309, 331) e (451, 189), Cerulean em (651, 629),
Lavender em (389, 789).

**Achado:** os blocos de sólidos são centrados na origem (o bloco 0 vai de
-metade a +metade). O quarteirão tem que dividir a **metade** do bloco
(senão um quarteirão cai em dois); o teste e a lista do F2 ficaram assim
(o quarteirão de 80 m saiu das opções).

## Fechamento

- **Wiki** (página "O mundo"): a cidade na lista de biomas; seção nova "As
  cidades" (ruas, casas, os quatro temas com o prédio especial de cada um,
  Pokécenter, loja e ginásio na cor da cidade; prédios sólidos, ainda sem
  entrar; sem itens no chão nem fruta); o "em breve" agora fala de entrar
  nos prédios e do Pokécenter curando o time (e não mais dos itens, que
  chegaram na 055).
- **Roadmap**: 056 no "Já feito" (grupo "Pokémon e mundo"); no "Depois da
  beta", o que ficou da cidade (interiores, loja, ginásio por tema, mais
  temas de Kanto). O Pokécenter funcionando já estava no Marco 5 (086).
- **Teste que dependia da geografia da seed**: `worldItemsStreamingSystem`
  procurava um chunk com itens numa faixa fixa do mundo, que agora cai
  dentro da cidade perto da origem (sem itens). Passou a procurar em mais
  de uma faixa.
- **Gates**: `npm test` inteiro (229 arquivos, 2449 testes, com
  `--maxWorkers=2`), `npm run lint` e build (numa cópia, sem a `.exemple`,
  com o `next dev` rodando) passando. No meio do fechamento, um ajuste de
  teste do usuário no `boy` (corrida rápida, sem gasto de stamina) fazia
  um teste do movimento falhar; o usuário voltou os valores.

## Pendências com o usuário

Nenhuma. Os números ajustáveis da cidade (tamanho e cobertura das manchas,
escala, rua, textura e cor de cada tema) ficam no F2, pasta Cidade; o
"Copiar valores" não leva o `town` — o que for escolhido lá precisa ser
passado para o código.

---

## Critérios de Conclusão

- [x] Andando pelo mundo, aparecem cidades: chão quase plano, ruas em
      grade e quarteirões com prédios.
- [x] Pokécenter, loja, ginásio, casas, cercas, postes e bancos do
      Let's Go, na escala do treinador.
- [x] Prédios colidem; treinador e criaturas contornam.
- [x] A cidade mistura com os biomas vizinhos na borda, sem degrau.
- [x] Mesma seed, mesma cidade.
- [x] Um Pokécenter, uma loja e um ginásio por cidade; o resto, casas.
- [x] Sem itens dentro da cidade e só vegetação de jardim. Selvagens: a
      cidade não tem espécie (`tags: ['urban']`); o spawn por bioma é da
      058.
- [x] Desempenho na Intel UHD no nível de hoje (dentro do ruído).
- [x] `npm run build`, `npm run lint` e `npm test` passando.
- [x] Wiki atualizada.

---

## Fora de escopo

- **Pokécenter funcionando** (cura do time com som, ponto de
  reaparecimento) — Marco 5 (086).
- **Entrar nos prédios** (interior, portas abrindo), loja e ginásio
  funcionando — depois da beta.
- **Aplainar o chão** sob a cidade e os prédios — depende da 080.
- **Estradas ligando cidades** — depois.
- **Selvagens urbanos** (Grimer, Koffing, Magnemite, Voltorb) — quando
  entrarem as espécies deles.
