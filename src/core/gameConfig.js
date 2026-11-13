/**
 * Configuração central do jogo.
 *
 * Toda constante ajustável e GENÉRICA (igual pra qualquer entidade —
 * zoom de câmera, gravidade, algoritmo do character controller) vive
 * aqui, agrupada por domínio. Config que varia POR ESPÉCIE (velocidade,
 * vitals, e — desde docs/features/018-troca-de-controle-treinador-
 * criatura.md — custos/delays de stamina/HP e o que é exclusivo do
 * treinador: arremesso/consumo/invocar/recolher/comportamento de time)
 * mora em `core/data/species/<id>/index.js`, não aqui. Systems leem
 * daqui — nunca declaram números mágicos.
 */
export const GAME_CONFIG = {
  LOOP: {
    // Passo fixo da simulação (s) — física, IA e systems. Não limita os
    // quadros desenhados: isso é o `RENDER.MAX_FPS`.
    FIXED_TIMESTEP: 1 / 60,
    // Teto de tempo absorvido por frame. Protege contra "spiral of death"
    // quando a aba fica em background ou ocorre um stall de GC.
    MAX_FRAME_TIME: 0.25,
    // Teto de passos fixos por frame. Backlog além disso é descartado.
    MAX_STEPS_PER_FRAME: 5,
  },
  // Ver docs/rules/README.md, 3.5 — sem `Math.random()` em lógica de
  // jogo, PRNG seedado e nomeado. `core/rng.js` (`gameplayRng`) usa
  // `WORLD.SEED` como seed.
  WORLD: {
    SEED: 151,
  },
  // Relevo procedural (docs/features/045-terreno-de-um-chunk.md). Mudar
  // qualquer valor da geração (aqui, em BIOMES ou no `relief`/`climate`/
  // `size` de um bioma, core/data/biomes/) muda o relevo da seed — subir
  // GENERATION_VERSION junto. A forma dos morros é de cada bioma
  // (docs/features/047-biomas.md).
  TERRAIN: {
    // Identifica a receita do relevo; subir quando a geração mudar.
    GENERATION_VERSION: 28,
    // Altura (m) da superfície da água: o que fica abaixo vira lago na 057.
    // O relevo dos biomas é medido a partir dela (`relief.baseHeight`).
    WATER_LEVEL: -2,
    // Lado (m) de um chunk — sempre um vértice por metro (o do Minecraft).
    CHUNK_SIZE: 16,
    // Lado (m) do bloco em que saem os objetos sólidos (árvores, troncos
    // caídos, pedras — core/terrain/terrainChunkSet.js): um número ÍMPAR de
    // chunks (os chunks são centrados na origem; só assim a borda do bloco
    // cai na borda de um chunk).
    SOLIDS_BLOCK_SIZE: 80,
    // O raio (em chunks) carregado em volta do treinador e da criatura
    // controlada é a distância de visão do menu "Gráficos"
    // (`GRAPHICS.VIEW_DISTANCE`). Um chunk descarrega a mais deste tanto
    // (em chunks) além dele: a folga evita carregar e descarregar o mesmo
    // chunk andando na borda.
    UNLOAD_MARGIN: 2,
    // Raio (em chunks) que carrega na hora, sem esperar a vez — o chão
    // debaixo e em volta de quem anda.
    NEAR_RADIUS: 2,
    // Quantos chunks carregam por tick fora do NEAR_RADIUS (cada um custa
    // alguns ms; muitos de uma vez travam o quadro).
    CHUNKS_PER_TICK: 1,
    // Folga (m) entre os pés e o chão de quem entra no mundo (treinador,
    // selvagens) — cai até pousar.
    SPAWN_HEIGHT: 1,
  },
  // Mapa de biomas (docs/features/047-biomas.md, core/terrain/biomeMap.js).
  // Os eixos do clima (temperatura, umidade, continentalidade, relevo) vão
  // de 0 a 1 — a fração do mundo abaixo daquele valor —, e cada bioma diz
  // em que faixa de cada eixo ele vive (`climate`, core/data/biomes/).
  BIOMES: {
    // Tamanho (m) das manchas de temperatura, umidade e relevo — quem fica
    // vizinho de quem (deserto perto de savana, tundra perto de montanha).
    // O tamanho de cada bioma é o `size` dele.
    CLIMATE_SIZE: 5000,
    // Tamanho (m) dos continentes e oceanos.
    CONTINENT_SIZE: 3200,
    // Quanto um bioma perde por estar fora da própria faixa de clima: maior
    // = fronteira de clima mais firme (e transição mais curta).
    CLIMATE_SHARPNESS: 6,
    // Quanto as manchas próprias de cada bioma (do tamanho do `size` dele)
    // pesam contra o clima: são elas que decidem entre biomas do mesmo
    // clima — o menor por cima, o maior de fundo.
    PRESENCE_STRENGTH: 0.3,
    // Fração (0 a 1) da área que as manchas de um bioma cobrem.
    PATCH_COVERAGE: 0.4,
    // Largura da borda de uma mancha (na mesma escala de 0 a 1): maior =
    // contorno mais suave.
    PATCH_EDGE: 0.08,
    // Faixa de mistura na disputa (em pontos): biomas que chegam perto do
    // vencedor entram um pouco na fronteira.
    BLEND: 0.1,
    // Grade (m) em que a disputa é feita; entre os pontos dela os pesos são
    // suavizados, e a transição entre dois biomas dura umas três células —
    // maior = fronteira de relevo e cor mais larga e suave.
    BLEND_CELL: 32,
    // Continentalidade mínima na origem (0 a 1, acima da faixa da praia):
    // quem nasce em (0, y, 0) está sempre em terra firme...
    SPAWN_CONTINENT: 0.55,
    // ...até esta distância (m) da origem, sumindo aos poucos.
    SPAWN_LAND_RADIUS: 400,
    // Ids dos biomas que ficam fora do mundo (o resto disputa o lugar
    // deles). Ferramenta de teste: o painel do debug (F2) esconde biomas
    // para olhar um só. Na beta só aparecem os biomas das espécies
    // selvagens, cada um ao ser refinado (docs/roadmap.md, Marco 2): a
    // floresta (049), a planície e a savana (050). Os outros ficam na seed,
    // vistos só pelo F2 — a montanha (051) inclusive, adiada para depois da
    // beta (docs/features/054-savana-lgpe-e-saida-do-megakit.md).
    HIDDEN: [
      'mountain',
      'ocean',
      'beach',
      'jungle',
      'swamp',
      'desert',
      'volcanic',
      'tundra',
    ],
  },
  // Desenho do chão (view/terrain/terrainMaterial.js,
  // docs/features/047-biomas.md): sobre a cor da paleta de cada bioma, o
  // claro e escuro e o relevo de luz das camadas de textura (`ground` do
  // bioma) e manchas suaves. O painel do debug (F2) ajusta ao vivo.
  TERRAIN_LOOK: {
    // Tamanho (m) de uma repetição da textura no chão.
    TEXTURE_SIZE: 4,
    // Tamanho (m) de uma repetição das texturas de cor (as do Let's Go, nos
    // biomas com `ground.colors` — docs/features/052-*.md).
    COLOR_TEXTURE_SIZE: 6,
    // Tamanho (m) próprio de algumas camadas de cor (nome da camada em
    // view/terrain/terrainLayers.js → m): as outras usam o de cima. O
    // calçamento das ruas da cidade (docs/features/056-bioma-cidade.md)
    // fica menor que a grama.
    COLOR_LAYER_SIZES: {
      'lgpe-street': 3,
      'lgpe-pewter-tile': 3,
      'lgpe-cerulean-tile': 3,
      'lgpe-vermilion-tile': 3,
      'lgpe-lavender-asphalt': 3,
      // O chão de Viridian montada à mão (docs/features/069-revisao-do-
      // bioma-cidade.md): o tamanho de uma repetição no mapa original vezes
      // a escala da cidade — o asfalto e as rochas dos barrancos.
      'lgpe-asphalt': 5,
      'lgpe-town-cliff': 2.5,
      'lgpe-wall-rock': 3,
      'lgpe-wall-soil': 3,
    },
    // A camada que aparece onde a de cima é transparente (a textura com
    // alfa): as pedras de pisar de Viridian sobre a terra batida, como no
    // original (lá elas são quadrados por cima do chão).
    COLOR_LAYER_UNDER: {
      'lgpe-path-stone': 'lgpe-soil',
    },
    // Força do relevo de luz do mapa de normal (0 = liso).
    NORMAL_STRENGTH: 0.8,
    // Quanto do claro e escuro da textura entra, para todos os biomas (vezes
    // o `ground.detail` de cada um).
    TEXTURE_DETAIL: 1,
    // Manchas grandes de claro e escuro, do tamanho PATCH_SIZE (m) — a
    // variação suave de cor do chão...
    PATCH_STRENGTH: 0.15,
    PATCH_SIZE: 9,
    // ...e um granulado fino por cima.
    GRAIN_STRENGTH: 0.05,
    // Tom e brilho do chão inteiro (docs/features/066-revisao-dos-
    // biomas.md): a cor puxa para `TINT` (`TINT_AMOUNT`, 0 = nada) mantendo
    // o claro e escuro, e `BRIGHTNESS` multiplica (1 = como está).
    TINT: '#3f6e30',
    TINT_AMOUNT: 0.75,
    BRIGHTNESS: 0.7,
    // Luz do chão (docs/features/066-revisao-dos-biomas.md, desempenho):
    // 'lambert' (só a luz difusa, mais leve — a diferença para a outra quase
    // não se vê) ou 'standard' (com o brilho especular). Troca o material ao
    // vivo.
    LIGHTING: 'lambert',
  },
  // Cor do chão (view/terrain/terrainGeometry.js); as cores são de cada
  // bioma (`palette`, core/data/biomes/).
  TERRAIN_COLOR: {
    // Margem: da água até esta altura (m) acima dela.
    SHORE_HEIGHT: 0.5,
    // Encosta: começa a misturar quando a inclinação passa de SLOPE_START
    // (normal.y abaixo dele) e chega cheia em SLOPE_FULL.
    SLOPE_START: 0.9,
    SLOPE_FULL: 0.75,
  },
  // Trilhas (docs/features/049-vegetacao-e-floresta.md, core/terrain/
  // trails.js): linhas sinuosas pela seed nos biomas com `trails`. O chão
  // pinta a trilha (`palette.trail`, `ground.trailTexture`) e a vegetação
  // não nasce nela.
  TRAILS: {
    // Distância típica (m) entre duas trilhas.
    SIZE: 150,
    // Quanto a trilha serpenteia (m de desvio) e o tamanho (m) das curvas.
    WARP: 22,
    WARP_SIZE: 45,
    // Largura (m) da trilha e da borda dela (onde a grama volta aos poucos).
    WIDTH: 2.2,
    EDGE: 0.9,
    // Relevo: quanto (m) o meio da trilha afunda no chão (o pisado) e quanto
    // a beirada sobe (a terra empurrada para o lado). O colisor acompanha.
    DEPTH: 0.3,
    BANK: 0.08,
    // Força do desenho da textura na trilha (0 a 1, como o `ground.detail`
    // dos biomas) — a terra batida tem mais marca que o chão em volta.
    DETAIL: 1,
    // Sem trilha abaixo da água + esta folga (m).
    SHORE_GAP: 0.3,
  },
  // Cidades (docs/features/056-bioma-cidade.md, core/town/townPlan.js): a
  // grade, os prédios e os objetos de rua de cada uma vêm do `town` do
  // bioma; aqui ficam os números de todas.
  TOWN: {
    // Faixa (no peso da cidade, 0 a 1) abaixo do `minShare` do bioma em que
    // a rua some aos poucos na borda.
    SHARE_FADE: 0.1,
    // Sem lote abaixo da água + esta folga (m).
    SHORE_GAP: 0.5,
    // Sem prédio nem objeto até esta distância (m) da origem (onde o
    // treinador nasce).
    SPAWN_CLEAR_RADIUS: 12,
    // Folga (m) entre o prédio e a divisa do lote.
    LOT_MARGIN: 0.5,
    // Lado (m) máximo de cada círculo da pegada retangular (prédio, cerca):
    // menor = contorno mais justo e mais círculos.
    FOOTPRINT_CELL: 1.5,
    // Cerca das casas: quanto (m) fica para dentro da divisa da rua e a
    // largura (m) do portão na frente da porta.
    FENCE_INSET: 0.6,
    GATE_WIDTH: 3,
    // Poste: quanto (m) fica para dentro da esquina do quarteirão.
    LAMP_INSET: 1,
    // Banco: quanto (m) fica à frente e ao lado da porta do prédio.
    DOOR_GAP: 0.8,
    // O quintal das casas (docs/features/069-revisao-do-bioma-cidade.md):
    // meia largura (m) do corredor livre da porta até a rua (onde vão as
    // pedras do caminho), a folga (m) entre as coisas do quintal e a parede
    // ou a cerca, e o passo (m) com que uma coisa que não coube escorrega
    // para fora.
    DOOR_CLEAR: 1,
    YARD_GAP: 0.3,
    YARD_SLIDE: 0.25,
    // Hidrante: quanto (m) fica do poste da esquina, ao longo da rua.
    HYDRANT_GAP: 3,
    // O maior raio (m) da água de uma fonte da praça: até onde a consulta
    // da água (`core/actions/water.js`) procura fonte nos chunks vizinhos.
    FOUNTAIN_REACH: 4,
    // Teto de quarteirões de uma cidade na busca (core/town/cityIndex.js):
    // só uma trava contra cidade sem fim (um mundo só de cidade).
    MAX_CITY_BLOCKS: 2000,
    // Lotes abertos mínimos para um pedaço de cidade ter Pokécenter, loja,
    // ginásio e o especial: abaixo disso (lascas na borda da mancha), só
    // casas.
    MIN_CITY_LOTS: 8,
  },
  // Entrar nos prédios (docs/features/068-interior-dos-predios.md): a sala
  // por dentro é um lugar à parte, bem acima da porta (os chunks em volta
  // continuam os da cidade), e o mundo de fora some enquanto o treinador
  // está nela.
  INTERIOR: {
    // Altura (m) da sala acima do chão da porta.
    ALTITUDE: 300,
    // Quanto (m) da porta o treinador alcança para entrar (da frente do
    // prédio) e para sair (do meio do tapete de saída, na sala).
    DOOR_REACH: 2.2,
    EXIT_REACH: 2.2,
    // Ao sair, onde o treinador para: quanto (m) à frente da porta.
    EXIT_DISTANCE: 1.5,
    // A tela escurecendo (s) e clareando de novo (s); no escuro o
    // treinador troca de lugar.
    FADE_OUT: 0.45,
    FADE_IN: 0.6,
    // A câmera lá dentro: de frente para a sala (como nos jogos da série),
    // sem mostrar o vazio em volta dela.
    CAMERA: {
      // Quanto (rad) ela gira para cada lado da frente da sala e inclina
      // para cima e para baixo da `PITCH` — 0 = travada.
      YAW_RANGE: 0,
      PITCH: 0.55,
      PITCH_RANGE: 0,
      // Distância (m): começa na `DISTANCE`, que é também a mais longe; o
      // zoom só chega mais perto, até a `MIN_DISTANCE`.
      DISTANCE: 9,
      MIN_DISTANCE: 5,
      // Quanto (0 a 1) a câmera acompanha o treinador a partir do meio da
      // sala: 1 = segue ele inteiro; menos = a sala fica enquadrada e a
      // borda dela não entra na tela num canto.
      FOLLOW: 0.5,
    },
    // A luz da sala, no lugar da do céu: cor e força da luz ambiente e da
    // luz de cima (com sombra), e de onde ela vem (do alto, um pouco da
    // frente — vetor apontando para a luz).
    LIGHT: {
      AMBIENT: [1, 0.98, 0.95],
      AMBIENT_INTENSITY: 1.35,
      KEY: [1, 0.97, 0.92],
      KEY_INTENSITY: 1.6,
      SHADOW_INTENSITY: 0.45,
      DIRECTION: [0.25, 1, 0.45],
    },
    // O fundo em volta da sala (o vazio do diorama).
    BACKGROUND: '#05070a',
    // A chuva de fora, abafada dentro (fração do volume dela).
    RAIN_VOLUME: 0.25,
  },
  // As cidades copiadas inteiras do Let's Go (docs/features/069-revisao-do-
  // bioma-cidade.md — Pallet, a cidade tutorial): um lugar à parte ao ar
  // livre, bem acima de onde o treinador estava (os chunks em volta
  // continuam os de lá, escondidos), com o céu, o clima e a câmera livre.
  TOWN_MAP: {
    // Altura (m) do chão do mapa acima do relevo do ponto de partida.
    ALTITUDE: 600,
    // Tamanho do mapa (vezes o original). `null`: o dos prédios da cidade
    // (`town.scale` do bioma cidade) — as salas dele saem no mesmo.
    SCALE: null,
  },
  // Onde ficam as cidades (core/town/citySites.js, docs/features/058-
  // ajuste-dos-biomas.md): uma por célula de uma grade, a âncora da área em
  // volta. O porte e o raio de cada uma vêm do `town.sizes` do bioma. Faz
  // parte da receita do relevo: mudar qualquer número muda o mundo da seed
  // — subir `TERRAIN.GENERATION_VERSION` junto.
  CITIES: {
    // Só a primeira cidade no mundo (docs/features/069-revisao-do-bioma-
    // cidade.md): nesta beta, Viridian é a cidade inicial e Pallet a do
    // tutorial (o lugar à parte); as cidades procedurais voltam com `false`.
    ONLY_FIRST: true,
    // Lado (m) da célula: a distância típica entre duas cidades vizinhas.
    SPACING: 1600,
    // Quanto (fração da célula) o centro da cidade pode sair do centro da
    // célula. Abaixo de um terço: a busca da mais próxima olha só as
    // células vizinhas (`nearestCity`).
    JITTER: 0.3,
    // Folga (m) de rio e lago que o centro e a volta da cidade buscam, e
    // quantos sorteios tentar até achar um lugar assim (sem achar, fica o
    // de centro seco e menos água em volta).
    WATER_GAP: 20,
    TRIES: 16,
    // Largura (m) da borda da cidade no mapa de biomas: de lá para fora,
    // o bioma de volta entra aos poucos.
    EDGE: 24,
    // Porte da primeira cidade (a da origem, onde o treinador nasce) —
    // sem `FIRST_TOWN.LAYOUT`.
    FIRST_SIZE: 'village',
    // A primeira cidade, fixa no mundo (core/town/fixedTown.js,
    // docs/features/069-revisao-do-bioma-cidade.md — Viridian): `LAYOUT`,
    // a cidade montada à mão (`core/data/cityLayouts/`, core/town/
    // cityLayout.js; `null` = a procedural, do porte `FIRST_SIZE`), com o
    // chão do layout nos nossos platôs e na nossa montanha (`GROUND`, forma
    // de `CityLayoutGround`); `SCALE`, o tamanho (`null`: o dos prédios da
    // cidade, `town.scale`); `BLEND`, a largura (m) em que o relevo de fora
    // vai da borda dela até o da seed.
    FIRST_TOWN: {
      LAYOUT: 'viridian',
      SCALE: null,
      BLEND: 20,
      // Os tipos de vegetação do bioma que nascem na montada à mão, só no
      // gramado dela (fora das ruas e do lago): a grama em fios e as flores
      // do mundo. O resto (árvores, moitas, tufos, pedras) não nasce nela —
      // as árvores dela são as do layout.
      GROWS: ['tall-grass', 'flower'],
      GROUND: {
        // Os degraus: na forma do `relief.terraces` dos biomas (escolhidos
        // no laboratório da cidade).
        terraces: { step: 1.75, cliff: 0.25, tilt: 0 },
        // O paredão: como o `relief.mountains` da floresta.
        mountain: { height: 8, rise: 1, step: 4, cliff: 0.95, tilt: 0.1 },
        // O lago: o fundo e a superfície da água abaixo do chão (as do
        // original vezes a escala da cidade).
        lakeDepth: 2.4,
        lakeWater: 1.55,
        rampEdge: 1,
        // A ondulação leve do chão (docs/roadmap.md, 090), à parte da
        // inclinação dos degraus.
        swell: 0.1,
        // O borrão dos níveis antes do degrau (core/town/cityLayout.js):
        // até onde (células do layout) cada uma mistura as vizinhas — o
        // barranco mais largo e de borda arredondada, não a reta do
        // original — e a folga (células) em volta dos objetos em que o
        // chão fica no nível da célula.
        soften: { radius: 2, keep: 1 },
        // A beira da rua (a borda de terra e a guia): a largura da faixa de
        // cada lado e as repetições da máscara ao longo dela (m do layout,
        // as do original).
        curb: { width: 0.5, along: 0.24 },
      },
    },
  },
  // Estradas entre as cidades (core/town/roads.js, docs/features/058-
  // ajuste-dos-biomas.md). Faz parte da receita do relevo (o vau muda o
  // leito da água): mudar qualquer número muda o mundo da seed — subir
  // `TERRAIN.GENERATION_VERSION` junto.
  ROADS: {
    // Liga as estradas (desligadas nesta beta: sem as cidades procedurais
    // não há o que ligar).
    ENABLED: false,
    // Chance (0 a 1) de uma cidade ligar às duas vizinhas (leste e norte),
    // não só a uma: maior = mais voltas e atalhos.
    EXTRA: 0.15,
    // Quanto a estrada serpenteia, em fração do comprimento dela.
    WARP: 0.15,
    // Distância (m) entre os pontos do traçado.
    STEP: 16,
    // Largura (m) da estrada e da borda dela (onde a grama volta aos
    // poucos).
    WIDTH: 5,
    EDGE: 1.5,
    // Relevo: quanto (m) o meio afunda e a beirada sobe (como a trilha).
    DEPTH: 0.1,
    BANK: 0.05,
    // Vau: onde a estrada cruza rio ou lago, o leito sobe até esta
    // profundidade (m) — somada ao afundado da estrada, abaixo do raso por
    // onde a IA navega (`WATER.NAV_DEPTH`) — numa faixa desta largura (m).
    FORD_DEPTH: 0.08,
    FORD_WIDTH: 9,
    // Camada de cor do chão da estrada (a mesma em todo bioma).
    LAYER: 'lgpe-trail-soil',
  },
  // Lagos e rios (core/terrain/waterBodies.js, docs/features/057-lagos-e-
  // rios.md): cavam o relevo abaixo do `TERRAIN.WATER_LEVEL` nos biomas com
  // `water`. Faz parte da receita do relevo: mudar qualquer número muda o
  // mundo da seed — subir `TERRAIN.GENERATION_VERSION` junto.
  WATER_BODIES: {
    RIVER: {
      // Distância típica (m) entre dois rios.
      SIZE: 700,
      // Quanto o rio serpenteia (m de desvio) e o tamanho (m) das curvas.
      WARP: 70,
      WARP_SIZE: 220,
      // Largura (m) da água.
      WIDTH: 9,
      // Fundura (m) que o meio vai alcançando e quanto (m) o fundo desce a
      // cada metro para dentro da beira.
      DEPTH: 2.2,
      SHORE_SLOPE: 0.35,
    },
    LAKE: {
      // Tamanho (m) das manchas de lago e a fração (0 a 1) delas que vira
      // lago.
      SIZE: 260,
      COVERAGE: 0.1,
      DEPTH: 2.8,
      SHORE_SLOPE: 0.2,
    },
    // Quanto (m) a encosta do vale sobe a cada metro para fora da água:
    // íngreme o bastante para pintar a encosta (`TERRAIN_COLOR.SLOPE_*`),
    // abaixo do degrau que a IA sobe (`PATHFINDING.MAX_CLIMB_STEP`).
    BANK_SLOPE: 0.5,
    // Largura (m) da curva onde o vale encontra o relevo.
    BLEND: 1.5,
    // Ruído do fundo: quanto (m) ele varia e o tamanho (m) das ondulações.
    BED_ROUGHNESS: 0.3,
    BED_SIZE: 7,
    // Sem lago nem rio até esta distância (m) da origem (onde o treinador
    // nasce); some aos poucos a partir da metade dela.
    SPAWN_CLEAR_RADIUS: 60,
  },
  // Água (core/terrain/water.js, view/water/; docs/features/049-vegetacao-
  // e-floresta.md e 057-lagos-e-rios.md): a superfície no
  // `TERRAIN.WATER_LEVEL`, onde o chão fica abaixo dela.
  WATER: {
    // Até onde cada corpo entra andando, em fração da altura dele: mais
    // fundo que isso, a água o barra (core/terrain/water.js).
    WADE_FRACTION: 0.3,
    // O trecho de raso por onde a IA navega (m de profundidade): mais fundo
    // que isso, o pathfinding desvia, o que é arremessado afunda e ninguém
    // nasce.
    NAV_DEPTH: 0.2,
    // Fração da velocidade que sobra no limite de cada corpo (cai aos
    // poucos da margem até lá).
    SHALLOW_MIN_SPEED: 0.55,
    // Raio (m) da consulta "perto de água" (tag do spawn).
    NEAR_RADIUS: 12,
    // Quanto tempo (s) dura o respingo de algo que afunda.
    SPLASH_DURATION: 0.9,
    // Ondas na margem (view/water/shoreWave.js): quanto (m) a superfície
    // sobe e desce na beira, quantas ondas por segundo, o tamanho (m) dos
    // trechos da margem que andam juntos e até que profundidade (m) a onda
    // mexe.
    SHORE_WAVE: {
      HEIGHT: 0.14,
      SPEED: 0.22,
      SIZE: 10,
      DEPTH: 0.8,
    },
    // Marolinha nos pés de quem anda na água (view/water/
    // FootRipplesView.jsx): até que raio (m) cresce, a opacidade no começo
    // (0 a 1) e quanto tempo (s) dura.
    RIPPLE: {
      SIZE: 0.5,
      OPACITY: 0.18,
      DURATION: 1.2,
    },
    // Correnteza dos rios: velocidade (m/s) e o ciclo (s)
    // em que o desenho volta ao lugar (curto = repete visível; longo =
    // estica).
    FLOW_SPEED: 1.2,
    FLOW_CYCLE: 2.5,
    // Cor na margem e no fundo; profundidade (m) em que a cor é a do fundo.
    SHALLOW_COLOR: '#3fb8e8',
    DEEP_COLOR: '#1462d9',
    DEEP_DEPTH: 3,
    // Opacidade na margem e no fundo; profundidade (m) em que fica a do
    // fundo — na margem dá para ver o chão.
    SHORE_OPACITY: 0.35,
    DEEP_OPACITY: 0.9,
    OPACITY_DEPTH: 1.5,
    // Espuma na beira: cor e largura (m de profundidade).
    FOAM_COLOR: '#e8f4ef',
    FOAM_WIDTH: 0.18,
    // Ondinhas: tamanho (m), velocidade e força no brilho.
    WAVE_SIZE: 2.5,
    WAVE_SPEED: 0.35,
    WAVE_STRENGTH: 0.35,
    // Quanto do céu a água reflete (mais vista de lado), quanto da cor
    // refletida é a do alto do céu (o resto, a do horizonte) e a aspereza
    // (brilho do sol).
    REFLECTION: 0.35,
    SKY_TOP_SHARE: 0.6,
    ROUGHNESS: 0.18,
  },
  BATTLE: {
    // Velocidade dos golpes pelo status `speed` (ver
    // `calculateAttackDurationFactor`, core/data/species/stats.js): a
    // duração autorada da skill (`duration`/`effectAt`) e a recarga são
    // multiplicadas por √(REFERENCE / speed), limitado a
    // [MIN_FACTOR, MAX_FACTOR]. REFERENCE é o `speed` CALCULADO (base + IV
    // + nível) que toca a duração autorada exata.
    ATTACK_SPEED: {
      REFERENCE: 10,
      MIN_FACTOR: 0.6,
      MAX_FACTOR: 1.4,
    },
    // Faixa de IV (individual value, convenção clássica de Pokémon)
    // sorteada pra QUALQUER criatura — selvagem, no spawn
    // (`nascerSelvagem` (`core/actions/wildSpawn.js`)), ou do jogador, ao criar o
    // registro (`core/actions/pokemon.js`, `criarPokemon`) — mesmo
    // range pros dois, IV é aleatório pra todo mundo (pedido do
    // usuário). Ver `rollIndividualValues`, `core/data/species/stats.js`.
    IV_MIN: 0,
    IV_MAX: 31,
    // Chance (0-1) de um ataque ser crítico (`critical = 2` na fórmula de
    // dano, ver `core/battle/calculateDamage.js`). Decisão separada do
    // cálculo de dano em si (pedido do usuário), sorteada com
    // `gameplayRng` (`core/rng.js`) — regra 3.5, sem `Math.random()`.
    CRITICAL_HIT_CHANCE: 1 / 16,
    // Faixa do multiplicador aleatório de dano (`random` na fórmula). Ver
    // `rollDamageRandomFactor`.
    DAMAGE_RANDOM_MIN: 0.85,
    DAMAGE_RANDOM_MAX: 1,
    // Status ofensivo/defensivo usado no cálculo de dano quando a
    // espécie ainda não migrou pro formato `stats.<key>.base` (ver
    // `resolveCreatureStats`, `core/data/species/stats.js`). Sem isso,
    // um ataque dessas criaturas não causaria dano nenhum; com o
    // fallback, causa um dano neutro/mediano — mesmo "fallback
    // gracioso" que `resolveMaxHp`/`resolveMaxStamina` já usam pra essas
    // mesmas espécies.
    FALLBACK_COMBAT_STAT: 50,
    // Direcionar o golpe ENQUANTO O AVISO CARREGA: do disparo até o `effectAt`,
    // a criatura controlada acompanha a câmera (a direção só trava no instante
    // do golpe). `false` = trava no disparo, como antes. Só vale pra criatura
    // controlada (a IA mira uma vez, no disparo).
    ATTACK_WINDUP_STEERING: true,
    // Golpe com arrancada (`lunge` da skill, `core/battle/attackLunge.js`):
    // vão (m) que sobra entre a borda da frente de quem arranca e a do
    // primeiro alvo no caminho quando ela para — dentro do alcance do golpe,
    // sem empurrar o corpo do alvo.
    LUNGE_STOP_GAP: 0.3,
    // Fração do `effectAt` em que a arrancada chega: termina um pouco antes
    // do acerto, que é resolvido antes do passo da física do mesmo tick.
    LUNGE_WINDOW: 0.9,
    // Segundos sem lançar ataque até a criatura sair do modo combate
    // (`CombatMode`, `combatModeSystem.js`) — cada ataque reinicia a conta.
    COMBAT_MODE_TIMEOUT: 3,
    // Atordoamento (ação `'hit'`, `core/actions/hitStun.js`) de quem teve um
    // golpe de status interrompido por dano: segundos em que toca a animação
    // de hit e não faz nada. Por espécie: `actions.hit.duration`.
    HIT_STUN_DURATION: 0.67,
    // Combate 2.5D (`core/battle/attackGeometry.js`): diferença máxima
    // (m) entre as elevações dos pés de atacante e alvo, cada uma medida
    // em relação ao terreno logo abaixo dela. Acima disso, o alvo está
    // fora do plano de combate (ex.: pulando alto).
    MAX_COMBAT_HEIGHT_DIFF: 1.0,
    // Até onde (m) procurar o chão abaixo de uma criatura pra medir a
    // elevação dos pés — sem chão nesse alcance, conta como no chão.
    GROUND_PROBE_DISTANCE: 20,
    // Espaçamento (m) das amostras de terreno ao longo da trajetória do
    // golpe (`resolveAttackImpactPoint`, creatureAttackSystem.js) — o
    // golpe acompanha rampas e para em desnível/parede entre amostras.
    ATTACK_PATH_SAMPLE_STEP: 0.25,
  },
  // Tipos elementais (docs/features/039-tipos-e-combate-classico.md). A tabela de
  // efetividade, com os próprios multiplicadores, fica em
  // `core/data/types/index.js`; aqui só o bônus do golpe do mesmo tipo de
  // quem ataca (STAB, `resolveStab`).
  TYPES: {
    STAB_MULTIPLIER: 1.5,
  },
  // Retorno visual de combate (view — consome eventos de `core/events/`).
  FEEDBACK: {
    // Emote acima da cabeça da selvagem (`view/scene/WildEmote.jsx`,
    // docs/features/063-revisao-da-ia-selvagem.md): a exclamação ao te
    // perceber, a veia de raiva ao partir para cima, a gota de suor ao fugir.
    // SIZE em px; durações em ms; POP_OVERSHOOT é o quanto passa do tamanho
    // na entrada; LOOP_AMPLITUDE multiplica o movimento do loop de cada
    // emote; OUTLINE é a grossura do contorno escuro (no desenho de 64).
    WILD_EMOTE: {
      SIZE: 56,
      POP_DURATION: 320,
      POP_OVERSHOOT: 0.35,
      LOOP_AMPLITUDE: 1,
      LOOP_DURATION: 900,
      OUTLINE: 3,
      FADE_DURATION: 260,
      // Quanto (px) o emote fica acima da etiqueta de nome.
      GAP: 4,
    },
    // Aviso de que a criatura vai ser puxada para a bola (docs/features/064-
    // revisao-da-ia-do-parceiro.md): a Pokébola piscando acima da plaquinha
    // dela (`RecallWarningIcon.jsx`) e o banner da HUD
    // (`StrayWarningHud.jsx`).
    RECALL_WARNING: {
      // Tamanho (px) da Pokébola e quanto (px) ela fica acima da etiqueta.
      SIZE: 34,
      GAP: 4,
      // Uma piscada (ms) com tempo sobrando e na reta final (abaixo de
      // FAST_BELOW, s) — acelera para avisar que está acabando.
      BLINK_SLOW: 700,
      BLINK_FAST: 220,
      FAST_BELOW: 1,
      // De quanto em quanto (s) o tempo da tela muda — a HUD redesenha
      // poucas vezes por segundo, não a cada tick.
      DISPLAY_STEP: 0.1,
    },
    // Brilho rápido no modelo de quem foi atingido (`hitFlashSystem.js`): acende
    // na cor do acontecimento (`FEEDBACK_COLORS`, abaixo) e apaga ao longo de
    // DURATION (s). INTENSITY (0-1) é o quanto o brilho cobre a textura.
    HIT_FLASH: {
      DURATION: 0.22,
      INTENSITY: 0.9,
    },
    // Cores do feedback por LADO e por TIPO de acontecimento — a mesma paleta
    // pro brilho do modelo (`hitFlashSystem.js`) e pros textos acima da cabeça
    // (`damageNumberSystem.js` + `DamageNumbersView.jsx`). Regra de jogo de
    // ação (docs/features/064-revisao-da-ia-do-parceiro.md, Parte 4): o dano
    // que VOCÊ causa é claro, o que você TOMA é vermelho.
    // - DAMAGE: tomou dano; CRIT: o número do dano CRÍTICO, com o brilho do
    //   contorno e o rótulo em CRIT_GLOW (o brilho do modelo continua em
    //   DAMAGE); DEBUFF: status negativo (atributo baixou); BUFF: status
    //   positivo (atributo subiu).
    // - OPPONENT (selvagens e quem não é do jogador): dano branco, crítico
    //   dourado; status laranja / verde.
    // - ALLY (o treinador e as criaturas do time): dano e crítico vermelhos;
    //   status violeta / azul — longe das cores do oponente.
    // Cor do texto "Errou!" (golpe que falhou no sorteio de precisão): cinza
    // claro, igual pros dois lados — não é dano nem status.
    MISS_COLOR: '#d9d9d9',
    // Cor do texto "Interrompido!" (golpe de status cortado na carga por
    // dano): amarelo, igual pros dois lados — não é dano nem status.
    INTERRUPT_COLOR: '#ffd54f',
    // Visual da Pokébola de captura (docs/features/043-captura.md,
    // `view/captureBallMotion.js`):
    // - SPIN_SPEED: giro (voltas/s) da bola em voo.
    // - WOBBLE_*: cada balançada inclina a bola de lado e volta, WOBBLE_CYCLES
    //   vezes em WOBBLE_DURATION (s), até WOBBLE_ANGLE (graus), amortecendo.
    // - GLOW_*: o brilho que puxa o selvagem pra dentro (cresce e some
    //   durante a absorção), até GLOW_MAX_SCALE × o tamanho da bola.
    // - STAR_*: estrelinhas do "Capturado!" — STAR_COUNT saindo até
    //   STAR_DISTANCE (m) em volta da bola.
    // - CLICK_*: o "clique" no fim — a bola encolhe CLICK_SQUASH e volta.
    // - POP_DURATION: o selvagem estourando a bola no escape (s).
    // - BREAK_*: a bola que errou quebra nos últimos BREAK_DURATION (s),
    //   em BREAK_PIECES pedaços.
    CAPTURE_BALL: {
      SPIN_SPEED: 2.5,
      WOBBLE_ANGLE: 45,
      WOBBLE_CYCLES: 3,
      WOBBLE_DURATION: 0.9,
      GLOW_COLOR: '#ff4d4d',
      GLOW_MAX_SCALE: 6,
      STAR_COUNT: 6,
      STAR_DISTANCE: 0.45,
      STAR_COLOR: '#ffe066',
      CLICK_SQUASH: 0.15,
      POP_DURATION: 0.2,
      BREAK_DURATION: 0.3,
      BREAK_PIECES: 6,
      BREAK_COLOR: '#d9d9d9',
    },
    // Partículas da Pokébola do Cobblemon (`view/vfx/pokeballVfx.js`): a bola
    // abrindo (invocar, escape) e o "Capturado!". ENABLED liga/desliga;
    // SCALE multiplica o tamanho e as distâncias do efeito inteiro.
    POKEBALL_VFX: {
      ENABLED: true,
      SCALE: 1,
    },
    // O feixe da Pokébola (recolher, invocar, captura puxando o selvagem —
    // `view/scene/RecallBeamView.jsx`), no estilo do Cobblemon: a textura
    // `phase_beam.png` correndo ao longo dele (SCROLL_SPEED, repetições
    // por segundo), tingida com a cor da bola (`pokeball.beamColor`, ou
    // DEFAULT_COLOR). Miolo de raio RADIUS (m) e opacidade OPACITY; brilho
    // em volta de raio GLOW_RADIUS e opacidade GLOW_OPACITY. O "envelope" da
    // criatura entrando/saindo usa ENVELOPE_OPACITY.
    PHASE_BEAM: {
      DEFAULT_COLOR: '#ff3b3b',
      RADIUS: 0.035,
      GLOW_RADIUS: 0.09,
      OPACITY: 0.95,
      GLOW_OPACITY: 0.35,
      SCROLL_SPEED: 3,
      ENVELOPE_OPACITY: 0.75,
    },
    // Cores dos textos da captura (docs/features/043-captura.md):
    // "Capturado!", "Escapou!" e "Pelas costas!".
    CAPTURED_COLOR: '#7cf29c',
    ESCAPED_COLOR: '#ff9e80',
    BACK_STRIKE_COLOR: '#ffe066',
    // Cores da mira da Pokébola: o arco/retículo normal, pegando um
    // selvagem e fora do alcance.
    AIM_COLOR: '#ffffff',
    AIM_TARGET_COLOR: '#ff4d4d',
    AIM_OUT_OF_RANGE_COLOR: '#8a8a8a',
    // Cor do texto "+N XP" em cima da criatura do time que ganhou XP
    // (docs/features/037-experiencia-e-nivel.md).
    XP_COLOR: '#9fd8ff',
    // Cor do texto "Nível N!" quando ela sobe de nível.
    LEVEL_UP_COLOR: '#ffe066',
    // Cor do texto "Falhou!" (golpe que não erra, falhando por domínio
    // baixo — docs/features/038-aprendizado-treino-e-dominio-de-golpes.md).
    FAIL_COLOR: '#c9b8a6',
    // Cor dos avisos de golpe: "Pode aprender X!", "Aprendeu X!".
    MOVE_NOTICE_COLOR: '#b9f6ca',
    // Cores dos avisos dos itens no mundo (docs/features/055-itens-no-
    // mundo.md): "Pegou X!" / "Colheu N X!" e "Inventário cheio".
    ITEM_NOTICE_COLOR: '#ffe9a8',
    INVENTORY_FULL_COLOR: '#ff9e80',
    // Cor da linha de quem ficou para trás e voltou para a bola
    // (docs/features/064-revisao-da-ia-do-parceiro.md).
    STRAYED_COLOR: '#ffd180',
    // Cores dos textos de efetividade de tipo (docs/features/039-tipos-e-combate-classico.md), iguais pros dois lados: "Super efetivo!", "Pouco
    // efetivo…" e "Não afeta…".
    // A cor do selo e do log de cada condição é dela (`feedback.color`,
    // `core/data/conditions/`).
    EFFECTIVENESS_COLORS: {
      super: '#ff8a3d',
      weak: '#9fb3c8',
      immune: '#8c8c8c',
    },
    FEEDBACK_COLORS: {
      OPPONENT: {
        DAMAGE: '#ffffff',
        CRIT: '#ffd23f',
        CRIT_GLOW: '#ff9500',
        DEBUFF: '#ff9f0a',
        BUFF: '#32d74b',
      },
      ALLY: {
        DAMAGE: '#ff3030',
        CRIT: '#d50000',
        CRIT_GLOW: '#ff6b6b',
        DEBUFF: '#b57bff',
        BUFF: '#40a9ff',
      },
    },
    // Marca do que é SEU (docs/features/064-revisao-da-ia-do-parceiro.md,
    // Parte 4) — pra achar o seu Pokémon numa briga com outro da mesma
    // espécie:
    // - anel no chão embaixo de cada criatura do seu time, sempre
    //   (`PartyMarkerView.jsx`): COLOR com OPACITY; o raio é o do corpo
    //   (a cápsula, no plano) vezes RADIUS_FACTOR, com WIDTH (m) de
    //   espessura; LIFT (m) acima do chão; no ar, só aparece até
    //   MAX_GROUND_GAP (m) do chão;
    // - na plaquinha, o nome em NAME_COLOR e a tecla do slot (Q/E/R) ao
    //   lado (`NameplateView.jsx`).
    PARTY_MARKER: {
      COLOR: '#3fa9ff',
      OPACITY: 0.8,
      RADIUS_FACTOR: 1.1,
      WIDTH: 0.1,
      LIFT: 0.04,
      MAX_GROUND_GAP: 8,
      NAME_COLOR: '#7cc4ff',
    },
    // Log de batalha em texto, estilo jogo de turno (`battleLogSystem.js` +
    // `tools/hud/BattleLogHud.jsx`, docs/features/039-tipos-e-combate-classico.md).
    // Avisos no canto da tela (`tools/hud/NoticeHud.jsx`, docs/features/
    // 067-campo-de-treino-e-avisos-de-nivel.md): subiu de nível, golpe novo
    // e a dica do campo de treino. DURATION em s; MAX_VISIBLE avisos ao mesmo
    // tempo (o mais antigo sai).
    NOTICES: {
      DURATION: 6,
      MAX_VISIBLE: 4,
    },
    // Balanço do boneco de treino ao levar o golpe do treino
    // (`trainingDummyWobbleSystem.js`, docs/features/067-campo-de-treino-e-
    // avisos-de-nivel.md): inclina para longe de quem bateu e vai e volta
    // diminuindo — inclinação máxima AMPLITUDE (rad), FREQUENCY idas e
    // voltas por segundo, DAMPING o quanto morre por segundo e DURATION (s)
    // até parar de vez.
    TRAINING_DUMMY_WOBBLE: {
      AMPLITUDE: 0.2,
      FREQUENCY: 2.2,
      DAMPING: 3,
      DURATION: 1.6,
    },
    BATTLE_LOG: {
      // Quantas linhas ficam guardadas/visíveis (as mais antigas saem).
      MAX_LINES: 7,
      // Segundos sem mensagem nova até o log apagar (volta na próxima).
      IDLE_FADE_TIME: 8,
      // Cor do "X usou Y!".
      USED_COLOR: '#ffffff',
    },
    // Número de dano subindo acima de quem apanhou (`damageNumberSystem.js`
    // + `DamageNumbersView.jsx`). Crítico fica mais tempo, maior e com
    // rótulo próprio (visual na view).
    DAMAGE_NUMBER: {
      // Quantos números podem estar na tela ao mesmo tempo — pool de
      // tamanho fixo (regra de efeito visual frequente); cheio, o mais
      // antigo é reaproveitado.
      POOL_SIZE: 24,
      // Segundos na tela (normal / crítico).
      LIFETIME: 0.9,
      CRIT_LIFETIME: 1.2,
      // Quanto (m) o número sobe ao longo da vida.
      RISE: 0.9,
      // Folga (m) acima do topo do corpo do alvo onde o número nasce.
      HEAD_MARGIN: 0.2,
      // Afastamento lateral (m) entre números seguidos no mesmo alvo, pra
      // golpes rápidos não empilharem um em cima do outro.
      SPREAD: 0.25,
    },
    // Indicador de alcance antes de lançar (`castMode: 'confirm'`,
    // `AttackIndicatorView.jsx`): leque azulado no chão, estilo LoL.
    ATTACK_INDICATOR: {
      FILL_COLOR: '#3fa9ff',
      FILL_OPACITY: 0.28,
      EDGE_COLOR: '#a6dcff',
      EDGE_OPACITY: 0.9,
      // Altura (m) acima do chão — evita o leque "piscar" dentro do chão.
      GROUND_LIFT: 0.03,
      // A forma (indicador e aviso) acompanha o relevo: é uma malha com no
      // máximo este passo (m) entre fileiras, e cada vértice desce até o
      // chão por um raio que sai `DRAPE_RAY_UP` (m) acima da trajetória e
      // desce até `DRAPE_RAY_DOWN` (m) abaixo dela. Passo menor = segue
      // melhor o relevo, com mais raios por frame.
      DRAPE_STEP: 0.25,
      DRAPE_RAY_UP: 3,
      DRAPE_RAY_DOWN: 10,
      // Desenha o leque por cima de tudo (sem teste de profundidade) — a
      // criatura não tampa mais a parte embaixo dela. Efeito colateral:
      // também aparece através de parede/obstáculo/terraço. `false` volta
      // ao normal (tampado por quem estiver na frente).
      ALWAYS_ON_TOP: true,
    },
    // Aviso de golpe (`view/scene/AttackTelegraphView.jsx`): durante a
    // execução de QUALQUER ataque (time e selvagens), o leque da área
    // aparece no chão e se preenche do ápice até a borda, completando no
    // instante do dano — dá pra ver onde vai acertar e desviar. Usa a
    // mesma altura (`GROUND_LIFT`) do indicador acima, mas respeita
    // profundidade (não é desenhado por cima de corpos/obstáculos).
    ATTACK_TELEGRAPH: {
      FILL_COLOR: '#ff7043',
      FILL_OPACITY: 0.35,
      EDGE_COLOR: '#ffab91',
      EDGE_OPACITY: 0.9,
      // Carga de golpe em SI MESMO (Growth): círculo nos pés, que ainda pode
      // ser interrompido por dano — cor própria, não o vermelho de ataque.
      SELF_FILL_COLOR: '#9ccc65',
      SELF_EDGE_COLOR: '#dcedc8',
      // Quantos avisos simultâneos no máximo (pool fixo de leques).
      POOL_SIZE: 16,
      // Por cima da grama e dos arbustos, que o golpe não colide
      // (view/materials/overPlants.js, docs/features/066-revisao-dos-
      // biomas.md): HEIGHT (m) é a altura da camada de plantas que o aviso
      // atravessa; MIN_ANGLE (rad), o menor ângulo da câmera com o chão
      // usado na conta (câmera rente ao chão não puxa sem fim). Os
      // personagens continuam por cima do aviso.
      OVER_PLANTS: { ENABLED: true, HEIGHT: 1.6, MIN_ANGLE: 0.2 },
    },
    // Efeito visual do dash (`view/vfx/dashVfx.js`, `view/scene/
    // DashEffectsView.jsx`): linhas de velocidade enquanto dura o dash e poeira
    // no chão na saída. SCALE multiplica tamanho e raio (1 = o do Cobblemon).
    DASH_EFFECT: {
      ENABLED: true,
      SCALE: 0.6,
      // Linhas de velocidade: quantas saem por SEGUNDO enquanto o dash dura
      // (0 = sem linhas), e o tamanho de cada uma em metros, antes da escala.
      LINE_RATE: 25,
      LINE_LENGTH: 0.6,
      LINE_THICKNESS: 0.05,
      // Nuvens de poeira na saída do dash (0 = sem poeira).
      DUST_COUNT: 5,
      // Dash no AR (voo livre, docs/features/060-ajustes-por-especie.md): sem
      // poeira; ondas de ar que estouram pra trás na saída (0 = sem ondas).
      AIR_WAVES: 2,
    },
    // Respingo de quem pula, cai ou dá dash na água (`view/vfx/
    // waterSplashVfx.js`, docs/features/057-lagos-e-rios.md), no lugar da
    // poeira: gotas por nuvem de poeira que sairia (`DROPS_PER_PUFF`), o
    // tamanho (m) e a força (m/s) delas, antes da escala do efeito, e o
    // tamanho do anel na superfície (vezes o da marolinha dos passos,
    // `WATER.RIPPLE`).
    WATER_SPLASH: {
      DROPS_PER_PUFF: 8,
      DROP_SIZE: 0.45,
      DROP_SPEED: 3.5,
      RING_SIZE: 2.5,
    },
    // Poeira do pulo (`view/scene/JumpDustView.jsx`, `view/vfx/jumpDustVfx.js`):
    // anel de nuvens no chão na decolagem de um pulo (TAKEOFF_COUNT nuvens) e na
    // aterrissagem de qualquer queda — a quantidade vai de LANDING_COUNT_MIN a
    // _MAX conforme a velocidade da queda (m/s): abaixo de MIN_FALL_SPEED não
    // solta nada (degrau, rampa) e em MAX_FALL_SPEED é a força total. SCALE
    // multiplica tamanho e raio. Valores de partida, ajustar jogando.
    // Fruta sendo comida (docs/features/042-itens-da-beta.md,
    // `view/systems/eatingFoodViewSystem.js` e `view/scene/
    // EatingVfxView.jsx`). A cada mordida (a cada BITE_INTERVAL s, ou quando
    // o pedaço do modelo troca) a fruta dá um "aperto" (achata BITE_SQUASH e
    // volta numa mola de rigidez BITE_SPRING), pula BITE_HOP (m, só a do
    // chão) e solta JUICE_COUNT gotas de suco e CRUMB_COUNT farelos. Enquanto
    // come, brilhos de cura sobem em volta de quem come (HEAL_SPARKLE_RATE
    // por segundo). A fruta caída respinga ao quicar (LAND_JUICE_COUNT).
    // SCALE multiplica o tamanho das partículas. Valores de partida,
    // ajustar jogando.
    EAT_FOOD: {
      ENABLED: true,
      BITE_INTERVAL: 0.7,
      BITE_SQUASH: 0.22,
      BITE_SPRING: 300,
      BITE_HOP: 0.04,
      JUICE_COUNT: 5,
      CRUMB_COUNT: 3,
      HEAL_SPARKLE_RATE: 6,
      LAND_JUICE_COUNT: 4,
      SCALE: 1,
    },
    JUMP_DUST: {
      ENABLED: true,
      SCALE: 0.5,
      MIN_FALL_SPEED: 2,
      MAX_FALL_SPEED: 10,
      TAKEOFF_COUNT: 2,
      LANDING_COUNT_MIN: 2,
      LANDING_COUNT_MAX: 4,
    },
    // Hit stop (`view/systems/hitStopSystem.js`): no acerto, a ANIMAÇÃO
    // do atacante e do alvo congela por um instante — dá "peso" ao golpe.
    // Só visual (a simulação segue); ticks de ataque canalizado não
    // disparam (travaria o canal a cada tick).
    HIT_STOP: {
      DURATION: 0.07,
      CRIT_DURATION: 0.12,
    },
    // Anel de tempo da ação de ataque (`view/scene/ActionTimerRingView.jsx`),
    // estilo stamina do Valheim: no chão, em volta da criatura CONTROLADA,
    // só enquanto ela executa um ataque — começa cheio e esvazia até o fim
    // da `duration` (quando ela fica livre de novo).
    ACTION_TIMER_RING: {
      COLOR: '#ffd54f',
      OPACITY: 0.9,
      // Anel de fundo (a parte já gasta).
      TRACK_COLOR: '#000000',
      TRACK_OPACITY: 0.35,
      // Folga (m) entre o corpo (`capsuleRadius`) e a borda interna do anel.
      PADDING: 0.12,
      // Espessura (m) do anel.
      THICKNESS: 0.06,
      // Segmentos do círculo — mais = arco mais liso.
      SEGMENTS: 64,
    },
  },
  // Modo scanner (item categoria `scanner`, ex.: Pokédex) —
  // `scannerModeSystem.js`, docs/features/031-*.md/032-*.md. Genérico
  // (não por espécie de item) porque só o treinador escaneia, mesmo
  // raciocínio de `PLAYER_ACTIONS.dash` abaixo.
  SCANNER: {
    // Alcance (m) do raycast que acha a criatura embaixo do retículo.
    RANGE: 5,
  },
  // Só `dash` continua aqui — funciona igual pra qualquer entidade
  // controlada (treinador ou criatura, ver docs/features/018-troca-de-
  // controle-treinador-criatura.md), sem variar por espécie. Arremesso,
  // consumo, invocar/recolher e o comportamento de time (antes `PARTY`
  // aqui) viraram config exclusiva do TREINADOR — só ele dispara essas
  // ações de verdade — em `core/data/species/boy/index.js`
  // (`actions`/`party`), lidos via `getPlayerSpecies()`
  // (`core/data/species/index.js`).
  PLAYER_ACTIONS: {
    dash: {
      // Duração do impulso (segundos).
      DURATION: 0.5,
      // Unidades por segundo — maior que o runSpeed de qualquer espécie hoje.
      SPEED: 10,
      // Recarga (s) depois de cada dash — igual pra todos, jogador e IA
      // (`DashCooldown`, docs/features/035-balanceamento-de-acoes-e-correcoes.md). O
      // custo é por entidade (`Vitals.dashStaminaCost`).
      COOLDOWN: 2.5,
      // Frenagem (s): nos últimos EASE_OUT_TIME segundos, a velocidade desce
      // suave de SPEED até a de saída (0 / andar / correr, pelo input) em
      // vez de cair de uma vez no tick seguinte. Limitado a metade de
      // DURATION; 0 desliga. Ver `resolveDashSpeed` (core/actions/dash.js).
      EASE_OUT_TIME: 0.25,
    },
  },
  // Itens (docs/features/042-itens-da-beta.md).
  ITEMS: {
    // Fruta derrubada por quem foi interrompido comendo (`derrubarComida`):
    // quanto tempo (s) fica no chão antes de sumir, e a que distância (m)
    // na frente de quem comia ela cai.
    DROPPED_FOOD_LIFETIME: 6,
    DROPPED_FOOD_FORWARD_OFFSET: 0.4,
    // Física da fruta caída (`droppedFoodSystem`) — só visual, ninguém
    // pega. Sai com um impulso pra frente (TOSS_FORWARD) e pra cima
    // (TOSS_UP), espalhado pros lados em até ±TOSS_SPREAD (m/s); cai com a
    // gravidade do jogo; quica devolvendo RESTITUTION da velocidade
    // vertical; no chão, o atrito tira FRICTION (fração por segundo) da
    // velocidade horizontal; abaixo de REST_SPEED (m/s) ela para.
    DROPPED_FOOD_PHYSICS: {
      TOSS_FORWARD: 1.2,
      TOSS_UP: 2.2,
      TOSS_SPREAD: 0.8,
      RESTITUTION: 0.35,
      FRICTION: 3,
      REST_SPEED: 0.15,
      // Batida no chão acima desta velocidade (m/s) quica e conta como
      // "quicou" (`DroppedFood.landings`, pro respingo da view); abaixo,
      // ela só assenta.
      LANDING_MIN_SPEED: 1,
    },
  },
  // Itens no mundo (docs/features/055-itens-no-mundo.md). O que nasce no
  // chão de cada bioma (teto por chunk, reposição) fica no `worldItems` do
  // bioma, e a fruta da vegetação no `forage`; aqui, o que vale para todos.
  // - INTERACT_RADIUS (m): até onde F pega o item ou vasculha o arbusto e
  //   a árvore (da borda deles).
  // - BUSH_REACH (m): o raio de um arbusto para o F.
  // - SPAWN_MIN_DISTANCE (m): a reposição não põe item mais perto que isso
  //   do treinador (não aparece do nada na frente dele).
  // - ITEM_SPACING (m): distância mínima entre dois itens do chão.
  // - SOLID_CLEARANCE (m): folga da pegada de árvore e pedra.
  // - BORDER_GAP (m): folga da borda do chunk.
  // - MAX_SLOPE (rad) e SHORE_GAP (m): sem item em encosta íngreme nem
  //   perto da água.
  // - SPOT_ATTEMPTS: tentativas de achar um ponto livre antes de desistir.
  // - REFILL_CHECK_SECONDS (s): de quanto em quanto tempo a reposição confere
  //   os chunks (a reposição é de minutos de jogo; conferir todo passo é
  //   desperdício).
  WORLD_ITEMS: {
    INTERACT_RADIUS: 1.6,
    BUSH_REACH: 0.5,
    SPAWN_MIN_DISTANCE: 25,
    ITEM_SPACING: 4,
    SOLID_CLEARANCE: 0.6,
    BORDER_GAP: 1,
    MAX_SLOPE: 0.4,
    SHORE_GAP: 0.6,
    SPOT_ATTEMPTS: 24,
    REFILL_CHECK_SECONDS: 1,
  },
  // Grade do inventário (docs/features/041-inventario-de-itens-e-pokemon.md).
  INVENTORY: {
    // Tamanho da grade (colunas × linhas) — é também o limite do inventário
    // (`resolveInventoryCapacity`): cheio, o Pokémon capturado fica numa bola
    // no chão (docs/features/043-captura.md).
    COLUMNS: 5,
    ROWS: 5,
  },
  // A Pokébola do invocar/recolher (docs/features/043-captura.md): depois de
  // pousar, a bola fica em cima de onde a criatura nasce, ABOVE_HEAD (m)
  // acima da cabeça dela, dá um pulinho de HOP_HEIGHT (m) em HOP_TIME (s),
  // abre e fecha em OPEN_DURATION (s — o clipe `summon` encaixa aqui) e
  // some encolhendo em VANISH_DURATION (s).
  SUMMON_BALL: {
    // Quanto dura (s) o feixe da bola até a criatura ao invocar.
    BEAM_DURATION: 0.45,
    ABOVE_HEAD: 0.15,
    HOP_HEIGHT: 0.2,
    HOP_TIME: 0.2,
    OPEN_DURATION: 0.8,
    VANISH_DURATION: 0.2,
  },
  // Captura (docs/features/043-captura.md): arremesso da Pokébola em arco,
  // chance, balançadas e o que acontece depois.
  CAPTURE: {
    // Velocidade (m/s) com que a bola sai da mão. O ângulo é resolvido pro
    // arco passar pelo ponto de mira (`resolveArcLaunch`); fora do alcance,
    // sai no ângulo de alcance máximo.
    THROW_SPEED: 16,
    // Gravidade da bola em voo (m/s², negativa) — própria, pra afinar o
    // arco sem mexer na do resto do jogo.
    GRAVITY: -18,
    // Tempo máximo (s) da bola em voo antes de ser dada como perdida.
    MAX_FLIGHT_TIME: 4,
    // Raio (m) da bola: o acerto num selvagem soma isto ao raio da cápsula.
    BALL_RADIUS: 0.12,
    // A bola para no ar e o selvagem vira luz e entra (s).
    ABSORB_DURATION: 0.8,
    // Logo depois do acerto, a bola dá um pulinho: sobe ABSORB_HOP_HEIGHT (m)
    // em ABSORB_HOP_TIME (s), desacelerando, e flutua ali até cair.
    ABSORB_HOP_HEIGHT: 0.3,
    ABSORB_HOP_TIME: 0.25,
    // Depois de absorver, a bola cai até o chão — com esta gravidade (m/s²).
    FALL_GRAVITY: -12,
    // Balançadas: quantas, o intervalo (s) entre uma e outra (a primeira
    // espera o intervalo depois de pousar) e a pausa (s) depois da última
    // antes do resultado.
    SHAKE_COUNT: 3,
    SHAKE_INTERVAL: 1,
    RESULT_DELAY: 0.6,
    // Quanto tempo (s) a bola fica na tela depois do "Capturado!" e do
    // escape, pros efeitos da view.
    CAUGHT_LINGER: 1.2,
    // Bola que errou: rola com a física da comida caída
    // (`ITEMS.DROPPED_FOOD_PHYSICS`, mesmas chaves) e quebra depois de
    // MISS_LIFETIME (s).
    MISS_LIFETIME: 1.6,
    MISS_PHYSICS: {
      RESTITUTION: 0.45,
      FRICTION: 2.5,
      REST_SPEED: 0.15,
      LANDING_MIN_SPEED: 1,
    },
    // Mira (segurar o botão direito com a Pokébola na mão; o clique só
    // arremessa mirando):
    // - MODE: 'arc' mostra a linha do arco e o círculo onde a bola cai;
    //   'reticle' (como no Legends Arceus) só o retículo, que muda quando
    //   pega um selvagem e fica apagado fora do alcance.
    // - CAMERA_DISTANCE: a câmera chega até esta distância (m) mirando (se
    //   já estiver mais perto, fica); SHOULDER_OFFSET: o desvio de ombro
    //   mirando; BLEND_SPEED: rapidez da transição da câmera.
    // - RANGE: até onde (m) o raio do retículo procura o ponto de mira.
    // - TRACE_STEP: passo (s) da previsão do voo.
    // - ARC_POINTS: pontos da linha do arco; RING_RADIUS: raio (m) do
    //   círculo no chão (no selvagem, o do corpo dele).
    AIM: {
      MODE: 'reticle',
      CAMERA_DISTANCE: 3.2,
      SHOULDER_OFFSET: 0.75,
      BLEND_SPEED: 10,
      RANGE: 30,
      TRACE_STEP: 1 / 30,
      ARC_POINTS: 40,
      RING_RADIUS: 0.25,
    },
    // Taxa de captura (0-255, escala da série) de uma espécie sem
    // `capture.rate`.
    DEFAULT_RATE: 45,
    // Teto do valor `a` da fórmula (Gen 3): daí pra cima captura direto.
    MAX_CAPTURE_VALUE: 255,
    // O bônus de condição na fórmula (multiplica `a`) é de cada condição
    // (`captureBonus`, `core/data/conditions/`).
    // Pelas costas (Legends Arceus): acertar um selvagem que não percebeu o
    // treinador (vagando) vindo de trás multiplica `a` por BACK_STRIKE_BONUS.
    // "De trás" = o ângulo entre a frente dele e a direção de onde a bola
    // veio passa de BACK_STRIKE_ANGLE (graus).
    BACK_STRIKE_BONUS: 2,
    BACK_STRIKE_ANGLE: 110,
    // Fração do XP de derrotar que a captura dá (só pra quem lutou).
    XP_FRACTION: 0.5,
    // Desmaiado que escapa acorda com esta fração (0-1) da vida máxima.
    ESCAPE_WAKE_HP_FRACTION: 0.3,
    // Chance (0-1) de partir pra briga ao escapar, por temperamento; senão
    // foge (some do mapa, a fuga clássica — 063).
    ESCAPE_FIGHT_CHANCE: {
      hostile: 0.8,
      peaceful: 0.25,
    },
  },
  // Grade de navegação usada por `core/pathfinding.js` pra contornar
  // obstáculos e encostas do `TEST_LEVEL` em vez de andar em linha reta —
  // ver `creatureFollowSystem.js`.
  PATHFINDING: {
    // Tamanho (m) de cada célula da grade (uma grade por chunk carregado).
    // A borda dos chunks precisa cair em borda de célula: metade do
    // `TERRAIN.CHUNK_SIZE` tem que ser múltiplo dele.
    CELL_SIZE: 1,
    // Folga (m) em volta da origem e do destino em que o A* procura o
    // caminho — desvio maior que isso não é achado (anda reto e desvia
    // pela física).
    SEARCH_MARGIN: 24,
    // Margem (m) somada ao contorno de cada obstáculo antes de marcar
    // células como não-andáveis — evita a cápsula da criatura raspar
    // quina de obstáculo (a grade só sabe de células inteiras).
    OBSTACLE_MARGIN: 0.4,
    // Segundos entre recálculos de caminho por criatura — recalcular todo
    // tick é desperdício (o treinador não se move tão rápido assim) e
    // deixa a trajetória mais nervosa.
    REPATH_INTERVAL: 0.5,
    // Distância (m) até um waypoint pra considerá-lo alcançado e avançar
    // pro próximo.
    WAYPOINT_ARRIVAL_DISTANCE: 0.5,
    // Diferença de elevação (m) entre células vizinhas acima da qual vira
    // "penhasco" intransponível sem rampa (na diagonal, vezes √2) — ver
    // "Elevação (heightmap)" em core/pathfinding.js. Também é a encosta mais
    // íngreme do relevo que as criaturas tentam subir. Precisa ficar
    // entre o degrau por célula das rampas do nível e o salto de um terraço
    // sem rampa — senão ou bloqueia rampas de verdade, ou deixa passar de um
    // andar pro outro sem rampa nenhuma.
    MAX_CLIMB_STEP: 0.6,
    // Distância máxima (m) de um único salto suavizado do caminho
    // (`boundedSmoothPath` em core/pathfinding.js) — mesmo que um trecho
    // reto inteiro seja andável célula a célula, virar UM waypoint só bem
    // longe (a trilha de teste inteira, por exemplo, cabe numa lane
    // estreita) dá tempo demais pra criatura desviar da lane antes
    // da próxima correção (giro suavizado por `turnSpeed`, física) — ela
    // acaba esbarrando de lado numa rampa (ou passando por baixo dela) em
    // vez de subir. Maior que distâncias comuns em campo aberto (mantém o
    // comportamento de sempre pra esses casos, um waypoint só até o alvo),
    // bem menor que o comprimento de um atalho perigoso atravessando
    // vários terraços/rampas.
    MAX_SHORTCUT_DISTANCE: 8,
    // Distância (m) dos dois raycasts laterais de evasão local — ver
    // `MovementBlocked` em `characterPhysicsSystem.js`/
    // `creatureFollowSystem.js`. Só usado no tick em que a criatura está
    // travada, pra escolher entre desviar à esquerda ou à direita.
    AVOIDANCE_PROBE_DISTANCE: 1.5,
  },
  // `wildWanderSystem.js` — genérico pra qualquer `WildCreature`, não varia
  // por espécie (ver docs/features/020-fox-selvagens-cena-e-texturas.md).
  WILD_WANDER: {
    // Raio (m) em torno do ponto de spawn (`WanderState.homeX/homeZ`) onde
    // um novo destino pode ser sorteado — mantém cada criatura vagando por
    // uma área local, não atravessando o mapa inteiro.
    RADIUS: 12,
    // Segundos parada ao chegar num destino, antes de sortear o próximo
    // (sorteado de novo a cada vez, entre os dois).
    MIN_PAUSE: 3,
    MAX_PAUSE: 8,
    // Distância (m) até o destino atual pra considerá-lo alcançado.
    ARRIVAL_DISTANCE: 0.6,
    // Segundos perseguindo o mesmo destino sem chegar antes de desistir e
    // sortear outro — trava de segurança contra destino praticamente
    // inalcançável (ver docstring de `WanderState.chaseTimer`).
    MAX_CHASE_TIME: 15,
  },
  // Spawn e despawn das selvagens em volta do jogador
  // (docs/features/062-spawn-estilo-cobblemon.md, `core/wildSpawn/`).
  // Distâncias no plano horizontal, do treinador ou da criatura controlada
  // (a mais perto). O raio longe fica dentro do raio de carga dos chunks
  // (`GRAPHICS.VIEW_DISTANCE`): a selvagem some antes do chão dela.
  WILD_SPAWN: {
    // Selvagens vivas, no máximo, até o raio longe de cada jogador.
    // Liga o spawn (o laboratório de biomas desliga para a cena ficar
    // parada, docs/features/066-revisao-dos-biomas.md).
    ENABLED: true,
    MAX_PER_PLAYER: 12,
    // Segundos entre as tentativas de spawn, quantos pontos cada uma tenta
    // e quantas nascem, no máximo, por tentativa — poucas de cada vez: o
    // teto enche aos poucos e as idades ficam espalhadas (sem leva nascendo
    // e sumindo junto).
    INTERVAL: 2,
    ATTEMPTS: 3,
    SPAWNS_PER_INTERVAL: 1,
    // Anel (m) onde nasce: nunca mais perto que o mínimo nem mais longe que
    // o máximo.
    MIN_RADIUS: 30,
    MAX_RADIUS: 70,
    // Fora da vista: fora do cone da câmera (meia-abertura em rad, a partir
    // de para onde ela olha) ou além da distância em que a névoa fecha (a
    // mesma conta da tela, `core/terrain/fogRange.js` — não é número daqui).
    VIEW_HALF_ANGLE: 1.1,
    // Andando, parte das tentativas (chance 0–1) vai para a frente, num
    // leque (meia-abertura em rad) em volta da direção do movimento, logo
    // além da névoa (até `AHEAD_DEPTH` m depois dela): a selvagem aparece
    // saindo da névoa no caminho. Abaixo de `MOVING_SPEED` (m/s), parado.
    AHEAD_CHANCE: 0.6,
    AHEAD_HALF_ANGLE: 0.6,
    AHEAD_DEPTH: 15,
    MOVING_SPEED: 1,
    // Faixas do despawn (m): até o perto, nunca some; além do longe, some;
    // no meio, some quem está velho e fora da vista. O longe fica além da
    // faixa da frente (névoa + `AHEAD_DEPTH`) e dentro do chão carregado:
    // é o da distância de visão padrão (`GRAPHICS.VIEW_DISTANCE`) e acompanha
    // a escolhida no menu, na mesma proporção (`spawnParams`).
    NEAR_RADIUS: 40,
    FAR_RADIUS: 125,
    // Idade (s de jogo) da faixa do meio: antes da mínima, não some; dali a
    // chance cresce a cada verificação até a máxima, quando some na certa.
    // Curta: quem ficou para trás, fora da vista, libera a vaga logo.
    MIN_AGE: 30,
    MAX_AGE: 180,
    // Segundos entre as verificações da faixa do meio.
    DESPAWN_CHECK_INTERVAL: 5,
    // Fora da terra: a inclinação máxima (altura/distância) do ponto e a
    // folga (m) dos sólidos (árvores, pedras, prédios).
    MAX_SLOPE: 0.6,
    SOLID_CLEARANCE: 1.5,
    // Chance de cada faixa de raridade (`spawn.rarity` da espécie) numa
    // tentativa — sorteada antes da espécie, como no Cobblemon. Somam um.
    RARITY_CHANCES: {
      common: 0.85,
      uncommon: 0.13,
      rare: 0.02,
    },
    // Nível pela distância da cidade inicial (`core/wildSpawn/
    // wildLevel.js`, docs/features/069-revisao-do-bioma-cidade.md): na
    // borda dela, `FIRST_CITY`; de lá para fora sobe aos poucos até o teto
    // da versão (`EXPERIENCE.LEVEL_CAP`), que alcança a `CAP_DISTANCE` m
    // da borda e que também limita cada indivíduo. `SPREAD`: a variação de
    // cada indivíduo para cada lado.
    LEVEL: {
      FIRST_CITY: 3,
      CAP_DISTANCE: 1200,
      SPREAD: 2,
    },
    // Quantos spawns e despawns recentes o debug (F2) lista.
    DEBUG_LOG_SIZE: 8,
  },
  // Comportamento das selvagens em relação ao lado do jogador
  // (`wildBehaviorSystem.js`, `WildBehavior`). Distâncias no plano
  // horizontal, entre a selvagem e o alvo dela (treinador ou criatura do
  // time). Valores de partida.
  WILD_BEHAVIOR: {
    // Chance (0-1) de uma selvagem nascer hostil, pra espécie sem
    // `wild.hostileChance` própria.
    DEFAULT_HOSTILE_CHANCE: 0.5,
    // Hostil que te percebeu parte para cima na hora se você chegar a esta
    // distância (m), sem esperar o fim do alerta ("perto demais")...
    AGGRO_RADIUS: 8,
    // ...e só desiste passando dela + esta folga — sem a folga, parado bem
    // na borda ela ficaria alternando entre perseguir e desistir.
    AGGRO_EXIT_MARGIN: 1,
    // Perseguindo, a selvagem para quando o alvo estiver a esta fração do
    // alcance do golpe (range + radius + raio do corpo do alvo) — perto o
    // bastante pra acertar com folga.
    ATTACK_REACH_FRACTION: 0.8,
    // Sem golpe nenhum, para quando sobrar este vão (m) entre os corpos
    // (bordas das cápsulas).
    CHASE_STOP_GAP: 0.8,
    // Segundos entre um pedido de golpe e o próximo, perseguindo.
    ATTACK_INTERVAL: 1.2,
    // Ameaça cai pela metade a cada este tanto (s); entrada abaixo de
    // THREAT_MIN sai da tabela.
    THREAT_HALF_LIFE: 10,
    THREAT_MIN: 0.5,
    // Quem persegue porque APANHOU (pacífica revidando, ou hostil atacada
    // de longe) só desiste além desta distância (m).
    RETALIATE_LEASH_RADIUS: 14,
    // Fuga clássica (docs/features/063-revisao-da-ia-selvagem.md): fugir é
    // sumir do mapa. Chance (0-1) de uma pacífica fugir ao te perceber, pra
    // espécie sem `wild.fleeChance` própria.
    DEFAULT_FLEE_CHANCE: 0.3,
    // Saindo: corre para longe de quem está mais perto por este tempo (s) e
    // some numa nuvem de poeira. Nesse meio-tempo não é alvo nem capturável.
    LEAVE_RUN_TIME: 1.2,
    // Percepção (`core/battle/perception.js`, `wildAwarenessSystem.js`). Vê
    // quem estiver a até VIEW_DISTANCE (m) dentro do cone (VIEW_HALF_ANGLE,
    // rad, para cada lado da frente dela) ou a até NEAR_RADIUS (m) em
    // qualquer direção.
    PERCEPTION: {
      VIEW_DISTANCE: 14,
      VIEW_HALF_ANGLE: 1.0,
      NEAR_RADIUS: 4,
      // Depois de reagir, só percebe de novo quando ninguém do lado do
      // jogador estiver a até esta distância (m).
      FORGET_RADIUS: 18,
      // Tempo (s) parada encarando, com a exclamação, antes de decidir — a
      // hostil adianta se o alvo chegar a `AGGRO_RADIUS`.
      ALERT_TIME: 1.2,
      // Quanto tempo (s) o emote de brava fica depois de partir para cima.
      ANGRY_DURATION: 2,
    },
  },
  // Dificuldade das selvagens na luta (`core/battle/aiTuning.js`,
  // docs/features/063-revisao-da-ia-selvagem.md). `LEVEL` vai de 0 (a ponta
  // `EASY` abaixo) a 1 (a ponta difícil = os valores de hoje, que continuam
  // nos campos de origem); no meio, interpola cada efeito. O time tem a dele
  // (`PARTY_DIFFICULTY`): mexer aqui não muda o time.
  WILD_DIFFICULTY: {
    LEVEL: 0.45,
    // Ponta fácil de cada efeito. A difícil é o campo citado:
    EASY: {
      // ritmo entre um golpe e outro (`WILD_BEHAVIOR.ATTACK_INTERVAL`, s);
      ATTACK_INTERVAL: 2.6,
      // chance de desviar do aviso e tempo até reagir
      // (`AI_MOVEMENT.DODGE_CHANCE`/`DODGE_REACTION_TIME`);
      DODGE_CHANCE: 0.1,
      DODGE_REACTION_TIME: 0.5,
      // erro de mira (rad, para cada lado) sorteado no disparo — na ponta
      // difícil, zero (a IA mira certo);
      AIM_ERROR: 0.35,
      // quão perto da melhor nota um golpe precisa estar para entrar no
      // sorteio (`AI_ATTACK.NEAR_BEST_FRACTION`) — menor, escolhe pior;
      NEAR_BEST_FRACTION: 0.2,
      // dash só faltando mais que isto (m) até o alcance
      // (`AI_MOVEMENT.DASH_CLOSE_DISTANCE`);
      DASH_CLOSE_DISTANCE: 12,
      // velocidade do rodeio (`AI_MOVEMENT.STRAFE_SPEED_FACTOR`);
      STRAFE_SPEED_FACTOR: 0.3,
      // energia em que para para descansar (`AI_ENERGY.REST_ENTER_FRACTION`,
      // sempre abaixo do `REST_EXIT_FRACTION`).
      REST_ENTER_FRACTION: 0.3,
    },
  },
  // Dificuldade do time na luta (docs/features/064-revisao-da-ia-do-
  // parceiro.md, Parte 3): o mesmo mecanismo do `WILD_DIFFICULTY`, com um
  // número só do time. `LEVEL` 1 = a IA de hoje (os campos de origem, com o
  // ritmo do `PARTY_BEHAVIOR.ATTACK_INTERVAL`); 0 = a ponta `EASY` abaixo.
  // Mexer aqui não muda as selvagens.
  PARTY_DIFFICULTY: {
    LEVEL: 0.6,
    // Ponta fácil de cada efeito (os mesmos do `WILD_DIFFICULTY.EASY`):
    EASY: {
      // ritmo entre um golpe e outro (`PARTY_BEHAVIOR.ATTACK_INTERVAL`, s);
      ATTACK_INTERVAL: 2.4,
      DODGE_CHANCE: 0.1,
      DODGE_REACTION_TIME: 0.5,
      AIM_ERROR: 0.35,
      NEAR_BEST_FRACTION: 0.2,
      DASH_CLOSE_DISTANCE: 12,
      STRAFE_SPEED_FACTOR: 0.3,
      REST_ENTER_FRACTION: 0.3,
    },
  },
  // IA das criaturas do time fora do controle do jogador
  // (`partyBehaviorSystem.js`, `PartyBehavior`), pela postura de cada Pokémon
  // (docs/features/064-revisao-da-ia-do-parceiro.md, Parte 2 —
  // `core/party/posture.js`).
  PARTY_BEHAVIOR: {
    // Postura de quem não escolheu outra: o Pokémon novo e o save antigo.
    DEFAULT_POSTURE: 'defensive',
    // Campo de visão da agressiva: a mesma regra das selvagens
    // (`isPerceived`, `WILD_BEHAVIOR.PERCEPTION`), com valores próprios —
    // vê até VIEW_DISTANCE (m) dentro do cone (VIEW_HALF_ANGLE, rad, para
    // cada lado da frente dela) ou até NEAR_RADIUS (m) em qualquer direção.
    PERCEPTION: {
      VIEW_DISTANCE: 14,
      VIEW_HALF_ANGLE: 1.0,
      NEAR_RADIUS: 4,
    },
    // Segundos entre um pedido de golpe e o próximo. Mais lento que o
    // jogador de propósito: a IA ajuda, quem decide a luta é quem joga.
    ATTACK_INTERVAL: 1.5,
    // Para quando o alvo estiver a esta fração do alcance do golpe (mesma
    // regra das selvagens, `WILD_BEHAVIOR`).
    ATTACK_REACH_FRACTION: 0.8,
    // Se afastou mais que isto (m, no plano) de quem segue (quem está no
    // controle), larga a luta e volta a seguir.
    LEASH_RADIUS: 15,
    // Quem fica para trás (docs/features/064-revisao-da-ia-do-parceiro.md,
    // Parte 1 — `followLimitSystem.js`): a criatura do time que segue longe
    // demais ou presa volta sozinha para a bola; com o controle numa
    // criatura, é o treinador quem segue, e a regra recolhe a controlada.
    FOLLOW_LIMIT: {
      // Mais longe que isto (m, no plano) de quem segue → começa a contagem
      // para voltar à bola. Acima do `LEASH_RADIUS` (nunca recolhe numa luta
      // normal). Só conta depois de ela ter chegado perto do grupo uma vez
      // (a recém-invocada pode pousar longe).
      RECALL_DISTANCE: 40,
      // Contando por estar longe, só cancela abaixo do RECALL_DISTANCE menos
      // isto (m) — sem a folga, andar na borda ligava e desligava o aviso.
      CANCEL_MARGIN: 3,
      // Com o controle numa criatura: passou disto (m) do treinador, aviso
      // na tela (sem contagem). Abaixo do `RECALL_DISTANCE`.
      WARN_DISTANCE: 30,
      // O aviso só apaga depois de voltar para menos disto (m). Abaixo do
      // WARN_DISTANCE.
      WARN_RESET_DISTANCE: 25,
      // Tentando seguir (andando ou correndo) sem sair de um círculo deste
      // raio (m) por STUCK_TIME (s) → presa.
      STUCK_RADIUS: 1,
      STUCK_TIME: 5,
      // Contagem (s) na tela antes de puxar para a bola — dá tempo de voltar
      // ou de desprender. Resolvido no meio, cancela.
      WARNING_TIME: 3,
      // O Pokémon TREINANDO num boneco (docs/features/067-campo-de-treino-e-
      // avisos-de-nivel.md) tem um limite maior: o treinador pode explorar em
      // volta. Passou de TRAINING_WARN_DISTANCE (m) de quem ele segue, aviso
      // sem contagem; passou de TRAINING_RECALL_DISTANCE, a contagem — no
      // fim ele volta para a bola e o treino acaba. Com a contagem e o
      // recolher, na velocidade mais rápida do jogo, tem que acabar antes de
      // o campo sair da memória na MENOR distância de visão (teste em
      // followLimitSystem.test.js).
      TRAINING_WARN_DISTANCE: 55,
      TRAINING_RECALL_DISTANCE: 70,
    },
  },
  // Treinador numa luta, fora do controle (`trainerBattleSystem.js`): fica
  // longe, desvia, foge pro time se mirado. A selvagem só mira nele se ele
  // for o único do lado do jogador no raio de perseguição dela
  // (`excludeCoveredTrainer`, core/battle/combatTargets.js).
  TRAINER_BATTLE: {
    // Zona segura (com folga): a pelo menos SAFE_MIN_DISTANCE (m) de toda
    // selvagem na luta e no máximo SAFE_MAX_DISTANCE (m) da criatura
    // controlada — dentro dela, fica parado encarando a luta.
    SAFE_MIN_DISTANCE: 5,
    SAFE_MAX_DISTANCE: 12,
    // Fora da zona: vai pra um ponto a esta distância (m) atrás da criatura
    // controlada, do lado oposto à selvagem mais perto dela — escolhido UMA
    // vez e guardado até chegar (ou ficar fora da zona).
    SAFE_DISTANCE: 7,
    // Chegou na posição segura com esta folga (m): para e encara a luta.
    ARRIVE_DISTANCE: 1,
    // Corre (em vez de andar) se alguma selvagem estiver a esta distância
    // (m) dele.
    DANGER_DISTANCE: 4,
    // Mirado por uma selvagem: corre até ficar a esta distância (m) da
    // criatura do time mais perto.
    TEAM_STOP_DISTANCE: 2,
  },
  // Escolha do ALVO pela IA (os dois lados — `core/battle/combatTargets.js`):
  // alvo quase desmaiando ganha prioridade, pra terminar a luta.
  AI_TARGET: {
    // Vida (fração) em que o alvo passa a ter prioridade...
    FINISH_HP_FRACTION: 0.25,
    // ...e quanto: multiplica a ameaça dele (e divide a distância) na
    // selvagem. A criatura do time, ao trocar de alvo, pega a de menos vida.
    FINISH_BONUS: 2,
  },
  // Grupos de golpe (docs/features/061-revisao-das-skills.md): o `group` de
  // cada golpe dá o alcance (RANGE, m, contado da borda do trigger de quem
  // ataca), a largura (RADIUS, m: a meia-largura da cápsula ou do cone na
  // ponta; no 'self', o tamanho do VFX; no 'circle', o raio do VFX — o tamanho
  // do círculo é o RANGE), a forma (AREA: cápsula sem ela) e o
  // `aim` da IA — fixos por grupo, aplicados em `resolveSkill`
  // (`core/data/skills/index.js`). EXECUTION é o modo de execução padrão
  // (o golpe ou a espécie trocam).
  ATTACK_GROUPS: {
    melee: {
      RANGE: 1.4,
      RADIUS: 0.5,
      AREA: null,
      AIM: 'melee',
      EXECUTION: 'instant',
    },
    ranged: {
      RANGE: 6,
      RADIUS: 0.35,
      AREA: null,
      AIM: 'ranged',
      EXECUTION: 'instant',
    },
    cone: {
      RANGE: 3,
      RADIUS: 3.5,
      AREA: 'cone',
      AIM: 'ranged',
      EXECUTION: 'instant',
    },
    // Área em volta de quem usa: todos dentro do círculo (centro no corpo,
    // raio = a borda do trigger + RANGE).
    circle: {
      RANGE: 1,
      RADIUS: 0.5,
      AREA: 'circle',
      AIM: 'ranged',
      EXECUTION: 'instant',
    },
    self: {
      RANGE: 0,
      RADIUS: 0.5,
      AREA: 'self',
      AIM: 'ranged',
      EXECUTION: 'charge',
    },
  },
  // Custo de energia e recarga das ações das CRIATURAS, por fórmula
  // (`core/battle/actionCost.js`, docs/features/035-balanceamento-
  // de-acoes-e-correcoes.md) — adaptada da fórmula de dano. `staminaCost`/`cooldown`
  // escritos na skill (ou no override da espécie) valem por cima.
  ACTION_COST: {
    // custo = (2·nível/5 + 2) × peso / COST_DIVISOR — o fator de nível do
    // dano. Maior = tudo mais barato (mais habilidades por barra).
    COST_DIVISOR: 50,
    // recarga = peso × COOLDOWN_PER_WEIGHT (s) × fator de velocidade.
    COOLDOWN_PER_WEIGHT: 0.085,
    // Peso × RANGED_BONUS quando o golpe alcança RANGED_MIN_RANGE (m) ou
    // mais — bater de longe é mais seguro...
    RANGED_MIN_RANGE: 5,
    RANGED_BONUS: 1.25,
    // ...e × CONE_BONUS em área, cone ou círculo (pode pegar mais de um
    // inimigo).
    CONE_BONUS: 1.3,
    // Peso do movimento das criaturas, na mesma conta (`resolveLevelCost`):
    // corrida POR SEGUNDO, dash e pulo.
    RUN_WEIGHT_PER_SECOND: 4,
    DASH_WEIGHT: 15,
    JUMP_WEIGHT: 5,
    // Voo livre (`core/systems/flightSystem.js`), POR SEGUNDO: pairando ou
    // devagar, e rápido (Shift).
    FLY_WEIGHT_PER_SECOND: 2,
    FLY_FAST_WEIGHT_PER_SECOND: 6,
  },
  // Escolha do golpe pela IA (selvagens e time fora do controle —
  // `core/battle/aiAttackChoice.js`): cada golpe pronto ganha uma nota pelos
  // campos da definição (poder, área, efeitos), nunca pelo id da skill.
  AI_ATTACK: {
    // Golpe que já alcança o alvo agora vale este tanto a mais (prefere
    // lançar já a correr até o alcance de outro).
    IN_REACH_BONUS: 1.25,
    // Sorteio entre os golpes com nota de pelo menos esta fração da melhor,
    // com chance proporcional à nota — não fica previsível.
    NEAR_BEST_FRACTION: 0.6,
    // Valor de UM estágio de status (baixar o do inimigo, subir o próprio),
    // na mesma escala do `damage.power`.
    STAT_STAGE_VALUE: 25,
    // Cada estágio já acumulado no sentido do efeito multiplica o valor por
    // isto: acumula, mas bater passa a valer mais.
    STAT_STAGE_DECAY: 2 / 3,
    // O valor de aplicar uma condição é dela (`ai.value`,
    // `core/data/conditions/`).
    // Efeito ativo com até estes segundos sobrando volta a valer cheio
    // (renovar antes de acabar).
    EFFECT_REFRESH_TIME: 3,
    // Golpe em si mesmo (`area: 'self'`, ex.: Growth) só com nenhum inimigo
    // a esta distância (m) — a carga é interrompida por dano.
    SELF_CAST_SAFE_DISTANCE: 4,
  },
  // Energia da IA na luta (`core/battle/aiEnergy.js`) — todo gasto reinicia o
  // atraso da regeneração, então gastar sempre um pouco nunca deixa regenerar.
  AI_ENERGY: {
    // Habilidade (golpe mais caro que o mais barato pronto) só se sobrar
    // esta fração (0-1) da energia máxima depois de pagar.
    SKILL_RESERVE_FRACTION: 0.25,
    // Com a energia nesta fração ou menos, descansa: sem golpe e sem correr...
    REST_ENTER_FRACTION: 0.15,
    // ...até voltar a esta fração.
    REST_EXIT_FRACTION: 0.6,
  },
  // Movimento da IA na luta (`core/battle/aiMovement.js`): desvio, recuo,
  // rodear o alvo, dash e o feixe seguindo o alvo.
  AI_MOVEMENT: {
    // Chance (0-1) de reagir a um golpe vindo nela — sorteada UMA vez por
    // golpe.
    DODGE_CHANCE: 0.5,
    // Só reage depois de o golpe estar carregando há isto (s) — golpe rápido
    // demais pega.
    DODGE_REACTION_TIME: 0.2,
    // Golpe planejado à distância (`aim: 'ranged'`): recua se o alvo estiver
    // mais perto que esta fração do alcance dele...
    KEEP_DISTANCE_MIN: 0.5,
    // ...andando pra um ponto este tanto (m) pra trás (recalculado sempre).
    RETREAT_STEP: 3,
    // Rodeando o alvo: velocidade como fração do `walkSpeed` (andando — não
    // gasta energia)...
    STRAFE_SPEED_FACTOR: 0.6,
    // ...a esta fração da distância de parada (dentro do alcance)...
    STRAFE_DISTANCE_FRACTION: 0.9,
    // ...trocando de sentido a cada intervalo sorteado entre estes (s).
    STRAFE_SWITCH_MIN: 1.5,
    STRAFE_SWITCH_MAX: 3.5,
    // Rodeando, ela anda virada pra onde vai; com o golpe pronto, para e vira
    // pro alvo, e só pede o golpe com o corpo a até este ângulo (rad)
    // dele — o disparo trava o corpo de uma vez, vindo de lado seria um estalo.
    AIM_TOLERANCE: 0.35,
    // (O dash da IA usa `PLAYER_ACTIONS.dash` — mesma velocidade, duração e
    // recarga do jogador, `DashCooldown`; custo da entidade, 035.)
    // Aproximando: dá dash se ainda faltar mais que isto (m) até o alcance.
    DASH_CLOSE_DISTANCE: 5,
    // Feixe da IA (canalizado na cápsula, `isBeamAttack`): quanto (rad/s) ele gira no
    // máximo pra seguir o alvo — dá pra escapar correndo de lado.
    BEAM_TURN_SPEED: 1.5,
  },
  // Desmaio (`faintSystem.js`, `Fainted`): criatura (selvagem ou do time)
  // que chega a 0 de HP.
  FAINT: {
    // Minutos desmaiada (intangível, sem regenerar) até acordar. Vale pra
    // selvagem e pra do time (que conta mesmo depois de recolhida).
    DURATION_MINUTES: 15,
    // Fração (0-1) do HP máximo com que acorda.
    REVIVE_HP_FRACTION: 0.15,
    // Segundos desmaiada no chão antes do treinador recolher a do time.
    PARTY_RECALL_DELAY: 2,
  },

  // Salvar o jogo (docs/features/044-salvar-o-jogo.md): `autosaveSystem.js`
  // pede, `platform/persistence/autosave.js` grava (só se mudou).
  SAVE: {
    // Segundos entre um pedido de save automático e o próximo.
    AUTOSAVE_INTERVAL: 30,
    // Até onde (m) procurar um lugar livre quando a posição salva caiu
    // dentro de um prédio que agora existe ali (core/save/trainerSave.js).
    FREE_SPOT_REACH: 40,
  },

  // Tela de "Carregando…" (docs/features/044-salvar-o-jogo.md):
  // `view/preload/preloadGameAssets.js`.
  LOADING: {
    // Segundos no máximo esperando os sprites (inventário, Pokédex, golpes);
    // passou disso, entra assim mesmo e o resto carrega no jogo.
    SPRITE_TIMEOUT: 8,
    // Segundos de cada fundo antes de trocar pro próximo (espera longa).
    WALLPAPER_INTERVAL: 6,
  },

  // Experiência e nível (docs/features/037-experiencia-e-nivel.md):
  // `core/data/species/experience.js` e `core/actions/experience.js`.
  EXPERIENCE: {
    // Teto oficial de nível — a escala do jogo: a curva de XP vai até ele e
    // as fórmulas e learnsets são pensados para ele.
    MAX_LEVEL: 50,
    // Teto desta versão (a beta): ninguém passa dele — o XP para no total
    // dele, nenhum Pokémon nasce acima e as selvagens também ficam abaixo
    // (docs/features/062-spawn-estilo-cobblemon.md). Nunca acima do
    // `MAX_LEVEL`; sobe a cada beta até chegar nele.
    LEVEL_CAP: 12,
    // Multiplica o XP total de todo degrau de todas as curvas de nível — o
    // "preço" dos níveis, valendo pra qualquer fonte de XP (batalha, item).
    // Pra mudar o ritmo de tudo, mexe aqui; o ganho de batalha é ajustado
    // por `BASE_DIVISOR`.
    CURVE_MULTIPLIER: 10,
    // Fórmula escalada (Gen 5): `(baseXp × Nd ÷ BASE_DIVISOR) ×
    // ((2·Nd + 10) ÷ (Nd + Nv + 10))^SCALING_EXPONENT + 1`.
    BASE_DIVISOR: 5,
    SCALING_EXPONENT: 2.5,
    // XP base de uma espécie sem `baseXp` configurado.
    FALLBACK_BASE_XP: 50,
    // Grupo de crescimento de uma espécie sem `growthRate`.
    DEFAULT_GROWTH_RATE: 'medium-slow',
    // XP dado pelo botão "+XP" do `DebugPanel`.
    DEBUG_XP_AMOUNT: 100,
    // Comemoração ao subir de nível (docs/features/067-campo-de-treino-e-
    // avisos-de-nivel.md): quanto tempo (s) a criatura em campo espera ficar
    // livre (ex.: terminar o golpe do nocaute) pra tocar a animação happy;
    // passado isso, desiste.
    CELEBRATION_WAIT: 3,
  },

  // Golpes aprendidos, treino e domínio
  // (docs/features/038-aprendizado-treino-e-dominio-de-golpes.md).
  MOVES: {
    MASTERY: {
      // Domínio com que um golpe recém-aprendido entra no slot (0–1).
      INITIAL: 0.15,
      // Fator de precisão/chance de sair no domínio zero; sobe em linha
      // até 1 (precisão clássica) no domínio máximo.
      MIN_ACCURACY_FACTOR: 0.5,
      // Multiplicadores de energia e de recarga no domínio zero; descem em
      // linha até 1 no domínio máximo.
      MAX_COST_FACTOR: 1.6,
      MAX_COOLDOWN_FACTOR: 1.6,
      // Domínio ganho por uso em combate (errando); acertar soma o bônus.
      GAIN_PER_USE: 0.03,
      HIT_GAIN_BONUS: 0.02,
      // Retorno decrescente: o ganho é multiplicado pelo que falta até o
      // máximo, mas nunca por menos que esta fração (pra chegar no teto).
      MIN_GAIN_FRACTION: 0.25,
      // Raio em que uma selvagem em combate faz o uso do golpe contar como
      // "em combate" (usar no vazio não sobe domínio).
      OPPONENT_RADIUS: 15,
    },
    TRAINING: {
      // Distância máxima (m) entre o TREINADOR e a borda de um boneco de
      // treino pra poder começar o treino (docs/features/067-campo-de-
      // treino-e-avisos-de-nivel.md) — o Pokémon vem de onde estiver.
      START_RADIUS: 6,
      // O lugar do treino: na frente do boneco (do lado da entrada do
      // campo), a SPOT_GAP m entre a borda do boneco e a do corpo do
      // Pokémon. Chegou quando está a SPOT_ARRIVAL m do ponto; empurrado
      // além de SPOT_LEAVE m, volta andando. Mais longe que RUN_DISTANCE m,
      // vem correndo.
      SPOT_GAP: 0.8,
      SPOT_ARRIVAL: 0.3,
      SPOT_LEAVE: 0.9,
      RUN_DISTANCE: 6,
      // Quanto tempo (s) o treino pedido espera o Pokémon sair da bola
      // (o treinador ocupado, a bola em voo); passado isso, desiste.
      PENDING_TIMEOUT: 8,
      // Tocar o atalho de quem está treinando só avisa; um segundo toque
      // nesta janela (s) recolhe e acaba o treino.
      RECALL_CONFIRM_TIME: 4,
      // TEMPO de treino (horas) pra APRENDER um golpe: proporcional ao peso
      // do golpe (o mesmo da conta de energia, `resolveAttackWeight`) —
      // LEARN_HOURS_PER_100_WEIGHT é o tempo de um golpe de peso 100; nunca
      // menos que MIN_LEARN_HOURS. Golpe com `trainingHours` escrito foge da
      // fórmula. Conta só o tempo treinando no objeto (repetindo, esperando
      // recarga ou descansando), não o de ir até ele.
      LEARN_HOURS_PER_100_WEIGHT: 20,
      MIN_LEARN_HOURS: 1,
      // Tempo de treino pra DOMINAR (de zero ao máximo de domínio), em
      // múltiplos do tempo de aprender o mesmo golpe.
      MASTERY_HOURS_MULTIPLIER: 10,
      // Acelera o relógio do treino (testes em jogo); 1 = tempo real.
      TIME_MULTIPLIER: 1,
      // Pausa entre uma repetição e a próxima (segundos).
      REPETITION_INTERVAL: 0.6,
      // Sem energia pra repetir, descansa até recuperar esta fração da
      // energia máxima.
      REST_STAMINA_FRACTION: 0.6,
      // Fração do treino que sobra de um golpe esquecido (re-treinar é mais
      // rápido).
      FORGET_RETAINED: 0.5,
      // Progresso dado pelo botão de debug.
      DEBUG_PROGRESS: 0.5,
    },
    // Segurar Q/E/R no modo treinador por este tempo (segundos) abre o menu
    // de ações daquele Pokémon; soltar antes é um toque (invoca/recolhe).
    ACTION_MENU_HOLD_TIME: 0.5,
    // Domínio dado pelo botão de debug.
    DEBUG_MASTERY: 0.2,
  },

  ANIMATION: {
    // Abaixo disso, considera parado (idle).
    WALK_MIN_SPEED: 0.3,
    // Duração do crossfade (segundos) ao trocar de AnimationState — evita o
    // corte seco entre idle/walk/run (ou qualquer outro clipe futuro).
    BLEND_DURATION: 0.2,
  },
  // Voo livre de quem tem `species.flight` (docs/features/060-ajustes-por-
  // especie.md, Parte 2; `core/systems/flightSystem.js`). O gasto de stamina
  // fica em `ACTION_COST` (pelo nível, como a corrida).
  FLIGHT: {
    // Teto (m acima do chão logo abaixo) com a stamina cheia; o teto de
    // verdade é a fração de stamina × este valor.
    MAX_HEIGHT: 30,
    // Fração da stamina máxima que precisa ter pra decolar.
    MIN_TAKEOFF_STAMINA: 0.25,
    // Decolagem: sobe nesta velocidade (m/s) por este tempo (s), e só
    // depois pode pousar encostando no chão.
    TAKEOFF_SPEED: 3,
    TAKEOFF_DURATION: 0.4,
    // Descida (m/s) do pouso pedido (`V` no ar, ou o controle devolvido).
    LANDING_SPEED: 3,
    // Teto macio (a stamina caindo): a velocidade vertical máxima é a
    // distância até o teto × CEILING_RESPONSE (por segundo) — maior = mais
    // seco —, descendo no máximo em CEILING_DESCENT_SPEED (m/s). Sem stamina,
    // desce pelo menos em TOUCHDOWN_SPEED (m/s) até tocar o chão.
    CEILING_DESCENT_SPEED: 1.5,
    CEILING_RESPONSE: 1.5,
    TOUCHDOWN_SPEED: 0.6,
    // A inclinação da câmera também sobe/desce o voo (W pra onde ela olha)?
    // Desligado, a câmera só dá a direção no plano e a altura é só no
    // Espaço/C.
    CAMERA_PITCH_CONTROL: false,
    // Pitch da câmera (rad, mesma convenção do `CAMERA.MIN_PITCH`) que conta
    // como voo reto quando a câmera controla a altura; acima dele desce,
    // abaixo sobe.
    NEUTRAL_PITCH: 0.35,
    // Embalo (por segundo, maior = mais seco): com que rapidez a velocidade
    // chega na pedida com tecla (ACCELERATION) e para sem tecla (BRAKE).
    ACCELERATION: 4,
    BRAKE: 2,
    // Inclinação do corpo no voo, só no modelo (`view/systems/
    // flightTiltSystem.js`): deita pro lado da curva (ROLL_PER_TURN rad de
    // roll por rad/s de giro, até MAX_ROLL) e levanta/abaixa o bico na
    // subida/descida (o ângulo da subida × PITCH_FACTOR, até MAX_PITCH,
    // pesando pela fração da velocidade de voo que vai no plano). SMOOTHING:
    // rapidez (por segundo) com que a inclinação acompanha.
    TILT: {
      MAX_ROLL: 0.6,
      ROLL_PER_TURN: 0.25,
      MAX_PITCH: 0.5,
      PITCH_FACTOR: 0.8,
      SMOOTHING: 6,
    },
  },
  // Luz de fogo presa num osso (`species.vfx.fireLight`, ex.: a ponta da
  // cauda do Charmander — `view/systems/fireLightSystem.js`). Valores padrão
  // de quem não declara o campo na espécie.
  FIRE_LIGHT: {
    COLOR: '#ff8a3d',
    // Brilho base, antes do tremor.
    INTENSITY: 2,
    // Alcance (metros) e queda com a distância da `THREE.PointLight`.
    DISTANCE: 3,
    DECAY: 2,
    // Tremor: oscilação senoidal (frequência e amplitude, fração do brilho
    // base) e um ruído aleatório por cima.
    FLICKER_SPEED: 18,
    FLICKER_AMOUNT: 0.15,
    FLICKER_NOISE: 0.1,
    // Fração do brilho que sobra com a criatura desmaiada (a chama fica
    // fraca, não apaga).
    FAINTED_INTENSITY: 0.3,
    // Segundos pra enfraquecer ao desmaiar e voltar ao acordar.
    FAINT_FADE_DURATION: 0.4,
  },
  PHYSICS: {
    // Aceleração da gravidade (m/s²). Mais forte que 9.81 dá um "peso" de jogo.
    GRAVITY: -30,
    // Parâmetros do algoritmo do character controller — compartilhados por
    // todo mundo (existe um único KinematicCharacterController do Rapier no
    // world inteiro, ver physicsWorld.js). Tamanho de cápsula e velocidades
    // (andar/correr/girar/pular) NÃO ficam aqui — são por espécie, ver
    // `core/data/species/<id>/index.js` (`body`/`movement`), copiados nos
    // traits CharacterController/MovementStats no spawn.
    CHARACTER: {
      // "Casca" do character controller (folga de colisão).
      CONTROLLER_OFFSET: 0.03,
      // Inclinação máxima que sobe / mínima em que escorrega (radianos). Com
      // as duas iguais, quem consegue subir a rampa também não escorrega nela
      // (docs/features/060-ajustes-por-especie.md, Parte 4).
      MAX_SLOPE_CLIMB: 0.9,
      MIN_SLOPE_SLIDE: 0.9,
      // Auto-degrau: altura e largura mínima do degrau transposto sozinho.
      AUTOSTEP_HEIGHT: 0.4,
      AUTOSTEP_MIN_WIDTH: 0.15,
      // Distância de "colar no chão" ao descer.
      SNAP_TO_GROUND: 0.4,
      // Velocidade vertical mantida enquanto no chão — epsilon técnico do
      // algoritmo, não atributo de criatura. Abaixo de zero, o controller
      // transforma o empurrão em deslize encosta abaixo a cada passo (o snap
      // do controller já cola no chão sem ele; 060, Parte 4).
      GROUNDED_STICK: 0,
      // Sinal de "tem algo sólido na frente que não era esperado" — ver
      // trait `MovementBlocked`. Só entra na conta quando o deslocamento
      // PEDIDO neste tick (Velocity * delta, no plano XZ) já passa dessa
      // distância mínima (m) — evita marcar bloqueado por causa de ruído
      // quando a entidade já está quase parada (pedido ~0, qualquer
      // razão real/pedido vira instável).
      MIN_BLOCKED_CHECK_DISTANCE: 0.01,
      // Razão (deslocamento real / pedido, no plano XZ) abaixo da qual
      // marca `MovementBlocked`. Baixo de propósito — deslizar ao longo
      // de uma parede em ângulo (o KCC já faz isso, mantém progresso) não
      // deve contar como bloqueado, só um estancamento quase total.
      BLOCKED_MOVEMENT_RATIO: 0.15,
    },
  },
  CAMERA: {
    // Órbita inicial em torno do alvo.
    INITIAL_YAW: 0,
    INITIAL_PITCH: 0.35,
    INITIAL_DISTANCE: 12,
    // Limite do ângulo vertical (pitch), em radianos. O horizontal (yaw) é
    // livre. `pitch` positivo põe a câmera ACIMA do alvo olhando pra baixo
    // (MAX_PITCH perto de π/2 = quase de cima); `pitch` 0 é olhar reto,
    // no nível do alvo. Pra olhar pra CIMA (céu, algo alto à frente), a
    // câmera precisa descer ABAIXO do alvo e inclinar — isso é `pitch`
    // NEGATIVO, não perto de zero (um MIN_PITCH só um pouco acima de 0
    // nunca deixa passar do "olhar reto", por menor que seja — foi o que
    // limitava antes).
    MIN_PITCH: -0.5,
    MAX_PITCH: 1.35,
    // Limites do zoom, em unidades.
    MIN_DISTANCE: 2.5,
    MAX_DISTANCE: 25,
    // Radianos por pixel de movimento do mouse (pointer lock).
    MOUSE_SENSITIVITY: 0.0025,
    // Unidades de distância por "notch" de scroll.
    ZOOM_SPEED: 1.5,
    // Fator de suavização do acompanhamento (maior = mais rígido).
    SMOOTHING: 12,
    // Altura do ponto de mira acima da origem do alvo.
    TARGET_HEIGHT: 1.5,
    // Deslocamento lateral (m) do ponto que a câmera mira, em relação ao
    // alvo — usado tanto na resolução do ponto de mira (`computeAimRay`,
    // arremesso/esfera de invocar) quanto no enquadramento renderizado de
    // fato (`cameraFollowSystem.js`, sempre ativo): o retículo (fixo no
    // centro da tela) não se move, mas o personagem sai do centro, dando
    // o enquadramento "sobre o ombro" de verdade. 0 desativa o efeito por
    // completo (personagem sempre centralizado).
    SHOULDER_OFFSET: 0.4,
    // Colisão da câmera orbital (docs/backlog.md → "Câmera orbital com
    // colisão"): raycast do alvo até a posição desejada da câmera; batendo
    // no CHÃO (relevo, montanhas incluídas — o resto fica translúcido,
    // `SEE_THROUGH`) antes de `orbit.distance`, a câmera aproxima pra logo
    // antes do ponto de impacto em vez de atravessar. COLLISION_MARGIN é a folga
    // (m) mantida antes da superfície (senão a câmera encostaria bem em
    // cima dela). MIN_DISTANCE_AFTER_COLLISION é o piso de quão perto do
    // alvo a colisão pode empurrar a câmera — independente de MIN_DISTANCE
    // (que só limita o zoom manual), porque encurralado num canto a câmera
    // precisa poder chegar bem mais perto do que o zoom mínimo normal.
    COLLISION_MARGIN: 0.3,
    MIN_DISTANCE_AFTER_COLLISION: 0.5,
    // Só o chão aproxima a câmera; o resto entre ela e o alvo (árvores,
    // pedras, plantas, caixas) fica translúcido (`view/materials/
    // seeThrough.js`): some em pontilhado dentro de um cilindro em volta
    // da linha câmera → alvo.
    // - RADIUS: raio (m) do cilindro; EDGE: largura (m) da borda suave.
    // - OPACITY: quanto fica visível dentro dele (0 some, 1 não muda).
    // - TARGET_GAP: perto do alvo (m) o efeito vai apagando — o que está
    //   encostado nele, do lado, não some.
    // O que some com a câmera dentro (docs/features/066-revisao-dos-
    // biomas.md, view/vegetation/toonMaterial.js): a copa de uma árvore (só
    // as folhas — a tela coberta de folha era o quadro mais caro do jogo)
    // e as pedras e os prédios da cidade (o modelo inteiro). Some quando a
    // câmera chega a HIDE (m) da caixa do que some (negativo: só depois de
    // entrar nela) e vai sumindo em pontilhado ao longo dos FADE (m)
    // antes disso. A sombra fica. CANOPY: copas; SOLID: pedras e prédios.
    NEAR_HIDE: {
      ENABLED: true,
      CANOPY: { HIDE: 0.5, FADE: 1 },
      SOLID: { HIDE: 0.3, FADE: 0.5 },
    },
    SEE_THROUGH: {
      ENABLED: false,
      RADIUS: 1.2,
      EDGE: 0.6,
      OPACITY: 0.5,
      TARGET_GAP: 0.4,
    },
    // Câmera do modo Scan (item categoria `scanner`, botão direito
    // SEGURADO — ver `view/systems/cameraFollowSystem.js`,
    // `core/systems/scannerModeSystem.js`, docs/features/033-*.md) —
    // seção própria, separada da câmera orbital de terceira pessoa
    // acima (nada aqui afeta o comportamento fora do modo Scan). Sem
    // zoom (removido — o usuário testou e não gostou do comportamento,
    // pediu de volta só o essencial): dois parâmetros, um offset fixo
    // e os limites de pitch.
    SCAN: {
      // Deslocamento FIXO da câmera pra FRENTE (na direção que ela
      // olha, `computeOrbitForward`) — único posicionamento que este
      // modo tem. Pedido do usuário: "o problema atual é que, quando o
      // personagem se movimenta... partes da própria malha acabam
      // aparecendo/vazando na câmera... uma solução simples é
      // posicionar a câmera um pouco à frente da posição atual dela...
      // não quero uma solução baseada em esconder partes do model, a
      // ideia é resolver isso pelo posicionamento da câmera". `0` =
      // sem deslocamento (câmera na posição "olho" pura — bem
      // provável que veja o próprio pescoço/cabelo do model);
      // positivo empurra pra frente do modelo. Valor de partida — sem
      // navegador neste sandbox, ajustar ao vivo (menu de pausa →
      // Configurações) até nenhuma parte do model aparecer, inclusive
      // nos extremos de PITCH_MIN/PITCH_MAX abaixo.
      CAMERA_OFFSET_FORWARD: 1.2,
      // Limites do pitch (ângulo vertical) só neste modo — independente
      // de MIN_PITCH/MAX_PITCH acima (terceira pessoa continua com o
      // range de sempre). Mesma convenção de sinal de MIN_PITCH/
      // MAX_PITCH (ver comentário acima).
      PITCH_MIN: -0.5,
      PITCH_MAX: 1,
    },
  },
  // Sem seção AUDIO aqui de propósito — volume/alcance/intervalo de som
  // (passo, voz, ambiente, música) moram todos junto do PRÓPRIO som que
  // descrevem (core/data/audio/: footstepGroups.js, voiceSound.js,
  // ambientBeds.js, musicTracks.js...) — nenhum é um número genérico igual
  // pra tudo, então nenhum fica aqui. Ver docs/features/019-som-ambiente-
  // e-passos.md e docs/features/065-sons-do-mundo.md.
  // Névoa que esconde a borda do mundo carregado — o chunk nascendo ou
  // sumindo (docs/features/046-sistema-de-chunks.md). A distância sai do
  // raio de carregar e do lado do chunk (`view/terrain/fogRange.js`).
  // A cor da névoa é a do horizonte da hora (`DAY_CYCLE.KEYFRAMES`), pra o
  // relevo enevoado não aparecer recortado contra o céu.
  // Serras do fundo (view/scene/BackdropView.jsx, backdropGeometry.js,
  // docs/features/058-ajuste-dos-biomas.md): na névoa fechada, silhuetas
  // de montanha em volta da câmera, como parte do céu, na cor da névoa —
  // o mundo não acaba num limbo. Lido ao abrir o jogo.
  BACKDROP: {
    ENABLED: true,
    // Raio (m) das faixas em volta da câmera (dentro do alcance dela) e
    // quantas colunas cada uma tem.
    RADIUS: 800,
    SEGMENTS: 512,
    // Da mais longe à mais perto. Cada uma: a altura da crista em graus
    // acima do horizonte (`minAngle` a `maxAngle`), quanto a base desce
    // abaixo dele (`belowAngle`: o bastante para não sobrar céu entre a
    // serra e o chão enevoado), quantas serras em volta (`frequency`), o
    // detalhe (`octaves`), crista pontuda (`ridged`, 0 a 1), quanto
    // escurece a cor da névoa (`shade`: 1 = igual a ela), o tom da serra
    // (`tint`, puxado com a força `tintAmount` — mais azulado ao longe) e
    // até que altura ela sai da névoa (`mist`, fração da crista mais alta:
    // do horizonte até lá, vai da cor da névoa à da serra).
    LAYERS: [
      {
        minAngle: 1.5,
        maxAngle: 7,
        belowAngle: 25,
        frequency: 1.4,
        octaves: 4,
        ridged: 0.7,
        shade: 0.78,
        tint: '#8ea7c7',
        tintAmount: 0.4,
        mist: 0.7,
      },
      {
        minAngle: 0.5,
        maxAngle: 4,
        belowAngle: 25,
        frequency: 2.2,
        octaves: 4,
        ridged: 0.4,
        shade: 0.62,
        tint: '#6f8f8a',
        tintAmount: 0.4,
        mist: 0.8,
      },
    ],
  },
  // Névoa (view/scene/FogView.jsx, docs/features/058-ajuste-dos-
  // biomas.md): fecha na borda do mundo carregado e, até onde começa, tudo
  // aparece inteiro (vegetação, cidades, sombras, grama, itens); dentro
  // dela some. Atrás dela, as serras do fundo (`BACKDROP`), na cor dela.
  FOG: {
    // Onde a névoa começa, como fração da distância em que ela fecha.
    START_FRACTION: 0.55,
    // Menor distância (m) em que ela fecha, mesmo com raio e chunk pequenos.
    MIN_DISTANCE: 24,
  },
  // Dia e noite (docs/features/048-dia-noite-e-clima.md, core/time/
  // dayCycle.js). O horário é medido em dias de jogo: 0 a 1 é um dia, e a
  // parte inteira conta quantos dias já passaram.
  DAY_CYCLE: {
    // Segundos de jogo (aberto e sem pausa) que dura um dia inteiro.
    DAY_LENGTH: 3600,
    // Horário (fração do dia) de quem entra sem horário salvo.
    START_TIME: 0.3,
    // Hora (0–24) em que começa cada fase do dia — o spawn usa a fase.
    PHASES: { dawn: 5, day: 7.5, dusk: 17, night: 19.5 },
    // Hora em que o sol nasce e se põe; a lua faz o caminho oposto.
    SUNRISE: 6,
    SUNSET: 18,
    // Inclinação (rad) do caminho do sol em relação ao alto do céu — o sol
    // passa de lado, e a sombra nunca fica bem debaixo de ninguém.
    SUN_TILT: 0.5,
    // Altura do sol (ou da lua) acima do horizonte, de 0 a 1, em que a luz
    // direta chega ao máximo — perto do horizonte ela some, e a troca de
    // sol para lua não dá salto na sombra.
    LIGHT_FADE_HEIGHT: 0.15,
    // Cores e intensidades em horas marcadas do dia; entre uma e outra o
    // jogo mistura aos poucos (e da última volta para a primeira, virando a
    // meia-noite). `light`: sol de dia, lua à noite. `ambient`: a luz de
    // todo lado. `skyTop`/`horizon`: o céu (a névoa usa o horizonte).
    // `stars`: quanto aparecem as estrelas (0 a 1).
    KEYFRAMES: [
      {
        hour: 0,
        light: '#8fa6d9',
        lightIntensity: 0.35,
        ambient: '#5a6c9e',
        ambientIntensity: 0.32,
        skyTop: '#0a1430',
        horizon: '#1d2b4d',
        stars: 1,
      },
      {
        hour: 4.5,
        light: '#8fa6d9',
        lightIntensity: 0.35,
        ambient: '#5a6c9e',
        ambientIntensity: 0.32,
        skyTop: '#0a1430',
        horizon: '#1d2b4d',
        stars: 1,
      },
      {
        hour: 6,
        light: '#ffb27a',
        lightIntensity: 0.6,
        ambient: '#c9a7a0',
        ambientIntensity: 0.45,
        skyTop: '#3d5a8a',
        horizon: '#f2a477',
        stars: 0.2,
      },
      {
        hour: 8,
        light: '#ffffff',
        lightIntensity: 1.2,
        ambient: '#ffffff',
        ambientIntensity: 0.6,
        skyTop: '#5d9ad8',
        horizon: '#cfe0ee',
        stars: 0,
      },
      {
        hour: 16.5,
        light: '#ffffff',
        lightIntensity: 1.2,
        ambient: '#ffffff',
        ambientIntensity: 0.6,
        skyTop: '#5d9ad8',
        horizon: '#cfe0ee',
        stars: 0,
      },
      {
        hour: 18,
        light: '#ff9a5c',
        lightIntensity: 0.6,
        ambient: '#c08e8a',
        ambientIntensity: 0.45,
        skyTop: '#3a4f85',
        horizon: '#f08a5d',
        stars: 0.2,
      },
      {
        hour: 19.5,
        light: '#8fa6d9',
        lightIntensity: 0.35,
        ambient: '#5a6c9e',
        ambientIntensity: 0.32,
        skyTop: '#0a1430',
        horizon: '#1d2b4d',
        stars: 1,
      },
    ],
    // Céu (view/scene/SkyView.jsx): tamanho do disco do sol e da lua (rad).
    SUN_SIZE: 0.045,
    MOON_SIZE: 0.035,
    SUN_COLOR: '#fff3c4',
    MOON_COLOR: '#e8eefc',
    // Sombra do sol e da lua (view/scene/DayNightView.jsx): distância (m)
    // da luz até o centro da área com sombra. O tamanho da área, o mapa e o
    // resto são do nível escolhido no menu (`GRAPHICS.SHADOW`).
    SHADOW_DISTANCE: 80,
    // Ajuste por cima das horas marcadas (docs/features/066-revisao-dos-
    // biomas.md, laboratório de biomas): multiplica a força da luz direta
    // (`SUN`), da luz ambiente (`AMBIENT`) e o escuro da sombra (`SHADOW`,
    // 0 = sem sombra). 1 = como as horas marcadas.
    ADJUST: { SUN: 1, AMBIENT: 1, SHADOW: 1 },
  },
  // Nuvens no céu (view/scene/DayNightView.jsx, docs/features/048-dia-
  // noite-e-clima.md): desenhadas no próprio céu, sem objeto 3D. A cor vem
  // da luz da hora; com chuva, tempestade ou neve, o céu fecha.
  CLOUDS: {
    // Fração do céu coberta num dia limpo (0 a 1)...
    COVER: 0.4,
    // ...e com o céu todo fechado (`WEATHER.OVERCAST` cheio).
    OVERCAST_COVER: 0.95,
    // Tamanho das nuvens: maior = nuvens maiores e mais espaçadas.
    SIZE: 1,
    // Quanto a borda de uma nuvem esfuma (0 a 1).
    SOFTNESS: 0.25,
    // Opacidade máxima (0 a 1).
    OPACITY: 0.9,
    // Velocidade com que andam pelo céu e direção (rad, no chão).
    SPEED: 0.006,
    DIRECTION: 0.6,
  },
  // Clima (docs/features/048-dia-noite-e-clima.md, core/weather/). As
  // chances de cada tipo são do bioma (`weather`, core/data/biomes/).
  WEATHER: {
    // Lado (m) de uma região: todo ponto dela tem o mesmo clima.
    REGION_SIZE: 400,
    // Quanto dura (em dias de jogo) o clima de uma região antes de um novo
    // sorteio.
    PERIOD: 0.25,
    // Força (0 a 1) mínima de um clima sorteado; a máxima é 1.
    MIN_INTENSITY: 0.4,
    // Segundos para um clima chegar à força cheia (ou sumir) quando muda.
    TRANSITION: 8,
    // Quanto cada tipo fecha o céu (0 = limpo, 1 = todo cinza) e apaga as
    // estrelas, o sol e a lua, na força cheia.
    OVERCAST: { clear: 0, sun: 0, rain: 0.65, storm: 0.9, snow: 0.55 },
    // Sol forte, na força cheia: quanto a luz do sol fica mais forte, a cor
    // para onde ela puxa (e quanto) e a cobertura de nuvens (0 a 1).
    SUN_LIGHT_BOOST: 0.3,
    SUN_TINT: '#ffd9a0',
    SUN_TINT_AMOUNT: 0.35,
    SUN_CLOUD_COVER: 0.08,
    // Quanto o céu fechado escurece a luz (0 a 1).
    OVERCAST_DIM: 0.45,
    // Relâmpagos (só na tempestade): intervalo (s) entre um e outro na força
    // cheia (mais fraca, mais espaçados) e atraso (s) do trovão.
    LIGHTNING_INTERVAL: [5, 14],
    THUNDER_DELAY: [0.3, 2.5],
    // Duração (s) e força (vezes a luz ambiente) do clarão.
    FLASH_DURATION: 0.35,
    FLASH_STRENGTH: 2.5,
    // Partículas em volta da câmera (view/scene/WeatherView.jsx): lado (m)
    // da caixa, altura (m) e quantidade na força cheia.
    PARTICLE_AREA: 40,
    PARTICLE_HEIGHT: 18,
    RAIN_DROPS: 3000,
    SNOW_FLAKES: 2500,
    // Queda (m/s), comprimento da gota (m) e vento (inclinação da chuva).
    RAIN_SPEED: 22,
    RAIN_LENGTH: 0.7,
    STORM_WIND: 0.35,
    SNOW_SPEED: 1.6,
    // Balanço (m) dos flocos de neve.
    SNOW_SWAY: 0.6,
    // Volume, na força cheia, dos sons do clima (view/audio/
    // WeatherAudio.jsx).
    RAIN_VOLUME: 0.35,
    WIND_VOLUME: 0.3,
    THUNDER_VOLUME: 0.6,
    // Clima no combate (core/weather/combatWeather.js), como nos jogos:
    // multiplicador do dano por tipo do GOLPE em cada clima...
    MOVE_TYPE_MULTIPLIER: {
      sun: { fire: 1.5, water: 0.5 },
      rain: { water: 1.5, fire: 0.5 },
      storm: { water: 1.5, fire: 0.5 },
    },
    // ...e de um atributo de defesa por tipo do DEFENSOR em cada clima.
    DEFENSE_MULTIPLIER: {
      snow: { ice: { defense: 1.5 } },
    },
  },
  // Vegetação (docs/features/049-vegetacao-e-floresta.md): grama, flores
  // e árvores. Quanto de cada uma nasce em cada bioma é a `density` do
  // `vegetation` dele (core/data/biomes/). A grama
  // (docs/features/052-assets-do-lgpe-e-floresta.md) são os modelos do
  // Let's Go de cada bioma (`models` da entrada `tall-grass`), espalhados
  // por bloco e tingidos pela cor do bioma.
  GRASS: {
    // A grama aparece? Escondida não some dos dados (os biomas continuam
    // com ela) — só não é desenhada; o F2 ("Vegetação → Mostrar → Grama")
    // liga ao vivo (docs/features/066-revisao-dos-biomas.md).
    VISIBLE: true,
    // Lado (m) de um bloco de grama — a grama nasce e some por bloco. O
    // `TERRAIN.CHUNK_SIZE` tem que ser múltiplo dele.
    TILE_SIZE: 16,
    // Tufos por m² onde a `density` do bioma é 1 (cada modelo cobre mais
    // de um m²).
    CLUMPS_PER_M2: 6,
    // Tamanho (multiplica o modelo) — sorteado entre os dois.
    SCALE: [0.8, 1.2],
    // Altura: multiplica o modelo só na vertical (por cima do tamanho).
    HEIGHT: 0.7,
    // Quanto a altura varia em manchas (0 = toda igual).
    HEIGHT_VARIATION: 0.6,
    // Tamanho (m) das manchas de altura.
    HEIGHT_PATCH_SIZE: 7,
    // Tamanho (m) das manchas de cor (entre a cor `a` e a `b` do bioma)...
    COLOR_PATCH_SIZE: 1.5,
    // ...e quanto uma mancha pode puxar para a `b` (0 a 1).
    COLOR_VARIATION: 0.5,
    // Variação grande de claro e escuro (0 a 1) e o tamanho (m) dela.
    MACRO_VARIATION: 0.35,
    MACRO_SIZE: 9,
    // Sem grama: abaixo da água + esta folga (m) e em encosta mais
    // íngreme que esta (rad).
    SHORE_GAP: 0.4,
    MAX_SLOPE: 0.6,
  },
  // Grama em fios (view/vegetation/bladeGrass.js, docs/features/066-
  // revisao-dos-biomas.md): o tufo de lâminas finas gerado por código, que
  // o bioma escolhe nos `models` da grama (`blade-grass`). A cor base vale
  // ao vivo; a forma, ao refazer o tufo (laboratório de biomas). O tamanho
  // e a altura no mundo seguem o `GRASS` (como os outros modelos).
  // - COUNT: lâminas por tufo (o que mais pesa: o custo da grama na tela
  //   segue o número de lâminas, mais que a altura ou a distância);
  //   RADIUS (m): o disco onde nascem;
  // - HEIGHT (m) e HEIGHT_VARIATION: altura da lâmina e quanto ela varia;
  // - WIDTH (m): largura no pé; SEGMENTS: partes da lâmina (a curva do
  //   vento — a lâmina nasce reta, virada para um lado sorteado);
  // - ROOT_SHADE e TIP_SHADE: o tom da raiz e da ponta (vezes a cor);
  // - SEED: o sorteio do tufo;
  // - FADE_START e FADE_END (m da câmera): a grama em fios encolhe entre
  //   os dois e some depois (longe, o chão faz o papel dela) — o bloco
  //   inteiro deixa de ser desenhado além do fim; nessa faixa, o tom da
  //   lâmina (raiz e ponta) vai virando o GROUND_SHADE, o mesmo do chão
  //   debaixo dela;
  // - GROUND_COVER (0 a 1) e GROUND_SHADE: o chão debaixo das manchas de
  //   grama em fios puxa para a cor dela (COLOR, com a tinta do bioma, vezes
  //   GROUND_SHADE) — de longe, onde as lâminas já sumiram, a mancha
  //   continua lá e, perto, elas brotam em cima da mesma cor
  //   (view/terrain/terrainGeometry.js, `groundGrass`).
  // O tufo não vira para a câmera (como no stylized-scene): fica de pé e
  // todas as lâminas dobram para o lado do vento.
  GRASS_BLADES: {
    COLOR: '#5cc417',
    COUNT: 20,
    RADIUS: 0.5,
    HEIGHT: 0.75,
    HEIGHT_VARIATION: 0.35,
    WIDTH: 0.07,
    SEGMENTS: 4,
    ROOT_SHADE: 0.6,
    TIP_SHADE: 1.3,
    SEED: 7,
    FADE_START: 40,
    FADE_END: 100,
    GROUND_COVER: 1,
    GROUND_SHADE: 1,
  },
  FLOWERS: {
    // Moitas de flores por m² onde a `density` é 1.
    CLUMPS_PER_M2: 0.25,
  },
  // Árvores (docs/features/049-vegetacao-e-floresta.md). `TREES` é a
  // folhosa comum (`broadleaf-tree`) e o que vale para todas as espécies
  // (tom, LOD); cada espécie tem o próprio bloco com a colocação
  // (`GIANT_TREES`, `ANCIENT_TREES`, `PINES`, `DEAD_TREES`).
  TREES: {
    // Lado (m) da grade de candidatas: no máximo uma árvore por célula —
    // é o espaço mínimo entre duas.
    SPACING: 6.5,
    // Chance de uma célula ganhar árvore onde a `density` do bioma é 1.
    CHANCE: 0.9,
    // Tamanho (multiplica o modelo) — sorteado entre os dois.
    SCALE: [0.85, 1.4],
    // Sem árvore em encosta mais íngreme que esta (rad), abaixo da água +
    // `SHORE_GAP` (m), nem perto da origem (onde o treinador nasce — vale
    // para todas as espécies e pedras).
    MAX_SLOPE: 0.45,
    SHORE_GAP: 0.8,
    SPAWN_CLEAR_RADIUS: 18,
    // Colisão do tronco: raio e altura (m) no tamanho 1.
    TRUNK_RADIUS: 0.4,
    TRUNK_HEIGHT: 4,
    // Raio (m, no tamanho 1) em volta do tronco onde não nasce o tronco de
    // outra árvore — a copa não atravessa a da vizinha.
    CROWN_RADIUS: 1.6,
    // Quanto o tom varia de uma árvore (ou planta) para outra (0 = todas
    // iguais): mais clara ou mais escura, e um pouco mais amarelada.
    TINT_VARIATION: 0.18,
    // Árvore de longe (LOD): a partir desta distância (m) da câmera, a
    // árvore para de fazer sombra.
    LOD_DISTANCE: 60,
  },
  // Árvore antiga (`ancient-tree`): a grande e retorcida, poucas e
  // espalhadas — a copa alta que fecha a mata. Mesmos campos de `TREES`.
  ANCIENT_TREES: {
    SPACING: 24,
    CHANCE: 0.8,
    SCALE: [0.85, 1.15],
    MAX_SLOPE: 0.35,
    SHORE_GAP: 1,
    TRUNK_RADIUS: 0.95,
    TRUNK_HEIGHT: 6,
    CROWN_RADIUS: 4.5,
  },
  // Árvore gigante (`giant-tree`, docs/features/066-revisao-dos-
  // biomas.md): poucas, da altura de vários andares, com tronco largo e
  // bastante espaço em volta (a copa não deixa outro tronco nascer
  // debaixo). Mesmos campos de `TREES`.
  GIANT_TREES: {
    SPACING: 60,
    CHANCE: 0.8,
    SCALE: [3.5, 4.5],
    MAX_SLOPE: 0.3,
    SHORE_GAP: 2,
    TRUNK_RADIUS: 0.6,
    TRUNK_HEIGHT: 8,
    CROWN_RADIUS: 3,
  },
  // Pinheiro (`pine-tree`): em bosques (`patches` no bioma), com a casca
  // um pouco mais quente que a da folhosa.
  PINES: {
    SPACING: 6.5,
    CHANCE: 0.9,
    SCALE: [0.9, 1.35],
    MAX_SLOPE: 0.5,
    SHORE_GAP: 0.8,
    TRUNK_RADIUS: 0.32,
    TRUNK_HEIGHT: 4,
    CROWN_RADIUS: 1.6,
  },
  // Acácia (`acacia-tree`, savana): isolada no campo. Mesmos campos de
  // `TREES`.
  ACACIAS: {
    SPACING: 22,
    CHANCE: 0.8,
    SCALE: [2, 2.5],
    MAX_SLOPE: 0.4,
    SHORE_GAP: 1,
    TRUNK_RADIUS: 0.5,
    TRUNK_HEIGHT: 4,
    CROWN_RADIUS: 3.5,
  },
  // Árvore morta (`dead-tree`): só galhos, rara.
  DEAD_TREES: {
    SPACING: 28,
    CHANCE: 0.8,
    SCALE: [0.55, 0.75],
    MAX_SLOPE: 0.45,
    SHORE_GAP: 0.8,
    TRUNK_RADIUS: 0.5,
    TRUNK_HEIGHT: 5,
    CROWN_RADIUS: 2,
  },
  // Manchas (`patches` no `vegetation` dos biomas): o tipo nasce em grupos
  // — bosque de pinheiros, tapete de samambaias — e não
  // salpicado por igual. Largura da borda da mancha (0 a 1 do ruído).
  VEGETATION_PATCHES: {
    EDGE: 0.12,
  },
  // Linha das árvores (docs/features/051-montanha.md): um tipo com
  // `maxHeight` no `vegetation` do bioma rareia ao subir e some nessa
  // altura.
  VEGETATION_ALTITUDE: {
    // Faixa (m) abaixo do `maxHeight` em que o tipo vai rareando até sumir.
    FADE: 6,
  },
  // Clareiras (docs/features/049-vegetacao-e-floresta.md): manchas abertas
  // pela seed nos biomas que têm `clearings`. A vegetação de sombra rareia
  // nelas e a de clareira (flores) só nasce nelas — `place` no `vegetation`
  // de cada bioma.
  CLEARINGS: {
    // Tamanho (m) das manchas.
    SIZE: 40,
    // Largura da borda da clareira (0 a 1 do ruído): maior = transição mais
    // longa entre mata e clareira.
    EDGE: 0.08,
  },
  // Pedras (`rock`) — colidem e entram no pathfinding.
  ROCKS: {
    SPACING: 10,
    CHANCE: 0.25,
    SCALE: [0.25, 3],
    MAX_SLOPE: 0.6,
    SHORE_GAP: 0.2,
    // Raio (m) da colisão no tamanho 1 (o modelo é um pouco maior que ele:
    // a pedra afunda no chão).
    RADIUS: 1.5,
    HEIGHT: 1.8,
    // Quanto a pedra afunda no chão (fração da altura).
    SINK: 0.12,
  },
  // O chão para o som do passo (core/terrain/groundSurface.js,
  // docs/features/066-revisao-dos-biomas.md): é grama onde a parte da
  // grama do bioma no ponto (as manchas, sem trilha) chega a GRASS (0 a 1).
  GROUND_SURFACE: {
    GRASS: 0.5,
  },
  // Base das árvores e pedras no chão (core/vegetation/solidPlacement.js,
  // `groundedBaseY`): o objeto fica na altura do chão mais baixo debaixo
  // da base — numa volta do tamanho da pegada do modelo vezes REACH — e
  // afunda SINK (m) a mais. Num barranco, a base inteira fica enterrada.
  SOLID_GROUND: {
    REACH: 1.2,
    SINK: 0.15,
  },
  // Arbustos (`bush`) — atravessáveis.
  BUSHES: {
    // Arbustos por m² onde a `density` do bioma é 1.
    PER_M2: 0.04,
  },
  // Samambaias (`fern`) — decorativas.
  FERNS: {
    PER_M2: 0.08,
  },
  // Plantas de folha larga (`leafy-plant`) do chão da mata — decorativas.
  LEAFY_PLANTS: {
    PER_M2: 0.06,
  },
  // Seixos (`pebble`) — decorativos, na trilha (`place: 'trail'`).
  PEBBLES: {
    PER_M2: 0.35,
  },
  // Vento da vegetação: a força vem do clima onde está quem joga (mistura
  // pela força de cada tipo, `LocalWeather`).
  WIND: {
    STRENGTH: { clear: 0.22, sun: 0.15, rain: 0.4, storm: 0.75, snow: 0.45 },
    // Direção (rad, no chão) e velocidade das rajadas.
    DIRECTION: 0.8,
    SPEED: 1.25,
    // Largura das faixas de rajada (maior = faixas mais estreitas).
    GUST_SCALE: 0.5,
    // Quanto cada folha sai da direção do vento e treme na ponta (0 a 1).
    TURBULENCE: 0.15,
    FLUTTER: 0.15,
  },
  // Modelos do Pokémon Let's Go (docs/features/052-assets-do-lgpe-e-
  // floresta.md): o material toon deles e o tamanho das plantas baixas.
  LGPE: {
    // Degrau da luz (0 a 1, do lado contra o sol ao lado do sol) e a
    // largura dele.
    RAMP_THRESHOLD: 1,
    RAMP_SOFTNESS: 0.5,
    // Cor que o lado sem sol puxa (a `Shadow_Color` do jogo original,
    // clareada).
    SHADOW_TINT: '#ffffff',
    // Força da luz de borda (na cor de cada material).
    RIM_STRENGTH: 0.25,
    // Quanto do sombreado pintado por vértice entra (0 a 1).
    VERTEX_COLOR: 1,
    // Fator do corte das folhas recortadas (o do jogo original vezes isto).
    CUTOFF: 0.75,
    // Tamanho sorteado das plantas baixas (vezes o `scale` da entrada do
    // bioma) — os modelos já vêm em metros.
    PLANT_SCALE: [0.8, 1.2],
    // Base das plantas mais escura (docs/features/066-revisao-dos-
    // biomas.md): o pé da grama e das plantas escurece até `BASE_SHADE`
    // (0 = desligado, 1 = preto) e clareia até a altura `BASE_SHADE_HEIGHT`
    // (fração da altura do modelo) — a sombra que a grama faz em si mesma.
    BASE_SHADE: 0.45,
    BASE_SHADE_HEIGHT: 0.6,
    // As árvores dos pacotes de fora (docs/features/066-revisao-dos-
    // biomas.md) com as folhas de uma árvore do LGPE (id do prop no
    // manifesto; `null` = as folhas delas): ao carregar a vegetação.
    PACK_LEAVES: 'round-tree',
    // A luz dos postes à noite (docs/features/069-revisao-do-bioma-
    // cidade.md): os materiais marcados no manifesto (`glow`, o vidro)
    // acendem junto com a noite (as estrelas do ciclo,
    // `DAY_CYCLE.KEYFRAMES`), na cor deles vezes `COLOR` e `STRENGTH`,
    // sem depender da luz da cena.
    LAMP_GLOW: { COLOR: '#ffe0a0', STRENGTH: 1.6 },
    // A luz de verdade dos postes à noite (a mesma feature): `COUNT` luzes
    // pontuais, sem sombra, nos postes mais perto de quem o jogador
    // controla (refeito a cada `REFRESH` s), no vidro de cada um — o
    // bastante para todos os postes de Viridian. Acendem com a noite, como
    // o vidro. Cada luz fica no poste dela enquanto ele segue entre os mais
    // perto; a que muda de poste apaga e acende em `FADE` s. O número de
    // luzes fica fixo (mudar recompila os materiais da cena); `INTENSITY`,
    // `DISTANCE` (m) e `DECAY` são os da `THREE.PointLight`.
    LAMP_LIGHT: {
      COUNT: 8,
      COLOR: '#ffd9a0',
      INTENSITY: 12,
      DISTANCE: 9,
      DECAY: 1.5,
      REFRESH: 0.5,
      FADE: 0.6,
    },
  },

  // Mato alto do LGPE (`encounter-grass`, o "mato de encontro"): pontos
  // por m² e só onde a altura dos conjuntos de grama passa de
  // `MIN_CLUSTER_HEIGHT` (o miolo deles).
  ENCOUNTER_GRASS: {
    PER_M2: 0.5,
    MIN_CLUSTER_HEIGHT: 0.85,
    SCALE: [0.85, 1.15],
  },
  // Vegetação abrindo para quem passa (docs/features/053-planicie-com-
  // assets-do-lgpe.md, view/vegetation/grassPush.js): as plantas (grama,
  // tufos, flores, arbustos e plantas largas; árvores não) dobram para
  // longe do treinador e das criaturas
  // mais perto da câmera, aos poucos, e voltam devagar depois que eles
  // passam (a grama guarda o empurrão num mapa em volta da câmera).
  // - RADIUS: alcance (m) além do raio do corpo;
  // - INNER: parte do alcance (0 a 1) em que a dobra é inteira;
  // - BEND: dobra máxima na ponta (rad);
  // - BUSH: parte da dobra nos arbustos e plantas largas (mais altos);
  // - ATTACK: tempo (s) para a grama tocada deitar (uma mola sem quicar:
  //   parte parada, acelera e assenta);
  // - RECOVERY: tempo (s) para a grama solta voltar de pé (a mesma mola);
  // - RUSTLE: tremor das folhas enquanto deitam ou levantam;
  // - HEIGHT_GATE: pé acima do chão (m) em que para de empurrar (pulo);
  // - AREA: lado (m) do mapa em volta da câmera; MAP_SIZE: texels do lado.
  GRASS_PUSH: {
    ENABLED: true,
    RADIUS: 0.7,
    INNER: 0.75,
    BEND: 1.25,
    BUSH: 0.85,
    ATTACK: 0.25,
    RECOVERY: 1,
    RUSTLE: 0.1,
    HEIGHT_GATE: 0.8,
    AREA: 48,
    MAP_SIZE: 192,
  },
  // Qualidade (`VEGETATION_QUALITY.CURRENT`, escolhida no F2):
  // - density: quanto da densidade da vegetação só visual fica;
  // - canopyShadow: se copas e arbustos fazem sombra;
  // - shadowRing: até quantos blocos de sólidos (`TERRAIN.SOLIDS_BLOCK_SIZE`)
  //   da câmera os objetos fazem sombra — o bastante para cobrir a área de
  //   sombra (`GRAPHICS.SHADOW`, a `AREA` do nível); 0 = nenhum;
  // - treeDistance: até onde (m, do centro do bloco da câmera ao centro do
  //   bloco) aparecem árvores e pedras;
  VEGETATION_QUALITY: {
    CURRENT: 'high',
    high: {
      density: 1,
      canopyShadow: true,
      shadowRing: 2,
      treeDistance: 150,
    },
    low: {
      density: 0.5,
      canopyShadow: false,
      shadowRing: 0,
      treeDistance: 100,
    },
  },
  // Gráficos que o jogador escolhe no menu (docs/features/066-revisao-dos-
  // biomas.md, desempenho): vão no save da conta (`GraphicsSettings`),
  // como o som. Cada opção tem os níveis em ordem, do mais leve ao mais
  // bonito, e o padrão de quem nunca mexeu.
  GRAPHICS: {
    // Sombra do sol (view/scene/DayNightView.jsx). Por nível:
    // - ENABLED: se há sombra (desligada, nada é desenhado nem lido);
    // - MAP_SIZE: lado (px) do mapa de sombra — mais, sombra mais nítida;
    // - AREA: lado (m) da área com sombra, em volta de quem está no
    //   controle, e AHEAD: quanto (m) ela vai à frente, para onde a câmera
    //   olha (menos que metade da AREA, para quem está no controle e a
    //   volta dele seguirem dentro);
    // - UPDATE_EVERY: o mapa é redesenhado a cada quantos quadros (1 =
    //   todo quadro; mais, a sombra de quem se mexe anda aos saltos);
    // - SOFT: borda macia no chão e nos personagens (várias leituras do
    //   mapa por pixel); sem ela, uma leitura só. A vegetação lê uma vez
    //   sempre (nas folhas a diferença não aparece);
    // - VEGETATION_RECEIVES: se a sombra cai em cima da vegetação (copas,
    //   troncos, plantas) ou só no chão e nos personagens.
    SHADOW: {
      DEFAULT: 'high',
      LEVELS: {
        off: {
          ENABLED: false,
          MAP_SIZE: 1024,
          AREA: 80,
          AHEAD: 30,
          UPDATE_EVERY: 1,
          SOFT: false,
          VEGETATION_RECEIVES: false,
        },
        low: {
          ENABLED: true,
          MAP_SIZE: 1024,
          AREA: 80,
          AHEAD: 30,
          UPDATE_EVERY: 2,
          SOFT: false,
          VEGETATION_RECEIVES: false,
        },
        medium: {
          ENABLED: true,
          MAP_SIZE: 2048,
          AREA: 100,
          AHEAD: 38,
          UPDATE_EVERY: 2,
          SOFT: false,
          VEGETATION_RECEIVES: true,
        },
        high: {
          ENABLED: true,
          MAP_SIZE: 2048,
          AREA: 120,
          AHEAD: 45,
          UPDATE_EVERY: 1,
          SOFT: true,
          VEGETATION_RECEIVES: true,
        },
      },
    },
    // Proporção do canvas (view/scene/GameCanvas.jsx): com ela, o canvas
    // fica no maior retângulo dessa proporção que cabe na janela, no centro,
    // com faixas pretas no que sobra; a interface continua na tela inteira.
    // Por nível, RATIO: largura ÷ altura (null = a da janela, sem faixas).
    ASPECT: {
      DEFAULT: 'fill',
      LEVELS: {
        fill: { RATIO: null },
        '21:9': { RATIO: 21 / 9 },
        '16:9': { RATIO: 16 / 9 },
        '16:10': { RATIO: 16 / 10 },
        '4:3': { RATIO: 4 / 3 },
      },
    },
    // Tamanho do canvas (view/scene/GameCanvas.jsx): fração do lado do
    // retângulo da proporção, de MIN até a janela toda (1), em passos de
    // STEP. O desenho é sempre um pixel por pixel do canvas (nítido, sem
    // esticar); o que sobra da janela fica preto. Canvas menor, menos
    // pixels para a placa de vídeo desenhar.
    CANVAS_SIZE: { DEFAULT: 1, MIN: 0.5, STEP: 0.05 },
    // Distância de visão (core/systems/chunkStreamingSystem.js): o raio, em
    // chunks inteiros, do mundo carregado em volta de quem anda — um
    // quadrado de lado 2 × raio + 1. Define até onde se vê (a névoa fecha
    // antes da borda, `core/terrain/fogRange.js`) e onde as selvagens
    // nascem e somem: mais raio, mais mundo na tela e mais peso para a
    // máquina. MIN: abaixo dele, o anel de spawn das selvagens sairia do
    // chão carregado.
    VIEW_DISTANCE: { DEFAULT: 8, MIN: 5, MAX: 12 },
  },
  RENDER: {
    // Curva de cor da cena inteira (docs/features/049-*.md): 'aces' (a de
    // sempre do R3F) ou 'neutral' (a do stylized-scene). Ver no F2.
    TONE_MAPPING: 'aces',
    // Antialiasing básico do WebGL (MSAA, no canvas): desligado porque é
    // caro na GPU integrada — as folhas recortadas e a grama pesam em cada
    // amostra (docs/features/049-*.md). Só vale ao recarregar a página.
    MSAA: false,
    // Limite de quadros por segundo (0 = o da tela). Não confundir com
    // `LOOP.FIXED_TIMESTEP`, que é o passo da simulação — o desenho
    // interpola entre os passos (view/scene/FrameLimiter.jsx).
    MAX_FPS: 30,
    // Antialiasing extra (SMAA) por cima do básico do WebGL.
    SMAA: false,
    // Visual toon (estilo Zelda) — ver src/view/materials/toonMaterial.js
    TOON: true, // false = visual antigo (MeshStandardMaterial do .glb)
    TOON_RAMP: [120, 200, 255], // tons chapados da luz: sombra, meio-tom, luz (0–255)
    OUTLINE_WIDTH: 0.0045, // espessura do contorno, em unidades do modelo (antes do scale)
    OUTLINE_COLOR: '#3a1410',
    OUTLINE_SKIP: ['fire'], // materiais (por nome) que não ganham contorno
    // Silhueta de quem está escondido atrás de planta (grama, arbusto,
    // flor — docs/features/066-revisao-dos-biomas.md,
    // view/materials/toonMaterial.js): a forma do corpo numa cor chapada,
    // ALLY_COLOR para o treinador e o time, WILD_COLOR para as selvagens,
    // com OPACITY. Atrás de chão, tronco, pedra ou prédio, não aparece.
    // WILD_AT_NIGHT: a das selvagens também à noite (desligado: de noite
    // elas não se destacam de longe — batalha e captura mais difíceis).
    SILHOUETTE: {
      ENABLED: true,
      WILD_AT_NIGHT: false,
      ALLY_COLOR: '#3fa9ff',
      WILD_COLOR: '#ffb35c',
      OPACITY: 0.6,
    },
    RIM_STRENGTH: 0.22, // brilho de borda; 0 desliga
    // faixa do rim (0 = de frente pra câmera, 1 = de lado): começa a acender
    // no primeiro valor e chega no máximo no segundo — perto um do outro =
    // corte seco, estilo toon
    RIM_EDGE: [0.62, 0.68],
    RIM_COLOR: '#ffe6b3',
    // Correção de cor no fim da imagem (view/scene/colorGrade.js,
    // docs/features/066-revisao-dos-biomas.md), depois da curva de cor:
    // saturação, contraste e gama (1 = sem mudança), exposição (0 = sem
    // mudança, em pontos de luz) e temperatura (0 = neutra; positivo
    // esquenta, negativo esfria). Com os valores neutros a etapa nem roda.
    GRADE: {
      SATURATION: 1,
      CONTRAST: 1,
      EXPOSURE: 0,
      GAMMA: 1,
      TEMPERATURE: 0,
    },
  },
}
