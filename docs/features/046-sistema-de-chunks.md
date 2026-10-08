# 🚀 Versão 0.0.46 — Sistema de chunks

## Resumo

Segunda feature do Marco 2 (mundo procedural). A área fixa de chunks da 045
dá lugar a um **mundo sem borda**: os chunks em volta do jogador são
carregados conforme ele anda, e os distantes são descarregados, liberando
colisor, malha e grade de navegação.

- **Carregar em volta do treinador e da criatura controlada** (os dois
  centros juntos).
- **Dois raios**: um para carregar e outro maior para descarregar, assim
  andar na borda não fica carregando e descarregando o mesmo chunk.
- **Quem fica num chunk descarregado congela** (sem física e sem IA) até o
  chunk voltar.
- **Pathfinding por chunk**: cada chunk tem a própria grade, assada quando
  carrega, e o A* atravessa os chunks.
- **Sem muros de borda.**
- **Debug (F2)**: borda e estado de cada chunk.

Versão: `0.0.46` (`package.json`). Branch: `feature/046-sistema-de-chunks`.

> **Números deste doc são fictícios (ilustrativos).** O valor de verdade é o
> do campo citado (config).

---

## O que já existe (ponto de partida)

- **Geração determinística por chunk** (`core/terrain/`):
  `generateTerrainChunk(sampler, chunkX, chunkZ, params)`, amostrada em
  coordenada de mundo (a borda é igual à do vizinho); `chunkHeightAt`,
  `chunkCoordAt`.
- **Área fixa** (`terrainArea.js`, `createTerrainArea`): chunks de
  `-AREA_RADIUS..AREA_RADIUS`, `bounds`, `minHeight`/`maxHeight` e
  `heightAt` (pelo chunk; fora dele, pelo ruído direto).
- **Colisor**: `createTerrainChunkCollider` e `destroyTerrainChunkCollider`
  (`core/physics/colliders.js`). Hoje `createStaticLevel` cria todos no
  bootstrap.
- **Nível** (`core/data/testLevel.js`): `terrain`, `bounds`, muros de borda,
  objetos de treino e selvagens. `rebuildTerrainDependentLevel` e a revisão
  (`getLevelRevision`/`subscribeLevelChanges`) servem ao painel de ajuste.
- **Pathfinding** (`core/pathfinding.js`): uma grade `PF.Grid` só, cobrindo
  `bounds`, com elevação por célula e regra de penhasco que compara cada
  célula com as 8 vizinhas. É criada de forma preguiçosa e fica em cache.
- **View**: `TerrainView.jsx` desenha um mesh por chunk de
  `TEST_LEVEL.terrain.chunks` e faz `dispose` da geometria ao desmontar.
- **Quem usa a área fixa**: `regenerarTerreno` (põe de volta na área quem
  saiu dela), `WaterLevelDebugView` (plano do tamanho de `bounds`),
  `world.js` (nascer na origem), `trainerSave.js` (subir quem caiu dentro do
  relevo).
- **Loading (044)**: tela de carregamento com controle de prontidão da cena.

---

## Decisões (com o usuário)

1. **Centro do carregamento**: o treinador **e** a criatura controlada
   (018). Um chunk fica carregado se estiver perto de qualquer um dos dois.
2. **Histerese**: `LOAD_RADIUS` para carregar e `UNLOAD_RADIUS` (maior)
   para descarregar, no `GAME_CONFIG.TERRAIN`, no lugar de `AREA_RADIUS`.
3. **Entidade em chunk descarregado congela**: selvagens, objetos de treino
   e criatura do time que ficou longe param (sem física e sem IA) e voltam
   de onde estavam quando o chunk carrega de novo. Despawn de verdade é da
   055.
4. **Pathfinding por chunk (opção A)**: uma grade por chunk, assada quando
   o chunk carrega e liberada quando descarrega; o A* atravessa os chunks
   carregados.
5. **Sem Web Worker**: geração síncrona, com um limite de chunks por tick
   (`CHUNKS_PER_TICK`). Medido em Node, por chunk do tamanho atual: alturas
   ~2 ms, geometria ~6 ms, grade de navegação ~1 ms — cabe num tick sem
   tranco. O worker volta à mesa se o jogo travar ao andar.
6. **Debug (F2)**: borda de cada chunk desenhada no chão, colorida pelo
   estado (carregado, na fila, descarregando), e um contador de chunks
   carregados.

---

## Arquitetura

### Conjunto de chunks (`core/terrain/`, headless)

- **`terrainChunkSet.js`** (substitui `terrainArea.js`): o conjunto de
  chunks carregados, por chave `chunkX,chunkZ`.
  - `planChunkStreaming` (`chunkStreaming.js`) — regra pura: quais chunks deveriam estar
    carregados em volta dos centros.
  - Fila de carga (os mais próximos primeiro) e lista de descarga.
  - `heightAt(x, z)`: pelo chunk carregado; fora, pelo ruído (igual hoje).
  - `isChunkLoadedAt(x, z)`.
  - Evento ou revisão quando o conjunto muda, para a view e o debug
    assinarem.
- **`chunkStreamingSystem`** (passo fixo): lê a posição do treinador e da
  criatura controlada, calcula os chunks desejados, carrega até
  `CHUNKS_PER_TICK` por tick e descarrega os que passaram de
  `UNLOAD_RADIUS`.
- **Actions** `carregarChunk(chunkX, chunkZ)` / `descarregarChunk(...)`:
  gera o chunk, cria o colisor e assa a grade de navegação; ao descarregar,
  destrói o colisor e libera a grade.

### Física

- O heightfield deixa de nascer em `createStaticLevel`: é criado por
  `carregarChunk` e destruído por `descarregarChunk` (regra 4, "colliders
  com escopo de chunk").
- Obstáculos fixos que sobrarem (objetos de treino) continuam estáticos.

### Congelar e descongelar

- Trait de fase/tag (ex.: `FrozenByChunk`) posta e tirada por uma action,
  com base em `isChunkLoadedAt` da posição da entidade.
- Entidade congelada: o corpo não se move (sem gravidade), sem IA, sem
  pathfinding. Ao descongelar, segue de onde estava.
- O treinador e a criatura controlada nunca congelam (são os centros).

### Pathfinding por chunk

- Cada chunk tem uma grade (`PF.Grid`) com elevação por célula, assada na
  carga a partir do relevo e dos obstáculos do chunk.
- **Costura do penhasco**: a regra compara com as vizinhas; na borda, a
  vizinha está no chunk do lado. Como a altura vem do ruído (determinística),
  a borda é calculada pela altura do vizinho mesmo que ele ainda não esteja
  carregado.
- **A* entre chunks**: o caminho é procurado numa grade montada pela janela
  de chunks carregados entre origem e destino (ou A* próprio por cima das
  grades). Decidir na implementação, medindo; destino num chunk não
  carregado = sem caminho (anda reto, como hoje fora da grade).
- `findPath`/`isWalkableAt`/`inspectCell` seguem com a mesma assinatura.

### Nível e save

- `testLevel.js`: saem os muros de borda e o `bounds` fixo; objetos de
  treino e selvagens continuam na posição da seed.
- Treinador nasce na origem; save longe da origem: os chunks em volta da
  posição salva carregam **antes** de a cena ficar pronta (loading da 044).
- `trainerSave.js` continua usando `heightAt` (funciona com ou sem chunk
  carregado).

### Painel de ajuste (F2)

- `regenerarTerreno` refaz os chunks carregados com a config nova (colisor,
  grade e malha) e põe quem ficou enterrado em cima do chão. Sai o "trazer
  de volta pra área".

### View

- `TerrainView.jsx` assina o conjunto de chunks: monta o mesh de quem
  carrega e desmonta (com `dispose`) de quem descarrega.
- `WaterLevelDebugView`: plano que segue o jogador (ou cobre os chunks
  carregados) no lugar de `bounds`.
- `tools/debug/ChunkDebugView.jsx`: bordas e estado dos chunks.

### Constantes (`GAME_CONFIG.TERRAIN`)

- `LOAD_RADIUS` (chunks) — raio para carregar.
- `UNLOAD_RADIUS` (chunks) — raio para descarregar (maior que o de carga).
- `NEAR_RADIUS` (chunks) — o que carrega na hora, sem fila.
- `CHUNKS_PER_TICK` — limite de chunks carregados por tick fora disso.
- Sai `AREA_RADIUS`.
- `PATHFINDING.CELL_SIZE`: comentário deixa de citar `TEST_LEVEL.bounds`.

### Testes

- `planChunkStreaming`: chunks em volta de um e de dois centros; histerese (entre
  os raios não carrega nem descarrega).
- Carregar e descarregar: colisor criado e destruído; grade criada e
  liberada; descarregar e carregar de novo dá o mesmo chunk.
- Limite por tick e ordem (mais próximo primeiro).
- Congelar: entidade em chunk descarregado congela; volta ao carregar;
  treinador e criatura controlada nunca congelam.
- Pathfinding: caminho atravessa a borda de dois chunks; penhasco na borda
  é bloqueado igual ao do meio do chunk.
- Save longe da origem: chunks prontos antes de a cena liberar.

---

## Como ficou (implementação)

- **Conjunto de chunks** (`core/terrain/terrainChunkSet.js`,
  `createTerrainChunkSet`): `load`/`unload`/`isLoaded`/`isLoadedAt`/
  `loadedChunks`, `reconfigure` (painel de ajuste; só sem chunk
  carregado), `streamingStatus` (fila e folga, para o debug) e
  `subscribe`/`getRevision` para a view. É o `TEST_LEVEL.terrain`.
- **`heightAt` independente do que está carregado**: com o chunk, a altura
  dele; sem, `latticeHeightAt` (`terrainChunk.js`) faz a mesma conta (mesmos
  vértices, mesmos triângulos, float32) direto do ruído. Nascer, save,
  objetos de treino e a grade de navegação perguntam a altura de qualquer
  lugar.
- **Regras puras** (`core/terrain/chunkStreaming.js`,
  `planChunkStreaming`): o que carregar já (até `NEAR_RADIUS`), o que vai
  para a fila (mais perto primeiro), o que descarrega (além de
  `UNLOAD_RADIUS` de todos os centros) e o que fica pela folga.
- **`chunkStreamingSystem`** (logo depois da troca de controle): centros =
  treinadores (`Party`) e quem tem `InputControlled`. O chão em volta de um
  centro carrega na hora — cobre a primeira entrada e o save longe da
  origem sem esperar a fila; o resto, `CHUNKS_PER_TICK` por tick.
- **Actions** (`core/actions/chunks.js`): `carregarChunk` (dados + grade +
  colisor, este só com a física pronta — senão nasce em
  `createStaticLevel`), `descarregarChunk`, `descarregarTodosOsChunks`,
  `congelarPorChunk`/`descongelarPorChunk`.
- **Colisor por chunk** (`core/physics/colliders.js`):
  `addLevelChunkCollider`/`removeLevelChunkCollider`. `createStaticLevel`
  cria os obstáculos e o colisor dos chunks já carregados (cobre o world
  refeito do hot-reload).
- **Congelar**: tag `ChunkFrozen` (`traits/components/chunk.js`), posta e
  tirada pelo `chunkFreezeSystem` (logo depois do streaming).
  `characterPhysicsSystem`, `creatureFollowSystem`, `wildBehaviorSystem`,
  `wildWanderSystem` e `partyBehaviorSystem` pulam quem está congelado.
- **Pathfinding por região** (`core/pathfinding.js`): `createNavigation`
  guarda uma grade por chunk (`addRegion`/`removeRegion`); nível com
  `bounds` fixos (testes) tem uma região só. Cada região é assada com uma
  moldura de uma célula do relevo/obstáculos de fora — o penhasco da borda
  sai igual ao de uma grade única (testado). O A* roda numa janela em volta
  da origem e do destino (`PATHFINDING.SEARCH_MARGIN`) montada das regiões;
  célula sem região é bloqueada; origem ou destino fora de chunk carregado
  = sem caminho (anda reto). De quebra, a busca deixou de clonar a grade
  da área inteira a cada chamada.
- **Nível** (`core/data/testLevel.js`): saem `bounds` e os muros de borda;
  selvagens nascem num quadrado fixo em volta da origem (provisório até a
  055).
- **Painel de ajuste (F2)**: `regenerarTerreno` descarrega tudo, refaz a
  receita e põe quem ficou enterrado em cima do chão; o streaming carrega
  de novo no tick seguinte. Os raios de carregar/descarregar entram no
  painel sem refazer o relevo; o lado do chunk só anda de 2 em 2.
- **View**: `TerrainView` assina o conjunto (`useTerrainChunks`), monta o
  mesh de quem carrega e desmonta (com `dispose`) quem descarrega.
  `WaterLevelDebugView` cobre os chunks carregados.
- **Debug (F2)**: `tools/debug/ChunkDebugView.jsx` — borda de cada chunk
  seguindo o relevo (verde carregado, laranja só pela folga, amarelo na
  fila) e a linha "chunks: N carregados · M na fila" no `DebugPanel`.
- **Constantes** (`GAME_CONFIG.TERRAIN`): `LOAD_RADIUS`, `UNLOAD_RADIUS`,
  `NEAR_RADIUS`, `CHUNKS_PER_TICK` (sai `AREA_RADIUS`);
  `PATHFINDING.SEARCH_MARGIN`.
- **Testes**: `terrainChunkSet.test.js` (inclui os de relevo do jogo que
  estavam no `terrainArea.test.js`), `chunkStreaming.test.js`,
  `chunks.test.js`, `chunkStreamingSystem.test.js`,
  `chunkFreezeSystem.test.js`, regiões no `pathfinding.test.js`, congelado
  no `characterPhysicsSystem.test.js`. Testes de física que usavam o nível
  do jogo carregam o chunk da origem (`src/test/gameLevelChunks.js`).

---

## Parte 2 — Objetos que somem e névoa

Pedido do usuário depois do primeiro teste: "itens e tudo mais tem que
sumir junto com a chunk e não voltam mais" e "uma fog para não ser possível
ver uma chunk sendo gerada ou removida, respeitando os parâmetros da chunk".

- **Objetos soltos somem com o chunk** (`chunkObjectCleanupSystem`, logo
  depois do congelamento; action `removerObjetoSolto`): comida derrubada,
  Pokébola fechada no chão (com o Pokémon dentro — que já não ia para o
  save) e projéteis num chunk descarregado são destruídos e não voltam.
  Personagens continuam congelando.
- **Névoa** (`view/scene/FogView.jsx`): fecha em `LOAD_RADIUS × lado do
  chunk − distância máxima da câmera` (`view/terrain/fogRange.js`) — o chunk
  novo mais perto que pode estar nascendo fica atrás dela, e quem
  descarrega está mais longe ainda. Começa em `FOG.START_FRACTION` disso;
  nunca fecha antes de `FOG.MIN_DISTANCE`. Recalcula quando o conjunto de
  chunks muda (mudar o raio ou o chunk no painel muda o conjunto).
- **Névoa pela distância**: o Three enevoa pela profundidade
  (`-mvPosition.z`), o que deixa os cantos da tela menos enevoados e
  mostraria a borda; o trecho `fog_vertex` passa a usar a distância até a
  câmera.
- **Céu**: o `Sky` do drei saiu; o fundo é um degradê (`FOG.SKY_TOP_COLOR`
  no alto, `FOG.COLOR` no horizonte e abaixo) — o relevo enevoado some no
  céu sem recorte.
- **Nomes sobre as criaturas** (`NameplateView`, overlay de DOM que o
  shader não enevoa) somem junto com a névoa.
- **Debug (F2)**: as bordas dos chunks ficam fora da névoa.
- **Constantes**: `GAME_CONFIG.FOG` (`COLOR`, `SKY_TOP_COLOR`,
  `START_FRACTION`, `MIN_DISTANCE`).
- **Testes**: `chunkObjectCleanupSystem.test.js`, `fogRange.test.js`.

---

## Fechamento

- **Teste no jogo pelo usuário**: aprovado ("ficou bom", depois "perfeito").
- **Achado para depois**: no relevo, o corpo das entidades não acompanha a
  inclinação (sobe o morro reto) e às vezes as skills saem da cabeça do
  personagem — virou o item 078 do Marco 5.
- **Wiki**: página "O mundo", seção "Tamanho" — mundo sem fim, névoa no
  horizonte, criaturas longe param e coisas largadas longe somem.
- Roadmap: 046 no "Já feito"; 078 no Marco 5. Backlog sem mudança.
- Gates: `npm test` inteiro (192 arquivos, 1855 testes, com
  `--maxWorkers=2`), `npm run lint` e build (numa cópia, com o `next dev`
  rodando) passando.

---

## Fora de escopo

- Biomas e cores por bioma — 047.
- Água (visual, rasa/funda, bloqueio) — 048.
- Spawn e despawn de selvagens por chunk — 055.
- Servidor dono da seed e geração compartilhada — 065.
- Célula plana do heightfield — 077.

---

## Etapas

- [x] Bump da versão para `0.0.46` e doc da feature.
- [x] Medir o custo de um chunk (alturas, geometria, grade) — sem worker.
- [x] `terrainChunkSet` + regras de streaming + testes.
- [x] `chunkStreamingSystem` + actions de carregar/descarregar (colisor por
      chunk) + testes.
- [x] Congelar entidades em chunk descarregado + testes.
- [x] Pathfinding por chunk (grade por chunk, costura, A* entre chunks) +
      testes.
- [x] Nível sem muros/`bounds`; save e loading com chunks prontos.
- [x] `TerrainView` por chunk carregado; plano da água; painel de ajuste.
- [x] Debug F2 dos chunks.
- [x] Teste no jogo pelo usuário.
- [x] Roadmap, backlog e wiki.

---

## Critérios de Conclusão

- [x] Dá para andar em qualquer direção sem chegar numa borda.
- [x] Chunks distantes somem (colisor, malha e grade liberados) e voltam
      iguais.
- [x] Sem tranco perceptível ao carregar chunks andando.
- [x] Criaturas longe do jogador congelam e voltam de onde estavam.
- [x] O pathfinding atravessa bordas de chunk e contorna encostas.
- [x] Save longe da origem carrega com o treinador em cima do chão.
- [x] Painel de ajuste do terreno (F2) continua funcionando.
- [x] `npm run build`, `npm run lint` e `npm test` passando.
- [x] Wiki: página "O mundo" atualizada (sem a área cercada).
