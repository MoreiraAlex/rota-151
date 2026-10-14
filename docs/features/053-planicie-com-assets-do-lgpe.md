# 🚀 Versão 0.0.53 — Planície com assets do LGPE

## Resumo

Segunda das quatro features da troca de arte (052 a 055): a **planície**
passa a usar só os modelos e as texturas do **Pokémon Let's Go**, em cima
da base que a 052 montou (conversor, material toon, `models` por bioma,
chão em modo textura, colisão pela malha).

A planície é o bioma onde o treinador nasce (a origem da seed cai nela) e
é o campo aberto das rotas de Kanto: árvores redondas em capões, mato alto
de encontro, flores em manchas, tufos e pedrinhas na grama, trilha de
terra batida.

O que entra:

- **Busca dos assets da planície** nos mapas das rotas de campo do LGPE
  (Rotas 1, 2, 3, 5, 22, 24 e 25), além dos que a 052 já empacotou: o
  inventário está em "Inventário do LGPE".
- **Props e texturas novos** no conversor (`scripts/lgpe/pack-lgpe.js`) e
  os cascos de colisão de novo (`scripts/lgpe/colliders.js`).
- **Escolha de modelos no F2 para todo tipo de vegetação** (hoje só a
  grama tem): por bioma e por tipo, marcar os modelos do LGPE da
  categoria certa. É a bancada de ajuste desta feature e das próximas
  (054, 055), já que o laboratório saiu.
- **Planície migrada**: vegetação toda do LGPE (sem MegaKit), chão com
  `ground.colors`, paleta casada com as texturas (o relevo distante) e o
  **mato alto de encontro** (`encounter-grass`) no miolo dos conjuntos.
- Os ajustes do usuário no jogo.

Versão: `0.0.53` (`package.json`). Branch:
`feature/053-planicie-com-assets-do-lgpe`.

> **Os números deste doc são fictícios (só ilustram).** O valor de verdade é
> o do campo citado (config, dado do bioma ou manifesto).

---

## O que já existe (ponto de partida)

- **Planície** (`core/data/biomes/plains/`, 050): folhosa em capões,
  arbusto (com `color` próprio), flores em manchas, pedra (com `moss`),
  seixos na trilha e a grama em conjuntos. Só a grama já é do LGPE
  (`grass-low`, `grass-clump`); o resto é MegaKit. O chão é o antigo
  (paleta + claro e escuro), sem `ground.colors`, e não tem mato alto de
  encontro.
- **Props do LGPE já empacotados** (052): as árvores redondas da Rota 1
  (`round-tree` a `round-tree-d`), a moita redonda, o arbusto e o arbusto
  florido, as flores soltas (brancas, pequenas, amarelas, tapete, da
  mata), o tufo, os trevos, as pedras da floresta, o mato alto e o capim.
- **Texturas de chão empacotadas**: as da floresta e as comuns (`grass01`
  e `grass02_com`, `soil01/08/12/13_com`, `cliff01_com`,
  `roadstone01_com`).
- **F2**: "Texturas do chão" já escolhe a textura de cada área por bioma;
  a grama já escolhe os modelos (`GRASS_MODEL_CHOICES`).

---

## Inventário do LGPE (levantado na abertura)

Fonte: `LGPE-FieldMaps.7z` (`field/area02`, `area03`, `area04` e
`buildmodel`). Nos mapas, cada nó é um tipo de objeto fundido (a 052
separa e fica com o mais comum). Candidatos para a planície:

**Árvores**
- Árvores redondas da Rota 1 — já no jogo (as mesmas se repetem nas
  Rotas 2, 5, 22, 24 e 25).
- `road003_00_tree/tree02_3` (Rota 3) — árvore redonda de outra cor
  (materiais próprios), a mais comum do mapa.
- `road003_00_tree/tree05_1` (Rota 3) — árvore pequena, de moita alta.
- `road003_00_tree/tree01_2` (Rota 3) — redonda média.

**Grama, tufos e manchas** (todas as rotas têm os mesmos sete tipos)
- `grass01` (`grass_s03`) — tufo pequeno, o objeto mais repetido.
- `grass06` — tufo médio.
- `grass05` — monte de grama largo e baixo.
- `grass03`, `grass04`, `grass07` — manchas planas no chão (quase sem
  altura): só se não brigarem com o chão (z-fighting).
- `road003_00_grass_s` (`grass08_1_com`) — o tufo da Rota 3, outra cor.

**Flores**
- `grass02` (`flower01_com`) e `road021_00_flower` — tapetes de flores.
- Soltos ainda não empacotados: `flowers06`, `flowers07` (moita florida
  grande), `flowers09`, `flowers10`, `flowers11`, `flowers13` e a árvore
  de Corte 2 (`iaigiri_tree02`). (`flower05` a `flower08` e `encgrass01`
  que apareciam na lista eram só texturas.)

**Pedras**
- `road001_00_rock` (`rock01_com_grass01_com`) — pedrinha na grama.
- `road022_00_rock02` (`rock01_com_soil09_com`) — pedrinha na terra (a
  trilha).
- `road003_00_rock02_001` (`rock01_com_soil08_com`) — outra da terra.

**Mato de encontro**
- Só os dois que já estão no jogo (`enc_grass01/02`).

**Texturas de chão (área 02)**
- `grass01_area02`, `grass02_area02`, `grass03_area02`,
  `grass03_com`, `grass04_com`, `soil01_area02`, `soil08_area02`,
  `soil09_com`, `soil10_com`, `sand01_com`, `sand02_com`,
  `cliff01_area02`.

> Fora daqui (estruturas, 057): cercas, placas, degraus, casas, postes.

---

## Decisões

1. **Escolha pelo F2.** Sem laboratório: os modelos de cada tipo e as
   texturas do chão são escolhidos no jogo, no F2, e o "Copiar valores"
   leva o `vegetation` e o `ground.colors` do bioma para o código.
2. **Empacotar com folga.** O conversor recebe todos os candidatos do
   inventário (são leves); o que não for usado por nenhum bioma não é
   carregado no jogo (`usedLgpeIds`). Os que sobrarem no fim saem do
   conversor (ou ficam para a 054 e a 055).
3. **Mato alto de encontro na planície**, como na floresta: o
   `encounter-grass` no miolo dos conjuntos de grama.
4. **Sem MegaKit na planície** no fim: todo tipo com `models` do LGPE.
   Os campos do MegaKit (`color` do arbusto, `moss` da pedra) saem da
   planície. O MegaKit continua nos biomas não migrados (savana e
   montanha) até a 055.
5. **Estruturas fora** (cercas, placas, degraus): 057.

---

## Arquitetura (proposta)

### Assets

- `scripts/lgpe/pack-lgpe.js`: os mapas das áreas 02, 03 e 04 entram na
  lista de mapas; `MAP_PROPS`, `LOOSE_PROPS` e `GROUND_TEXTURES` recebem
  os candidatos do inventário. As texturas de chão passam a poder vir de
  outra pasta além da `forest/` (as da área 02).
- `scripts/lgpe/colliders.js` de novo para as árvores e pedras novas.
- Comando de extração no cabeçalho do conversor com as pastas novas.

### Escolha de modelos no F2 (view/tools)

- As opções de cada tipo saem da **categoria** do prop no manifesto (tipo
  de árvore → `tree`, arbusto → `bush`, flor → `flower`, pedra → `rock`
  etc.), no lugar da lista fixa da grama (`GRASS_MODEL_CHOICES` vira um
  caso disso).
- Por bioma e por tipo, uma pasta "Modelos" com uma caixa por prop (pelo
  menos um marcado). Trocar remonta as malhas; árvore e pedra (o core
  sorteia e colide) refazem o terreno ao soltar.
- Carregar os modelos de escolha só com o painel ligado, para não pesar
  no jogo normal (o jogo carrega só os `models` dos biomas).

### Planície (core/data)

- `vegetation`: `models` em todas as entradas; `encounter-grass` novo;
  tipos novos se o inventário pedir (tufo, monte de grama).
- `ground.colors` (base, trilha, margem, encosta) e a paleta pela média
  das texturas escolhidas.
- `GENERATION_VERSION` sobe (o sorteio muda).

### Testes (regras, sem fixar valores)

- Os de sempre da 052 valem para a planície: todo `models` existe no
  manifesto; camadas de cor válidas; origem em terra; mesmo mundo para a
  mesma seed.
- Opções do F2: as opções de um tipo são só props da categoria dele.
- Nenhum tipo da planície cai no MegaKit.

---

## Etapas

- [x] Bump `package.json` → `0.0.53` e doc.
- [x] Inventário dos assets do LGPE para a planície.
- [x] Revisão do doc pelo usuário ("pode seguir").
- [x] Conversor: mapas, props e texturas novos; cascos de colisão.
- [x] F2: escolha de modelos por bioma e tipo (pela categoria).
- [x] Planície: primeira versão com os modelos e texturas do LGPE e o mato
      alto de encontro (+ testes).
- [x] Conferir no jogo (bancada): planície e o "Modelos" do F2 ao vivo.
- [x] Teste no jogo pelo usuário e ajustes (+ grama abrindo ao passar).
- [x] Desempenho na Intel UHD (no fechamento, depois dos ajustes).
- [x] Limpeza: props que nenhum bioma usa e que não servem à 054/055 saem
      do conversor.
- [x] Wiki: página "O mundo" (planície e as plantas abrindo).
- [x] Roadmap: 053 para "Já feito".
- [x] Gates: `npm test` inteiro, `npm run lint` e build.

---

## Como ficou (implementação)

- **Conversor** (`scripts/lgpe/pack-lgpe.js`): mapas das Rotas 3 e 22
  (`area02`, `area03`) além da Rota 1 e da floresta. Props novos:
  árvores redondas da Rota 3 (`round-tree-e`, `round-tree-f`), tufos da
  Rota 1 (`tuft-route`, `tuft-medium`), monte de grama (`grass-mound`),
  pedrinhas na grama e na terra (`rock-grass`, `rock-soil`,
  `rock-soil-b`), flores soltas
  (`flower-6`, `flower-9`, `flower-10`, `flower-11`, `flower-13`), a
  moita florida grande (`flower-bush-b`) e a árvore de Corte 2
  (`cut-tree-b`). Saíram na hora os repetidos (a moita da Rota 3 é a
  mesma da Rota 1; o tufo da Rota 3, o mesmo da Rota 1). As texturas de
  chão vêm por pasta (`GROUND_TEXTURES`), com as da área 02. Os props
  antigos saíram idênticos (só o nome do gerador no `.glb` mudaria; os
  arquivos antigos ficaram). `colliders.js` rodado de novo. Na limpeza
  do fechamento saíram os decalques planos que nenhum bioma usou (mancha
  e faixa de grama, tapete e canteiro de flores — tendem a brigar com o
  chão) e a textura que só eles usavam; os outros sem uso (flores,
  capim, monte de grama, árvore de Corte, pedra de Força) ficam como
  opção do F2 para a 054/055 (o jogo só carrega o que algum bioma usa).
- **Escolha de modelos no F2** (`VegetationPanel.jsx`, `addModelChoices`):
  cada "No bioma" (flores, árvores, sub-bosque, pedras e pedrinhas, mato
  alto no "Let's Go (toon)") mostra a densidade e uma pasta "Modelos" por
  entrada, com os props das categorias que o tipo aceita
  (`LGPE_KIND_CATEGORIES` e `lgpeChoicesOf`, `lgpeModels.js`; a grama
  usa o mesmo, no lugar da lista fixa `GRASS_MODEL_CHOICES`). O painel
  lê o manifesto antes de montar.
- **Carregar só o escolhido** (`lgpeChoices.js`, `LgpeChoiceLoader.jsx`):
  o jogo carrega só os `models` dos biomas; marcar no F2 um modelo ainda
  não carregado pede ele, o `LgpeChoiceLoader` carrega num `<Suspense>`
  próprio e marca pronto, e a vegetação monta com ele já no cache (sem
  parar a cena). Enquanto carrega, o tipo sem modelo não desenha nada
  (`groupByModel` sem modelos).
- **Camadas de cor do chão**: o limite subiu de dois para três `vec4` por
  vértice (`MAX_COLOR_LAYERS`, `groundColors2`) — as oito já estavam
  ocupadas. Camadas novas das rotas: grama (`lgpe-route-grass`), terra
  clara da trilha (`lgpe-trail-soil`) e areia (`lgpe-sand`). Sobra uma
  vaga para a 054/055.
- **Planície** (`core/data/biomes/plains/`): todo tipo com `models` do
  LGPE — árvores redondas da Rota 1 e da Rota 3, moita redonda, arbusto
  e moita florida, tufos da Rota 1 (`leafy-plant` novo na planície),
  flores soltas, pedra com trevo e pedrinha na grama, o mato alto de
  encontro e a grama de antes. Saíram o `color` do arbusto e o `moss` da
  pedra (MegaKit). `GENERATION_VERSION` subiu.
  - **Ajustes do usuário** (F2): bem mais mato alto, menos flores e
    pedras, **sem trilhas** e o chão todo na grama do LGPE
    (`ground.colors` só com `base`; as camadas novas das rotas ficaram
    sem uso, para a 054/055). A entrada de pedrinhas (`pebble`, que
    nasce na trilha) ficou sem efeito. No fechamento, a paleta (relevo
    distante) passou a ser a média dessa grama em todos os papéis, com
    a encosta um verde um pouco mais escuro.
- **Grama abrindo ao passar** (pedido do usuário, `grassPush.js`,
  `GAME_CONFIG.GRASS_PUSH`): o mato, os tufos e as flores do LGPE
  (`push` no toon, categorias `tall-grass`, `tuft` e `flower`) dobram
  para longe do treinador e das criaturas mais perto da câmera, no mesmo
  arco da dobra do vento, com um tremor leve pela velocidade de quem
  passa; pulando, para de empurrar. A primeira versão (pela posição de
  agora, com um rastro atrás) ficou seca e voltava na hora ao sair do
  mato; virou um **mapa do empurrão** em volta da câmera, atualizado na
  placa de vídeo a cada quadro: a grama tocada deita aos poucos
  (`ATTACK`) e a solta levanta devagar (`RECOVERY`), lembrando por onde
  passaram. Painel F2: Grama → "Abrir ao passar" (ao vivo).
  O primeiro toque ainda dava um tranco (o usuário notou que só o
  primeiro contato era estranho): a aproximação exponencial é mais rápida
  no começo, quando a grama está de pé (a maior distância até o alvo);
  nos toques seguintes a grama ainda estava meio deitada e a diferença
  era pequena. Virou uma **mola amortecida sem quicar** (a velocidade
  fica no mapa): parte parada, acelera e assenta, tanto ao deitar quanto
  ao voltar; o tremor sai da velocidade da mola (as folhas tremem
  enquanto se mexem). Medido na bancada num ponto de grama intocada no
  caminho do treinador: a força sobe em curva suave a partir do zero e,
  depois que ele passa, desce aos poucos ao longo de um segundo e pouco.
  Depois, a pedido do usuário, **todas as plantas** passaram a abrir
  (árvores não): no LGPE, toda categoria que dobra como planta
  (`lgpePushOf` — arbustos e plantas largas com uma parte da dobra,
  `GRASS_PUSH.BUSH`, por serem mais altos); no MegaKit (savana e
  montanha, até a 054/055), as samambaias, plantas e flores (`foliage`).
  O pedaço de shader ficou em `grassPush.js` (`GRASS_PUSH_SHADER`),
  incluído pelo toon e pela folhagem do MegaKit. Os arbustos do MegaKit
  usam o material da copa das árvores e ficaram só no vento (saem com o
  MegaKit). Conferido na bancada: todos os programas compilam.
- **Testes**: todo `models` dos biomas é de uma categoria que o tipo
  aceita; as opções do painel de cada tipo são só das categorias dele;
  bioma com chão do LGPE não usa MegaKit em nenhum tipo; os pesos de cor
  nos três atributos somam a parte com textura.
- **Conferido no jogo** (bancada, meio-dia, na origem): chão, trilha com
  pedrinhas, mato alto, moitas, flores e as árvores redondas; no F2,
  marcar "Flores 10" na planície pôs as flores novas na hora, sem a cena
  piscar. Sem erro novo no console.
- **Desempenho** (bancada na Intel UHD, fechamento): produção da 0.0.52
  (o commit anterior) contra a 053, intercaladas em três rodadas, 1920 ×
  1080, meio-dia, na origem (planície, dentro do mato). Medido (não
  fictício), em proporção: as duas no teto de 60 FPS; a 053 desenha
  cerca de 5% menos e com cerca de 8% menos triângulos, mas a cena custa
  cerca de **um quarto a mais de tempo de GPU** por quadro. Para separar
  a causa, uma terceira versão (a 053 sem o empurrão nos shaders) contra
  a 053: iguais dentro do ruído, e o mapa do empurrão custa uma fração
  pequena de milissegundo. O custo vem da planície nova — o mato alto
  do Let's Go bem denso dos ajustes (folhas recortadas umas sobre as
  outras). Fica anotado no 086 (desempenho no celular, Marco 5).

---

## Critérios de Conclusão

- [x] A planície usa só modelos e texturas do LGPE.
- [x] Mato alto de encontro no miolo dos conjuntos de grama da planície.
- [x] Floresta igual; savana e montanha como estavam — menos as plantas,
      que em todos os biomas abrem ao passar (pedido do usuário).
- [x] Mesmo mundo para a mesma seed; árvores e pedras colidem (pela malha).
- [ ] Desempenho na Intel UHD na planície no nível de hoje ou melhor —
      **em parte**: FPS igual (teto de 60), mas cerca de um quarto a mais
      de GPU pela grama densa dos ajustes (ver "Desempenho"; anotado no
      086).
- [x] `npm run build`, `npm run lint` e `npm test` passando.
- [x] Wiki atualizada.

---

## Fora de escopo

- **Savana e montanha** — 054 e 055.
- **Cercas, placas, degraus e casas** das rotas — estruturas (057).
- **Água das rotas** (lagos, margem) — 060.
- **Remover o MegaKit do jogo** — depois da 055 (junto da 081).
