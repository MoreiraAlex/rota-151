# 🚀 Versão 0.0.49 — Vegetação e floresta

## Resumo

Quinta feature do Marco 2 (mundo procedural): a **base da vegetação** que
todos os biomas usam e a **floresta** completa, o primeiro bioma fechado. Por
enquanto o mundo nasce só com a floresta (`BIOMES.HIDDEN`); dos outros
biomas, a beta refina só os das espécies selvagens — planície e savana
(050) e montanha (051). O resto fica na seed, visto só pelo F2.

O que entrou:

- **Grama** do repositório de referência
  [dedekpo/stylized-scene](https://github.com/dedekpo/stylized-scene) (campo
  de grama estilizado, no clima Ghibli/BotW), instanciada em blocos até a
  névoa, com folha de frente para a câmera, cor por bioma e **conjuntos**
  (mato denso e chão ralo, como nos jogos de Pokémon).
- **Floresta do Stylized Nature MegaKit** (Quaternius, CC0): árvores em
  camadas (folhosa, antiga, pinheiro, morta) com copa macia, arbustos,
  flores, samambaias, plantas de folha larga, cogumelos, pedras com musgo,
  troncos caídos e seixos; clareiras e manchas pela seed.
- **Vento** único, que balança grama, plantas e copas juntas e fica mais
  forte com o clima (048).
- **Colisão e desvio** nos sólidos (tronco em pé, tronco caído, pedra);
  arbusto e planta baixa são atravessáveis.
- **Trilhas** afundadas no relevo e a **superfície da água** (só visual).
- **Chunk de 16 m**, com os sólidos e a vegetação desenhada por bloco.
- **Desempenho**: materiais Lambert, árvore simplificada de longe, sub-bosque
  e sombra só perto, MSAA desligado e limite de FPS.
- **F2**: curva de cor (ACES / Neutral), SMAA, qualidade, liga/desliga de
  cada parte, ajuste da grama, dos conjuntos, das árvores, da floresta, do
  vento e das trilhas; contador de desenho e stats na tela.
- **Curva de cor**: fica a ACES, com SMAA e MSAA desligados (escolha do
  usuário).

As Partes 1 a 11, abaixo, contam a feature na ordem em que foi feita — o
plano da Parte 1 ("Arquitetura") foi mudando nas seguintes.

Versão: `0.0.49` (`package.json`). Branch:
`feature/049-vegetacao-e-floresta`.

> **Os números deste doc são fictícios (só ilustram).** O valor de verdade é
> o do campo citado (config).

---

## Referência: stylized-scene

O que o repositório faz e serve de modelo:

- **Grama**: um modelo de folha (`.glb` pequeno) instanciado milhares de
  vezes; cor da raiz à ponta com dois pares de cor, manchas e variação
  grande (macro); cor do chão projetada na base; escurecimento na base
  (oclusão falsa); translucência contra o sol; brilho de borda (fresnel);
  altura variando por ruído.
- **Vento** (`materials/wind.ts`): rajada que viaja na direção do vento
  (onda deformada por ruído), brisa, agitação e tremor na ponta. A grama e
  as copas leem o **mesmo** campo de vento, então a rajada passa pelos dois
  ao mesmo tempo. Cada instância recebe a própria origem no mundo
  (`aOrigin`) e o giro (`aFacing`), para a rajada ser amostrada no lugar
  certo e a dobra apontar sempre para o mesmo lado no mundo.
- **Árvore** (`scene/tree.tsx`): tronco em `.glb` + três copas instanciadas
  (cartões de folha com alpha map e `alphaTest`), sombreadas com **normal
  esférica** em volta do centro de cada copa (a copa vira um volume macio,
  sem cartão claro ou escuro destoando).
- **Flores** (`scene/flowers.tsx`): atlas 2×2 (caule + três pétalas) em
  cor e em alpha.
- **Assets** (código MIT, uso liberado pelo usuário): `grass-blades-up.glb`,
  `tree-tronk-transformed.glb`, `tree-leaves-mesh.glb`,
  `leaves-alpha-map.png`, `flowers.glb`, `flowers-color.png`,
  `flowers-alpha.png`, `perlin.webp`.

**Diferença de stack**: o repositório usa **WebGPU + TSL** (R3F v9, React
19). O Rota 151 usa **WebGL + GLSL** (R3F v8, React 18, Next 14). O código
**não** é copiado; as técnicas são portadas para GLSL.

---

## O que já existe (ponto de partida)

- **Biomas** (047): `vegetation` declarado em `core/data/biomes/<id>/` —
  16 tipos, só declaração. Os que esta feature usa: `tall-grass`
  (planície, floresta, savana, selva), `flower` (planície, selva) e
  `broadleaf-tree` (floresta, planície).
- **Chunks** (046): `TerrainView` monta/desmonta um mesh por chunk;
  colisor do relevo por chunk (`core/physics/colliders.js`); `heightAt`,
  `biomeAt`, `GENERATION_VERSION`; PRNG seedado (`core/rng.js`:
  `createRng`, `deriveSeed`).
- **Pathfinding** (`core/pathfinding.js`): grade por chunk carregado, com
  `obstacles`.
- **Luz e céu** (048): `DayNightView.jsx` (sol/lua, ambiente, céu em shader,
  névoa) com as cores por hora em `DAY_CYCLE.KEYFRAMES`; `LocalWeather` com
  a força de cada clima.
- **Chão** (047): material híbrido (paleta do bioma + textura Poly Haven),
  `TERRAIN_LOOK` ajustável no F2.
- **Renderer**: `<Canvas shadows>` com o padrão do R3F — tone mapping **ACES
  Filmic** e o antialiasing básico do WebGL.

---

## Decisões (com o usuário)

1. **Continua WebGL.** As técnicas do repositório são portadas para GLSL.
   Migrar para WebGPU exigiria React 19 / R3F v9 / Next 15 e reescrever os
   shaders atuais, e o WebGPU ainda falha em parte dos celulares (a família
   joga no celular).
2. **Escopo da Parte 1 = só o que o repositório tem**: grama, flores e um
   tipo de árvore (`broadleaf-tree`). Depois (decisão com o usuário), a 049
   passou a fechar também a **floresta** (Parte 2); dos outros biomas, a
   beta só refina planície e savana (050) e montanha (051).
3. **Assets do repositório usados direto** (`.glb`, texturas e o ruído).
4. **Céu continua o nosso** (048). Não entra o céu de imagem nem o IBL do
   repositório; a luz "de preenchimento" vem do ambiente/hemisfério que já
   segue a hora do dia.
5. **Tone mapping e SMAA viram opção no F2**: curva ACES (a de hoje) ou
   Neutral (a do repositório), e SMAA liga/desliga. Valem para a cena
   inteira (chão, vegetação, treinador e Pokémon). O usuário compara no
   jogo e escolhe; a escolha vira o padrão no `GAME_CONFIG`, e as cores dos
   biomas e da luz são ajustadas em cima dela. **Escolha final**: ACES, SMAA
   desligado (e o MSAA também, ver Parte 4).
6. **Vento ligado ao clima**: calmo no limpo, mais forte na chuva, forte na
   tempestade e na neve.
7. **Grama por chunk, perto do jogador** (depois: até a névoa, sem sumir
   antes — ver "Parte 5"); densidade e cor por bioma; opção de qualidade
   (alta / baixa) para o celular. Os números se acertam com o tempo.
8. **Trilha pintada do repositório: fora.** Caminhos fazem sentido com as
   estruturas (053). Depois o usuário pediu trilhas na floresta já nesta
   feature — ver "Parte 7".
9. **Colisão**: o tronco da árvore bloqueia (treinador, criaturas) e entra
   no pathfinding; grama e flores não.

---

## Arquitetura

### Dados por bioma (`core/data/biomes/`)

- A entrada `tall-grass` do `vegetation` ganha a aparência da grama do
  bioma: densidade (a `density` que já existe) e cores (dois pares
  raiz/ponta). Planície verde amarelado, savana seca, selva escura — a
  definir no jogo.
- `flower` e `broadleaf-tree` usam a `density` declarada.
- O `_template` documenta os campos. Biomas sem essas entradas não ganham
  nada (deserto, tundra, praia...).

### Posição das árvores (`core/vegetation/`, headless e determinístico)

- **`treePlacement.js`** — `placeChunkTrees(chunk, recipe)`: lista de
  árvores `{ x, y, z, yaw, scale }` do chunk.
  - PRNG com `deriveSeed(WORLD.SEED, 'trees', chunkX, chunkZ)`.
  - Pontos numa grade com jitter (espaço mínimo entre troncos); cada ponto
    fica pela `density` do bioma no lugar (peso do bioma, não só o
    dominante, para a borda rarear aos poucos).
  - Descarta: abaixo da água, encosta íngreme demais, perto da origem
    (`(0, y, 0)`, onde o treinador nasce).
  - `y` = `heightAt`.
- Fica no **core** porque decide colisão e pathfinding; o resto
  (grama, flores) é só visual e mora na view.
- Sobe `GENERATION_VERSION`.

### Colisão e pathfinding

- **Colisor do tronco**: cilindro (ou cápsula) estático por árvore, criado
  junto com o colisor do relevo do chunk e destruído no unload
  (`core/physics/colliders.js`, mesma vida do heightfield). A copa não
  colide.
- **Pathfinding**: as árvores do chunk entram como obstáculo na região da
  grade daquele chunk — as criaturas desviam.
- Medir o custo por chunk (a geração tem orçamento por tick desde a 046).

### Vento (`core/weather/` + view)

- **`windAt(localWeather)`** (puro): força do vento pelo clima atual (a
  mistura das forças de cada tipo do `LocalWeather`) e direção. Números em
  `GAME_CONFIG.WIND` (força por clima, direção, velocidade da rajada).
- A view passa força, direção e tempo como uniforms para todos os
  materiais de vegetação.
- O pedaço GLSL do vento (`view/vegetation/windShader.js`) é um só,
  incluído pela grama, flores e copas — a mesma rajada passa por todos.
- A inclinação da chuva da 048 (`WEATHER.STORM_WIND`) pode passar a ler a
  mesma direção — conferir na implementação.

### View (`view/vegetation/`)

- **Materiais** (GLSL, por `onBeforeCompile` num material com luz do
  three, para receber sol, ambiente, sombra e névoa de graça):
  - `grassMaterial.js` — cor raiz→ponta por instância e por mancha,
    projeção da cor do chão, oclusão na base, translucência, fresnel,
    altura por ruído, vento, sumiço pela distância.
  - `flowerMaterial.js` — atlas 2×2, vento.
  - `canopyMaterial.js` — alpha map, normal esférica, vento.
- **`GrassView.jsx`**: um `InstancedMesh` por chunk dentro do raio da grama
  (`GRASS.RADIUS`). Posições geradas na view por hash da coordenada (sem
  `Math.random`, mesma grama ao voltar ao chunk), descartando onde o peso
  de `tall-grass` do bioma é baixo, água e encosta íngreme. Atributos por
  instância: `aOrigin`, `aFacing`, cor do bioma. Altura pelo `heightAt`.
- **`FlowerView.jsx`**: mesma ideia, menos instâncias.
- **`TreeView.jsx`**: troncos (instanciados por chunk) e copas
  (instanciadas, três por árvore), das posições de `placeChunkTrees`.
  Fazem sombra.
- Geometrias e buffers de instância são do chunk e saem no unload (regra
  5.3); modelos e texturas são do `assetRegistry`.
- **Qualidade** (`GAME_CONFIG.VEGETATION_QUALITY`): alta / baixa muda o
  raio e a densidade da grama e das flores e a sombra das copas.

### Tone mapping e SMAA (view)

- `<Canvas>` passa a ter o tone mapping vindo do config
  (`GAME_CONFIG.RENDER.TONE_MAPPING`: `aces` | `neutral`). Trocar no F2
  marca os materiais para recompilar.
- SMAA pelo `EffectComposer` + `SMAAPass` do próprio three
  (`three/examples/jsm`), sem dependência nova.
  `GAME_CONFIG.RENDER.SMAA` liga/desliga.
- Depois da escolha do usuário: ajustar paletas dos biomas,
  `DAY_CYCLE.KEYFRAMES` (sol quente, sombra azulada, névoa leve) e o
  `TERRAIN_LOOK` para a curva escolhida.

### Debug (F2)

- Painel novo **"Vegetação"**: densidade, escala e cores da grama (do bioma
  escolhido), flores, balanço das copas, vento (força por clima, direção,
  rajada, agitação, tremor), raio e qualidade. "Copiar valores", como os
  outros painéis.
- Painel **"Render"** (ou pasta no "Dia e clima"): tone mapping ACES /
  Neutral e SMAA liga/desliga.
- Liga/desliga grama, flores e árvores (para medir FPS).

### Constantes (`GAME_CONFIG`)

- `GRASS`: raio, faixa de sumiço, máximo de instâncias por chunk, escala,
  variação de altura, cores e parâmetros do material.
- `FLOWERS`: densidade, escala.
- `TREES`: espaço mínimo, escala, inclinação máxima, raio livre na origem,
  raio do tronco (colisão), balanço.
- `WIND`: força por clima, direção, velocidade, rajada, agitação, tremor.
- `VEGETATION_QUALITY`: os presets alto / baixo.
- `RENDER`: `TONE_MAPPING`, `SMAA`.

### Testes (regras, sem fixar valores)

- **Árvores**:
  - mesma seed e chunk → mesmas árvores; seeds diferentes → diferentes;
  - nenhuma abaixo da água, nem em encosta acima do limite, nem no raio da
    origem;
  - espaço mínimo entre troncos respeitado;
  - bioma sem `broadleaf-tree` → nenhuma árvore; mais `density` → mais
    árvores numa amostra grande;
  - árvore na borda do chunk não se repete no vizinho.
- **Colisão**: o colisor do tronco nasce com o chunk e sai no unload; o
  personagem não atravessa o tronco.
- **Pathfinding**: a célula do tronco fica bloqueada e o caminho contorna.
- **Vento**: força cresce do limpo para a tempestade; sempre contínua na
  troca de clima.
- **Registro**: toda entrada de vegetação usada tem `density` válida;
  `tall-grass` tem as cores.
- Visual (grama, flores, copas, tone mapping): verificação no jogo.

---

## Parte 2 — Floresta

A floresta é o primeiro bioma fechado por inteiro. Antes ela mostrava só
árvores e grama.

### Decisões (com o usuário)

1. **Arbusto atravessável** (como no BotW). Tronco caído e pedra bloqueiam.
2. **Samambaia de um pacote CC0 que combine com o cenário**: o Stylized
   Nature MegaKit da Quaternius ("inspirado em Ghibli", CC0) — dele vieram
   também o cogumelo, as pedras e a casca do tronco caído.
3. **Flores nas clareiras** da floresta.

### O que entra

1. **Arbustos** (`bush`) — a copa do stylized-scene pequena, no chão
   (no repositório o "bush" é esse mesmo modelo): mesmo material, vento e
   normal esférica, sem asset novo. Vão servir de esconderijo de itens na
   052.
2. **Samambaias** (`fern`) e **cogumelos** (`mushroom`) — modelos do
   MegaKit; a samambaia balança com o vento.
3. **Clareiras** — um ruído pela seed de "mata fechada / clareira": árvores,
   arbustos, samambaias, cogumelos e troncos caídos rareiam nas clareiras;
   flores só nelas; a grama é cheia nas clareiras e rala na mata.
4. **Variação das árvores** — tom das folhas por árvore e mais faixa de
   tamanho.
5. **Troncos caídos** (`fallen-log`) e **pedras com musgo** (`rock`) — com
   colisão e desvio no pathfinding.
6. **Luz no estilo BotW** — depois da escolha da curva de cor: sol quente,
   sombra azulada, névoa leve (`DAY_CYCLE.KEYFRAMES`), e o ajuste das cores
   e do chão da floresta.

### Depois de fechar os objetos

Névoa mais fechada na mata, partículas (folhas caindo, vaga-lumes) e som
ambiente por bioma ficaram de fora: viraram o item 083 do Marco 5.

### Como ficou (Parte 2)

- **Dados** (`core/data/biomes/`): a floresta ganhou `clearings` (quanto
  dela é clareira) e, no `vegetation`, `fern`, `fallen-log`, `rock` (com
  `moss`) e `flower`; cada entrada pode ter `place` (`'shade'` ou
  `'clearing'`, com `shade` = a fração que fica na mata). O `_template`
  documenta tudo. Arbusto, pedra, samambaia e cogumelo valem em qualquer
  bioma que os declare (pedra e arbusto já aparecem em outros biomas).
- **Clareiras** (`core/vegetation/clearings.js`): ruído simplex pela seed
  (`CLEARINGS.SIZE`), independente do bioma e da altura; `opennessOf`
  vira o ruído em "quão aberto" pelo `amount` do bioma.
- **Densidade com clareiras** (`createKindDensity`,
  `vegetationDensity.js`): a densidade de um tipo em qualquer ponto, com o
  `place` de cada bioma — usada pelos sólidos (core) e pela vegetação só
  visual (view), com a mesma seed (`chunk.vegetationSeed`).
- **Sólidos** (`core/vegetation/solidPlacement.js`, no lugar do
  `treePlacement.js`): árvores, troncos caídos e pedras pela mesma grade
  de células do mundo, cada tipo com a sub-seed dele; um não nasce
  encostado no outro (pegadas em círculos); o tronco caído só onde as duas
  pontas ficam quase na mesma altura (`LOGS.MAX_END_DROP`). Tudo vai em
  `chunk.solids` (com as pegadas); a receita do relevo leva `solids`
  (`TREES`, `LOGS`, `ROCKS`, `CLEARINGS`).
- **Colisão**: tronco em pé e pedra = cilindro; tronco caído = cápsula
  deitada no giro dele. **Pathfinding**: as pegadas
  (`footprintsIn`), com a margem das caixas.
- **Assets** (`scripts/pack-forest-assets.py`): lê o MegaKit extraído,
  recorta da textura (atlas de 2048 px) só o pedaço de cada modelo, ajusta
  as UVs, reduz e grava um `.glb` com a textura embutida em
  `public/assets/vegetation/forest/` (samambaia, cogumelo, três pedras) +
  a casca. O `COLOR_0` do pacote fica de fora: é uma máscara cinza do
  shader do MegaKit, não cor (escurecia a planta).
- **View**: `chunkMeshes.js` (árvores com tom por árvore, arbustos,
  samambaias, cogumelos, pedras por modelo, troncos caídos), `instancing.js`
  (ajudantes e o tom por lugar), `propMaterials.js` (vento na samambaia,
  musgo no topo das pedras), `useVegetationModels.js` (carrega e prepara
  modelos e materiais). O sub-bosque é sorteado por chunk, fora das
  pegadas dos sólidos.
- **Debug (F2)**: liga/desliga "Arbustos, samambaias e cogumelos" e
  "Pedras e troncos caídos"; pasta "Floresta" (quantidade de cada um,
  samambaia na sombra, cor do musgo, variação do tom).
- **Medido** (Node): sólidos ~1 ms por chunk ao carregar; sub-bosque
  alguns ms por chunk quando ele aparece (na view).
- **Conferido fora do jogo** (WebGL headless): sem erro de shader; num
  chunk de floresta, árvores com tons diferentes, arbustos, samambaias,
  cogumelos, tronco caído e flores só nas clareiras.

### Parte 3 — Modelos do MegaKit (decisão do usuário)

Depois de ver o pacote, o usuário pediu: **do stylized-scene, só a grama**;
árvores, arbustos, flores e o resto vêm todos do Stylized Nature MegaKit.

- **Saíram** os assets e o código das árvores e das flores do
  stylized-scene (tronco + três copas, atlas de flores e o port do
  `flower-geometry.ts`/`flower-material.ts`). A grama continua igual.
- **Modelos** (`scripts/pack-forest-assets.py`, agora com modelos de
  várias partes): cinco árvores (`CommonTree_1..5`), dois arbustos (liso e
  com flores), duas moitas de flores, samambaia, cogumelo e três pedras, em
  `public/assets/vegetation/megakit/`. A casca e as folhas das árvores
  ficam num arquivo só cada (os `.glb` apontam para ele — as UVs da casca
  repetem a textura); as plantas do atlas grande têm o pedaço delas
  recortado e embutido.
- **Partes por material** (`PART_KINDS`): folha de árvore/arbusto = copa
  (vento da copa, normal esférica, sombra recortada); folha e pétala de
  planta baixa = vento da grama; casca = clareada na sombra; pedra = musgo.
  O tipo de cada vegetação sorteia um dos modelos dele (`VEGETATION_MODELS`).
- **Cores**: a folha colorida do arbusto liso no pacote é vermelha
  (outono); usamos a versão branca, tingida por `BUSHES.LEAF_COLOR`. A
  casca do pacote puxa para o vermelho: `TREES.BARK_COLOR` multiplica (vale
  também para o tronco caído). O preenchimento da sombra segue a cor do
  material.
- **Tamanhos**: as árvores do MegaKit têm escala real (6 a 11 m no
  `TREES.SCALE`); a colisão do tronco foi ajustada a elas.
- **Código**: `useVegetationModels.js` monta os modelos por partes
  (funções puras `buildVegetationModels`/`buildGrassModel`/`buildLogModel`
  + o hook); `instancing.js` faz as malhas de qualquer modelo
  (`buildModelMeshes`/`buildKindMeshes`); `chunkMeshes.js` e
  `vegetationMeshes.js` só sorteiam as instâncias.
- **Conferido fora do jogo** (WebGL headless): sem erro de shader; árvores,
  arbustos, flores, samambaias, cogumelos e pedras do MegaKit na floresta.

### Parte 4 — Só floresta e performance

- **Só a floresta no mundo, por enquanto** (pedido do usuário):
  `BIOMES.HIDDEN` nasce com todos os outros biomas, enquanto a vegetação é
  fechada bioma a bioma (cada bioma da beta sai dele na feature dele;
  os outros ficam escondidos, ver o Resumo). Os testes da
  colocação dos sólidos pegam os biomas do registro inteiro, para não
  dependerem disso.
- **Medido** (o usuário viu o FPS cair e outras abas do Chrome travarem —
  a placa de vídeo saturada): com 5×5 chunks de floresta, a vegetação
  desenhava ~8,8 M triângulos, e a sombra quase o mesmo de novo (~15 M por
  quadro). Os maiores: árvores (~3,5 M), arbustos (~1,8 M), cogumelos (~1,2
  M — o modelo tem 880 triângulos), grama (~1,1 M) e samambaias (~0,9 M).
- **Por distância do chunk da câmera** (`VEGETATION_QUALITY`): o
  sub-bosque só até `detailRing` chunks; árvores, pedras e troncos caídos
  até `treeDistance`; sombra só até `shadowRing`. Planta baixa e cogumelo
  nunca fazem sombra. A sombra liga e desliga sem remontar as malhas
  (`allowShadow`/`setShadowsEnabled`).
- **Densidade de pixels** limitada pela qualidade (`maxDpr`): telas de alta
  resolução desenhavam até o dobro de pixels (as folhas recortadas pesam
  por pixel).
- **Resultado estimado** (mesma conta, câmera na origem, antes do corte
  pelo campo de visão): ~7,8 M triângulos por quadro com a sombra (era
  ~15 M). As árvores continuam sendo a maior parte — próximo passo, se
  ainda pesar: árvore simplificada de longe (LOD) ou menos árvores.
- **Debug (F2)**: linha "desenho: N chamadas · N M triângulos · dpr" no
  painel (`RenderStatsProbe`), para medir no jogo.
- **Segunda rodada** (o usuário seguiu vendo o jogo lento, e diminuir os
  chunks quase não ajudou — sinal de que o peso estava perto da câmera, não
  na quantidade de longe). Medido numa bancada headless (WebGL por
  software: o tempo absoluto não vale, a proporção sim), floresta em
  terceira pessoa, ligando e desligando cada parte:
  - **custo por pixel** era mais da metade do quadro: todo material da
    vegetação era PBR (`MeshStandardMaterial`) e folha recortada e grama
    empilham camadas. Tudo virou **Lambert** (`toLambertMaterial`; a grama
    também) — mesmo visual desenhado, bem mais barato;
  - **árvore de longe (LOD)**: cada modelo de árvore ganhou a versão sem
    galhos (casca cortada um pouco acima da base da copa — os galhos eram
    32 a 91% dos triângulos da casca e somem nas folhas de longe); a partir
    de `TREES.LOD_DISTANCE`, por árvore, sem remontar (as malhas de perto e
    de longe do chunk recebem a lista dividida, `buildLodKindMeshes`);
  - **sub-bosque só perto** (`detailDistance` na qualidade), pelo mesmo
    LOD (o "de longe" é nada);
  - **de longe não faz sombra**: a área de sombra do sol cobre só a volta
    da câmera, e a malha do chunk inteiro entrava no mapa de sombra;
  - **geometria compartilhada** (`shareGeometry`): as malhas apontam para
    os buffers do modelo em vez de copiar — cada modelo sobe uma vez para
    a placa de vídeo.
  - Resultado na bancada: quadro ~4,1 s → ~1,4 s (−66%); triângulos na
    tela 3,55 M → 1,69 M; a sombra deixou de pesar.
- **Terceira rodada — a queda era andando, não a quantidade** (bancada com
  a GPU de verdade do PC, Intel UHD, 1920×1080, jogando: parado, andando,
  correndo, em curva; tempo de GPU medido por quadro):
  - parado a GPU gastava o mesmo que antes, mas **correndo o FPS caía pela
    metade com o mesmo número de triângulos** — a GPU recebia ~130 buffers
    novos por quadro (80 MB em 12 s) e o main thread ficava ~95% ocupado;
  - causa: `useVegetationModels` devolvia um objeto novo a cada render, e
    as malhas da grama e dos chunks dependem dele — todo render do
    `VegetationView` (cada bloco de grama que entra no raio, cada chunk)
    **remontava a vegetação inteira** e, pelo `releaseGeometry`, reenviava
    os buffers dos modelos. Por isso as rodadas anteriores (menos
    triângulos, chunks menores) quase não mudaram o que se sentia;
  - correção: o objeto é memorizado (`useMemo`). Correndo, três rodadas de
    cada lado: ~14 → ~30 FPS, pior quadro (p95) ~240 → ~80 ms, buffers
    novos ~130 → ~2 por quadro;
  - o que sobra parado é custo da GPU por pixel: as **copas** (folha
    recortada) são a maior parte (somem quase todo o custo com 1/4 dos
    pixels — não é triângulo); depois a casca e o redesenho da sombra.
  - o LOD regravava as instâncias de todos os chunks a cada `LOD_STEP` m,
    mesmo sem nada mudar de perto para longe: agora `setNear` pula o grupo
    cuja divisão é a mesma da última vez. Correndo e em curva, ~90% menos
    dados de instância reenviados; o FPS quase não muda (era pouco), os
    piores quadros ficaram um pouco menores.
  - **o custo das copas, aberto** (trocando na mesma sessão): luz, sombra
    e vento juntos são pouco; o grosso é desenhar as folhas recortadas
    (`discard`) em camadas, com o MSAA do canvas multiplicando isso por
    amostra. Testado e descartado: alpha to coverage (pior) e metade das
    folhas nas copas de longe (pouco ganho para o visual que muda).
  - **MSAA desligado** (`RENDER.MSAA`, no `<Canvas>`): ~6–7 ms a menos por
    quadro na Intel UHD (~25% da GPU na mata), sem mudar copa, grama nem
    sombra — só a borda fica serrilhada. Ligar de novo ou usar o SMAA do
    F2 é escolha de visual para depois (o MSAA só vale ao recarregar).
- **Limite de FPS** (`RENDER.MAX_FPS`, F2 → Vegetação → Render): o
  `LOOP.FIXED_TIMESTEP` é o passo da simulação, não limita o desenho (o R3F
  desenhava a cada quadro da tela e interpolava). Agora o `<Canvas>` usa
  `frameloop="never"` e o `FrameLimiter` manda desenhar só quando passa o
  intervalo do limite (`nextDrawnFrame`, que mantém a média mesmo quando o
  limite não divide a taxa da tela). Medido: tela de 60 Hz com limite 30 →
  30 quadros por segundo.
- **`CHUNK_SIZE`**: o usuário testou 16; o tamanho de projeto era 64 —
  depois o usuário fixou 16 (ver "Parte 11").

### Parte 5 — Grama de frente e até a névoa (pedido do usuário)

- **Folha de frente para a câmera**: de alguns ângulos a grama parecia
  sumir (a folha vista de lado é um risco). O tufo tem folhas em todas as
  direções, então girar o tufo inteiro não resolve: cada folha gira em
  volta da própria raiz para a câmera (`bladePivotsOf`, em
  `grassBlades.js`, acha as folhas do modelo — pedaços ligados da malha — e
  grava a raiz e o giro de cada uma no atributo `aBlade`; o shader faz o
  giro). `GRASS.FACE_CAMERA` diz quanto (0 = como no modelo, 1 = sempre de
  frente), com controle no F2.
- **Até a névoa**: a grama e as flores não encolhem mais com a distância;
  os blocos vão até onde a névoa fecha (`scene.fog.far`) — dali em diante
  não se vê nada. Saíram `grassRadius` e `FADE` do `VEGETATION_QUALITY` e
  o encolhimento dos shaders da grama e das flores. O alcance passa a
  seguir o `TERRAIN.LOAD_RADIUS` (é ele que define a névoa).

### Parte 6 — Floresta com identidade (revisão dos kits)

O usuário pediu para olhar de novo a floresta e os dois pacotes em
`.exemple/ambient` — o **Stylized Nature MegaKit** (o que já usamos) e o
**Ultimate Stylized Nature** (Quaternius, 2022) — e melhorar composição e
ambientação **sem mexer na grama**.

**Como estava** (visto no jogo, em vários horários): árvores de uma
espécie só, finas e espaçadas por igual — lia como parque, não como mata;
copa verde-escura chapada (a textura de folha do pacote é uma cor só, sem
desenho — o volume das prévias vem do shader deles); casca avermelhada
saturada; samambaia e cogumelo salpicados por igual e escondidos na grama.

**Os kits:**

- **MegaKit** (base, mantido): além do que já usávamos, serve à floresta a
  `TwistedTree` (árvore grande e retorcida, a "árvore antiga"), o `Pine`
  (pinheiro), a `DeadTree` (árvore morta) e as plantas de folha larga
  (`Plant_1`, `Plant_1_Big`). As folhas vêm também numa versão **branca**,
  para tingir. O `COLOR_0` é só a máscara de vento (folhas = 1).
- **Ultimate Stylized Nature**: versão anterior da mesma linha. Folhas de
  cor chapada, sem desenho; árvore comum, pinheiro, arbusto e pedra repetem
  o MegaKit; o zip veio só com parte dos glTF (o resto em OBJ/FBX). O
  usuário já tinha escolhido o visual do MegaKit numa comparação de
  cenários — **nada dele entra na floresta**. Fica anotado para os outros
  biomas: bétula e bordo (folha branca para tingir), palmeira, árvores
  mortas leves e moitas de flores baratas.
- Os dois `.wav` de vento da pasta já estão no jogo
  (`public/assets/audio/ambient/`).

**Decisões:**

1. A grama não muda (modelo, material, cor, densidade).
2. A luz do dia (048) não muda: qualquer ajuste nela muda a cor da grama.
3. A floresta ganha **camadas**: árvores antigas espalhadas (copa alta),
   folhosas, **bosques** de pinheiros, uma ou outra árvore morta; por
   baixo, arbustos, **tapetes** de samambaia, plantas de folha larga e
   **rodas** de cogumelos.

**O que entrou:**

- **Espécies de árvore** (`core/vegetation/solidPlacement.js`): `broadleaf-
  tree`, `ancient-tree` (tipo novo), `pine-tree` e `dead-tree` (já
  declarados no vocabulário dos biomas) pela mesma grade de células, na
  ordem de `STANDING_TREE_KINDS` (a antiga primeiro). Cada árvore guarda o
  `kind`; `chunk.solids.trees` tem todas. Cada espécie tem o bloco dela no
  `GAME_CONFIG` (`TREES` = folhosa e o que vale para todas; `ANCIENT_TREES`,
  `PINES`, `DEAD_TREES`). Novo: `CROWN_RADIUS` — nenhum tronco nasce na
  copa de outra árvore. Colisão pelo tronco da espécie (`trunkOf`).
  `GENERATION_VERSION` subiu.
- **Manchas** (`core/vegetation/patches.js`, `patches: { amount, size }` no
  `vegetation` do bioma): o tipo só nasce em manchas pela seed (um ruído por
  tipo, o mesmo das clareiras generalizado em `patchNoiseFor`). Entra em
  `createKindDensity`, então vale para os sólidos (core) e para o
  sub-bosque (view). Borda em `VEGETATION_PATCHES.EDGE`.
- **Planta de folha larga** (`leafy-plant`, tipo novo, `LEAFY_PLANTS`):
  sub-bosque como samambaia e cogumelo. A samambaia ficou maior (menor que a
  grama, ela sumia).
- **Assets** (`scripts/pack-forest-assets.py`): o script dá um nome de
  material por espécie (`Bark_Broadleaf`, `Leaves_Ancient`, `Leaves_Pine`...)
  e usa as folhas **brancas** (tingidas por espécie, `LEAF_COLOR`). Todas as
  árvores vivas e o tronco caído usam a casca cinza-amarronzada da
  TwistedTree (`bark-twisted.jpg`); a morta, a dela. Saíram `bark.jpg`,
  `leaves-tree.png` e `leaves-bush.png`.
- **Volume da copa** (`canopyMaterial.js`, todas as copas e arbustos):
  miolo mais escuro (`TREES.INNER_SHADE`), alto mais claro e quente
  (`TOP_LIGHT`) e o sol atravessando a borda das folhas vista contra ele
  (`TRANSLUCENCY`). Calculado **por vértice**: por pixel custava ~5 ms na
  Intel UHD (a copa empilha muitas camadas de folha recortada); por vértice
  o custo some na medição.
- **Debug (F2)**: em "Árvores", volume da copa e cor da folha e da casca de
  cada espécie; em "Floresta", plantas por m²; "Copiar valores" leva os
  blocos novos.

**Medido** (Intel UHD, 1920×1080, bancada Playwright; A/B na mesma sessão
trocando a floresta pela regeneração do terreno, média de quatro pontos da
mata, intercalado): floresta anterior ~33 ms de GPU por quadro, nova ~35 ms
(+~6%). Tirar uma espécie por vez não muda o custo de forma mensurável —
o peso continua sendo copa e grama por pixel. A mata densa em 1080p já
passava do orçamento de 30 FPS antes desta parte.

**Fica para depois** (sugestões, não feitas): luz do dia em estilo BotW
(sol quente, céu azulado), que mexe na cor da grama — Marco 5, 081; névoa
mais fechada na mata — 083; grama mais rala sob a copa fechada (o `shade` da
grama na floresta — a grama foi mantida como está), cogumelo-prateleira
(`Mushroom_Laetiporus`) e musgo nos troncos caídos — 084. Os seixos
entraram na Parte 8.

### Parte 7 — Trilhas e água (pedido do usuário)

O usuário pediu trilhas pelo bosque ("para dar mais realidade", com as
texturas que já temos) e uma representação simples da água onde o chão
fica abaixo do nível dela.

- **Trilhas** (`core/terrain/trails.js`, `GAME_CONFIG.TRAILS`): onde um
  ruído suave pela seed (torcido para serpentear) passa por zero — uma
  rede de caminhos contínua entre chunks, com a mesma largura em todo
  lugar (distância ao zero = valor ÷ inclinação do ruído, numa grade com um
  vértice a mais de cada lado). Só nos biomas com `trails: true` (pelo peso
  deles) e acima da água + `SHORE_GAP`; a trilha que chega no lago acaba na
  margem. Cada chunk guarda a força por vértice (`chunk.trails`, posto pelo
  conjunto de chunks antes dos sólidos; `null` sem trilha). Custo medido em
  Node: ~2 ms por chunk, ao carregar.
  - **Chão** (`terrainGeometry.js`): a trilha puxa a cor do vértice para
    `palette.trail` e o desenho para `ground.trailTexture` (na floresta,
    uma camada que já existia — ver a Parte 8).
  - **Vegetação**: `createKindDensity` multiplica tudo por (1 − trilha) —
    árvores, troncos caídos, pedras, sub-bosque, flores e grama somem no
    meio dela e voltam na borda (`EDGE`). A grama em si não mudou.
  - `chunkFieldAt` (`terrainChunk.js`): amostra um valor por vértice do
    chunk (as trilhas) em qualquer ponto.
  - `GENERATION_VERSION` subiu (as árvores mudam de lugar).
- **Água** (`view/water/`, `GAME_CONFIG.WATER`) — só visual; a água de
  verdade (nadar, colisão, criaturas da água) continua na 056:
  - `waterGeometry.js`: por chunk com chão abaixo da água, uma grade plana
    no `WATER_LEVEL` só nas células com algum canto submerso, com a
    profundidade por vértice (`waterDepth`).
  - `waterMaterial.js`: `MeshStandardMaterial` transparente (sol, sombra e
    névoa do jogo) com a cor pela profundidade (margem clara e
    transparente, fundo escuro), espuma na beira, ondinhas que pegam o
    brilho do sol e o céu refletido — entre o alto do céu e o horizonte
    (`SKY_TOP_SHARE`; só o horizonte deixava a água cor de barro no fim de
    tarde).
  - `WaterView.jsx` (montado no `GameScene`): uma malha por chunk, um
    material para todos; `useFrame` só visual (ondinhas e céu, lê hora e
    clima do ECS).
- **Conferido no jogo** (bancada Playwright): trilha de terra serpenteando
  pela mata, sem grama nem árvore em cima, descendo até o lago; água de
  manhã, no fim de tarde e à noite.
- Testes: `trails.test.js` (mesma seed = mesma trilha, continua na borda
  entre chunks, nada debaixo d'água, vegetação fora do meio da trilha,
  bioma sem trilha), `waterGeometry.test.js`, e as camadas do chão de cada
  bioma existem (`terrainLayers.test.js`).

### Parte 8 — Relevo da trilha, margem, F2 e stats (pedido do usuário)

O usuário achou a trilha chapada, a terra dela diferente da beira do lago,
pediu mais controle dela no F2 e o monitor de desempenho ligável, ficando
na tela fora do F2.

- **Relevo** (`carveTrails`, core/terrain/trails.js): o conjunto de chunks
  afunda a trilha no `heights` do chunk logo depois de calcular as trilhas,
  antes dos sólidos e do colisor — o meio desce `TRAILS.DEPTH` e a beirada
  sobe até `BANK` (a terra empurrada para o lado). Vizinhos afundam igual na
  borda (os mesmos valores por vértice). A altura de fora dos chunks
  carregados (`latticeHeightAt`) não sabe da trilha. `GENERATION_VERSION`
  subiu.
- **Desenho**: na trilha, a força da textura vai a `TRAILS.DETAIL` (a terra
  batida tem mais marca).
- **Seixos** (`pebble`, `PEBBLES`): quatro seixos do MegaKit
  (`Pebble_Round`/`Pebble_Square`), sub-bosque com `place: 'trail'` — o
  único tipo que só nasce NA trilha (`createKindDensity` usa a trilha no
  lugar de 1 − trilha).
- **Trilha e margem da mesma terra**: na floresta, `trailTexture` e
  `shoreTexture` são a camada `mud` (a `dry-ground`, rachada, lia como
  deserto; a margem era `sand` bege), com cores irmãs (`palette.shore` um
  pouco mais clara que `palette.trail`).
- **F2 → Terreno → "Trilhas (refaz ao soltar)"**: distância entre trilhas,
  serpenteio, tamanho das curvas, largura, borda, afundado, beirada,
  desenho da textura, folga da água, seixos por m²; e, por bioma, se tem
  trilha, cor e textura da trilha e da margem. Entram no "Copiar valores" e
  no "Voltar ao inicial".
- **Stats** (`tools/debug/statsOverlay.js`): o `<Stats/>` do drei (FPS, MS,
  MB) deixou de abrir junto com o F2 — liga e desliga em F2 → Vegetação →
  Render → "Stats (fica fora do F2)"; ligado, fica na tela com o F2
  fechado, e a escolha fica guardada no navegador (começa desligado).
- Conferido no jogo (bancada Playwright): sulco da trilha com a grama na
  beirada, seixos, margem do lago na mesma terra; stats ligado no F2
  continua depois de fechar.

### Parte 9 — Conjuntos de grama (pedido do usuário)

O usuário quer a grama como nos jogos de Pokémon: áreas de mato denso e
áreas sem grama — subir a densidade enchia o mapa inteiro.

- **Conjuntos** (`core/vegetation/grassClusters.js`, `clusters` na entrada
  `tall-grass` do bioma; bioma sem ele continua com a grama por igual):
  manchas pela seed, com a grama do conjunto e a de fundo entre elas.
  - **Do conjunto**: `density` (quanto da densidade da grama do bioma fica
    dentro), `size` (largura típica, m), `sizeVariation` (moitinhas e
    campos grandes), `roughness` (borda recortada), `edge` (corte seco ou
    esfiapado), `height` (altura no conjunto), `holes` (falhas dentro).
  - **Do mapa**: `coverage` (a fração do chão que vira conjunto — o ruído é
    normalizado para ela valer isso mesmo), `grouping` (conjuntos reunidos
    em campos), `variety` (conjuntos diferentes entre si em densidade e
    altura), `background` e `backgroundHeight` (a grama de fora — 0 = chão
    limpo), `clearingPreference` (nos biomas com clareiras: 0 = em qualquer
    lugar, 1 = só nelas).
- **Escolhas** (o usuário deixou comigo): fora dos conjuntos, grama baixa
  e rala (o chão não fica careca; zerar o fundo deixa estilo Pokémon puro);
  na floresta, preferência por clareira média — a maioria do mato nas
  clareiras, um pouco na mata. Na floresta, os conjuntos ficaram no lugar
  do `place: 'clearing'`/`shade` da grama (os dois juntos se somavam).
- **No core**, em `createKindDensity` (a densidade) e no novo
  `heightAt(x, z)` dela (a altura): a view escala cada tufo só na vertical.
  Fica pronto para a 055 perguntar "este ponto é mato alto?".
- **Custo**: calcular as camadas de ruído em cada tufo candidato deixava
  um bloco de grama ~4× mais caro; os conjuntos são calculados numa grade
  de 1 m (`createGrassClusterField`) e interpolados — medido em Node,
  ~2–3 ms → ~3,5–4 ms por bloco. Na tela, menos tufos que antes (fundo
  ralo): ~108 mil → ~83 mil no mesmo percurso.
- **F2 → Vegetação → "Conjuntos de grama (refaz ao soltar)"**: o bioma
  (abre no primeiro com conjuntos), "Usar conjuntos" e as pastas
  "Conjunto" e "Mapa" com os campos acima. "Tufos por m²" (pasta Grama)
  continua sendo o máximo de dentro do conjunto. "Copiar valores" leva a
  grama de cada bioma com os `clusters`.
- Testes: `grassClusters.test.js` (dentro/fora, mais quantidade = mais chão,
  falhas, preferência por clareira) e os conjuntos em
  `vegetationDensity.test.js`; o registro confere os campos de `clusters`.

### Parte 10 — Cores casando com a grama (pedido do usuário)

O usuário achou que vegetação, pedra e chão não combinavam; a grama é a
referência.

- **Medido na tela** (bancada Playwright, meio-dia, mata e clareira; a cor
  de cada parte = os pixels que mudam ao escondê-la, com o vento parado):
  a grama sai num verde amarelado (matiz em torno de 86–89°); o chão e as
  copas saíam num verde mais azulado e bem mais saturado (matiz 100–110°,
  o chão "mesa de sinuca"), e copa e arbustos escuros demais.
- **Ajuste** (duas rodadas medindo de novo; a primeira deixou o chão oliva
  apagado demais): o chão da floresta (`palette.low`/`high`), as folhas de
  cada espécie, os arbustos e o musgo passaram para o verde da grama, cada
  um mais claro ou mais escuro; a copa ganhou mais preenchimento na sombra
  (`TREES.LEAF_FILL`) e um miolo menos escuro (`INNER_SHADE`). Na tela, os
  verdes ficaram todos na faixa da grama (matiz ~83–94°). Conferido de
  manhã, no fim de tarde e na chuva. A grama, a luz do dia, a terra da
  trilha e da margem, a casca e a água não mudaram.
- **Bug do vento** (achado medindo): com a força do vento em zero (dá para
  zerar no F2), a grama caía no chão — a dobra tinha um mínimo só no raio,
  não no ângulo. O mínimo vale para os dois (`windShader.js`); com vento,
  nada muda.
- Fica de fora: os blocos dos objetos de treino (038) — provisórios, cinza
  e marrom.

### Parte 11 — Chunk de 16 m e o raio como controle de gráfico (pedido do usuário)

O usuário fixou o chunk em 16 m (o do Minecraft) e quer controlar o peso do
gráfico pelo raio de carregar, com faixas maiores no F2 para máquinas mais
fortes.

- **`TERRAIN.CHUNK_SIZE` = 16**, fixo (saiu do F2). Para ver a mesma
  distância de antes, `LOAD_RADIUS` subiu para 8 e `UNLOAD_RADIUS` para 10
  (a névoa segue o raio, `fogRange`); `NEAR_RADIUS` = 2. No F2 → Terreno,
  carregar vai de 1 a 32 e descarregar de 1 a 40.
- **Sólidos por bloco** (`TERRAIN.SOLIDS_BLOCK_SIZE`, um número ÍMPAR de
  chunks — os chunks são centrados na origem, e só assim a borda do bloco
  cai na de um chunk): com a folga da borda em cada chunk de 16 m, a mata
  ficaria com faixas sem árvore a cada 16 m. Agora o conjunto de chunks
  sorteia árvores, troncos caídos e pedras por bloco (`blockGround`: o
  relevo do bloco inteiro, com as trilhas), quando o primeiro chunk dele
  carrega; cada chunk fica com os objetos de centro nele (um tronco pode
  passar da borda do chunk, não da do bloco). `footprintsIn` procura nos
  blocos — a navegação de um chunk já conta com a árvore do vizinho ainda
  não carregado. O bloco sai quando o último chunk dele sai.
- **Vegetação desenhada por bloco** (`BlockVegetation`, `loadedBlocks`):
  árvores, pedras, troncos caídos e o sub-bosque saem do relevo do bloco,
  não de cada chunk — as malhas não se multiplicam com o chunk pequeno. Os
  anéis da qualidade (`detailRing`, `shadowRing`, `treeDistance`) passam a
  contar blocos.
- **Blocos de grama centrados** como os chunks (`tileStart`): com o chunk
  de 16 m, o bloco de grama de 16 m (que começava em 0) cairia metade em
  cada chunk. Regra nova (teste): o chunk é um número ímpar de blocos de
  grama.
- **Medido** (Intel UHD, 1920×1080; A/B na mesma sessão, trocando 64 ↔ 16
  pela regeneração do terreno, nos mesmos pontos): GPU parado igual (~36,6
  × ~36,5 ms); correndo, igual (~25 FPS, os mesmos piores quadros); ~10% a
  mais de chamadas de desenho (o chão e a água continuam um por chunk).
- `GENERATION_VERSION` subiu.

---

## Etapas

- [x] Bump `package.json` → `0.0.49` e doc da feature.
- [x] Assets do repositório em `public/assets/vegetation/` e os caminhos em
      `view/vegetation/vegetationAssets.js`.
- [x] `GAME_CONFIG`: `GRASS`, `FLOWERS`, `TREES`, `WIND`,
      `VEGETATION_QUALITY`, `RENDER`.
- [x] Dados por bioma (`tall-grass` com cores, `_template`) + teste de
      registro.
- [x] `windStrengthOf` + testes; pedaço GLSL do vento.
- [x] Grama: material GLSL + blocos perto da câmera (raio, sumiço,
      qualidade).
- [x] Flores: geometria do atlas + material.
- [x] `placeChunkTrees` + testes; `GENERATION_VERSION`.
- [x] Árvores: tronco + copas com normal esférica e vento.
- [x] Colisor do tronco por chunk + pathfinding + testes; medir custo por
      chunk.
- [x] Tone mapping e SMAA na cena com opção no F2.
- [x] Debug F2: painel "Vegetação" (com a pasta "Render").
- [x] Floresta: arbustos.
- [x] Floresta: samambaias e cogumelos (MegaKit, `pack-forest-assets.py`).
- [x] Floresta: clareiras (árvores, sub-bosque, flores e grama).
- [x] Floresta: variação de tom e tamanho das árvores.
- [x] Floresta: troncos caídos e pedras (com colisão e pathfinding).
- [x] Árvores, arbustos e flores do MegaKit no lugar das do stylized-scene
      (do repositório fica só a grama).
- [x] Floresta em camadas: árvore antiga, pinheiro, árvore morta, planta de
      folha larga, manchas, volume da copa (Parte 6).
- [x] Trilhas na floresta e superfície da água só visual (Parte 7).
- [x] Relevo da trilha, seixos, margem combinando, controles no F2 e stats
      fora do F2 (Parte 8).
- [x] Conjuntos de grama, com controles no F2 (Parte 9).
- [x] Cores da floresta casando com a grama (Parte 10).
- [x] Chunk de 16 m, sólidos por bloco e raios maiores no F2 (Parte 11).
- [x] Curva de cor escolhida pelo usuário: ACES, SMAA e MSAA desligados.
- [x] Pendências para o Marco 5: luz BotW por hora (081), desempenho no
      celular (082), ambiente da floresta (083), detalhes da floresta (084).
- [x] Wiki: página "O mundo" (a floresta, o vento com o clima).
- [x] Roadmap: 049 para "Já feito".
- [x] Gates: `npm test` inteiro, `npm run lint` e build (numa cópia).

---

## Como ficou (implementação)

O estado final, depois das Partes 1 a 11 (o detalhe de cada mudança está na
parte dela).

- **Core** (`core/vegetation/`, headless e determinístico):
  - `vegetationDensity.js` — a `density` de cada tipo misturada pelo peso
    dos biomas no ponto, com clareiras, manchas, trilhas e conjuntos de
    grama (`createKindDensity`); a inclinação do chão (`slopeAt`).
  - `clearings.js`, `patches.js`, `grassClusters.js` — os ruídos pela seed
    de clareira, mancha por tipo e conjunto de grama.
  - `solidPlacement.js` — árvores (por espécie, `STANDING_TREE_KINDS`),
    troncos caídos e pedras pela grade de células do mundo, sorteados por
    bloco de chunks (`TERRAIN.SOLIDS_BLOCK_SIZE`); cada chunk fica com os
    objetos de centro nele (`chunk.solids`, com as pegadas). Sem sólido na
    água, em encosta, perto da origem ou encostado em outro.
  - `core/terrain/trails.js` — trilhas pela seed, afundadas no relevo
    (`carveTrails`).
  - `GENERATION_VERSION` subiu a cada mudança no lugar das coisas.
- **Colisão**: tronco em pé e pedra = cilindro; tronco caído = cápsula
  deitada; no mesmo corpo do heightfield do chunk
  (`core/physics/colliders.js`), nascem e saem com ele. Copa, arbusto e
  planta baixa não colidem.
- **Pathfinding**: as pegadas dos sólidos (`footprintsIn`, procurando nos
  blocos), com a margem das caixas, bloqueiam a grade.
- **Vento**: `core/weather/wind.js` (`windStrengthOf`) mistura a força de
  cada clima pela força atual de cada tipo do `LocalWeather` — muda junto
  com a troca de clima, sem salto.
- **View** (`view/vegetation/`):
  - `windShader.js` — o vento em GLSL (rajada que viaja, dobra em arco da
    folha, as três camadas da copa) e os uniforms compartilhados. Ruído
    procedural (hash), sem a textura de ruído do repositório.
  - Materiais **Lambert** com o shader injetado (`onBeforeCompile`) —
    recebem sol, ambiente, sombra e névoa do jogo: `grassMaterial.js`
    (grama, com a folha de frente para a câmera de `grassBlades.js`),
    `canopyMaterial.js` (copas e arbustos: normal esférica, volume por
    vértice, sombra recortada), `propMaterials.js` (folhagem baixa, casca,
    musgo nas pedras). `toLambertMaterial` (`useVegetationModels.js`) troca
    o PBR dos `.glb`.
  - `useVegetationModels.js` — carrega e monta os modelos do MegaKit por
    partes (`PART_KINDS`), com a versão sem galhos de cada árvore (LOD);
    memorizado para não remontar a vegetação a cada render.
  - `vegetationScatter.js` + `vegetationMeshes.js` — grama e flores em
    blocos centrados nos chunks, posição por hash da célula (voltar ao lugar
    dá a mesma grama), até a névoa.
  - `chunkMeshes.js` + `instancing.js` — árvores (tom por árvore, perto e
    longe), sub-bosque, pedras e troncos caídos por bloco, com geometria
    compartilhada (`shareGeometry`).
  - `VegetationView.jsx` — monta os blocos de grama e os blocos de sólidos
    perto da câmera, os anéis da qualidade (`VEGETATION_QUALITY`: sub-bosque,
    sombra e árvores por distância) e atualiza vento e sol (um `useFrame`,
    exceção 3.4).
- **Água** (`view/water/`): só a superfície, por chunk (Parte 7).
- **Render** (`view/scene/RenderSettingsView.jsx`, `FrameLimiter.jsx`): a
  curva vem de `RENDER.TONE_MAPPING`; SMAA pelo `EffectComposer` do three,
  com a cena desenhada num alvo com a curva e o sRGB já aplicados (o céu da
  048 escreve cor de tela direto); MSAA (`RENDER.MSAA`) e limite de FPS
  (`RENDER.MAX_FPS`).
- **Copa e tronco clareados na sombra** (`TREES.LEAF_FILL`, `TRUNK_FILL`):
  o repositório clareia a sombra com a luz do céu de imagem (IBL), que o
  jogo não tem; sem isso, copa e tronco ficavam quase pretos.
- **Assets**: a grama do stylized-scene (`grass-blades.glb`) e os modelos do
  MegaKit em `public/assets/vegetation/megakit/`, preparados por
  `scripts/pack-forest-assets.py`.
- **Debug (F2)**: painel "Vegetação" (render, qualidade, liga/desliga,
  grama, conjuntos, árvores, floresta, vento, "Copiar valores"), trilhas no
  painel "Terreno", contador de desenho (`RenderStatsProbe`) e stats na tela.

---

## Fechamento

- **Teste no jogo pelo usuário**: aprovado. A curva de cor fica a ACES, com
  SMAA e MSAA desligados.
- **Roadmap**: 049 no "Já feito". Os biomas da beta passam a ser só os das
  7 espécies selvagens — floresta, planície e savana (050) e montanha
  (051); selva/pântano e praia/deserto saíram, e o resto andou dois
  números. Os outros biomas ficam na seed, vistos só pelo F2. Os 3
  iniciais não nascem no mundo (só no kit inicial). Marco 5: 081 a 084.
- **Wiki**: página "O mundo" — o mundo é todo floresta por enquanto, seção
  nova "A floresta" (plantas, trilhas, o que bloqueia, o vento com o
  clima), os lagos atravessáveis pelo fundo e a tabela de clima só com os
  biomas que aparecem no jogo.
- **Login**: o redirecionamento do `(auth)/layout.js`, comentado durante a
  bancada, voltou ao normal.
- **Gates**: `npm test` inteiro (216 arquivos, 2207 testes, com
  `--maxWorkers=2`), `npm run lint` e build (numa cópia, com o `next dev`
  rodando) passando.

---

## Critérios de Conclusão

- [x] A floresta tem árvores variadas em camadas, arbustos, samambaias,
      plantas de folha larga, cogumelos, flores nas clareiras, troncos
      caídos, pedras, trilhas e conjuntos de grama.
- [x] Grama, plantas e copas balançam com a mesma rajada; o vento fica mais
      forte com chuva, tempestade e neve, sem salto.
- [x] Tronco em pé, tronco caído e pedra bloqueiam o treinador e as
      criaturas, e a IA desvia; arbusto e planta baixa são atravessáveis.
- [x] Mesmo mundo para a mesma seed (árvores, pedras e trilhas no mesmo
      lugar).
- [x] Sem tranco perceptível ao carregar chunks (custo medido). O celular
      fica para o Marco 5 (082).
- [x] Curva de cor fixada no config (ACES, SMAA e MSAA desligados).
- [x] `npm run build`, `npm run lint` e `npm test` passando.
- [x] Wiki atualizada.

---

## Fora de escopo

- **Vegetação dos outros biomas** — planície e savana (050) e montanha
  (051); os demais (oceano, praia, selva, pântano, deserto, vulcânico e
  tundra) ficam escondidos, para depois da beta.
- **Luz BotW por hora, celular, ambiente e detalhes da floresta** — Marco
  5 (081 a 084).
- **Trilha pintada** do repositório — as trilhas da floresta entraram na
  Parte 7, com outra técnica; caminhos entre estruturas ficam para a 053.
- **Água de verdade** (nadar, colisão, criaturas da água) — 056; aqui só a
  superfície.
- **Céu de imagem e IBL** do repositório — fica o céu da 048.
- **Migrar para WebGPU/TSL.**
- **Grama alta com efeito de jogo** (esconder, ponto de spawn) — a tag
  continua para a 055.
- **Frutas e itens na vegetação** — 052.
- **Cortar/destruir vegetação.**
- **Grama amassando sob o jogador.**
