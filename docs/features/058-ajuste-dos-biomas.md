# 🚀 Versão 0.0.58 — Ajuste dos biomas

## Resumo

Fechar os biomas visíveis da beta (**floresta**, **planície**, **savana** e
**cidade**) antes de as espécies entrarem (059) e de o spawn passar a
depender do bioma (060). Os biomas já existem e cada um foi refinado na
própria feature (047, 049–056), mas o conjunto ainda não ficou alinhado:

- **Tamanho e distribuição**: quanto do mundo é de cada bioma, o tamanho
  típico de cada mancha, quem fica vizinho de quem e como é a transição
  entre eles.
- **Névoa**: distância, cor e densidade, no mundo inteiro e por bioma.
- **Desenho dos objetos do bioma**: até onde cada tipo aparece, densidade,
  LOD e o "pop-in" ao andar.
- **Detalhes que ainda não ficaram bem alinhados** (lista a fechar com o
  usuário na abertura).

Vem depois da água (057): lagos e rios entram na distribuição e no
desenho dos biomas que serão ajustados aqui.

Versão: `0.0.58` (`package.json`, sobe quando a feature começar — depois
da 057). Branch: `feature/058-ajuste-dos-biomas`.

> **Os números deste doc são fictícios (só ilustram).** O valor de verdade é
> o do campo citado (config ou dado do bioma).

---

## O que já existe (ponto de partida)

- **Mapa de biomas** (`core/terrain/biomeMap.js`, 047): clima por ruído
  (temperatura, umidade, continentalidade) decide a faixa; dentro do mesmo
  clima, as manchas próprias de cada bioma (do tamanho do `size` dele)
  decidem — o menor fica por cima. Números globais em
  `GAME_CONFIG.BIOMES` (`CLIMATE_SIZE`, `CONTINENT_SIZE`,
  `CLIMATE_SHARPNESS`, `PRESENCE_STRENGTH`, `PATCH_COVERAGE`, `PATCH_EDGE`,
  `BLEND`, `BLEND_CELL`); `coverage` opcional por bioma (a cidade usa, 056).
- **Biomas escondidos** (`BIOMES.HIDDEN`): os escondidos saem da disputa e
  os visíveis ocupam o lugar deles — então o tamanho real de cada bioma
  visível hoje depende de quem está escondido, não só do `size` dele.
- **Origem em terra** (`SPAWN_CONTINENT`, `SPAWN_LAND_RADIUS`).
- **Névoa** (`view/terrain/fogRange.js`, `GAME_CONFIG.FOG`): fecha antes da
  borda do mundo carregado (`TERRAIN.LOAD_RADIUS`) e, com o relevo distante
  (`FAR_TERRAIN`, 051), vira bruma (`HAZE_*`). A cor vem do ciclo de dia
  (`DAY_CYCLE`, 048). Não há névoa por bioma.
- **Vegetação e props** (049–054): colocação pela seed no core, por bloco de
  sólidos; malhas instanciadas por modelo, LOD das árvores
  (`TREES.LOD_DISTANCE`), configs por tipo (`GRASS`, `FLOWERS`, `TREES`,
  `BUSHES`, `ROCKS`...), qualidade baixa cortando parte.
- **Cidade** (056): manchas raras (`size`, `coverage`), quarteirões em
  grade, temas.
- **Painel F2**: bioma atual, chão colorido por bioma, parâmetros de cada
  bioma e "Copiar valores" (sem o `town`).

---

## Decisões (com o usuário — a fechar na abertura)

Ordem combinada: primeiro os itens 1, 2 e 3 (o mapa); os outros ficam
guardados para depois, com calma.

1. **Tamanho e proporção** — que fração do mundo cada bioma visível deve
   ter (floresta, planície, savana, cidade) e quanto tempo andando para
   atravessar uma mancha típica de cada. O `size` sozinho não diz o
   tamanho real: os escondidos saem da disputa e os visíveis ocupam o
   lugar deles. *(decidido)*
   - Floresta, planície e savana ficam como estão (vêm do clima — o mapa
     da seed foi aprovado).
   - **A cidade vira a âncora de uma área**: sai do ruído e passa a ser
     posta pela seed, uma por área; floresta, planície e savana em volta
     continuam vindo do clima. Todo ponto do mundo pertence à cidade mais
     próxima, e o core responde "qual a cidade mais próxima e a que
     distância". O nível do spawn pela distância (e como fica entre duas
     cidades) é da 060.
   - O jogador nasce **dentro da primeira cidade** (na origem).
   - **Estradas** ligando as cidades vizinhas entram nesta feature.
   - Distância entre cidades: 10 a 15 min **andando** pela estrada. Uma
     cidade por célula de uma grade, posta perto do centro pela seed (fora
     da água) — protótipo aprovado com a estrada típica nessa faixa.
   - Estradas: estilo rotas de Kanto, não malha — cada cidade liga a um
     vizinho (leste ou norte, pela seed), o que já deixa todas ligadas,
     mais algumas ligações extras; estrada sinuosa.
   - Tamanho das cidades: varia pela seed entre vila, cidade e cidade
     grande; a primeira é vila.
2. **Vizinhança** — regras de quem encosta em quem (ex. fictício: savana
   nunca direto na floresta sem planície no meio?) ou deixar só o clima
   decidir. *(decidido: só o clima decide; com a cidade de âncora, a
   vizinhança pesa menos)*
3. **Transição** — largura da borda entre biomas (relevo, chão e
   vegetação) — curta e marcada ou longa e gradual. *(decidido: fica a de
   hoje, `BLEND_CELL`)*
4. **Névoa** e 5. **Objetos do bioma** — juntos (o problema é um só: o
   que nasce de uma vez na borda do mundo carregado). *(decidido)*
   - **Névoa fechada** (`FOG`, view/scene/FogView.jsx): fecha na borda do
     mundo carregado (`loadedFogRange`, começando em `FOG.START_FRACTION`)
     e, até ela começar, tudo aparece inteiro — árvores, prédios, grama,
     sub-bosque (o alcance e o anel de blocos vão até a névoa), itens do
     chão (até a névoa fechar) e sombras (`DAY_CYCLE.SHADOW_AREA` e
     `TREES.LOD_DISTANCE` cobrindo até onde ela começa; a área de sombra
     vai à frente de quem está no controle, para onde a câmera olha —
     `SHADOW_AHEAD` —, e cobre o que se vê, não o que fica atrás da
     câmera). Dentro da névoa, some.
   - Bug antigo achado aqui: as props `shadow-camera-*` do
     `<directionalLight>` nunca chegavam à câmera da sombra — ela ficava
     na de 10 m do three, só em volta de quem está no controle (por isso a
     sombra "não acompanhava a névoa"). Agora o tamanho vai direto na
     câmera (`fitShadowCamera`, DayNightView). Custo medido na Intel UHD
     (ABAB, mesma sessão, sol baixo): floresta igual (12,8 ms × 12,7 ms),
     planície +1,8 ms de GPU (13,6 × 11,9), FPS igual.
   - **Serras do fundo** (`BACKDROP`, view/scene/BackdropView.jsx e
     backdropGeometry.js): camadas de silhueta de montanha em volta da
     câmera, como parte do céu (vão com ela, desenhadas logo depois do céu
     e antes de tudo) — o mundo não acaba num limbo. Crista por ruído
     sobre o círculo (sem emenda), pela seed; altura em ângulo acima do
     horizonte. Cor = a do horizonte escurecida (`shade`) e puxada para o
     tom da camada (`tint`, `mountainColor`), saindo da névoa do horizonte
     para cima (`mist`). A **névoa toma a cor da serra da frente**
     (`fogColorOf`, no DayNightView): o mundo some direto nela. Cor
     ajustável ao vivo no F2 ("Serras do fundo"); a forma, ao recarregar.
   - Pegadinha (medida pixel a pixel): a névoa dos materiais sai
     convertida para a tela (mais clara que o valor do uniform), então as
     serras passam pela mesma conversão (`colorspace_fragment`, sem a
     curva de cor) — senão a base não bate com o chão enevoado.
   - **Tentado e descartado** (o usuário preferiu só a névoa com as serras):
     bruma leve com o relevo distante à vista (a da 051 — saiu junto o
     relevo distante: `FAR_TERRAIN`, farTerrain.js, FarTerrainView, a cor
     da copa ao longe `LEAF_COLOR`); esmaecer em pontilhado pela distância;
     grama e sub-bosque rareando; árvores de longe em impostor (o sorteio
     de perto sem o chunk); itens crescendo do nada. A névoa fechada
     mediu GPU parecida com a bruma na Intel UHD (ABAB, dentro do ruído).
6. **Outros detalhes** — lista do usuário do que ainda não ficou alinhado
   jogando. *(decidido: grama e vento)*
   - **Vento forte que não passava** (`windStrengthOf`, core/weather/
     wind.js): a força era a média dos climas pesada pelo nível de cada um
     — ignorava a intensidade, então uma tempestade fraca (quase sem gota)
     ventava como a cheia. Como o clima vem do horário e da posição salvos,
     o F5 não resolvia. Agora parte do vento do limpo e puxa para o de cada
     clima pela força dele.
   - **Planta afundando ao ser empurrada** (`vegArc`, windShader.js): a
     dobra em arco cresce do pé à ponta por um expoente, mas a altura era
     comparada com a do modelo como se fosse linear — com dobra zero a
     planta já saía achatada. O empurrão (`vegPush`) somava esse
     achatamento inteiro assim que começava e só o soltava quando o
     resíduo do mapa sumia. Agora o arco parte da forma do modelo (dobra
     zero = parada), no vento e no empurrão; a planta em repouso fica na
     forma original (um pouco mais alta que antes no meio da folha).
   - **Tufo sumindo de perfil** (`lgpeBillboardOf`, lgpeModels.js; o
     `vegFaceCamera` do toonMaterial.js): os tufos (`tuft`, `tuft-route`,
     `tuft-medium`) são um leque de planos virados quase para o mesmo
     lado. Agora a forma parada gira para a câmera em cada instância, antes
     do vento e do empurrão (que seguem iguais). O mato alto e as flores
     têm volume e ficam como estão.

**Escopo** *(decidido)*:

- Vegetação de margem (juncos, vitórias-régias), deixada em aberto pela 057:
  sem vegetação na água nesta beta.
- O doc da 056 citava "spawn por bioma é da 058"; pela renumeração é da 060
  — corrigido.

---

## Arquitetura (proposta — itens 1 a 3)

Ideia central: o mapa de biomas, o relevo, o chão, a vegetação e a planta
da cidade (056) já leem o **peso da cidade** em cada ponto. Só muda **de
onde vem esse peso**: em vez da mancha de ruído, um disco em volta de cada
cidade posta pela seed. O resto da cadeia segue igual.

### Cidades postas pela seed (`core/town/citySites.js`, novo)

Puro e determinístico, sem chunk:

- O mundo é uma grade de células de `CITIES.SPACING` m. Cada célula tem
  **uma cidade**, sorteada pela seed perto do centro (`CITIES.JITTER`,
  fração da célula). Se o ponto cai na água ou perto dela (`insideRiver` e
  `insideLake` de `waterBodies.js`, que só dependem da seed — sem ciclo com
  o relevo), sorteia de novo (`CITIES.TRIES`); sem lugar todo seco, fica o
  de centro seco e menos água em volta. Lagos e rios são frequentes perto
  do tamanho de uma cidade, então às vezes o disco pega água: a cidade não
  tem `water`, e a água para na borda dela.
- A célula `(0, 0)` é a **primeira cidade**, centrada na origem, sempre
  vila.
- **Porte** pela seed (`town.sizes` do bioma da cidade: vila, cidade,
  cidade grande, cada um com peso, raio e os prédios únicos).
- `cityAt(cellX, cellZ)` → `{ id, x, z, size, radius }` (em cache).
- `nearestCity(x, z)` → `{ city, distance }`: olha as células em volta (o
  bastante para o `JITTER` — testado contra a busca exaustiva). É a
  resposta que a 060 vai usar para o nível.

### O peso da cidade no mapa de biomas (`biomeMap.js`)

- O bioma com `town` deixa de disputar por clima e mancha (`size`,
  `coverage`, `climate` saem do `city/index.js` e do `_template`): o
  placar dele é o **disco** da cidade mais próxima — vence dentro do raio,
  some fora, com uma borda suave. Os outros biomas não mudam.
- A transição continua a de hoje (a disputa na grade de `BLEND_CELL`,
  suavizada).
- Sozinha no mundo (os testes da planta da cidade), ela vale em todo
  lugar.
- `CITIES` entra na receita do relevo (`currentTerrainRecipe`) e o
  `TERRAIN.GENERATION_VERSION` sobe (o mundo da seed muda). O sampler do
  relevo expõe as cidades (`cities`: `nearestCity`, `cityAt`).
- A prioridade das manchas (o menor `size` por cima) passa a não contar a
  cidade: floresta, planície e savana mudam um pouco de lugar, com a mesma
  proporção (medida no mapa da seed).

### Planta da cidade (`core/town/`)

- `cityIndex.js` continua achando os quarteirões pelo peso; o **id** da
  cidade passa a ser o da célula da grade (estável, sem flood fill para
  saber de quem é), e o **porte** decide os prédios únicos (`town.sizes`:
  vila = Pokécenter e casas; cidade = + loja; cidade grande = + ginásio e
  o especial do tema). O índice recebe as cidades da seed (`sites`); sem
  elas (testes), a cidade fica como na 056 (id do quarteirão, todos os
  prédios únicos).
- **Nascer dentro da primeira cidade**: a origem já é um cruzamento de ruas
  (a grade dos quarteirões passa por ela); o `TOWN.SPAWN_CLEAR_RADIUS`
  segue deixando o cruzamento livre. Sai a origem forçada em terra
  (`SPAWN_CONTINENT`, `SPAWN_LAND_RADIUS`)? Fica: o oceano está escondido,
  mas a regra é barata e protege quando ele voltar.

- Os selvagens do nível de teste (`testLevel.js`) nascem em volta da
  origem — agora dentro da primeira vila. Provisório até o spawn por
  bioma e distância (060).

### Estradas (`core/town/roads.js`, novo)

- **Ligações**: cada cidade liga à vizinha de leste **ou** de norte (pela
  seed) — numa grade infinita isso forma uma árvore só, então toda cidade
  chega em toda outra — mais `ROADS.EXTRA` de ligações a mais (voltas e
  atalhos).
- **Traçado**: da borda de uma cidade à da outra, sinuoso pela seed
  (`ROADS.WARP`), como uma linha com poucos pontos. Por chunk, só as
  ligações cuja caixa encosta nele.
- **No chão**: força por vértice como as trilhas e as ruas (`ROADS.WIDTH`,
  `ROADS.EDGE`), no mesmo canal (`chunk.trails`, ao lado de `withStreets`):
  a vegetação não nasce e o relevo afunda de leve, como na trilha. Fica
  também à parte (`chunk.roads`): o chão pinta a estrada com uma camada só
  dela (`ROADS.LAYER`, papel `road` em `addColorLayers`) em todo bioma —
  planície e savana não pintam trilha. Some dentro das cidades (da beira
  do disco para dentro), onde as ruas assumem.
- **Água**: onde a estrada cruza rio ou lago, o leito fica raso (o vau,
  no sampler do relevo depois do `carveAt`: sobe até `ROADS.FORD_DEPTH`
  numa faixa de `ROADS.FORD_WIDTH`) — dá para atravessar a pé, e a IA
  navega. Ponte fica para depois (backlog).

### Save

O relevo e a água já são corrigidos ao carregar (`liftAboveGround`, margem
da 057). Novo caso: a posição salva cair dentro de um prédio que agora
existe — vai para o lugar livre mais perto (`freeSpotNear`, voltas cada
vez maiores até `SAVE.FREE_SPOT_REACH`), pelas pegadas dos sólidos em
volta (`footprintsAround` do conjunto de chunks, que sorteia o bloco sem
guardar quando ele não está carregado).

### Debug (F2)

Mostrar a cidade mais próxima, o porte e a distância; os números de
`CITIES` e `ROADS` no painel do mapa, com "Copiar valores".

### Testes (regras, sem números fixos)

- `citySites`: mesma seed, mesmas cidades; a da origem em `(0, 0)` e vila;
  toda cidade dentro da própria célula (pelo `JITTER`) e fora da água;
  `nearestCity` igual à busca exaustiva.
- `roads`: numa janela, toda cidade chega à origem pelas ligações; cada
  cidade tem ao menos uma; o traçado começa e termina nas cidades.
- `biomeMap`: o bioma da cidade vale no centro de toda cidade e some longe
  delas; floresta, planície e savana sem mudança fora dos discos.
- `cityIndex`/`townPlan`: o porte decide os prédios únicos; a origem fica
  numa rua livre.

---

## Etapas

- [x] Doc e roadmap (água para 057, esta como 058, o resto renumerado).
- [x] Bump `package.json` → `0.0.58` (ao começar, depois da 057).
- [x] Decisões com o usuário e revisão do doc (1 a 6 e o escopo).
- [x] Cidades postas pela seed (`citySites`) e o peso delas no mapa de
      biomas (+ testes).
- [x] Porte das cidades e nascer na primeira (+ testes).
- [x] Estradas entre as cidades, com o vau na água (+ testes).
- [x] Save: posição dentro de prédio novo.
- [x] F2: cidade mais próxima e números de `CITIES`/`ROADS`.
- [x] Névoa fechada com as serras do fundo (a bruma e o relevo distante saem).
- [x] Desenho dos objetos do bioma (junto da névoa: tudo inteiro até ela).
- [x] Detalhes levantados na abertura.
- [x] Desempenho na Intel UHD (antes e depois): A/B de produção contra a
      0.0.57, 3 rodadas intercaladas (ABAB) por cena, mesmas coordenadas.
      FPS e GPU no mesmo nível (dentro do ruído); a 058 desenha mais vezes
      por quadro (tudo inteiro até a névoa, mais as serras), sem pesar.

      | Cena | FPS 0.0.57 → 0.0.58 | GPU média (ms) | Desenhos/quadro |
      |---|---|---|---|
      | Origem (vila), parado | 52,8 → 54,7 | 13,4 → 13,2 | 327 → 426 |
      | Mata (-57, -57), parado | 56,5 → 57,7 | 12,8 → 12,5 | 301 → 398 |
      | Origem, andando | 45,1 → 44,5 | 12,6 → 11,9 | 352 → 460 |
- [x] Wiki: página "O mundo".
- [x] Roadmap: 058 para "Já feito".
- [x] Gates: `npm test` inteiro, `npm run lint` e build.

---

## Critérios de Conclusão

- [x] Floresta, planície e savana como no mapa aprovado; uma cidade por
      área, posta pela seed, com porte variado; o jogador nasce dentro da
      primeira.
- [x] Estradas ligando todas as cidades (a pé, inclusive sobre a água).
- [x] O core responde a cidade mais próxima e a distância até ela.
- [x] Névoa sem borda visível do mundo carregado e no tom combinado.
- [x] Objetos do bioma sem pop-in incômodo, na distância combinada.
- [x] Mesma seed, mesmo mapa.
- [x] Desempenho na Intel UHD no nível de hoje (dentro do ruído).
- [x] `npm run build`, `npm run lint` e `npm test` passando.
- [x] Wiki atualizada.

---

## Fora de escopo

- Biomas escondidos (oceano, praia, selva, pântano, deserto, vulcânico,
  tundra e montanha) — depois da beta.
- Água (lagos, rios) — 057.
- Spawn por bioma — 060.
