# 🚀 Versão 0.0.50 — Planície e savana

## Resumo

Sexta feature do Marco 2 (mundo procedural): fecha a **planície** e a
**savana** em cima da base de vegetação da 049, como a floresta foi
fechada. Os dois saem do `BIOMES.HIDDEN` e passam a dividir o mundo com a
floresta — são os biomas de Pidgey, Rattata, Pikachu (planície) e Rattata,
Spearow, Ekans (savana), que nascem na 055.

O que entra:

- **Planície**: campo aberto no estilo dos jogos de Pokémon — conjuntos de
  mato alto com chão ralo entre eles, manchas de flores, folhosas isoladas
  ou em capões pequenos, arbustos (com e sem flor) e pedras.
- **Savana**: campos grandes de capim amarelo, **acácias** isoladas,
  arbustos secos, pedras maiores e uma ou outra árvore morta.
- **Acácia** (`acacia-tree`): modelo novo, montado a partir de peças do
  MegaKit (não há acácia nos kits).
- **Trilhas** de terra batida nos dois biomas.
- **Chão da savana** sem a terra rachada (que lia como deserto).
- Ajuste visual de cada bioma (cores do chão e da vegetação casando com a
  grama, como na Parte 10 da 049).

Versão: `0.0.50` (`package.json`). Branch: `feature/050-planicie-e-savana`.

> **Os números deste doc são fictícios (só ilustram).** O valor de verdade é
> o do campo citado (config ou dado do bioma).

---

## O que já existe (ponto de partida)

- **Planície** (`core/data/biomes/plains/`): relevo, paleta e chão
  (`grass`) da 047; `vegetation` com `tall-grass` (cores, sem `clusters`),
  `flower`, `broadleaf-tree` e `rock`. Sem trilha, clareira nem manchas.
- **Savana** (`core/data/biomes/savanna/`): relevo, paleta e chão
  (`dry-ground`) da 047; `vegetation` com `tall-grass` (cores, sem
  `clusters`), `acacia-tree` e `rock`. A `acacia-tree` só está declarada:
  não tem modelo, não está em `STANDING_TREE_KINDS` nem em
  `VEGETATION_MODELS`, então hoje não nasce.
- **Base da vegetação** (049): densidade por tipo com clareiras, manchas,
  trilhas e conjuntos de grama (`createKindDensity`); sólidos por bloco
  (`solidPlacement.js`) com colisão e pathfinding; sub-bosque, grama e
  flores só visuais; vento; LOD das árvores; anéis de qualidade; F2 com
  "Copiar valores".
- **Modelos** (`scripts/pack-forest-assets.py`, `public/assets/vegetation/
  megakit/`): folhosa, antiga, pinheiro, morta, arbustos, flores, samambaia,
  planta de folha larga, cogumelo, pedras e seixos. Folhas na versão
  branca, tingidas por espécie.
- **Kits extraídos** em `~/.cache/rota151-kits/` (MegaKit e Ultimate) —
  nenhum tem acácia. O Ultimate tem bétula e bordo com folha branca.
- **Camadas do chão** (`scripts/pack-terrain-textures.py`, Poly Haven):
  `grass`, `forest-floor`, `sand`, `snow`, `dry-ground`, `mud`, `rock`,
  `volcanic-rock`.

---

## Decisões (com o usuário)

1. **Acácia montada do MegaKit** no `pack-forest-assets.py`: tronco
   inclinado da `TwistedTree` e copa achatada em guarda-chuva, folha branca
   tingida de verde seco. Mesmo estilo do resto, sem asset novo de fora.
2. **Identidade de cada bioma** como no Resumo: planície aberta com
   conjuntos de mato e flores; savana de capim amarelo com acácias
   isoladas.
3. **Trilhas nos dois** (`trails: true`), de terra batida mais clara que a
   da floresta.
4. **Chão da savana sem a `dry-ground`**: primeiro testar as camadas que já
   existem com a paleta da savana; se nenhuma servir, uma camada nova do
   Poly Haven (terra seca sem rachadura), escolhida no jogo com o usuário.
5. **Desempenho depois dos biomas prontos**: medir na bancada (Intel UHD)
   só com os dois biomas fechados — feito na Parte 3, a pedido do usuário.

---

## Arquitetura

### Acácia

- **Modelo** (`scripts/pack-forest-assets.py`): entrada nova em `MODELS`,
  com nomes de material próprios (`Bark_Acacia`, `Leaves_Acacia`). As
  peças vêm da `TwistedTree` (tronco e galhos) e das folhas brancas do
  MegaKit; a copa é achatada na vertical e alargada (transformação no
  script, sobre os vértices da copa), para o perfil de guarda-chuva.
  Algumas variações (`acacia-1..N`), como as outras árvores.
- **Core** (`solidPlacement.js`): `ACACIA_KIND` em `STANDING_TREE_KINDS`
  (antes da folhosa — copa larga, ocupa o chão primeiro), com bloco próprio
  no `GAME_CONFIG` (`ACACIAS`: `TRUNK_RADIUS`, `CROWN_RADIUS`, `SCALE`,
  `LEAF_COLOR`...). Colisão pelo tronco, como as outras. Sobe
  `GENERATION_VERSION`.
- **View**: `acacia-tree` em `VEGETATION_MODELS`; as partes caem nos
  `PART_KINDS` que já existem (copa com vento e normal esférica, casca).
  Versão sem galhos para o LOD, como as outras árvores. Cor da folha e da
  casca no F2 → Árvores.

### Dados dos biomas (`core/data/biomes/`)

- **Planície**: `tall-grass` com `clusters` (conjuntos de mato, fundo ralo
  — estilo Pokémon); `flower` em manchas (`patches`); `broadleaf-tree`
  rara, em capões (`patches`); `bush` (os dois modelos, com e sem flor);
  `rock`; `pebble` na trilha; `trails: true`; `palette.trail`;
  `ground.trailTexture`.
- **Savana**: `tall-grass` com `clusters` em campos grandes (capim alto,
  cor seca); `acacia-tree` espalhada; `dead-tree` rara; `bush` (folha seca,
  ver abaixo); `rock` com pedras maiores; `pebble` na trilha;
  `trails: true`; chão novo (Decisão 4).
- **Cor por bioma das plantas que já existem**: hoje a cor da folha é por
  espécie (`BUSHES.LEAF_COLOR`, `TREES.LEAF_COLOR`...). Para o arbusto seco
  da savana, a entrada do `vegetation` ganha uma cor opcional (`color`;
  começou como `leafColor` e passou a valer também para a pedra na Parte 2)
  que vence a do config naquele bioma; o `_template` documenta.
- **Bétula** do Ultimate: **não entra** de início; fica anotada como opção
  para os capões da planície, se a folhosa não der identidade.

### Cores

- Mesmo método da Parte 10 da 049: a grama de cada bioma é a referência;
  chão, folhas, arbustos e pedras na família dela. Medir na tela (bancada
  Playwright) e conferir em mais de um horário e no clima de chuva.
- A luz do dia (048) não muda (081, Marco 5).

### Transição entre biomas

- A densidade já mistura pelo peso dos biomas no ponto; conferir no jogo a
  borda floresta → planície → savana (mata rareando, acácias aparecendo
  aos poucos) e ajustar só os dados se precisar.

### Debug (F2)

- Acácia no F2 → Árvores (como as outras espécies).
- Os conjuntos de grama, as trilhas e o "Copiar valores" já são por bioma
  (049): planície e savana entram sozinhas ao terem `clusters`/`trails`.

### Testes (regras, sem fixar valores)

- Registro dos biomas: a acácia e os campos novos (`color`) validados.
- `solidPlacement`: acácia nasce só onde o bioma declara, respeita
  `CROWN_RADIUS` e a pegada do tronco; mesma seed = mesmas acácias.
- `vegetationAssets`/modelos: todo tipo declarado num bioma visível tem
  modelo (pegaria a `acacia-tree` sem modelo).

---

## Etapas

- [x] Bump `package.json` → `0.0.50` e doc da feature.
- [x] Acácia: modelo montado no `pack-forest-assets.py` + LOD.
- [x] Acácia: `ACACIA_KIND`, `GAME_CONFIG.ACACIAS`, colisão, pathfinding,
      `GENERATION_VERSION` + testes.
- [x] Acácia na view (`VEGETATION_MODELS`) e no F2.
- [x] `color` por bioma na entrada do `vegetation` (+ `_template` e
      teste do registro).
- [x] Planície: vegetação (conjuntos, flores, capões, arbustos, pedras,
      seixos) e trilhas.
- [x] Savana: vegetação (capim, acácias, árvore morta, arbustos secos,
      pedras, seixos) e trilhas.
- [x] Chão da savana: camada existente (`grass`) com a paleta seca.
- [x] Cores dos dois biomas casando com a grama (bancada, Partes 1 e 2;
      aprovado pelo usuário: "ficou bom").
- [x] Planície e savana fora do `BIOMES.HIDDEN`; bordas com a floresta
      conferidas (Parte 2).
- [x] Revisão dos dois biomas: pedras, flores e o bug das texturas
      recortadas (Parte 2).
- [x] Desempenho na Intel UHD, em dev e no build de produção (Parte 3).
- [x] Pedras maiores na savana, seixos claros e folha da acácia (Parte 4).
- [x] Wiki: página "O mundo" (planície e savana).
- [x] Roadmap: 050 para "Já feito".
- [x] Gates: `npm test` inteiro, `npm run lint` e build (numa cópia).

---

## Como ficou (implementação)

- **Acácia** (`scripts/pack-forest-assets.py`, `SHAPED_MODELS`): as cinco
  `TwistedTree` deformadas por `umbrella` — tudo abaixo das folhas mais
  baixas vira o tronco (esticado até `ACACIA_SHAPE.trunk` e afinado por
  `thin` em volta do eixo dele); o resto é achatado na espessura `crown` e
  aberto por `spread`. Casca e folhas passam pela mesma deformação, então
  os galhos continuam ligados às folhas; as normais seguem a escala de
  cada eixo. Materiais `Bark_Acacia`/`Leaves_Acacia` (casca da TwistedTree,
  folha redonda branca). O script aceita nomes de saída para gravar só
  alguns modelos (`... acacia-1 acacia-2`).
- **Core**: `ACACIA_KIND` em `STANDING_TREE_KINDS` (depois da antiga, antes
  do pinheiro), bloco `GAME_CONFIG.ACACIAS`; colisão, pathfinding e LOD
  pelo caminho das outras árvores. `GENERATION_VERSION` subiu.
- **Cor por bioma** (`view/vegetation/biomeColor.js`): `color` na entrada
  do `vegetation` (árvores, `bush` e `rock`, `KIND_COLOR`). Cada instância
  leva o fator `color ÷ cor do tipo no config`, misturado pelo peso dos
  biomas no ponto (como o musgo das pedras), multiplicado no tom de cada
  objeto (`chunkMeshes.js`). Mexer na cor do tipo no F2 só acerta o fator
  ao remontar a vegetação.
- **Planície**: conjuntos de grama com fundo bem ralo, flores em manchas,
  folhosas em capões (`patches`), arbustos mais claros que os da mata
  (`color`), pedras com pouco musgo, seixos e trilhas de terra clara.
- **Savana**: acácias espalhadas, árvore morta rara, arbustos secos e
  pedras de arenito (`color`), seixos, trilhas e capim em campos grandes e
  mais alto (`clusters.height`). Chão com a camada `grass` e a paleta seca no
  lugar da `dry-ground`.
- **Mundo**: planície e savana fora do `BIOMES.HIDDEN`. Na seed do jogo, a
  origem cai na planície (o treinador nasce nela).
- **Testes**: cada espécie de árvore tem números no config e nasce no
  bioma que a declara (`solidPlacement.test.js`); todo tipo dos biomas
  visíveis tem modelo, e toda parte com cor tem um jeito de desenhar
  (`vegetationAssets.test.js`); `color` (`biomeColor.test.js` e o
  registro). O teste "tem vales abaixo da água" (`terrainChunkSet.test.js`)
  olhava só os chunks em volta da origem e dependia do bioma dela: agora
  procura numa área maior.
- **Conferido no jogo** (bancada Playwright, meio-dia e fim de tarde):
  acácias em guarda-chuva, capim amarelo, trilha com seixos; na primeira
  rodada as copas e os arbustos ficaram escuros demais contra o campo
  claro e foram clareados.

O usuário aprovou a Parte 1 no jogo ("ficou bom") e pediu a revisão dos
dois biomas e a avaliação de desempenho (Partes 2 e 3).

---

## Parte 2 — Revisão dos dois biomas

Olhado na bancada (meio-dia, dois pontos de cada bioma e as três bordas,
três direções em cada).

**Bordas**: a mata rareia aos poucos para o campo; acácias aparecem ao
longe na planície perto da savana. Nada a mudar.

**Bug das texturas recortadas (vinha da 049)**: `buildPart`
(`useVegetationModels.js`) dividia a textura pelo NOME do material. As
texturas recortadas do atlas (`Flowers`, `Leaves`, `Rocks`, `PathRocks`)
vêm embutidas em cada `.glb` com o mesmo nome, então todo modelo usava o
recorte do primeiro que carregou: as flores pegavam as pétalas azuis e
roxas do arbusto florido (por isso saíam roxas — o pacote tem flores
vermelhas e amarelas), a samambaia e as plantas usavam a folha da flor, as
três pedras o recorte da primeira e os quatro seixos o do primeiro. Agora
só se divide o que é mesmo um arquivo ao lado dos `.glb`
(`SHARED_TEXTURES`, `vegetationAssets.js` — casca e folhas das árvores,
espelho dos `'shared'` do script). Teste: `useVegetationModels.test.js`.
Muda também a floresta (samambaia, plantas, pedras e seixos com a textura
certa).

**Pedras**: a textura do MegaKit é escura e esverdeada e, em Lambert, o
lado sem sol ficava quase preto no campo aberto. Ganharam cor
(`ROCKS.COLOR`), brilho (`BRIGHTNESS`, clareia a textura) e preenchimento
da sombra (`FILL`, como a casca) — `applyRockLook`, no F2 → Floresta. A
pedra recebe o tom do lugar e a cor por bioma (`color` da entrada `rock`):
na savana, arenito.

**`leafColor` → `color`**: o campo da cor por bioma passou a valer para a
pedra também (`biomeColor.js`, `KIND_COLOR`).

**Fica para depois** (sugestões, não feitas): pedras maiores na savana e
seixos da trilha escuros — feitos na Parte 4; flores mais baratas do Ultimate
(`Flower_*_Clump`, 136 triângulos contra ~1.700 da `Flower_4_Group`), se as
flores pesarem no celular (082).

## Parte 3 — Desempenho

Bancada Playwright na GPU de verdade (Intel UHD, 1920×1080, meio-dia,
céu limpo), biomas intercalados (a GPU integrada oscila entre execuções).

**GPU parado, antes dos cortes** (dev, quatro pontos por bioma, duas
rodadas): floresta ~35 ms, planície ~25 ms, savana ~32 ms por quadro.
Escondendo cada parte na mesma sessão: na floresta pesam grama (~12 ms) e
copas (~12 ms); na planície, a grama (~12 ms); na savana, a grama
(~20 ms) — a copa quase não pesa nos campos abertos.

**Grama da savana mais leve**: A/B na mesma sessão (três pontos, duas
rodadas) mexendo na entrada `tall-grass` da savana — com menos densidade,
cobertura e fundo, ~32,5 → ~25 ms, e o campo continua de capim alto e
dourado (conferido nas fotos lado a lado). Aplicado nos dados da savana.

**Correndo, o gargalo era a CPU** (a GPU gastava ~30 ms, o quadro ~47):
perfil de CPU (CDP) correndo na planície — montar os blocos de grama
levava ~1,4 s a cada 8 s, quase tudo no campo dos conjuntos de grama:
- `createGrassClusterField` buscava os quatro cantos num `Map` com chave
  de texto (quatro strings por tufo) e `grassClusterAt` procurava de novo
  as seis camadas de ruído a cada ponto. Agora as camadas e as constantes
  saem uma vez por campo (`createGrassClusterSampler`), a chave do canto é
  numérica e os quatro cantos da última célula ficam guardados. Medido em
  Node: ~1,1 → ~0,3 ms por bloco, com o resultado idêntico (diferença 0).
  No jogo, montar a grama correndo caiu para ~0,7 s a cada 8 s.
- As malhas da vegetação não recalculam mais a matriz a cada quadro
  (`finishMesh`: ficam paradas na origem, `matrixAutoUpdate` desligado —
  são centenas).
- Correndo (dev, duas rodadas): ~21–22 → ~23–25 FPS, pior quadro (p95)
  ~108 → ~85 ms, nos três biomas.

**Build de produção** (o que a família joga; dev infla a CPU com o React
de desenvolvimento): numa cópia, `next start`, uma página por ponto com o
save falso. GPU parado: floresta ~30 ms, planície ~25 ms, savana ~24 ms;
correndo: ~29–33 quadros por segundo de navegador, p95 ~62–71 ms. Os dois
biomas novos ficam dentro do que a floresta já gastava.

**Fica para depois**: o celular (082); o que sobra correndo no perfil é o
React de desenvolvimento (some no build), o percurso da cena do three por
quadro e a compilação de shader na primeira acácia que aparece.

## Parte 4 — Pedras maiores na savana e seixos claros (pedido do usuário)

- **Tamanho por bioma** (`scale` na entrada do `vegetation`, objetos com
  colisão): no core (`createScaleField`, `solidPlacement.js`), o tamanho
  sorteado é multiplicado pelo `scale` dos biomas no ponto (misturado pelo
  peso, como a densidade). A pegada, o colisor e o desvio usam esse tamanho
  final; a folga da borda (`borderGapOf`) conta o maior `scale` do chunk,
  para a pegada continuar dentro dele. Na savana, pedras bem maiores
  (pedregulhos). `GENERATION_VERSION` subiu. Testes: o `scale` multiplica
  o tamanho e a pegada maior continua dentro do chunk
  (`solidPlacement.test.js`); o registro confere o campo.
- **Seixos** (`PathRocks`): a textura é tão escura quanto a das pedras e
  eles ficavam como pontos pretos na trilha. Viraram a parte `pebble`: o
  material da pedra (cor, brilho e preenchimento da sombra do `ROCKS`, cor
  por bioma), sem fazer sombra (pequenos e muitos). Na savana, o mesmo
  arenito das pedras.
- **Brilho das pedras**: comparado no mesmo enquadramento (savana, trilha,
  planície) com o brilho e o preenchimento da sombra mais altos — ficou o
  do meio (com o mais alto a pedra perdia o volume). Conferido também na
  floresta: topo de musgo verde, corpo mais claro.
- **Folha da acácia** (pedido do usuário): verde-oliva acinzentado, mais
  seco que o verde-amarelado de antes — escolhido entre quatro tons no
  mesmo enquadramento (`ACACIAS.LEAF_COLOR`).

---

## Fechamento

- **Teste no jogo pelo usuário**: aprovado ("ficou bom"; depois das
  Partes 2 a 4, "ótimo").
- **Roadmap**: 050 no "Já feito" (grupo "Pokémon e mundo"). As flores mais
  leves do Ultimate, se pesarem no celular, entraram no item 082 do
  Marco 5.
- **Wiki**: página "O mundo" — a lista dos três biomas e a passagem aos
  poucos entre eles, seções novas "A planície" e "A savana"; o "em breve"
  agora fala só da montanha, da água, das cavernas, dos itens e do
  Pokécenter.
- **Gates**: `npm test` inteiro (219 arquivos, 2253 testes, com
  `--maxWorkers=2`), `npm run lint` e build (numa cópia, com o `next dev`
  rodando) passando.
- **Bancada**: o redirecionamento do `(auth)/layout.js`, comentado durante
  as fotos e medições, voltou ao normal.

---

## Critérios de Conclusão

- [x] A planície tem conjuntos de mato alto, flores, folhosas em capões,
      arbustos, pedras e trilhas, com cores casando com a grama.
- [x] A savana tem capim amarelo, acácias, uma ou outra árvore morta,
      arbustos secos, pedras e trilhas, com chão sem cara de deserto.
- [x] A acácia colide, entra no pathfinding e balança com o vento.
- [x] Planície e savana aparecem no mundo, com borda suave com a floresta.
- [x] Mesmo mundo para a mesma seed.
- [x] `npm run build`, `npm run lint` e `npm test` passando.
- [x] Wiki atualizada.

---

## Fora de escopo

- **Desempenho no celular** — 082 (aqui só a Intel UHD do PC, Parte 3).
- **Montanha** — 051.
- **Itens no mundo e árvores de frutas** — 052.
- **Spawn das espécies por bioma** — 055.
- **Água de verdade** — 056.
- **Luz BotW por hora** — 081.
- **Som ambiente por bioma** — 083 (floresta) e depois.
