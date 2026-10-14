# 🚀 Versão 0.0.52 — Assets do LGPE e floresta

## Resumo

Primeira das quatro features da troca de arte (052 a 055): o cenário passa
a vir do **Pokémon Let's Go Pikachu/Eevee** (LGPE). A direção saiu do
laboratório da floresta (`/tools/teste-floresta-*`, `src/tools/forestLab/`):
das três páginas comparadas, o usuário escolheu **só assets do LGPE**.

Esta feature monta a **base** que os quatro biomas usam e já entrega a
**floresta** com ela. Planície (053), savana (054) e montanha (055) vêm
depois, cada uma com a busca dos assets dela no LGPE e os ajustes do
usuário. Até a vez delas, esses biomas continuam como estão.

O que entra:

- **Conversor do LGPE no projeto**: o do laboratório
  (`scripts/forest-lab/`) vira o empacotador dos assets do jogo — modelos
  dos mapas (separando as árvores e plantas fundidas), props soltos,
  texturas e o `manifest.json` com os números de cada material.
- **Material toon** nos modelos do LGPE: luz em degrau, sombra puxando
  para a cor de sombra do jogo original, luz de borda na cor de cada
  material e a cor por rampa das árvores redondas.
- **Vegetação por modelo do LGPE**: os mesmos lugares que o core já
  sorteia (árvores, pedras e troncos do core; sub-bosque, flores e mato
  pela densidade do bioma), com os modelos do LGPE no lugar dos do MegaKit.
  O bioma escolhe os modelos de cada tipo.
- **Mato alto do LGPE** nos conjuntos de grama (o "mato de encontro").
- **Chão com as texturas do LGPE**: cor da textura (não mais só o claro e
  escuro sobre a paleta), com grama, chão de mata pelas clareiras, trilha,
  encosta e margem.
- ~~A grama atual continua~~ — trocada pela do LGPE (ver "Correções da
  floresta").
- **Floresta** com tudo isso e as correções pedidas pelo usuário.

Versão: `0.0.52` (`package.json`). Branch:
`feature/052-assets-do-lgpe-e-floresta`.

> **Os números deste doc são fictícios (só ilustram).** O valor de verdade é
> o do campo citado (config, dado do bioma ou manifesto).

---

## O que já existe (ponto de partida)

- **Laboratório** (`src/tools/forestLab/`, README lá): três páginas de
  teste, com o próprio mundo, luz e painel. A do LGPE já mostra a floresta
  com os modelos e o chão do LGPE nos lugares do core.
- **Conversor** (`scripts/forest-lab/pack-lgpe.js`): `.gfbmdl` → GLB, DDS
  (BC1/BC3) → PNG, separação dos objetos fundidos nos mapas e o
  `manifest.json` (texturas por papel, corte do alfa, `Shadow_Color`,
  `RimColor`). 30 props hoje: árvores redondas da Rota 1, pinheiro, árvore
  jovem e tronco alto de Viridian, samambaias, trevos, tufos, mato alto,
  capim, arbustos, flores, pedras, árvore de Corte e pedra de Força.
- **Vegetação do jogo** (049/050/051): modelos do MegaKit por tipo
  (`VEGETATION_MODELS`), materiais próprios (copa, folhagem, casca, pedra
  com musgo), vento, LOD das árvores, sombra pela distância.
- **Chão do jogo** (047): cor da paleta por vértice + camadas de textura
  (só claro e escuro e normal) por papel do `ground` de cada bioma.

### Achados do laboratório (valem para a base)

- Nos mapas do LGPE cada tipo de árvore ou planta vem numa malha só; o
  conversor separa e fica com o objeto mais comum.
- O UV do LGPE vem de baixo para cima (as texturas carregam invertidas).
- A cor por vértice das árvores redondas é dado do jogo, não cor.
- As árvores redondas pintam a copa por uma rampa de cor lida pelo segundo
  UV (altura na copa).

---

## Correções da floresta (pedidas pelo usuário)

- **Samambaia do MegaKit na borda da floresta**: cada planta usava os
  modelos do bioma de mais peso onde estava — a samambaia da floresta que
  nascia do lado de um vizinho sem samambaia caía no padrão do MegaKit.
  Agora usa o bioma de mais peso **entre os que têm o tipo** (o que fez
  ela nascer, `dominantBiomeAt`); vale para todos os tipos.
- **Tronco caído removido do jogo**: nenhum bioma tinha mais
  (`fallen-log` saiu da floresta). Saíram o sorteio no core
  (`LOG_KIND`, `solids.logs`), a colisão, o `GAME_CONFIG.LOGS`, o modelo
  e as malhas na view, o painel e o laboratório. O mundo não muda (nenhum
  bioma sorteava). A wiki ("O mundo") ainda cita troncos caídos — sai no
  passo da wiki.
- **Grama só do LGPE (todos os biomas)**: a grama antiga (o tufo do
  stylized-scene com o shader próprio) saiu. A grama passa a ser a grama
  baixa e a moita do LGPE (`models` da entrada `tall-grass`, sem modelo
  padrão), com as mesmas regras de antes: densidade por bioma, conjuntos
  (a altura deles), manchas de altura, manchas de cor e claro e escuro —
  agora por instância, no tom. A cor do bioma virou duas tintas (`colors:
  { a, b }`) que multiplicam a textura (branco = textura pura). Saíram do
  `GRASS` o virar para a câmera, a sombra na base, a luz pela folha e o
  brilho de borda (o toon tem os dele); entraram `SCALE` e a `HEIGHT` como
  multiplicador vertical. O mato alto continua no miolo dos conjuntos.
  No F2 (Grama → No bioma → Modelos) escolhem-se os modelos da grama de
  cada bioma entre as opções do LGPE (`GRASS_MODEL_CHOICES`, carregadas
  sempre).
- **Tudo pelo vento, sem balanço próprio**: saíram `TREES.SWAY` e
  `LGPE.SWAY` (e os "Balanço" do F2). Todo modelo usa o vento da
  vegetação (`windShader.js` — direção, velocidade, rajadas, agitação,
  tremor e a força pelo clima): no toon do LGPE, as plantas (mato, tufo,
  flor, moita, trevo) dobram como as plantas do MegaKit e as árvores
  balançam como as copas, com o pé parado; pedra fica parada. A copa do
  MegaKit balança só pelo vento (amplitude fixa no shader).
- **Colisão pela malha** (pedras e troncos): o cilindro do tamanho da
  espécie (`TRUNK_RADIUS`, `ROCKS.RADIUS`) não batia com o modelo do LGPE
  — esbarrava no ar em volta da pedra e do tronco. Agora cada árvore e
  pedra com modelo do LGPE colide pelo **casco convexo da malha** (ver
  "Como ficou").
- **Câmera vê através dos objetos**: a câmera só aproxima quando o
  **chão** (relevo e montanhas) fica entre ela e o alvo
  (`resolveCameraCollision` com `groundOnly`). Árvores, pedras, plantas,
  caixas e personagens no caminho não aproximam mais: o que fica dentro de
  um cilindro em volta da linha câmera → alvo some em pontilhado
  (`view/materials/seeThrough.js`, `seeThroughSystem`,
  `CAMERA.SEE_THROUGH`). A sombra não muda; em primeira pessoa (Scan)
  desliga. Painel F2 novo, "Câmera": o ver-através (ligado, raio, borda,
  opacidade, folga no alvo) e a órbita (suavização, folga do chão, mais
  perto no chão), com "Copiar valores".
- **Pedras maiores e mais densas** (valores do usuário): a `density` do
  bioma pode passar de 1 (a chance satura) e o teste do `scale` por bioma
  usa um tamanho que caiba no chunk com o `ROCKS.SCALE` do config.

---

## Decisões

1. **Fonte única: LGPE.** Nada do Zelda entra no jogo. ~~A página do LGPE
   fica como bancada de ajuste~~ — no fechamento o usuário pediu para
   descartar o laboratório inteiro: as três páginas
   (`/tools/teste-floresta-*`), `src/tools/forestLab/`, o `pack-zelda.js`
   e as texturas do Zelda saíram.
2. **Modelos por bioma**: cada entrada do `vegetation` pode dizer os
   modelos dela (`models`); sem isso, vale o padrão do tipo. Assim a
   floresta e a planície podem usar árvores diferentes para o mesmo tipo.
3. **Bioma migrado ou não**: um bioma ainda não migrado (planície, savana,
   montanha até a vez deles) continua com o MegaKit e o chão de hoje. O
   MegaKit sai depois da 055 (junto da 081, limpeza).
4. **Grama**: ~~a atual fica~~ — virou a do LGPE em todos os biomas
   (pedido do usuário). O mato alto do LGPE entra por cima, no miolo dos
   conjuntos de grama.
5. **Luz**: a do jogo (dia e noite, clima) continua; o toon lê a luz da
   cena. A cor de sombra e a luz de borda vão para o `GAME_CONFIG`.

---

## Arquitetura (proposta)

### Assets

- `scripts/lgpe/` (saindo de `scripts/forest-lab/`): o mesmo conversor,
  com a lista de props por bioma. Saída em `public/assets/vegetation/lgpe/`
  (o laboratório passa a ler de lá).

### Vegetação (view)

- **Modelos**: `useVegetationModels` monta também os do LGPE (do
  manifesto), com o material toon; cada modelo vira as mesmas partes
  (`ModelPart`) que as malhas instanciadas já usam (`instancing.js`), com
  os papéis de sombra, tom e balanço.
- **Por bioma**: `models` na entrada do `vegetation` (com validação no
  registro dos biomas).
- **LOD**: as árvores do LGPE são leves (poucas centenas de triângulos):
  sem versão de longe, só a distância de desenho de sempre.
- **Mato alto**: tipo novo (`encounter-grass`), sorteado pela densidade
  dos conjuntos de grama, só no miolo deles.

### Chão (view)

- Modo **textura** no material do chão: as camadas passam a ter cor
  (além do claro e escuro e normal), e o bioma migrado usa a cor da
  textura no lugar da paleta. A mistura de chão de mata pelas clareiras
  entra como papel novo do `ground` (ex.: `shadeTexture`).
- O relevo distante (051) continua pela paleta — a paleta da floresta é
  ajustada para casar com as texturas do LGPE.

### Colisão

- O colisor e a pegada de cada árvore e pedra passam a vir do modelo do
  LGPE do bioma: casco convexo da malha (o tronco, na árvore), gerado dos
  `.glb` para o core.

### Testes (regras, sem fixar valores)

- Todo tipo de vegetação de bioma visível tem modelo (LGPE ou padrão) e
  todo `models` aponta para um prop do manifesto.
- Separação dos objetos fundidos (`splitObjects.js`): pedaços ligados e
  caixas que se tocam viram um objeto só.
- Os de sempre (origem em terra, mesmo mundo para a mesma seed).

---

## Etapas

- [x] Bump `package.json` → `0.0.52`, doc e roadmap (052–055 novas, as
      seguintes renumeradas).
- [x] Revisão do doc pelo usuário ("pode seguir"; correções durante).
- [x] Conversor em `scripts/lgpe/`, saída em `public/assets/vegetation/lgpe/`.
- [x] Material toon no jogo (+ config e painel F2).
- [x] Modelos do LGPE na vegetação; `models` por bioma (+ registro e testes).
- [x] Mato alto do LGPE.
- [x] Chão em modo textura (+ papel do chão de mata).
- [x] Colisão: pela malha do modelo do LGPE (casco convexo, ver "Como
      ficou").
- [x] Floresta migrada.
- [x] Correções da floresta.
- [x] Limpeza do painel F2: abas Terreno e Vegetação (+ painel Câmera novo).
- [x] Laboratório: removido inteiro (pedido do usuário no fechamento).
- [x] Conferir no jogo (bancada) e desempenho na Intel UHD.
- [x] Teste no jogo pelo usuário e ajustes.
- [x] Wiki: página "O mundo" (floresta e a câmera que vê através).
- [x] Roadmap: 052 para "Já feito".
- [x] Gates: `npm test` inteiro, `npm run lint` e build.

---

## Como ficou (implementação)

- **Conversor** (`scripts/lgpe/`): o do laboratório, com a saída em
  `public/assets/vegetation/lgpe/`. Depois dele, `colliders.js` (os
  cascos de colisão, ver "Colisão pela malha").
- **Laboratório removido** (pedido do usuário no fechamento): saíram
  `src/tools/forestLab/`, as páginas `/tools/teste-floresta-lgpe`,
  `-zelda` e `-mista`, `scripts/forest-lab/` (o `pack-zelda.js`) e
  `public/assets/lab/` (as texturas do Zelda).
- **Material toon** (`view/vegetation/toonMaterial.js`): o do
  laboratório, com os números no `GAME_CONFIG.LGPE` (painel F2 →
  Vegetação → "Let's Go (toon)"), o balanço pelo vento da vegetação e a
  luz de borda apagando à noite (`uSunGlow`).
- **Modelos** (`view/vegetation/lgpeModels.js`): `useVegetationModels`
  carrega o manifesto e só os modelos que algum bioma usa (`models`), e
  monta cada um nas partes de sempre (`toon` faz sombra pela qualidade,
  `toon-low` não — `instancing.js`).
- **Por bioma** (`view/vegetation/biomeModels.js`): cada árvore, pedra,
  planta e flor usa os modelos do bioma de mais peso onde está
  (`modelsOf`: os `models` da entrada ou o padrão MegaKit). Nas plantas
  baixas e flores do LGPE, o tamanho é `LGPE.PLANT_SCALE` vezes o `scale`
  da entrada (os modelos já vêm em metros).
- **Mato alto** (`encounter-grass`, `buildEncounterGrassMeshes`): montado
  com os blocos de grama, só nos biomas com a entrada, no miolo dos
  conjuntos de grama (`ENCOUNTER_GRASS`).
- **Chão** (`terrainGeometry.js`, `terrainMaterial.js`): camadas de cor
  (`TERRAIN_COLOR_LAYERS`, texturas do LGPE) e, nos biomas com
  `ground.colors`, a cor delas no lugar da paleta, por papel (`base`,
  `shade` pelas clareiras do core, `shore`, `trail`, `slope`, `high`,
  `peak` — `addColorLayers`), na parte do vértice que é desses biomas: a
  fronteira com um bioma não trocado mistura sem degrau. O desenho antigo
  (claro e escuro) sai dessa parte. `TERRAIN_LOOK.COLOR_TEXTURE_SIZE`.
- **Colisão pela malha**: `scripts/lgpe/colliders.js` lê os `.glb`
  empacotados e grava `src/core/data/lgpeColliders.json` — por prop de
  árvore ou pedra, os pontos de um casco convexo (os mais longe em cada
  direção) e o `reach` (afastamento do eixo no chão). Pedra: a malha
  inteira. Árvore: só o tronco (os vértices abaixo da copa, acima das
  raízes), esticado até o alto do modelo — a copa não colide e não dá
  para subir no toco. Rodar de novo quando o `pack-lgpe.js` mudar os
  props.
  - O core escolhe o modelo de cada sólido como a view
    (`core/vegetation/solidModels.js`: `dominantBiomeAt` e `entryOf`
    saíram da view; o sólido guarda o `biome` e o `variant` escolhe o
    modelo) e o colisor é o casco no `scale` e no giro dele
    (`ColliderDesc.convexHull`), com a pedra na mesma base afundada da
    view (`rockBaseY`). Bioma sem modelo do LGPE: o cilindro de antes.
  - A pegada que a navegação e o sub-bosque evitam passa a ser o círculo
    do casco (`solidFootprintOf`); a folga da borda conta o maior `reach`
    dos modelos do tipo no chunk. O sorteio (encostar nos vizinhos, copa)
    segue pelos números da espécie.
- **Floresta**: árvores redondas (folhosa e antiga), pinheiro de
  Viridian, árvore jovem (no lugar da morta), samambaias, moita redonda,
  trevos, tufos, pedra com trevo, pedrinha na trilha, flores e o mato
  alto; chão de grama, chão de mata, terra e pedra do LGPE. Saíram o
  tronco caído e o cogumelo (o LGPE não tem). A paleta virou a média das
  texturas (relevo distante). `GENERATION_VERSION` subiu.
- **Testes**: todo `models` existe no manifesto; camadas de cor
  empacotadas e válidas nos biomas; regras da mistura de cor (somam o
  peso do bioma; mata fechada = chão de mata; trilha = terra); geometria
  (desenho + cor somam 1). O teste dos sólidos passou a montar o tronco
  caído na cópia do bioma (nenhum visível tem mais) e a contar o `scale`.
- **Painel F2, aba Terreno** (limpeza pedida pelo usuário): saíram o
  "Chão por bioma" (com o modo de cor do debug e a `palette.debug` dos
  biomas) e a pasta "Desenho do chão" (o `TERRAIN_LOOK` vai direto para o
  material). Entrou "Texturas do chão": escolhe o bioma e a textura do
  Let's Go de cada área (`ground.colors`: chão, mata fechada, trilha,
  margem, encosta, alto e pico); sem textura no chão, o bioma volta ao
  chão antigo. A trilha perdeu as texturas antigas (ficaram as cores de
  longe). "Copiar valores" leva o `ground.colors` de cada bioma.
- **Painel F2, aba Vegetação**: "Render" ficou só com FPS máximo e
  Stats (curva de cor e SMAA saíram do painel, não do jogo). "Mostrar",
  "Let's Go (toon)" e "Vento" iguais. As outras pastas viraram uma por
  item do "Mostrar" — Grama (tufo e, por bioma, densidade, cores e
  conjuntos), Flores, Árvores (o comum e uma subpasta por espécie),
  Arbustos/samambaias/plantas (uma subpasta por planta; cogumelo fora) e
  Pedras —, cada uma com "Densidade no bioma". O que o
  core sorteia (árvores, pedras) refaz o terreno ao soltar.
  "Copiar valores" leva o `vegetation` de cada bioma.
- **Conferido no jogo** (bancada, meio-dia, dentro da floresta): árvores
  e plantas do LGPE, chão de mata escuro, trilha de terra e a grama
  atual. Sem erro novo no console.

- **Desempenho** (bancada na Intel UHD, fechamento): produção da 0.0.51
  (o commit anterior) contra a 052, intercaladas em três rodadas, 1920 ×
  1080, meio-dia, dentro da floresta fechada, câmera padrão. Medido (não
  fictício), em proporção: a 052 roda a cerca de **2,4 vezes o FPS** da
  0.0.51 (ela fica no teto de 60 Hz; a anterior não chegava à metade),
  com cerca de **30% menos tempo de GPU** por quadro, **40% menos
  desenhos** e **um terço dos triângulos** — os modelos do LGPE são bem
  mais leves que os do MegaKit. Na foto da bancada, a cena completa e o
  ver-através funcionando (a árvore na frente do treinador em
  pontilhado). Sem erro novo no console (os 404 de sempre, iguais nas
  duas: um ícone de habilidade e os scripts da Vercel).

---

## Critérios de Conclusão

- [x] A floresta usa só modelos e texturas do LGPE (a grama também).
- [x] Planície, savana e montanha continuam como estavam — menos a grama,
      que virou a do LGPE em todos os biomas (pedido do usuário).
- [x] Mesmo mundo para a mesma seed; árvores e pedras colidem (pela malha).
- [x] Desempenho na Intel UHD no nível de hoje na floresta (melhor — ver
      "Desempenho").
- [x] `npm run build`, `npm run lint` e `npm test` passando.
- [x] Wiki atualizada.

---

## Fora de escopo

- **Planície, savana e montanha** — 053, 054 e 055.
- **Modelos dos Pokémon do LGPE** — 058 (o conversor daqui é o ponto de
  partida).
- **Céu do LGPE** (`skydome01`, formato BC7) — depois, se fizer falta.
- **Mato alto com ossos** (o balanço do jogo original) — balanço simples
  no shader por enquanto.
