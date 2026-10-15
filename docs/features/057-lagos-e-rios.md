# 🚀 Versão 0.0.57 — Lagos e rios

## Resumo

A água deixa de ser só visual. O mundo ganha **lagos** e **rios** gerados
pela seed nos biomas visíveis (floresta, planície e savana; a cidade fica
seca):

- **Água rasa** dá para atravessar andando, **mais devagar** conforme a
  profundidade, com respingo e som de passo na água.
- **Água funda** bloqueia o treinador e as criaturas — cada um até uma
  fração da própria altura. O pathfinding e a IA ficam num trecho pequeno
  de raso.
- **Arremesso**: o que cai na água funda **afunda e volta** — a esfera de
  invocar volta como quando erra, e o item comum some com um respingo.
- **Tag "perto de água"**, consultada pelo spawn (060).
- **Visual**: duas opções lado a lado no F2 para o usuário escolher — o
  shader da 049 ajustado e um no estilo da água do Let's Go.

Versão: `0.0.57` (`package.json`). Branch: `feature/057-lagos-e-rios`.

> **Os números deste doc são fictícios (só ilustram).** O valor de verdade é
> o do campo citado (config ou dado do bioma).

---

## O que já existe (ponto de partida)

- **Um nível de água para o mundo todo** (`TERRAIN.WATER_LEVEL`). O relevo
  de cada bioma é medido a partir dele (`relief.baseHeight`).
- **Água só onde o relevo afunda abaixo do nível**: na prática, só nos
  bebedouros da savana (vales com `hillHeight` maior que `baseHeight`). A
  floresta, a planície e a cidade quase nunca descem até a água.
- **Superfície visual** (`view/water/`, 049): uma grade por chunk nas
  células com chão abaixo da água (`buildWaterChunkGeometry`). O material
  (`waterMaterial.js`, `GAME_CONFIG.WATER`) tem cor rasa e funda, opacidade
  pela profundidade, espuma na margem, ondas e reflexo do céu. Não colide
  nem bloqueia.
- **Relevo pela seed** (`createTerrainSampler`, `terrainHeight.js`): a mesma
  altura com e sem chunk carregado (`heightAt`), usada também pelo relevo
  distante (051).
- **Trilhas** (`trails.js`, 049): linha onde um ruído torcido passa por
  zero, com a mesma largura em todo lugar. Elas já evitam a água
  (`SHORE_GAP`). É o molde para os rios.
- **Pathfinding** (`core/pathfinding.js`): grade por chunk com andável,
  penhasco (`MAX_CLIMB_STEP`) e pegadas dos sólidos.
- **Passos** (`view/systems/footstepAudioSystem.js`, 019) com sons em
  `public/assets/audio/footsteps/`. O pacote de origem
  (`.exemple/Steps/Steps`) tem os de água: `WaterFootStepWalk`, `Run`,
  `RunRelease`, `Sneak` e `Land`.
- **Arremesso** (`projectileSystem`, `summonBallSystem`,
  `captureBallSystem`): a esfera de invocar já volta quando erra.
- **Save**: a posição salva dentro do relevo sobe para a superfície (044).

---

## Decisões (com o usuário)

1. **Lagos e rios, com um nível de água só** (o `WATER_LEVEL`). Os lagos
   são manchas pela seed que afundam o relevo abaixo da água; os rios são
   faixas pela seed (como as trilhas) que cavam um vale até abaixo da
   água, com a margem em rampa. Os rios atravessam os biomas, mas não as
   cidades. Lagos com nível próprio foram descartados (complexos demais).
2. **Água rasa mais devagar**: a velocidade cai com a profundidade até o
   limite do raso (ajustável no F2).
3. **Arremesso na água funda afunda e volta**: respingo na superfície; a
   esfera de invocar volta como quando erra; o item comum some.
4. **Visual em duas opções para comparar** (troca no F2):
   - **A — shader da 049 ajustado**, com correnteza no rio (ondas andando
     na direção dele).
   - **B — estilo do Let's Go**: textura e cores da água tiradas dos mapas
     do LGPE.
   O usuário escolhe uma; a outra sai do código.

---

## Arquitetura (proposta)

### Lagos e rios no relevo (core, `core/terrain/water.js`)

- **No sampler do relevo**, não no chunk: o vale do rio e a bacia do lago
  entram em `createTerrainSampler`, depois da média dos biomas. Assim o
  `heightAt` continua igual com e sem chunk, e o relevo distante já mostra
  os rios.
- **Rio**: mesma ideia das trilhas — onde um ruído próprio
  (`deriveSeed(seed, 'rivers')`) passa por zero, com tamanho maior e a
  largura em `GAME_CONFIG.WATER_BODIES.RIVER_*` (leito, margem, fundura).
  O leito desce até `WATER_LEVEL − fundura` e a margem sobe em rampa até o
  relevo de volta. Em morro alto o rio cava um vale mais fundo: a largura
  da margem cresce com a altura, para não virar cânion.
- **Lago**: manchas por ruído (`LAKE_SIZE`, `LAKE_COVERAGE`) que afundam o
  relevo em bacia — mais fundo no meio, raso na beira.
- **Por bioma**: `water` no dado do bioma (quanto de rio e de lago ele
  aceita, 0 a 1), pesado como o relevo. A cidade fica com zero; o molde
  vai no `_template`.
- **Fundo nunca plano** (para não cair na pendência da 081): o leito leva
  um pouco do ruído do relevo.
- `TERRAIN.GENERATION_VERSION` sobe.

### Consultas (core, puras)

- `waterDepthAt(x, z)` = `WATER_LEVEL − heightAt(x, z)` (positiva = água).
- `isDeepWater(x, z)`: profundidade acima de `WATER.DEEP_LIMIT`.
- `nearWaterAt(x, z, radius)`: a tag "perto de água" do spawn (060),
  amostrando em volta.
- Trilhas, itens no mundo, frutas, vegetação e sólidos já evitam o chão
  abaixo da água; conferir que os rios novos seguem a mesma regra.

### Bloqueio e movimento

- **Água funda**: o movimento não entra na célula funda — o
  `characterPhysicsSystem` corta a componente do deslocamento que leva
  para a água funda (como uma parede na margem), sem colisor novo no
  Rapier. Se isso ficar instável, a alternativa é uma parede de colisor na
  linha da margem funda, por chunk.
- **Água rasa**: multiplicador de velocidade pela profundidade
  (`WATER.SHALLOW_SPEED`, de 1 na margem até o mínimo no limite do raso),
  aplicado no `movementSystem` para todos (treinador, time e selvagens).
- **Pathfinding**: célula com água funda é não andável, como a pegada de
  um sólido; o raso continua andável (com custo maior, se o A* da grade
  aceitar custo).
- **Save**: posição salva em água funda vai para a margem mais perto.
- **Nascer**: o treinador em `(0, y, 0)` continua em terra (a origem fica
  fora de rio e lago).

### Arremesso

- Projétil que toca a superfície da água sobre fundo fundo: respingo e
  fim — a esfera de invocar volta (o mesmo caminho de quando erra), a de
  captura e o item comum somem. No raso, cai no fundo como hoje.

### View

- **Superfície**: a grade de hoje continua; ganha a direção da correnteza
  por vértice (do ruído do rio) para a opção A.
- **Opção B**: buscar nos mapas do LGPE (`LGPE-FieldMaps.7z`) o material e
  a textura da água (lagos de rota e o rio de Cerulean) e montar o material
  com eles.
- **Troca no F2**: `WATER.STYLE` (`'toon'` / `'lgpe'`), em tempo real, com
  os ajustes de cada um.
- **Respingo**: partículas (no kit de VFX que já existe) nos pés de quem
  anda no raso e no ponto onde o arremesso cai.
- **Som**: passos na água (andar, correr, pousar) do pacote `Steps`,
  trocados pela profundidade nos pés; respingo do arremesso.

### Config

- `GAME_CONFIG.WATER_BODIES`: tamanho e largura dos rios, tamanho e
  cobertura dos lagos, fundura, margem.
- `GAME_CONFIG.WATER`: `DEEP_LIMIT`, `SHALLOW_SPEED`, `STYLE` e o visual
  de cada estilo.
- F2: pasta "Água" com tudo isso e o "Copiar valores".

### Testes (regras, sem fixar valores)

- Mesma seed, mesmos rios e lagos; `heightAt` igual com e sem chunk.
- Rio e lago só nos biomas que aceitam; nenhum dentro da cidade; origem em
  terra.
- O leito fica abaixo da água; nenhuma célula do leito perfeitamente plana.
- Água funda não andável no pathfinding; raso andável.
- Na água funda o personagem não entra; no raso anda mais devagar quanto
  mais fundo.
- Esfera de invocar que cai na água funda volta; item comum some.
- `nearWaterAt` verdadeiro na margem e falso longe.
- Save em água funda volta para a margem.

---

## Etapas

- [x] Bump `package.json` → `0.0.57` e doc.
- [x] Revisão do doc pelo usuário.
- [x] Rios e lagos no relevo, `water` por bioma, `GENERATION_VERSION`
      (+ testes).
- [x] Consultas (`waterDepthAt`, `isDeepWater`, `nearWaterAt`) (+ testes).
- [x] Bloqueio da água funda, raso mais devagar, pathfinding, save
      (+ testes).
- [x] Arremesso na água (+ testes).
- [x] Visual A (shader da 049 com correnteza).
- [x] Busca no LGPE e visual B; troca no F2.
- [x] Escolha do visual pelo usuário; o outro sai.
- [x] Respingo e som.
- [x] Teste no jogo pelo usuário e ajustes.
- [x] Desempenho na Intel UHD (com e sem água na tela).
- [x] Wiki: água na página "O mundo".
- [x] Roadmap: 057 para "Já feito".
- [x] Gates: `npm test` inteiro, `npm run lint` e build.

---

## Como ficou (implementação)

**Relevo** (`core/terrain/waterBodies.js`):
- `createWaterBodies(seed)`: rio (linha onde um ruído torcido passa por
  zero) e lago (manchas do ruído em camadas do mapa de biomas, que tem a
  fração calibrada — `noiseToFraction`/`layeredNoise`, agora exportado do
  `biomeMap.js`). Os dois medidos pela distância até a beira:
  `waterProfile` desce dentro da água sem nunca ficar plano e sobe fora com
  a encosta `BANK_SLOPE`; `smoothMin` junta o vale ao relevo sem vinco; um
  ruído de fundo (`BED_*`) garante que nenhuma célula do leito é plana.
- Entra no `createTerrainSampler`, depois da média dos biomas, pesado pelo
  `water` de cada bioma (`{ rivers, lakes }`, 0 a 1). Floresta, planície e
  savana têm; a cidade não. A origem fica seca (`SPAWN_CLEAR_RADIUS`).
- `flowAt`: a correnteza (a tangente do rio), só para o desenho.
- `GAME_CONFIG.WATER_BODIES` faz parte da receita do relevo;
  `GENERATION_VERSION` subiu.

**Consultas** (`core/terrain/water.js`, puras; `core/actions/water.js` liga
ao relevo do nível): `waterDepthAt`, `isDeepWater` (`WATER.NAV_DEPTH`), `wadeLimit` (`WADE_FRACTION`),
`shallowSpeedFactor` (`SHALLOW_MIN_SPEED`), `stepOutOfDeepWater`,
`nearWaterAt` (tag do spawn, `NEAR_RADIUS`), `shoreNear`, `deepWaterEntry`.

**Movimento** (`characterPhysicsSystem`, vale para todos): o passo encolhe
no raso e não entra na água funda (desliza pela margem; quem já está no
fundo sai). O passo barrado entra no `MovementBlocked`, e a IA desvia.
**Pathfinding**: célula com água funda bloqueada. **Save**: posição em
água funda vai para a margem. Os **selvagens de teste** sorteados em água
funda também vão para a margem (provisório até a 060).

**Arremesso**: `WaterSplash` (trait + `waterSplashSystem`) e
`respingarAgua`. A esfera de invocar que mergulha (ou para no ar sobre o
fundo) não invoca — o Pokémon fica no time; a bola de captura voando ou
perdida, a fruta derrubada e o projétil afundam e somem, sem quebrar.

**View**:
- A malha da água leva a correnteza por vértice (`waterFlow`).
- **A — toon** (`waterMaterial.js`): o de antes, com as ondas levadas pela
  correnteza (flow map de duas fases: `FLOW_SPEED`, `FLOW_CYCLE`).
- ~~**B — Let's Go**~~ (saiu no fechamento; `lgpeWaterMaterial.js`): as texturas do
  `FieldWaterShader01/02` do rio da Rota 24 (`river_area04_00`) — rede de
  luz em duas camadas, brilho, normal map, céu com nuvens refletido e a
  faixa de espuma da beira —, também com a correnteza
  (`WATER.LGPE`). Texturas por `scripts/lgpe/pack-water.js` em
  `public/assets/textures/water/lgpe/`.
- `WATER.STYLE` troca na hora (`WaterView`).
- Respingo (`WaterSplashView`: gotas + anel, som `WATER_SOUNDS.splash`) e
  marolinhas nos pés de quem anda no raso (`FootRipplesView`), com o passo
  da água no lugar do da espécie (`footstepAudioSystem`). Sons do pacote
  `Steps` (`WaterFootStep*`).

**F2** (painel "Terreno"): "Lagos e rios (refaz ao soltar)" — forma dos
rios e lagos e quanto cada bioma aceita; "Água (desenho)" — estilo A/B,
limite do fundo, velocidade no raso, correnteza e os ajustes de cada
estilo. "Copiar valores" leva os dois.

**Na seed do jogo**: cerca de 13% do mundo vira água (antes, 1,6%) —
11,7% de lago e 3,6% de rio, por igual nos três biomas; a cidade fica
seca. Um rio passa a uns 60 m da origem (terra firme em (-65, -1)). A
altura por ponto ficou cerca de 2× mais cara (1,6 → 3,4 µs): uns 0,5 ms a
mais por chunk — conferir o relevo distante na medição de desempenho.

**Pendente de olhar no teste**: objeto sólido grande na margem (moita,
pedra) pode avançar sobre a água — a vegetação confere só o centro dele.

---

## Ajustes depois do primeiro teste (pedido do usuário)

1. **Margem e encosta**: a margem (`TERRAIN_COLOR.SHORE_HEIGHT`) ficou mais
   larga; a planície ganhou areia na margem e terra na encosta
   (`ground.colors.shore`/`slope`, e a cor de longe), a savana, areia na
   margem. A encosta do vale (`WATER_BODIES.BANK_SLOPE`) ficou mais
   íngreme, para pintar como encosta — ainda abaixo do degrau que a IA
   sobe. `GENERATION_VERSION` subiu.
2. **Correnteza que "voltava com tudo"**: o peso das duas fases do flow
   map estava trocado (mostrava a fase justo quando ela recomeçava).
   Corrigido nos dois estilos.
3. **Fundo por espécie**: cada corpo entra até uma fração da própria
   altura (`WATER.WADE_FRACTION`, `wadeLimit`) — o Charmander e a Caterpie
   param bem antes do treinador —, e a velocidade cai até o limite dele.
   A IA navega só num trecho pequeno de raso (`WATER.NAV_DEPTH`), que
   também é o "fundo" para o arremesso, o save e o nascer. Os dois no F2
   ("Água (desenho)").
4. **Marolinha dos passos** mais suave: anel fino, pouco opaco, que cresce
   desacelerando e some aos poucos; tamanho, opacidade e duração em
   `WATER.RIPPLE` (F2, "Marolinha dos passos").
5. **Pulo e dash**: o dash usa a mesma poeira do pulo (`jumpDustVfx.js`,
   do tamanho dela) e mantém as linhas. Com os pés na água, pulo, pouso e
   dash soltam um respingo na superfície (`waterSplashVfx.js`: espuma em
   anel e gotas do Water Gun) no lugar da poeira.

### Segunda rodada

6. **Respingo sem poeira**: a espuma do respingo usava a fumaça da poeira
   (só pintada de azul) e parecia poeira. Saiu: o respingo é só água —
   gotas do Water Gun numa coroa (altas) e espirrando longe (baixas) —,
   mais um anel na superfície (`addFootRipple`, no pulo e no dash).
7. **Respingo maior**: gotas por nuvem de poeira que sairia, tamanho,
   força e o anel em `FEEDBACK.WATER_SPLASH`.
8. **Ondas na margem** (`view/water/shoreWave.js`, nos dois estilos):
   perto da beira a superfície sobe rápido e recua devagar, cobrindo e
   descobrindo a encosta, com fase própria por trecho da margem; a espuma
   e a transparência seguem a beira que anda. A malha da água cobre também
   a terra da beira (`SHORE_REACH`) para a onda ter onde subir.
   `WATER.SHORE_WAVE` (altura, ondas por segundo, tamanho dos trechos, até
   que profundidade) — F2, "Água (desenho)" → "Ondas na margem".
9. **Save na água**: quem salva na água onde entra volta no mesmo lugar;
   só vai para a margem se estiver além do próprio limite (`shoreNear` com
   o `wadeLimit` do corpo) — antes valia o raso da navegação, mais raso que
   o treinador.

## Fechamento

- **Visual**: o usuário ficou com o **A — toon** (o shader da 049 com
  correnteza e ondas na margem). O B saiu: `lgpeWaterMaterial.js`,
  `scripts/lgpe/pack-water.js`, as texturas em
  `public/assets/textures/water/lgpe/`, `WATER.STYLE`/`WATER.LGPE` e as
  pastas do F2. As cores da margem e do fundo do toon ficaram as que o
  usuário ajustou no teste.
- **Desempenho** (Intel UHD, `next dev`, 1080p, na beira do rio perto da
  origem, a água visível e escondida na mesma sessão, intercalado):
  59,5 contra 58,0 FPS (no teto) e GPU 12,0 contra 10,7 ms — a água custa
  cerca de 1,2 ms por quadro (119 malhas, uma por chunk com água ou
  margem). A altura por ponto ficou cerca de 2× mais cara (os rios e lagos
  no sampler): uns 0,5 ms a mais por chunk gerado.
- **Wiki** (página "O mundo"): o relevo aponta para a seção nova "Lagos e
  rios" (raso e fundo por criatura, a IA na beirada, respingo e
  marolinhas, o que afunda, a correnteza e as ondas, a volta na margem ao
  entrar); o "em breve" troca a água por nadar.
- **Roadmap**: 057 no "Já feito" (grupo "Pokémon e mundo"); a 081 (chão
  plano) anota que a água desviou dela com o leito sempre ondulado.
- **Gates**: `npm test` inteiro (233 arquivos, 2497 testes, com
  `--maxWorkers=2`), `npm run lint` e build (numa cópia, sem a `.exemple`,
  com o `next dev` rodando) passando.

---

## Critérios de Conclusão

- [x] Andando pelo mundo aparecem lagos e rios na floresta, na planície e
      na savana, e nenhum na cidade.
- [x] O raso é atravessado mais devagar, com respingo e som; o fundo
      bloqueia treinador e criaturas, e a IA desvia.
- [x] O que cai na água funda afunda; a esfera de invocar volta.
- [x] Mesma seed, mesma água.
- [x] Visual escolhido pelo usuário entre as duas opções (A — toon).
- [x] Desempenho na Intel UHD no nível de hoje (dentro do ruído).
- [x] `npm run build`, `npm run lint` e `npm test` passando.
- [x] Wiki atualizada.

---

## Fora de escopo

- **Nadar** (e Pokémon de água entrando no fundo) — depois da beta.
- **Oceano e praia** — continuam escondidos.
- **Vegetação de margem** (juncos, vitórias-régias) — pode entrar na 058.
- **Pontes** — depois.
- **Água com nível próprio** (lago no alto do morro, cachoeira) — depois.
