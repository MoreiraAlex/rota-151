# 🚀 Versão 0.0.47 — Biomas

## Resumo

Terceira feature do Marco 2 (mundo procedural). O relevo único da 045 passa a
variar por **bioma**: um mapa de clima por ruído (temperatura, umidade e
distância do mar) escolhe o bioma de cada ponto, e cada bioma define o relevo,
as cores do chão, a vegetação que vai ter (colocada na 049) e as tags que o
spawn usa (055).

- **Todos os biomas que os 151 precisam**, já nesta beta — o objetivo é fechar
  o terreno agora, para as próximas betas não mexerem no mapa.
- **Bioma muda o relevo**, não só a cor: montanha alta, planície lisa, oceano
  abaixo da água.
- **Transição suave**: perto da fronteira os biomas se misturam pelo peso de
  cada um (altura e cor), sem degrau nem recorte.
- **Tamanho por bioma**: cada bioma tem o próprio tamanho típico (uns
  maiores que outros), na casa de alguns minutos andando para atravessar.
- **Treinador nasce sempre em `(0, y, 0)`**, em terra firme.
- **Debug (F2)**: bioma atual no painel, chão colorido por bioma e parâmetros
  de cada bioma no painel de ajuste.

Versão: `0.0.47` (`package.json`). Branch: `feature/047-biomas`.

> **Números deste doc são fictícios (ilustrativos).** O valor de verdade é o
> do campo citado (config).

---

## O que já existe (ponto de partida)

- **Relevo** (`core/terrain/terrainHeight.js`, `createHeightSampler`): uma
  soma de camadas de simplex com parâmetros globais de
  `GAME_CONFIG.TERRAIN` (`HILL_SIZE`, `HILL_HEIGHT`, `ROUGHNESS`,
  `FLATNESS`). Seed da geração por `deriveSeed(WORLD.SEED, 'terrain')`.
- **Chunks** (`terrainChunk.js`, `terrainChunkSet.js`): alturas amostradas
  em coordenada de mundo; `heightAt` igual com e sem chunk carregado
  (`latticeHeightAt`); `GENERATION_VERSION` identifica a receita.
- **Cores** (`view/terrain/terrainPalette.js`, `terrainGeometry.js`): cor por
  vértice pela altura acima da água e pela inclinação — paleta provisória
  "até os biomas (047)".
- **Água**: só o nível (`WATER_LEVEL`) e o plano de debug; visual e bloqueio
  são da 056.
- **Painel de ajuste (F2)** (`tools/debug/TerrainTuningPanel.jsx`) e
  `regenerarTerreno`, que refaz os chunks carregados com a config nova.
- **Save**: posição salva dentro do relevo sobe para a superfície (044/045).

---

## Decisões (com o usuário)

1. **Biomas para os 151**: a lista cobre os habitats da 1ª geração (tabela
   abaixo). Caverna e cidade não são bioma de superfície (ver "Fora de
   escopo").
2. **Bioma define o relevo**, com mistura suave pelo peso de cada bioma na
   fronteira.
3. **Tamanho por bioma**: cada bioma tem o seu (`size`, largura típica em
   metros), uns maiores que outros. Referência: médio = 6–8 chunks
   (fictício), uns 3–4 minutos andando.
4. **Nascer em `(0, y, 0)`**, seja qual for o bioma; quando vierem as
   cidades/estruturas, isso é revisto. A origem é garantida em terra firme
   (ver "Origem em terra").
5. **Vegetação**: a 047 só **declara** o que cada bioma tem (tipos e
   densidade); a 049 coloca os objetos.
6. **Tags de spawn** definidas por bioma agora; quem consome é a 055.
7. **Água não bloqueia**: como hoje, dá para entrar no oceano e nos lagos
   e andar pelo fundo, sem animação nenhuma (a água nem aparece fora do
   plano de debug). Visual e regra da água seguem para a 056 e são revistos
   no caminho.
8. **Cavernas pela seed, sem ser estrutura** (opção "híbrida"): a
   superfície continua mapa de alturas e as cavernas viram uma camada
   subterrânea gerada pela seed, na 057 — não mexe na
   superfície fechada aqui. A 047 só prevê onde as bocas aparecem
   (montanha).
9. **Debug (F2)**: nome do bioma onde o jogador está, chão colorido por
   bioma (liga/desliga) e parâmetros de cada bioma no painel de ajuste.

---

## Biomas

Espécies só como referência de habitat (quem decide o spawn é a 055).

| Bioma | Clima | Relevo | Exemplos de espécie |
|---|---|---|---|
| **Oceano** | qualquer, longe da costa | abaixo da água, fundo | Tentacool, Horsea, Goldeen, Magikarp, Lapras, Seel |
| **Praia** | qualquer, na costa | baixo e plano, desce até a água | Krabby, Shellder, Staryu, Slowpoke, Psyduck |
| **Planície** | temperado, médio | quase plano, colinas baixas | Pidgey, Rattata, Pikachu, Nidoran, Doduo |
| **Savana** | quente, seco | plano, ondulação larga | Tauros, Kangaskhan, Ponyta, Rhyhorn |
| **Floresta** | temperado, úmido | colinas médias | Caterpie, Weedle, Oddish, Bellsprout, Bulbasaur |
| **Selva** | quente, muito úmido | colinas irregulares | Paras, Tangela, Exeggcute, Scyther |
| **Pântano** | temperado/quente, encharcado | muito plano, rente à água | Ekans, Grimer, Koffing, Venonat, Poliwag |
| **Deserto** | quente, muito seco | dunas largas | Sandshrew, Diglett, Cubone, Ekans |
| **Montanha** | frio a temperado, relevo alto | morros altos e íngremes, pico nevado pela altura | Geodude, Onix, Machop, Mankey, Spearow, Clefairy |
| **Vulcânico** | quente, relevo alto, raro | íngreme, rocha escura | Charmander, Vulpix, Growlithe, Magmar |
| **Tundra** | gelado | colinas suaves com neve | Jynx, Seel, Dewgong, Cloyster |

- **Pico nevado** não é bioma: é a cor do alto da montanha pela altura.
- **Lagos e rios** (056) cortam qualquer bioma de terra; a tag "perto de
  água" vem de lá.
- O clima de cada bioma (chuva, neve, tempestade) é da 048.

---

## Arquitetura

### Dados dos biomas (`core/data/biomes/`)

Uma pasta por bioma, mesma forma de `species/` (`biomes/<id>/index.js` +
`biomes/index.js` com o registro):

- `id`, `name` (para o debug e a wiki).
- `size`: largura típica (m) de uma mancha desse bioma.
- `climate`: faixa/centro de temperatura e umidade em que ele vence.
- `relief`: `baseHeight` (deslocamento em relação ao nível da água),
  `hillHeight`, `hillSize`, `roughness`, `flatness` — mesmos conceitos dos
  parâmetros globais de hoje, que passam a ser por bioma.
- `palette`: cores do chão (baixo, alto, encosta, margem) — substitui
  `TERRAIN_PALETTE`.
- `vegetation`: tipos e densidade (ex.: `{ kind: 'pinheiro', density }`),
  só declaração (049).
- `tags`: tags de spawn (ex.: `campo`, `floresta`, `montanha`, `frio`,
  `quente`, `costa`) — consumidas na 055.

### Mapa de clima (`core/terrain/`, headless e determinístico)

- **`biomeMap.js`** — `createBiomeSampler(seed, params)`: em qualquer
  `(x, z)` devolve os **pesos** de cada bioma (somam 1; quase sempre 1 ou 2
  biomas com peso).
- **Regiões com tamanho por bioma** (Voronoi com peso): o mundo é dividido
  em regiões em volta de pontos espalhados pela seed; cada ponto recebe um
  bioma pelo clima naquele lugar, e a região dele cresce ou encolhe pelo
  `size` do bioma (a distância até o ponto é dividida pelo tamanho). Assim
  o clima mantém a vizinhança coerente (deserto perto de savana, tundra
  perto de montanha) e cada bioma tem a própria escala.
- **Clima** — ruídos independentes, cada um com sub-seed própria
  (`deriveSeed`), em escala grande (`BIOMES.CLIMATE_SIZE`, maior que
  qualquer bioma):
  - **continentalidade** — mar aberto, costa ou interior (oceano e praia;
    o tamanho do oceano e a largura da praia também vêm do `size` deles);
  - **temperatura** e **umidade** — escolhem o bioma de terra;
  - **relevo** — onde o terreno sobe (montanha/vulcânico).
- **Regra: o bioma nunca depende da altura** (a altura depende do bioma —
  senão vira ciclo). Pico nevado é só cor.
- **Mistura**: perto da fronteira entre duas regiões o peso passa de uma
  para a outra numa faixa de transição (`BIOMES.BLEND_WIDTH`).

### Relevo por bioma

- `createHeightSampler` passa a receber o sampler de bioma: altura =
  soma dos pesos × altura de cada bioma (ou mistura dos parâmetros numa soma
  de ruído só — decidir na implementação, **medindo**: hoje as alturas de um
  chunk custam poucos ms e o limite por tick da 046 conta com isso).
- `latticeHeightAt` e `heightAt` continuam batendo com o chunk (mesma conta).
- Sobe `GENERATION_VERSION`.
- Saem de `GAME_CONFIG.TERRAIN` os parâmetros de relevo globais que viraram
  de bioma (`HILL_SIZE`, `HILL_HEIGHT`, `ROUGHNESS`, `FLATNESS`); ficam
  `WATER_LEVEL`, `CHUNK_SIZE` e os de streaming.

### Bioma no chunk

- `generateTerrainChunk` guarda também o **bioma dominante e os pesos por
  vértice** (para a cor) e o **bioma dominante do chunk** (debug, 055).
- `biomeAt(x, z)` no conjunto de chunks, igual com ou sem chunk carregado
  (como `heightAt`).

### Origem em terra

- Perto da origem a continentalidade é empurrada para "interior"
  (`BIOMES.SPAWN_LAND_RADIUS`), assim `(0, y, 0)` nunca cai no oceano,
  qualquer que seja a seed.

### View

- `terrainGeometry.js`: cor por vértice = mistura das paletas pelos pesos,
  mantendo as regras de altura (margem, pico nevado) e inclinação (encosta).
- `terrainPalette.js` sai (vira `palette` de cada bioma).

### Debug (F2)

- `DebugPanel`: linha "bioma: Floresta" (onde o jogador está).
- Chão colorido por bioma (cor chapada por bioma dominante), liga/desliga no
  painel.
- `TerrainTuningPanel`: escolhe um bioma e ajusta o relevo e o `size` dele;
  `BIOMES.CLIMATE_SIZE` e `BLEND_WIDTH` também. Usa o `regenerarTerreno`
  de hoje.

### Constantes (`GAME_CONFIG.BIOMES`)

- `CLIMATE_SIZE` — escala (m) dos ruídos de clima (vizinhança dos biomas;
  o tamanho de cada bioma é o `size` dele).
- `BLEND_WIDTH` — largura da transição entre biomas.
- `SPAWN_LAND_RADIUS` — raio em volta da origem garantido em terra.
- Limites de continentalidade (oceano / costa / interior) e do relevo
  (onde vira montanha).

### Testes

- Determinismo: mesma seed e posição, mesmo bioma e mesma altura.
- Pesos somam 1 em qualquer ponto.
- Bioma com `size` maior ocupa regiões maiores (área média amostrada
  cresce com o `size`).
- Sem degrau na fronteira: diferença de altura entre vértices vizinhos
  limitada também na faixa de mistura.
- Bioma não depende da altura (o sampler de bioma não usa o de altura).
- Todos os biomas do registro aparecem numa área grande amostrada.
- A origem é terra firme (acima de `WATER_LEVEL`), para várias seeds.
- `latticeHeightAt` = altura do chunk com biomas.
- Registro: todo bioma tem `relief`, `palette`, `tags` e `vegetation`
  válidos (sem fixar valores — testes derivam do registro).

## Como ficou (implementação)

- **Registro** (`core/data/biomes/`, `_template/` + uma pasta por bioma):
  `id` (em inglês, como espécies e itens: `ocean`, `beach`, `plains`,
  `savanna`, `forest`, `jungle`, `swamp`, `desert`, `mountain`, `volcanic`,
  `tundra`), `name`, `size`, `climate`, `relief`, `palette` (com `debug`,
  a cor do modo "chão por bioma"), `vegetation` e `tags` (também em inglês,
  ex.: `grassland`, `cold`, `water`, `cave-entrance`). A ordem do registro
  é o índice dos pesos no chunk.
- **Clima** (`core/terrain/biomeMap.js`): quatro eixos de 0 a 1
  (temperatura, umidade, continentalidade, relevo) — ruído em camadas
  levado a "fração do mundo" pela curva normal, então a faixa de um bioma
  é a parte do mundo que ele disputa.
- **Tamanho por bioma — o que mudou do plano**: o Voronoi com peso saiu.
  Medindo, nenhum modelo de disputa dá tamanho próprio a um bioma que está
  **sozinho** no clima dele: ele vai até onde o clima vai. Ficou um modelo
  de **camadas**: cada bioma tem manchas do tamanho do `size`
  (`PATCH_COVERAGE` da área); o menor fica por cima e, onde nenhuma mancha
  cobre, vale o maior do clima (o fundo). Na prática:
  - biomas que dividem clima (pântano dentro de floresta/selva, savana e
    deserto, floresta e planície, praia) aparecem do tamanho do `size`;
  - quem domina o clima sozinho (tundra, montanha) vai até a borda do
    clima — o tamanho dele sai de `CLIMATE_SIZE` e da largura da faixa.
- **Disputa numa grade** (`BLEND_CELL`): a disputa é calculada nos pontos
  de uma grade alinhada ao mundo (em cache) e suavizada entre eles por uma
  B-spline cúbica. Sem isso, a borda de uma mancha pequena virava o bioma
  em poucos metros e o relevo ganhava paredão (oceano colado num vulcão).
  Agora a transição dura umas três células, nunca menos (testado), e o
  chunk ficou mais barato (bem menos ruído por vértice).
- **Fronteira de clima** (`CLIMATE_SHARPNESS`): perder a disputa aos
  poucos fora da faixa. Firme demais, a mancha não atravessa o clima e o
  `size` não aparece; frouxa demais, a praia vaza para dentro da terra.
- **Relevo** (`terrainHeight.js`, `createTerrainSampler`): altura =
  `WATER_LEVEL` + média do relevo de cada bioma pelo peso (cada bioma com o
  próprio ruído). Saíram `HILL_SIZE`/`HILL_HEIGHT`/`ROUGHNESS`/`FLATNESS`
  do `GAME_CONFIG.TERRAIN`; `GENERATION_VERSION` subiu. A receita
  (`TERRAIN` + `BIOMES` + biomas) é copiada pelo conjunto de chunks — o
  painel mexe nos originais, e só o `regenerarTerreno` aplica.
- **Chunk**: `biomeIds`, `biomeWeights` (por vértice, 0 a 255, só para a
  cor) e `biome` (o dominante). `biomeAt(x, z)` no conjunto de chunks.
- **Origem**: continentalidade mínima `SPAWN_CONTINENT` até
  `SPAWN_LAND_RADIUS` — a origem é sempre um bioma de terra (testado com
  várias seeds) e, na seed do jogo, acima da água.
- **Cor** (`view/terrain/terrainGeometry.js`): cor de cada bioma pela
  paleta dele (fundo, margem, chão de `low` a `high`, encosta, pico) e
  mistura pelo peso no vértice. Margem e encosta são globais
  (`GAME_CONFIG.TERRAIN_COLOR`). Saiu `terrainPalette.js`.
- **Debug (F2)**: "bioma: …" no `DebugPanel`; no painel "Terreno",
  "Chão por bioma" (`view/terrain/terrainColorMode.js`), pasta "Mapa de
  biomas" (`GAME_CONFIG.BIOMES`) e pasta "Bioma" (escolhe um e ajusta
  `size` e relevo). "Copiar valores" leva os biomas também.
- **Esconder biomas (F2)**: a pedido do usuário, para olhar um bioma só
  (testar o chão). Pasta "Biomas no mundo" no painel "Terreno": um
  liga/desliga por bioma, "Só o escolhido" e "Mostrar todos". Os
  escondidos ficam em `GAME_CONFIG.BIOMES.HIDDEN` (vazio no jogo) e saem da
  receita (`currentTerrainRecipe`) — o mundo é refeito sem eles.
- **Desenho do chão (híbrido)**: depois de testar três estilos na
  floresta (procedural, textura e híbrido), o usuário escolheu o híbrido —
  a cor continua da paleta do bioma e, por cima, entram o claro e escuro e
  o relevo de luz de uma textura, mais manchas suaves e granulado. Motivos:
  uma textura serve vários biomas (a cor vem da paleta), a fronteira entre
  biomas continua sendo a mistura das paletas, combina com o estilo
  desenhado do jogo (referência: Zelda Breath of the Wild) e pesa menos.
  - **Camadas** (`view/terrain/terrainLayers.js`): grama, chão de floresta,
    areia, neve, terra seca, lama, rocha e rocha vulcânica — texturas CC0
    do Poly Haven, empacotadas por `scripts/pack-terrain-textures.py` (baixa
    pelo id, grava um JPEG de 512 px por camada: R = claro e escuro em
    volta do brilho médio, G/B = normal), 2 MB no total.
  - **Por bioma** (`ground`, core/data/biomes/): `texture`, `slopeTexture`,
    `shoreTexture`, `peakTexture` e `detail` (força do desenho).
  - **Geometria**: peso de cada camada por vértice (`groundLayers0/1`, pelas
    mesmas regras da cor — margem, encosta, pico) e `groundDetail`.
  - **Material** (`view/terrain/terrainMaterial.js`): as camadas num
    `DataArrayTexture`, projeção triplanar, só as camadas com peso no
    fragmento. Números em `GAME_CONFIG.TERRAIN_LOOK`, ajustáveis no F2
    (pasta "Desenho do chão").
  - Paletas de planície, floresta, savana, selva, montanha, praia e deserto
    puxadas para o tom do BotW (verdes mais amarelados e claros, areia
    quente).
- **Colliders no debug (F2) sem o relevo**: a pedido do usuário (o FPS caía
  com o debug ligado). `debugRenderWithoutTerrain` (`core/physics/
  colliders.js`) tira o heightfield do `debugRender` — ele é igual à malha
  do chão, e redesenhar o de todos os chunks a cada quadro pesava.
- **Medido** (Node, chunk do tamanho atual): geração ~5 ms por chunk (era
  ~2 ms sem biomas); encosta mais íngreme numa área grande da seed do jogo
  abaixo do limite de subida do personagem (o pior caso é montanha colada
  no oceano).
- **Testes**: `biomeMap.test.js` (determinismo, pesos, continuidade,
  largura mínima da transição, origem em terra, todos os biomas aparecem,
  `size` maior = manchas maiores), `core/data/biomes/index.test.js`
  (registro), `terrainHeight.test.js`, `terrainChunk.test.js` (pesos no
  chunk e na borda), `terrainChunkSet.test.js` (`biomeAt`, receita
  copiada, origem acima da água), `terrainGeometry.test.js` (cor de cada
  paleta e modo bioma). Testes antigos que supunham o chão da origem em
  altura zero passaram a perguntar a altura ao relevo.

## Fechamento

- **Teste no jogo pelo usuário**: aprovado ("de resto tá bom por hora"). O
  ajuste fino de cada bioma (cores, desenho do chão) fica para a 055, junto
  da vegetação.
- **Roadmap**: 047 no "Já feito"; caverna entrou como 049 (logo depois da
  água) e o resto andou um número; a 051 virou "Vegetação, objetos e luz"
  (luz no estilo Zelda Breath of the Wild, a pedido do usuário). Backlog
  sem mudança.
- **Wiki**: página "O mundo", seção "Biomas" (os 11, transição aos poucos,
  começo em terra firme, dá para andar pelo fundo da água).
- **Gates**: `npm test` inteiro (195 arquivos, 1988 testes, com
  `--maxWorkers=2`), `npm run lint` e build (numa cópia, com o `next dev`
  rodando) passando.

---

## Fora de escopo

- **Cavernas** (Zubat, Geodude, Onix, Diglett...) — 057:
  camada subterrânea gerada pela seed (túneis e salões com malha, colisor e
  grade de navegação próprios, por chunk), boca numa encosta de montanha
  (célula removida do heightfield, se o Rapier JS permitir; senão uma peça
  com colisor próprio). Save e spawn passam a saber em que camada a
  entidade está (hoje sobem quem está "dentro" do relevo).
- **Cidade/urbano** (Grimer, Koffing, Magnemite, Voltorb...) — estruturas
  (053 em diante).
- **Água** (visual, rasa/funda, rios) — 056. Até lá oceano e lagos ficam
  sem água visível (só o plano de debug) e sem bloqueio: anda-se pelo fundo.
- **Nado** — depois da beta.
- **Clima e partículas** por bioma — 048.
- **Colocar vegetação** (árvores, pedras, grama alta) — 049.
- **Spawn por bioma** — 055.
- **Célula plana do heightfield** — 079 (praia/pântano/deserto são planos,
  mas não perfeitamente planos — conferir na implementação se o problema
  aparece).

---

## Etapas

- [x] Bump da versão para `0.0.47` e doc da feature.
- [x] Registro de biomas (`core/data/biomes/`) + testes do registro.
- [x] Mapa de clima (`biomeMap.js`): pesos por bioma, origem em terra +
      testes.
- [x] Relevo por bioma com mistura (medir custo por chunk) +
      `GENERATION_VERSION` + testes.
- [x] Bioma no chunk e `biomeAt` + testes.
- [x] Cores por bioma na geometria (sai `terrainPalette.js`).
- [x] Debug F2: bioma atual, chão por bioma, painel de ajuste por bioma.
- [x] Teste no jogo pelo usuário.
- [x] Roadmap, backlog e wiki.

---

## Critérios de Conclusão

- [x] Andando, dá para ver e atravessar todos os biomas da tabela.
- [x] Fronteira entre biomas sem degrau nem recorte de cor.
- [x] Mesmo mundo para a mesma seed (alturas, biomas, cores).
- [x] Treinador nasce em `(0, y, 0)` em terra firme.
- [x] Sem tranco perceptível ao carregar chunks (custo medido).
- [x] Cada bioma declara vegetação e tags de spawn.
- [x] Debug F2 mostra o bioma e ajusta o relevo de cada um.
- [x] `npm run build`, `npm run lint` e `npm test` passando.
- [x] Wiki: página "O mundo" com os biomas.
