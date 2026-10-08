# 🚀 Versão 0.0.45 — Terreno de um chunk

## Resumo

Primeira feature do Marco 2 (mundo procedural). O chão plano do nível de teste
dá lugar a um **relevo gerado pela seed**, em chunks:

- **Altura por ruído** (simplex em várias oitavas), a partir da seed fixa do
  mundo e das coordenadas do chunk — mesma entrada, mesmo relevo.
- **Malha e colisor** de cada chunk saem das mesmas alturas: o que se vê é o
  que se pisa.
- **Nível da água já definido**: os vales mais fundos ficam abaixo dele e
  viram lagos na 048, sem mudar o relevo da seed.
- Por enquanto uma **área fixa de chunks** em volta da origem, com muros na
  borda; carregar e descarregar conforme o jogador anda é a 046.
- Treinador, selvagens e objetos de treino nascem **em cima do terreno**;
  posição salva antiga que caia dentro de um morro sobe para a superfície.
- O pathfinding enxerga o relevo: encosta íngreme demais vira penhasco.

Versão: `0.0.45` (`package.json`). Branch: `feature/045-terreno-de-um-chunk`.

> **Números deste doc são fictícios (ilustrativos).** O valor de verdade é o
> do campo citado (config).

---

## O que já existe (ponto de partida)

- **Nível de teste** (`core/data/testLevel.js`): chão plano (`ground`, uma
  caixa) + obstáculos (`box`/`ramp`/`floor`): trilha de terraços, rampas,
  corredor, pedras, muros de borda e objetos de treino. Dele saem, uma vez
  só, os colliders (`createStaticLevel`), o mesh (`TestLevelView`) e a grade
  de pathfinding (`core/pathfinding.js`, que já guarda elevação por célula e
  bloqueia penhascos — hoje o chão vale sempre 0).
- **PRNG seedado** (`core/rng.js`, mulberry32) com `WORLD.SEED`: RNG de
  gameplay e cosmético. Não existe o de geração procedural.
- **Sem lib de ruído.**
- Quem acha o chão por raycast (comida, bolas, ataques, câmera, projétil)
  já funciona com relevo. Quem assume chão plano: o treinador nasce em
  `y` fixo, os selvagens em `y` fixo com posição por `Math.random()`, e a
  posição salva (044) veio do chão plano.

---

## Decisões (com o usuário)

1. **O terreno substitui o chão plano.** A trilha de terraços, rampas,
   plataforma, corredor, parede, degrau, pilar e pedras de teste saem (iam
   boiar ou afundar no relevo). Ficam os **muros de borda** (enquanto a área
   for fixa) e os **objetos de treino**, apoiados no terreno. Os tipos
   `ramp`/`floor` continuam suportados no pathfinding (estruturas da 052).
2. **Ruído pela lib `simplex-noise`** (v4), alimentada pelo nosso PRNG
   seedado (`createRng`) — sem `Math.random()`.
3. **Tamanho do chunk e da área parametrizáveis** em `GAME_CONFIG.TERRAIN`
   (ex.: chunk de 48 m com 1 vértice por metro, área de 3×3 chunks —
   fictícios).
4. **Seed fixa** no `gameConfig` (`WORLD.SEED`). Na 064 o servidor passa a
   ser o dono dela.

---

## Arquitetura

### Geração (`core/terrain/`, headless e determinística)

- **Seed da geração**: `deriveSeed(WORLD.SEED, 'terrain')` (`core/rng.js`) —
  RNG de geração procedural separado do de gameplay (regra 3.5).
- **`terrainHeight.js`** — `createHeightSampler(seed)`: altura contínua em
  qualquer `(x, z)` de mundo. Soma camadas de simplex: a primeira do
  tamanho dos morros (`HILL_SIZE`), cada seguinte com metade do tamanho e
  `ROUGHNESS` vezes o peso, até a menor que ainda aparece na malha (o número
  de camadas é calculado). `FLATNESS` achata o meio (campos) e acentua
  morros e vales; `HILL_HEIGHT` converte para metros. Os vales mais fundos
  ficam abaixo de `WATER_LEVEL`.
- **`terrainChunk.js`** — `generateTerrainChunk({ seed, chunkX, chunkZ })`:
  `Float32Array` de `(N+1)²` alturas, amostradas em **coordenada de mundo**
  (a borda de um chunk é igual à do vizinho), com a `version` de geração
  (`TERRAIN.GENERATION_VERSION`). As alturas ficam na **ordem do heightfield
  do Rapier** (por coluna: `iz + ix·(N+1)`).
  - `chunkHeightAt(chunk, x, z)`: altura dentro do chunk interpolada nos
    **mesmos triângulos** do colisor (a diagonal de cada célula vai do canto
    `+x,−z` ao `−x,+z` — conferido no Rapier).
- **`terrainArea.js`** — `createTerrainArea({ seed, radius })`: os chunks
  de `−radius..radius` em volta da origem, os limites da área, a altura
  mínima/máxima e `heightAt(x, z)` (pelo chunk; fora da área, pelo ruído).
  `getLevelTerrain()` guarda a área do nível (lazy, uma vez só).

### Física (`core/physics/colliders.js`)

- `createTerrainChunkCollider(chunk)` → heightfield do Rapier no lugar do
  chunk; devolve o handle. `destroyTerrainChunkCollider(handle)` já existe
  para a 046.
- `createStaticLevel` cria o colisor de cada chunk da área no lugar da caixa
  do chão.

### Nível de teste (`core/data/testLevel.js`)

- `ground` sai; entra `terrain` (área de chunks) e `bounds` (limites).
- Muros de borda calculados pela área (cobrem da altura mínima à máxima + uma
  folga).
- Objetos de treino: `y` pela altura do terreno.
- Selvagens: posição sorteada pelo RNG de geração (não mais
  `Math.random()`), `y` acima do terreno.

### Pathfinding (`core/pathfinding.js`)

- A grade cobre `bounds` e começa com a **altura do terreno** em cada célula;
  `floor`/`ramp` sobrescrevem como antes. A regra de penhasco existente
  bloqueia encosta íngreme.
- `box` só bloqueia se passar do auto-step **acima do terreno onde está**
  (antes: acima de 0).
- `createNavigation(level)` monta a navegação de qualquer nível (os testes
  usam níveis próprios); `findPath`/`isWalkableAt`/`inspectCell` seguem
  usando o nível do jogo.

### Começo e save

- Treinador nasce acima do terreno na origem (`core/world/world.js`).
- `deserialize` do treinador (`core/save/trainerSave.js`): posição salva
  abaixo do terreno sobe para a superfície. Não muda o formato do save.

### View

- `view/scene/TerrainView.jsx`: um mesh por chunk (`BufferGeometry` feita das
  alturas, mesma triangulação do colisor), cor por vértice pela altura e
  inclinação (areia perto da água, grama, terra/pedra na encosta), `dispose`
  da geometria ao desmontar (regra 5.3). Cores de bioma ficam para a 047.
- `TestLevelView` deixa de desenhar o chão e o `gridHelper`.

### Debug (F2)

- `tools/debug/WaterLevelDebugView.jsx`: plano translúcido no
  `WATER_LEVEL`, para ver onde vão ficar os lagos.

### Constantes (`GAME_CONFIG.TERRAIN`)

Simplificadas a pedido do usuário (nomes que dizem o efeito):

- `GENERATION_VERSION` — identifica a receita do relevo.
- `CHUNK_SIZE` (m) — lado do chunk; sempre um vértice por metro.
- `AREA_RADIUS` — chunks em volta da origem (some na 046).
- `HILL_SIZE` (m) — largura dos morros grandes.
- `HILL_HEIGHT` (m) — altura dos morros; os vales descem o mesmo.
- `ROUGHNESS` (0 a 1) — detalhe miúdo por cima dos morros.
- `FLATNESS` (1 = natural) — mais campo plano e morros mais marcados.
- `WATER_LEVEL` (m) — superfície da água.
- `SPAWN_HEIGHT` (m) — quanto acima do chão se nasce.

Os muros de borda não têm config: são provisórios (saem na 046) e usam
constantes locais em `testLevel.js`.

### Testes

- Mesma seed → mesmo chunk; seed diferente → relevo diferente.
- Borda comum de dois chunks vizinhos é igual.
- `chunkHeightAt` bate com o raycast no colisor heightfield.
- Existe terreno abaixo do nível da água na área do nível; e acima.
- Inclinação entre vértices vizinhos não passa do que o personagem sobe
  (`MAX_SLOPE_CLIMB`).
- Pathfinding: regras de rampa/terraço/penhasco/parede com níveis de teste
  próprios; encosta íngreme bloqueia; `box` sobre terreno alto bloqueia.
- Save: posição abaixo do terreno sobe; acima fica igual.

---

## Como ficou (implementação)

- **Geração** (`src/core/terrain/`): `terrainHeight.js`
  (`createHeightSampler`), `terrainChunk.js` (`generateTerrainChunk`,
  `chunkHeightAt`, `chunkCoordAt`, `heightIndex`) e `terrainArea.js`
  (`createTerrainArea`). A seed é `deriveSeed(WORLD.SEED, 'terrain')`
  (`core/rng.js`). O simplex vale zero nos pontos da grade dele, então a
  origem fica sempre na altura 0, com qualquer seed.
- **Layout do heightfield conferido no Rapier**: alturas por coluna
  (`iz + ix·(N+1)`), centrado no corpo, e a diagonal de toda célula do canto
  `+x,−z` ao `−x,+z`. O teste `colliders.test.js` compara o raycast no
  colisor com `chunkHeightAt` dentro dos dois triângulos.
- **Colisor**: `createTerrainChunkCollider`/`destroyTerrainChunkCollider`
  (`core/physics/colliders.js`); `createStaticLevel` cria um por chunk.
- **Nível** (`core/data/testLevel.js`): `terrain`, `bounds`, muros de borda
  do ponto mais baixo ao mais alto do relevo (mais uma folga), objetos de
  treino apoiados no ponto mais baixo debaixo deles, selvagens pelo RNG `deriveSeed(SEED,
  'wild-spawn')`.
- **Pathfinding**: `createNavigation(level)`; a grade parte da altura do
  relevo. A regra de penhasco passou a escalar o limite pela distância até a
  vizinha (diagonal = √2): sem isso, encosta moderada na diagonal já virava
  penhasco.
- **Testes que dependiam do nível antigo** (chão plano, parede, rampa,
  trilha): `src/test/flatTestLevel.js` guarda o nível de antes (chão como
  caixa + as mesmas peças) e troca o `TEST_LEVEL` por ele com `vi.mock` —
  física (`characterPhysicsSystem`, `summonBallSystem`,
  `trainerBattleSystem`), comportamento (`wildBehaviorSystem`, fuga, seguir,
  vagar) e as regras de rampa/terraço do pathfinding. O de contornar a
  parede antes passava mesmo sem a parede (o alvo de quem segue fica ao lado
  do treinador); agora confere que o caminho passa pela ponta dela.
- **View**: `view/scene/TerrainView.jsx` (um mesh por chunk) e
  `view/terrain/terrainGeometry.js` (geometria + cor por vértice,
  `terrainPalette.js` provisória até a 047). `TestLevelView` só desenha os
  obstáculos.
- **Debug (F2)**: `tools/debug/WaterLevelDebugView.jsx`.
- **Ajuste em tempo real** (pedido do usuário: "configuro o terreno em tempo
  real"): painel `lil-gui` no F2 (`tools/debug/TerrainTuningPanel.jsx`) com a
  seed e os parâmetros do relevo, "Copiar valores" (para colar no
  `gameConfig.js`) e "Voltar ao inicial". Cada mudança chama a action
  `regenerarTerreno` (`core/actions/terrain.js`): refaz o nível
  (`rebuildTerrainDependentLevel`, `testLevel.js`), os colliders estáticos
  (`destroyStaticLevel` + `createStaticLevel`) e a navegação
  (`resetLevelNavigation`), e põe quem ficou enterrado ou fora da área em
  cima do chão. A view assina as mudanças (`useLevelRevision`). A seed do
  painel só muda o relevo (o RNG de gameplay já foi criado).
  - Digitar nos campos do painel não chega ao teclado do jogo.
- Libs novas: `simplex-noise` e `lil-gui` (`package.json`).
- **Valores finais** escolhidos pelo usuário no painel (`GAME_CONFIG.TERRAIN`):
  morros mais largos e mais altos, menos detalhe miúdo e chunk maior que os
  do começo.

---

## Fechamento

- **Nascer pelos pés**: `SPAWN_HEIGHT` passou a ser a folga entre os PÉS e o
  chão (o centro fica `verticalClearance` acima deles). Antes era do centro:
  o treinador, cuja cápsula vai do centro aos pés numa distância igual à
  folga, nascia com a base exatamente na superfície — numa encosta, parte da
  cápsula começa abaixo do relevo e cai através dele (o heightfield é só
  superfície, sem "dentro" que empurre pra fora, como a caixa do chão antigo
  fazia). Vale pro treinador (`world.js`), pros selvagens (`testLevel.js`) e
  pro save que caiu dentro do relevo (`trainerSave.js`). `verticalClearance`
  foi pra `core/physics/capsule.js` (sem Rapier; `colliders.js` reexporta),
  pra o nível usar sem import circular.
- **Achado — células planas**: o Rapier (0.20) erra parte dos raios em
  células PLANAS de heightfield (medido: cerca de 1 em 10 num chão todo
  plano). O relevo por ruído não tem célula plana (nenhum erro em centenas de
  raios no relevo do jogo), então hoje não aparece; vai importar quando
  houver terreno aplainado (048/052). Virou o item 076 do Marco 5. O nível
  plano dos testes usa caixa como chão por isso.
- **Wiki**: página nova "O mundo" (relevo, área cercada por enquanto e o que
  ainda vai chegar), no grupo "Começando".
- Roadmap: 045 no "Já feito"; backlog sem mudança.
- Gates: `npm test` inteiro (186 arquivos, 1824 testes, com
  `--maxWorkers=2`), `npm run lint` e build (numa cópia, sem a `.exemple`, com
  o `next dev` rodando) passando.

---

## Fora de escopo

- Carregar/descarregar chunks e pathfinding por chunk — 046.
- Biomas e cores por bioma — 047.
- A água em si (visual, rasa/funda, bloqueio) — 048.
- Escolher um ponto de nascimento seco — junto da água (048) ou do
  Pokécenter (052).

---

## Etapas

- [x] Bump da versão para `0.0.45` e doc da feature.
- [x] `simplex-noise` + `deriveSeed` + `core/terrain/` (altura, chunk, área)
      + testes.
- [x] Colisor heightfield + teste contra a amostragem.
- [x] Nível de teste: terreno no lugar do chão, muros e objetos de treino
      no relevo, selvagens pelo RNG de geração.
- [x] Pathfinding com o terreno + testes com níveis próprios.
- [x] Treinador e save acima do terreno + testes.
- [x] `TerrainView` e debug do nível da água.
- [x] Painel de ajuste em tempo real (F2).
- [x] Ajuste dos parâmetros jogando.
- [x] Teste no jogo pelo usuário.
- [x] Roadmap, backlog e wiki.

---

## Critérios de Conclusão

- [x] O mundo tem relevo, igual a cada vez que o jogo abre.
- [x] Treinador e criaturas andam pelo relevo sem atravessar o chão nem
      prender em emenda de chunk.
- [x] O pathfinding contorna encostas íngremes.
- [x] Há vales abaixo do nível da água (vistos no debug).
- [x] Save antigo carrega com o treinador em cima do chão.
- [x] `npm run build`, `npm run lint` e `npm test` passando.
- [x] Wiki: página "O mundo".
