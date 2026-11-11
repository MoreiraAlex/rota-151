# 🚀 Versão 0.0.66 — Revisão dos biomas

## Resumo

Os biomas visíveis da beta (**floresta**, **planície**, **savana** e
**cidade**) já foram montados um a um (047, 049–058) e trocados para os
modelos do Pokémon Let's Go (052–054), mas o conjunto ainda não combina — sem
um motivo claro. Esta feature começa por um **diagnóstico**, bioma a bioma,
comparando o jogo com referências dos jogos atuais de Pokémon, e só depois
ajusta.

Ordem: **floresta** primeiro, depois planície, savana e cidade.

| Parte | O quê | Estado |
|---|---|---|
| 1 — Floresta: referências e diagnóstico | Imagens de referência da floresta nos jogos atuais; comparação com o jogo; lista do que não combina | feita |
| 2 — Floresta: bosque aberto | Levantamento das árvores do Let's Go; primeira versão do bosque no jeito do Scarlet/Violet, só com dados do bioma, para o usuário ajustar no F2 | substituída pelo lab (Partes 3 a 8) |
| 3 — Laboratório de biomas | Página `/tools/lab-bioma` com o motor do jogo num ponto fixo: assets, luz e sombra, cor e atmosfera e distribuição ao vivo, com a referência ao lado | feita |
| 4 — Grama em fios | Pelas referências do usuário: tapete de grama em lâminas finas gerado por código, chão verde-escuro por baixo, no lab | feita (levada para o jogo na Parte 8) |
| 5 — Árvores com tronco | Árvores, arbustos e pedras da Quaternius (Ultimate Stylized Nature e MegaKit) com tronco à vista e copa alta, recoloridas, no lab | feita (levada para o jogo na Parte 8) |
| 6 — Platôs com barranco e rampa | Leves montanhas sem pico, em patamares com barranco de textura própria e rampas até o topo, no lab | feita (levada para o jogo na Parte 8) |
| 7 — Montanhas com caminho até o topo | Algumas montanhas maiores, soltas pela seed, no mesmo jeito de patamar e barranco, com um caminho que dá a volta até o topo, no lab | feita (levada para o jogo na Parte 8) |
| 8 — Floresta do lab no jogo | Grama em fios, árvores dos pacotes, platôs e montanhas levados para os dados da floresta e o config, para o usuário testar no jogo | feita |
| 9 — Desempenho sem a grama | Medição na GPU (lab e jogo, com o time em campo) do que pesa com a grama escondida, e a lista de itens para tratar um a um; menu "Gráficos" | feita (os 5 itens; a grama de volta na Parte 10) |
| 10 — Grama em manchas | A grama de volta no jogo, na floresta em manchas de mato fechadas (como nos jogos clássicos) em vez do tapete, e o tufo com menos lâminas, medido no jogo | feita |
| 11 — Últimos ajustes da floresta | Base de árvores e pedras enterrada no barranco, modelo próprio das árvores gigantes, o aviso de golpe por cima da grama, a silhueta através das plantas e o passo na grama | feita |
| 12 — Planície | Revisão visual da planície isolada (só ela no mundo, grama escondida), com as árvores, os ressaltos e a grama em fios no estilo da floresta; o desempenho no fim | feita |
| 13 — Savana | A mesma revisão da planície na savana isolada: árvores dos pacotes, ressaltos e grama em fios; o desempenho no fim | feita |

Versão: `0.0.66` (`package.json`). Branch: `feature/066-revisao-dos-biomas`.

> **Os números deste doc são fictícios (só ilustram).** O valor de verdade é
> o do campo citado (config ou dado do bioma).

---

## O que já existe (ponto de partida)

- **Dados do bioma** (`core/data/biomes/<id>/index.js`): clima, relevo,
  água, paleta do relevo distante, chão (`ground`: texturas e cores do Let's
  Go), trilhas, clareiras e vegetação em camadas (`vegetation`, por `kind`,
  `place`, `density`, `patches`, `models`).
- **Floresta** (049, 052): mata fechada com clareiras; árvores redondas
  grandes, redondas comuns, bosques de pinheiros de Viridian e árvores
  jovens; por baixo, samambaias, moitas, trevos e tufos; flores e mato alto
  nas clareiras; trilhas de terra.
- **Luz, névoa e ciclo do dia** (048, `DAY_CYCLE`, `FOG`): afinados antes da
  troca para os modelos do Let's Go.
- **Ajuste do conjunto** (058): tamanho e distribuição dos biomas, névoa,
  distância de desenho e LOD.
- **Painel F2**: bioma atual, parâmetros de cada bioma, modelos por tipo,
  texturas do chão e "Copiar valores".

### Primeiros suspeitos (a confirmar no diagnóstico)

- Luz, névoa e cores do ciclo do dia ainda da época do BotW.
- Cor e textura do chão em relação à vegetação.
- Transição entre biomas e tamanho das manchas.
- Escala e densidade dos objetos perto do treinador e dos Pokémon.

---

## Parte 1 — Floresta: referências e diagnóstico

### Objetivos

- Juntar imagens de referência da floresta nos jogos atuais de Pokémon.
- Comparar com a floresta do jogo na mesma hora e clima.
- Fechar com o usuário a lista do que não combina, antes de mexer.

### Etapas

- [x] Galeria de referências da floresta: capturas do Let's Go (Floresta de
      Viridian, Rotas 1 e 2), Sword/Shield (Slumbering Weald, Glimwood
      Tangle, Forest of Focus), BDSP (Floresta de Eterna) e Scarlet/Violet
      (Tagtree Thicket, Timeless Woods, Província Oeste), tiradas do Serebii
      Pokéarth. O Legends: Arceus ficou de fora (sem captura disponível).
- [x] Capturas da floresta do jogo para comparar.
- [x] Lista do que não combina (com o usuário): a referência passa a ser o
      Scarlet/Violet e Kitakami (ver Decisões).

### O que não combinava na floresta

- Árvores redondas e pinheiros misturados ao acaso, sem bosque definido.
- Sub-bosque escuro (samambaias, moitas) cobrindo quase todo o chão.
- Chão verde amarelado claro por baixo de copas verde-azuladas escuras.

---

## Parte 2 — Floresta: bosque aberto

### Objetivos

- Saber que árvores o Let's Go tem além das que já usamos.
- Primeira versão da floresta como bosque aberto, só mexendo nos dados do
  bioma, para o usuário ajustar no F2.

### Levantamento das árvores do Let's Go

- **Mapas de campo** (`LGPE-FieldMaps.7z`, `area01`–`area09`, `forest`,
  `safari`): Kanto inteira usa os mesmos poucos tipos de árvore, e todos
  já estão no jogo — as redondas (`tree19`/`tree20`: `round-tree`,
  `round-tree-b`, `round-tree-f`), os pinheiros das rotas
  (`tree21`/`tree22`: `round-tree-c`, `round-tree-d`, `round-tree-e`,
  que apesar do nome são pinheiros), o pinheiro de Viridian (`tree08`),
  o tronco alto e a árvore jovem da Floresta de Viridian. De fora ficaram
  só cercas-vivas e moitas de cidade (`tree05`–`tree07`).
- **Cenário de batalha da floresta** (`LGPE-BattleMaps.7z`,
  `btl_N_wood`): o único lugar com árvore nova — uma folhosa grande, com
  tronco grosso, galhos e copa alta (`tree_set`, várias juntas). A copa é
  feita de camadas horizontais de folhas (feita para a câmera fixa da
  batalha): cheia de cima, com as camadas aparecendo de lado. Tem também
  cartões de árvore para o fundo, feixes de sol, sub-bosque e uma textura
  de grama alta em fios soltos. O tronco usa um shader de batalha
  (`FieldBattleShader01`, com mapa de luz) que o jogo ainda não lê.

### O que mudou (`core/data/biomes/forest/`)

- Mais clareira (`clearings.amount`): o bosque é aberto e a mata fechada
  vira mancha.
- Árvores: as grandes por cima passam a ser folhosas (eram pinheiros de
  rota); as folhosas comuns sem o pinheiro de rota no meio e com a árvore
  jovem misturada; bosques de pinheiro de Viridian mais raros; a árvore
  jovem nasce também fora da sombra.
- Sub-bosque (moitas, samambaias, trevos) bem mais ralo, só em manchas.
- Grama alta em manchas maiores, cobrindo mais o chão, com menos
  preferência pelas clareiras.

### Diagnóstico: por que não parece o Scarlet/Violet

Comparado com câmera baixa, como a do Scarlet/Violet (o padrão do jogo é
mais alto e mais longe), o que separa não é só a organização:

- **Traço dos modelos**: o mundo é do Let's Go (desenho, folha grande,
  grama em folhas largas), mas o treinador e a maior parte dos Pokémon vêm
  do Legends: Z-A (`docs/features/059-as-10-especies.md`), do mesmo jeito
  moderno do Scarlet/Violet. Personagem moderno em cenário de desenho.
- **Cor**: o Let's Go é claro e saturado (verde-limão, chão amarelado); o
  Scarlet/Violet é verde-oliva, mais escuro e menos saturado.
- **Luz**: o toon do Let's Go tem ambiente forte e sombra clara; no
  Scarlet/Violet a sombra é escura e a base da grama e o chão sob as
  árvores escurecem.
- **Grama e chão**: fios finos e densos e chão com textura (musgo, terra)
  no Scarlet/Violet; folhas largas e chão liso no nosso.

Teste ao vivo (sem mexer nos arquivos): tinta mais fria nas árvores, luz
mais suave, céu neutro e um filtro de cor na tela chegam mais perto no tom,
mas o traço continua o do Let's Go.

### Etapas

- [x] Levantamento das árvores (mapas de campo e cenários de batalha).
- [x] Primeira versão do bosque aberto (dados da floresta).
- [ ] Ajuste do usuário no F2 — trocado pelo lab (Parte 3).
- [ ] Decidir se a folhosa da batalha entra (empacotar, ler o tronco,
      colisor) — no lab.
- [ ] Cor e luz da floresta (grama e copas não casam) — no lab.

---

## Parte 3 — Laboratório de biomas

Ferramenta, não faz parte do jogo (como os labs de golpes, alcance,
animação, corpo e luz). Serve para decidir o visual dos biomas olhando, em
vez de ir e voltar por capturas.

### Parte 11 — Últimos ajustes da floresta

### Base no barranco

Árvores e pedras num barranco ficavam com parte da base no ar: a altura
era a do chão no centro. Agora é a do chão mais baixo debaixo da base — o
centro e uma volta de pontos na largura da pegada do modelo
(`solidFootprintOf` × `SOLID_GROUND.REACH`) — afundada `SOLID_GROUND.SINK`
(`groundedBaseY`, `solidPlacement.js`). O colisor acompanha (sai do mesmo
`y`).

### Árvores gigantes com modelo próprio

As gigantes usavam as mesmas CommonTree das árvores grandes, só maiores. O
usuário pediu árvores com cara de muito antigas, cheias de galhos, no mesmo
estilo. Nenhum modelo pronto dos pacotes é assim (as TwistedTree só têm o
tronco torto); as árvores secas (`DeadTree`) têm o esqueleto de galhos.
`scripts/lab/compor-arvore-gigante.py` (Blender) junta os galhos de uma
árvore seca, com o pé do tronco engrossado, a tufos das folhas da
NormalTree nas pontas dos galhos. As folhas viram as do Let's Go no jogo,
como nas outras árvores dos pacotes (material com "leaves" no nome).

Ficaram três, de copa larga (`usn-gianttree-4`, `-8`, `-mk1`); uma
estreita, de longe parecida com um pirulito, saiu. Levadas para o jogo
(`levar-pacotes-para-o-jogo.js`) com os colisores refeitos. A árvore
grande solta (`ancient-tree`) segue com as CommonTree e TwistedTree.

### Aviso de golpe por cima da grama

O aviso (o leque no chão, `AttackTelegraphView`) sumia atrás da grama e dos
arbustos. O pedido: o aviso por cima de tudo que o golpe não colide.

- **Profundidade puxada** (`view/materials/overPlants.js`): no vertex
  shader, a profundidade do aviso vai para a câmera o bastante para passar
  à frente de uma camada de plantas de `OVER_PLANTS.HEIGHT` m (a altura
  dividida pelo seno do ângulo da câmera com o chão). O lugar na tela não
  muda; pedra e tronco mais altos que a camada continuam tampando.
- **Personagens por cima** (`view/materials/characterStencil.js`): as
  criaturas e o treinador (material toon e contorno) marcam o stencil, e o
  aviso não desenha onde há personagem — um Weedle dentro do aviso continua
  à vista. Stencil ligado no canvas (`GameCanvas`) e no alvo do
  pós-processamento.
- Só o aviso de golpe; o indicador de mira segue como estava.

Conferido no jogo: com um aviso de teste dentro de uma mancha de grama, a
grama tampava a borda do aviso; com o ajuste, o aviso inteiro aparece por
cima dela, e o treinador em cima dele continua por cima do aviso. Sem erro
de shader.

### Ver o alvo dentro da grama

Em batalha dentro da grama, Weedle e Caterpie (pequenos) sumiam. Das três
sugestões (a grama abrir em volta, um anel no chão sob o alvo, a silhueta
através da grama), o usuário escolheu ver primeiro a primeira; se não
gostar, a silhueta.

Primeiro testada a grama abrindo mais em volta de quem está em batalha (a
clareira do empurrão maior, com um mínimo para as pequenas): o usuário
preferiu a silhueta, e a clareira de batalha saiu.

**Silhueta através das plantas** (`createSilhouette` em
`view/materials/toonMaterial.js`, `RENDER.SILHOUETTE`): cada corpo
(criaturas e treinador) ganha, junto com o contorno, uma cópia numa cor
chapada e meio transparente — azul (a do anel do seu time) para o
treinador e o time, laranja para as selvagens — que só desenha onde o
corpo está atrás do que já foi desenhado e onde quem está na frente é
planta. Quem está na frente vem do stencil
(`view/materials/characterStencil.js`): grama, arbustos e flores (o toon
das plantas) marcam planta; o chão, as árvores, as pedras e os prédios
apagam a marca; os personagens marcam a deles. Atrás de grama e arbusto, a
forma aparece; atrás de chão, tronco, pedra ou prédio, não. A silhueta
desenha uma vez por pixel (sem somar a transparência onde partes do corpo
se cruzam). Conta como contorno para quem percorre o modelo (texturas,
flash de dano, vulto).

Quando aparece (`view/materials/silhouetteVisibility.js`, pedidos do
usuário depois de ver no jogo):

- **A do seu lado sempre** (treinador e time, inclusive quem está no
  controle).
- **A das selvagens só com o nameplate à mostra**: o nameplate avisa a
  cada quadro se está aparecendo (`NameplateView`); longe, na névoa ou
  dentro da Pokébola, sem silhueta.
- **A das selvagens some à noite** (`RENDER.SILHOUETTE.WILD_AT_NIGHT`):
  de noite elas não se destacam de longe — batalha e captura mais
  difíceis. A do treinador e do time continua. Quem aplica é quem lê o
  relógio (`DayNightView`, fase `night` de `dayPhaseOf`).

### Passo na grama (pedido do usuário)

O passo do treinador e das criaturas era o mesmo em todo chão (o de
concreto da biblioteca de passos). Agora, como no raso da água, o chão de
grama troca o som:

- **Onde é grama** (`core/terrain/groundSurface.js`, `groundSurfaceAt`;
  `levelGroundSurfaceAt` com o relevo do jogo): dentro das manchas de
  grama — a mesma conta que decide onde a grama nasce (conjuntos,
  clareiras, trilhas), a parte dela no ponto a partir de
  `GROUND_SURFACE.GRASS` —, fora de encosta íngreme e com a grama à
  mostra. Entre as manchas, na trilha e fora dos chunks carregados, chão.
  (A primeira versão tocava a grama no bioma inteiro; o usuário pediu só
  nas manchas.)
- **Quem troca**: os grupos de passo de quem pisa (`grass` em
  `footstepGroups.js`: o treinador e as criaturas de passo leve); quem
  rasteja ou voa fica com o próprio som. No volume do passo da espécie.
- **O som** (`GRASS_SOUNDS`, `public/assets/audio/footsteps/grass/`): a
  biblioteca de passos do depósito não tem grama — por ora, o passo em
  terra dela, com a intensidade igualada à do passo do treinador
  (`scripts/audio/passos-na-grama.sh`). Trocar por um som de grama de
  verdade é só apontar o script para outros arquivos.

Conferido no jogo: no ponto da floresta o chão sai como grama, os sons
carregam e andar não dá erro.

### Etapas

- [x] Base de árvores e pedras no chão mais baixo debaixo dela (com
      teste).
- [x] Árvores gigantes com modelo próprio (galhos de árvore seca + folhas).
- [x] Aviso de golpe por cima da grama e dos arbustos, sem cobrir os
      personagens (com teste).
- [x] Ver o alvo dentro da grama: silhueta através das plantas (com
      teste); a grama abrindo em batalha foi testada e saiu.
- [x] Passo na grama (com teste) — som provisório (terra), a trocar por um
      de grama.
- [ ] O usuário testar no jogo.

---

## Decisões (com o usuário)

1. **Motor do jogo**: o lab monta a mesma cena do jogo (`GameScene`:
   terreno, vegetação, água, céu, luz, névoa) num ponto fixo do mundo. O
   que se ajusta ali vale direto no jogo ("Copiar valores").
2. **Ao vivo**: conjunto de assets, luz e sombra, cor e atmosfera e
   distribuição.
3. **Referência lado a lado**: uma imagem de referência ao lado da cena,
   com câmeras prontas.

### Como funciona

- **Página** `/tools/lab-bioma` (`src/app/tools/lab-bioma/`, código em
  `src/tools/biomeLab/`). Sem login nem save: o treinador nasce no ponto
  escolhido, sem time, sem HUD do jogo, e o save nunca grava.
- **Ponto e hora**: lista de pontos por bioma (floresta, planície, savana,
  cidade), achados pela seed (o primeiro ponto de cada bioma perto da
  origem); hora do dia e clima fixos por controle; selvagens ligáveis
  (desligadas por padrão, para a cena ficar parada).
- **Câmeras prontas**: "baixa" (perto do ombro, como no Scarlet/Violet),
  "alta" (como no Let's Go) e a do jogo; e uma volta lenta em torno do
  treinador para ver o bosque de todos os lados.
- **Referência**: painel ao lado da cena (a tela se divide em duas). A
  imagem entra arrastando um arquivo ou colando; as últimas ficam salvas
  no navegador (não vão para o repositório). Botão "Capturar" baixa a
  cena em PNG no mesmo tamanho, para guardar o antes e o depois.
- **Painéis**:
  - os que o F2 já tem, reaproveitados: vegetação (densidade, manchas,
    tinta e modelo por tipo, grama em conjuntos), terreno, dia e clima,
    câmera;
  - **Luz e sombra** (novo): força e cor do sol e da luz ambiente por cima
    do ciclo do dia; cor e força da sombra; material toon do Let's Go ou
    comum (com luz de verdade) por tipo de objeto; escurecer a base da
    grama e o chão debaixo das árvores;
  - **Cor e atmosfera** (novo): uma etapa de correção de cor no fim da
    imagem (saturação, contraste, claros, escuros e tom), além da curva de
    cor que já existe; névoa e bruma do horizonte; cor do céu;
  - **Assets** (novo): além dos modelos do Let's Go, pacotes de fora (FBX
    ou GLB, ex.: do Fab) convertidos por um script para uma pasta do lab,
    com o material comum; cada tipo (árvore, grama, arbusto, pedra) escolhe
    os modelos de qualquer pacote. A folhosa da batalha do Let's Go entra
    como o primeiro desses.
  - "Copiar valores" de tudo que mudou, no formato do config e dos dados
    do bioma.

### O que ficou (código)

- **Página** `src/app/tools/lab-bioma/` e `src/tools/biomeLab/`:
  - `BiomeLab.jsx`: sobe a física e os assets, registra os pacotes de fora,
    acha os pontos e monta a cena do jogo (`GameScene` + `GameLoop`) com o
    save do lab (`labSave.js`: o treinador no ponto, migrado da primeira
    versão do formato, nunca grava). Relógio parado, tempo limpo, sem
    selvagens. Três colunas: painel, cena e referência (empilham em tela
    estreita). F2 liga os painéis de ajuste do jogo.
  - `labPoints.js`: o primeiro ponto de cada bioma (floresta, planície,
    savana, cidade) em anéis em volta da origem, em terra e com o bioma em
    volta.
  - `labWorld.js`: levar o treinador a um ponto sem recarregar (os ajustes
    não se perdem), câmeras prontas e a volta em torno; `BiomeLabRig.jsx`
    gira a câmera e põe o começo da névoa ao vivo.
  - `ReferencePane.jsx` + `labReferences.js`: a referência numa caixa 16:9
    do tamanho da cena; arrastar, colar ou abrir; as últimas guardadas no
    navegador (IndexedDB).
  - `BiomeLabPanel.jsx`: cena (ponto, hora, clima, selvagens), câmera
    (prontas, volta, "Capturar"), luz e sombra, cor e atmosfera, pacotes
    carregados e "Copiar valores" (`labValues.js`: tudo que mudou no
    `GAME_CONFIG` e nos biomas desde que o lab abriu, do lab e do F2).
- **No jogo** (neutro por padrão, nada muda no jogo como está):
  - `DAY_CYCLE.ADJUST` (`DayNightView.jsx`): força do sol, da luz ambiente
    e escuro da sombra por cima das horas marcadas.
  - `RENDER.GRADE` (`view/scene/colorGrade.js`, etapa no
    pós-processamento de `RenderSettingsView.jsx`): saturação, contraste,
    exposição, gama e temperatura; neutra, a etapa nem monta.
  - `LGPE.BASE_SHADE` e `BASE_SHADE_HEIGHT` (`toonMaterial.js`): a base das
    plantas mais escura.
  - `WILD_SPAWN.ENABLED`: o spawn de selvagens desligável.
  - Pacotes de fora na vegetação (`lgpeModels.js`:
    `registerExtraLgpePack`, `mergeLgpeManifests`, cada prop e textura com
    a pasta dele): o lab registra, o jogo não; o F2 e a vegetação veem os
    modelos deles como do LGPE. O tronco das árvores de batalha
    (`Ground00Tex01`) passou a ser lido como cor.
- **Scripts** (`scripts/lab/`, ver o README de lá): `pack-lab.py` (Blender:
  FBX, GLB/glTF e OBJ → pacote, com a altura pedida e as texturas achadas
  pelo nome), `register-pack.js` (a lista `public/assets/lab/packs.json`)
  e `lgpe-batalha.json` (a folhosa do cenário de batalha, pelo
  `pack-lgpe.js` com `--only-extra`, `--prefix` e `scale` por objeto).
  `public/assets/lab/` fica fora do git.

### Mudança depois de usar

- **Sem a referência ao lado** (pedido do usuário, que não usava): saíram
  `ReferencePane.jsx` e `labReferences.js`; a cena ocupa toda a tela ao
  lado do painel.

### Diferenças do plano

- **Toon ou comum por tipo**: não virou uma troca por tipo de objeto. A luz
  contínua sai do degrau e da suavidade do toon (suavidade no máximo = luz
  sem degrau), para tudo de uma vez.
- **Escurecer debaixo das árvores**: ficou só o escuro da sombra do sol
  (que já cai debaixo das copas); o chão não escurece por conta própria.

### Etapas

- [x] Página e cena: motor do jogo num ponto fixo, sem save, pontos por
      bioma, hora e clima fixos, selvagens ligáveis.
- [x] Câmeras prontas, volta em torno e "Capturar".
- [x] Referência lado a lado (arrastar, colar, guardar no navegador).
- [x] Painéis do F2 no lab.
- [x] Cor e atmosfera: etapa de correção de cor no fim da imagem;
      névoa (o céu fica pela correção de cor e pelo F2 "Dia e clima").
- [x] Luz e sombra: ajustes por cima do ciclo do dia; sombra; degrau do
      toon; escurecer a base das plantas.
- [x] Assets de fora: script de conversão para a pasta do lab, escolha
      por tipo no F2; a folhosa da batalha e duas árvores do MegaKit como
      pacotes de exemplo.
- [x] "Copiar valores".
- [ ] O usuário usar o lab na floresta e decidir o visual.

### Testes (regras, sem fixar valores)

- Os pontos por bioma caem mesmo no bioma pedido (pela seed atual).
- A correção de cor neutra não muda a imagem (identidade).
- O manifesto de um pacote de fora traz tudo que o jogo lê de um modelo
  (a mesma régua passa em todos os do LGPE) e aparece nas escolhas do
  tipo certo.
- O save do lab sai válido, na versão atual, no ponto e na hora pedidos.
- "Copiar valores" só leva o que mudou e no formato que o config aceita.

### Critérios de conclusão

- Abrir o lab, escolher a floresta, pôr uma referência do Scarlet/Violet
  ao lado e mexer em luz, cor, distribuição e modelos vendo o resultado na
  hora.
- Trazer um pacote de fora para o lab sem mexer no jogo.
- Levar o que ficou bom para o jogo pelos valores copiados.

---

## Parte 4 — Grama em fios

### Diagnóstico pelas referências do usuário

O usuário não sabia dizer o que estava errado; mandou quatro imagens (duas
do Scarlet/Violet — Kitakami e Paldea — e duas de um jogo de fã na Unreal).
O que as quatro têm e a floresta não tinha, do mais ao menos importante:

1. **Grama em fios finos cobrindo o chão** — tapete contínuo de lâminas,
   escuro na base e claro na ponta; o chão quase não aparece. A nossa era
   de folha larga em tufos, com o chão claro entre eles.
2. **Árvores com tronco à vista e copa alta** (acima da cabeça), dando
   para ver por baixo até o horizonte. As nossas são bolas de copa baixa.
3. **Volume pela luz** — base da grama escura, sombra escura e suave.
4. Apoio: arbustos redondos e escuros, pedras grandes, trilha de terra.

A cor em si não era o problema: a referência de Paldea é tão saturada e
clara quanto a nossa.

### O que ficou

- **`view/vegetation/bladeGrass.js`**: o tufo de lâminas gerado por código
  (`GRASS_BLADES`: lâminas, largura do tufo, altura, largura e curva da
  lâmina, tom da raiz e da ponta), registrado como o modelo `blade-grass`
  (categoria `tall-grass`) no manifesto (`withProceduralProps`) — o bioma
  escolhe nos `models` da grama, o F2 lista. Mesmo material toon das
  plantas: o tufo vira de frente para a câmera, normais para cima (a luz
  do chão), vento, abrir ao passar e base escura. Cor base ao vivo
  (`applyToonLook`); a forma, ao refazer (`refazerGramaEmFios`).
- **Distância** (`GRASS_BLADES.FADE_START`/`FADE_END`): a grama em fios
  encolhe até sumir (no shader) e o bloco de grama além do fim nem é
  desenhado (`VegetationView`, `MeshesOf`). Longe, o chão faz o papel dela.
- **Deitar para a câmera** (`GRASS_BLADES.TILT`, pedido do usuário: de
  cima a grama virava pontinhos): o tufo, já de frente para a câmera,
  deita para trás conforme ela sobe (a fração do ângulo dela) — de cima as
  lâminas aparecem inteiras; o vento e o abrir ao passar somam depois,
  iguais; a base escura conta pela altura antes de deitar.
- **Tom e brilho do chão** (`TERRAIN_LOOK.TINT`, `TINT_AMOUNT`,
  `BRIGHTNESS`, neutros por padrão; `TerrainView` aplica ao vivo).
- **No lab**, pasta "Grama em fios": usar no bioma do ponto, voltar à do
  Let's Go, mato alto do Let's Go liga e desliga, a forma do tufo, a cor,
  tufos por m², o tapete entre as manchas e o botão "Tapete do
  Scarlet/Violet (tudo)", que aplica o primeiro acerto de uma vez (grama em
  fios, tapete, sem o mato alto, chão verde-escuro e base escura).

### Custo (a medir)

Com o tapete, a grama em fios perto da câmera passa de alguns milhões de
triângulos. A medida de verdade (tempo de GPU na Intel UHD) fica para
quando o visual estiver escolhido; os controles do custo são os tufos por
m², as lâminas por tufo e a distância em que ela some.

### Etapas

- [x] Tufo de lâminas por código, no material toon, como modelo da grama.
- [x] Corte pela distância (shader e bloco).
- [x] Tom e brilho do chão.
- [x] Controles e o acerto de uma vez no lab.
- [x] O usuário aprovar o visual da grama.
- [ ] Medir o custo na GPU e ajustar.
- [ ] Refinar a grama vista de cima: o deitar para a câmera ajudou, mas
      o usuário ainda acha estranho.
- [ ] Renderização da grama distante: longe, a grama em fios encolhe e
      some, e o chão sozinho faz o papel dela — refinar essa passagem.
- [ ] Levar para o jogo (dados da floresta) quando aprovado.

---

## Parte 5 — Árvores com tronco

### Onde achar

O Let's Go não tem árvore com tronco à vista e copa alta (Parte 2). No
depósito pessoal, os pacotes da Quaternius têm, em FBX:
- **Ultimate Stylized Nature** (`usn`): NormalTree (copa larga e aberta
  sobre tronco fino, a mais parecida com as de Paldea), MapleTree (formas
  boas, folhas de outono), BirchTree (amarelas, tronco branco — fora),
  arbustos e pedras;
- **MegaKit** (`megakit`): CommonTree (tronco grosso, copa cheia),
  TwistedTree (tronco torcido, folhas vermelhas), arbustos e pedras.

### O que ficou

- **`scripts/lab/pack-lab.py`**: material sem textura ligada usa a imagem
  com o nome dele (os FBX do Ultimate não ligam); `--recolor` puxa a
  textura de alguns materiais para uma cor mantendo o claro e escuro —
  folhas de outono verdes e a casca avermelhada marrom, sem pintar o
  modelo inteiro (a tinta do bioma pinta tudo). As texturas dos pacotes
  dizem `flipY: false` no manifesto (o glTF já vem com o UV certo; as do
  LGPE viram) e `prepareLgpeTexture` respeita.
- **`scripts/lab/pack-natureza.sh`**: refaz os dois pacotes a partir dos
  zips (árvores com 8 m, arbustos e pedras), com as recolorações.
- **No lab**, pasta "Árvores": "Árvores dos pacotes (tudo)" troca, no
  bioma do ponto, as folhosas (NormalTree, MapleTree e CommonTree), as
  árvores grandes (MapleTree e TwistedTree maiores), tira os pinheiros e as
  árvores jovens do Let's Go e troca arbustos e pedras; "Voltar às do Let's
  Go" desfaz.

### Segunda volta: bosques e variedade

O usuário achou a tela poluída e tudo igual: nas referências há várias
árvores, mas juntas em bosques, com campo aberto entre eles, e pouca pedra.
O botão "Árvores dos pacotes" passou a montar isso só com os dados do bioma:
- cada tipo de árvore é um jeito de bosque, com as próprias manchas
  (`patches`): folhosas (NormalTree) e bordos (MapleTree, na entrada dos
  pinheiros);
- as árvores grandes (CommonTree e TwistedTree) ficam soltas no campo,
  raras;
- pouca pedra (só as do MegaKit; as do Ultimate saem sem textura), arbustos
  em manchas, sem as samambaias e trevos do Let's Go, poucas flores;
- a grama alterna manchas altas e baixas, com mais claro e escuro
  (`GRASS.HEIGHT_VARIATION`, `MACRO_VARIATION`, conjuntos de grama);
- a casca das NormalTree e dos bordos também sai marrom
  (`pack-natureza.sh`).

### Terceira volta: chão e cobertura da grama

- **Tom do chão só na grama** (pedido do usuário): o `TERRAIN_LOOK.TINT`
  pesa pela parte do ponto que é camada de grama (`lgpe-grass`,
  `lgpe-grass-bright`, `lgpe-route-grass`, `lgpe-forest-floor`;
  `colorLayerGrass` em `terrainMaterial.js`); trilha, margem, areia, encosta
  e rua ficam com as texturas do Let's Go.
- **Tapete cobrindo tudo** (grama baixa onde hoje fica vazio): testado e
  recusado pelo usuário — voltou a cobertura de antes (tufos espalhados,
  manchas sem grama).
- **Custo medido** (tempo de GPU por quadro na Intel UHD, câmera baixa e a
  do jogo, mesmo ponto da floresta): com a grama e as árvores do Let's Go,
  por volta de 10 ms; com a grama em fios cobrindo tudo (a versão mais
  pesada) e as árvores dos pacotes, de 17 a 20 ms. A de tufos espalhados,
  que ficou, desenha menos lâminas. Cabe no limite de 30 quadros (33 ms) no
  PC; o celular fica para a 092.

### Ainda a ver

- Na câmera do jogo (alta e longe), as copas maiores às vezes ficam entre a
  câmera e o treinador.
- As árvores dos pacotes não têm casco de colisão (cai no cilindro de
  tronco padrão) e não foram medidas na GPU.

### Etapas

- [x] Levantar e converter as árvores, arbustos e pedras dos pacotes.
- [x] Recolorir folhas e casca por material.
- [x] Botões no lab (aplicar e voltar).
- [ ] O usuário aprovar as árvores.
- [ ] Medir o custo (grama e árvores juntas) e ajustar.
- [ ] Levar para o jogo quando aprovado.

---

## Parte 6 — Platôs com barranco e rampa

### O que o usuário pediu

Leves montanhas, sem picos; o barranco com textura diferente (como a terra
avermelhada da referência de Paldea, com a borda de grama em cima); e
caminhos até o topo que não sejam pelo barranco.

### Como funciona (`core/terrain/terraces.js`)

- `relief.terraces` (opcional, por bioma): a altura do relevo sobe em
  patamares de `step` m. A subida de cada patamar se concentra numa faixa
  estreita (`cliff`) — o barranco, íngreme demais para subir a pé
  (`PHYSICS.CHARACTER.MAX_SLOPE_CLIMB`) e pintado pela encosta do terreno
  (`ground.colors.slope`, ex.: `lgpe-cliff`). O topo guarda um pouco do
  declive natural (`tilt`): nunca fica plano de todo, por causa dos raios
  do Rapier em célula plana (089).
- Rampas: um ruído próprio (o do relevo lido longe) marca manchas
  (`ramps`, de `rampSize` m) onde o degrau não acontece e a altura natural
  volta — a subida suave até o topo.
- Sem `terraces` (todos os biomas hoje), o relevo fica como estava.

### No lab, pasta "Relevo"

O relevo do bioma do ponto (chão médio, altura e largura dos morros,
achatamento, detalhe), os platôs (degrau, barranco, declive no topo,
rampas e o tamanho delas), a textura do barranco e o começo e o cheio da
encosta. "Platôs (tudo)" aplica o primeiro acerto: chão médio mais alto (os
vales não afundam na água), morros mais largos com mais campo entre eles,
degraus baixos de barranco seco, rampas e o barranco de penhasco do Let's
Go. "Voltar ao relevo de antes" desfaz.

Medido na seed atual: com o acerto, por volta de 1% do chão da floresta
vira barranco (em linhas); sem ele, nenhum.

### Textura do barranco (correção)

O usuário viu o barranco "bugado": a textura esticada em listras verticais
e manchas verdes em diagonal na parede. Duas causas, as duas do desenho
do chão (`view/terrain/`), que antes não tinha parede íngreme:
- as texturas de cor eram projetadas de cima (`x, z`): numa parede, metros
  de altura caíam no mesmo ponto da textura — agora, nas encostas, elas
  são projetadas dos três lados, pesadas pela normal (`colorLayerAt` em
  `terrainMaterial.js`);
- a encosta era decidida por vértice (um por metro): a parede tem poucos
  vértices, e a mistura corria pelos triângulos em diagonal — agora a
  geometria passa os pesos sem a encosta (`addColorLayers` com
  `perPixelSlope`) e a encosta de cada vértice à parte (`slopeInfoOf`,
  atributo `groundSlope`: a camada do barranco, quanto do vértice tem
  barranco e quanto o pico cobre), e o shader decide por pixel, pela
  inclinação ali (`TERRAIN_COLOR.SLOPE_START`/`SLOPE_FULL`).

Vale para tudo que tem encosta íngreme — os platôs e as montanhas
(`core/terrain/mountains.js`, do usuário).

### Ainda a ver

- Andar no jogo: o barranco barra a subida e a rampa deixa subir; as
  selvagens e o time contornam (navegação).
- Ao levar para o jogo, mudar o relevo do bioma muda o mundo da seed: sobe
  `TERRAIN.GENERATION_VERSION`.
- Pedras ainda grandes e aparecendo bastante nos platôs.

### Etapas

- [x] Degraus, barranco e rampas no relevo (com testes).
- [x] Controles e o acerto de uma vez no lab.
- [ ] O usuário aprovar.
- [ ] Testar andar (barranco barra, rampa sobe) e a navegação.
- [ ] Levar para o jogo (relevo da floresta e `GENERATION_VERSION`).

---

## Parte 7 — Montanhas com caminho até o topo

### O que o usuário pediu

Algumas montanhas, do mesmo jeito dos platôs (Parte 6), mas um pouco
maiores, com o caminho para chegar até o topo.

### Como funciona (`core/terrain/mountains.js`)

- `relief.mountains` (opcional, por bioma): o mundo é dividido em células
  (`spacing`) e cada uma tem, pela `chance`, no máximo uma montanha,
  inteira dentro dela (nunca se encostam). Tamanho (`radius`, `height`)
  variando um pouco (`sizeJitter`, raio e altura juntos — a inclinação não
  muda) e a base fora do círculo (`wobble`). A montanha soma ao relevo do
  bioma (o patamar acompanha de leve o chão em volta) e some na fronteira
  pelo peso do bioma, como o resto do relevo.
- **Patamares**: o morro liso sobe em degraus (`step`), com o mesmo
  barranco e declive no topo dos platôs (`cliff`, `tilt`,
  `terraceHeight`), pintado pela encosta do terreno.
- **Caminho**: cada patamar tem uma rampa só (o barranco não acontece numa
  faixa de `pathWidth` m), e a rampa de cada patamar fica um pouco mais à
  frente da anterior (`turn`, fração da volta), sempre no mesmo sentido:
  sobe-se a rampa, anda-se pelo patamar, rente à beirada, até a próxima — o
  caminho dá a volta na montanha até o topo. O caminho (rampas e o trecho
  no patamar) vai no canal das trilhas do chunk: pinta o chão de terra e a
  vegetação não nasce nele.
- **Água**: a montanha não nasce com o centro ou o começo do caminho na
  água; o resto dela tira a água de baixo (rio e lago cavam cada vez menos
  até o pé — o rio parece nascer na montanha). Recusar toda montanha com
  água perto não dava: na seed atual, quase todas têm rio ou lago perto.
- **Trilhas**: as trilhas de terra da floresta somem em cima da montanha
  (subiriam o barranco e confundiriam o caminho).
- A célula do nascimento (origem) nunca tem montanha em cima do treinador.
- Sem `mountains` (todos os biomas hoje), o relevo fica como estava.

### No lab, pasta "Montanhas"

"Montanhas (tudo)" põe o primeiro acerto no bioma do ponto (com o barranco
de penhasco do Let's Go) e leva o treinador ao pé do caminho da montanha
mais perto, de frente para ela; "Ir à montanha mais perto" faz só a
segunda parte; "Tirar as montanhas" desfaz. Controles: distância entre
montanhas, chance, raio, altura, variação de tamanho, base fora do
círculo, altura do patamar, barranco, declive no patamar, largura do
caminho e quanto ele anda entre uma rampa e a próxima.

Medido na seed atual, com o acerto: cerca de uma dezena de montanhas num
quadrado de 6 km em volta da origem (só nas partes de floresta); a mais
perto do ponto da floresta do lab fica a algumas centenas de metros.

### Ainda a ver

- Andar no jogo: a rampa sobe e o barranco barra (os testes dizem que
  sim pela inclinação; falta andar); as selvagens e o time na navegação.
- Estradas entre cidades que cruzem uma montanha sobem o barranco.
- Árvores e pedras no patamar estreito perto do caminho.
- Ao levar para o jogo, sobe `TERRAIN.GENERATION_VERSION`.

### Etapas

- [x] Montanhas pela seed, em patamares, com o caminho em volta até o topo
      (com testes).
- [x] Caminho pintado como trilha, sem vegetação; trilhas e água fora da
      montanha.
- [x] Pasta "Montanhas" no lab (acerto, ir até ela, tirar, controles).
- [ ] O usuário aprovar.
- [ ] Testar andar até o topo e a navegação.
- [ ] Levar para o jogo (relevo da floresta e `GENERATION_VERSION`).

### Testes (regras, sem fixar valores)

- Mesma seed, mesmas montanhas; cada uma inteira na célula dela; nenhuma
  em cima da origem; sem chance, nenhuma.
- Fora da base não soma nada; no centro, chega à altura do topo.
- A rampa de cada patamar sobe dentro do limite do personagem
  (`MAX_SLOPE_CLIMB`); longe das rampas, o barranco passa dele.
- No patamar, o caminho liga a rampa de baixo à de cima; do outro lado,
  não há caminho.
- A água some debaixo da montanha; as trilhas também; o caminho só entra
  no chunk acima da água.

---

## Parte 8 — Floresta do lab no jogo

### O que o usuário pediu

Levar para o jogo tudo que foi feito no lab (grama, árvores, platôs,
montanhas), para testar jogando.

### O que mudou

- **Dados da floresta** (`core/data/biomes/forest/`), com os acertos dos
  botões "(tudo)" do lab:
  - relevo: os platôs (`relief.terraces`, morros mais largos e chão médio
    mais alto) e as montanhas (`relief.mountains`); o barranco com a
    terra de trilha do Let's Go (`ground.colors.slope`);
  - árvores e pedras dos pacotes da Quaternius, em bosques; os arbustos
    do Let's Go (pedido do usuário depois de testar: combinam mais que os
    dos pacotes), em manchas; sem as árvores jovens, as samambaias e os
    trevos do Let's Go; menos flores;
  - grama em fios (`blade-grass`) com mais grama entre as manchas, sem o
    mato alto do Let's Go (só visual: o spawn não usa).
- **Config** (vale para todos os biomas, como no lab): grama
  (`GRASS.CLUMPS_PER_M2`, `HEIGHT_VARIATION`, `MACRO_VARIATION`), tom e
  brilho do chão de grama (`TERRAIN_LOOK`), base das plantas escura
  (`LGPE.BASE_SHADE`) e `TERRAIN.GENERATION_VERSION` (o relevo da seed
  mudou).
- **Pacotes no jogo** (`view/vegetation/vegetationPacks.js`): o jogo lê
  `public/assets/vegetation/packs/` (no git) ao carregar, antes da cena,
  e registra como o lab registra os dele. O lab lê os do jogo e, por cima,
  os inteiros dele.
- **`scripts/lab/levar-pacotes-para-o-jogo.js`**: copia dos pacotes do lab
  só os modelos que os biomas citam (o `.glb`, as texturas dele e o
  manifesto enxuto) para a pasta do jogo.
- **Colisores** (`scripts/lgpe/colliders.js`): lê também os pacotes do jogo
  — as árvores e pedras novas ganham o casco do tronco e da pedra, como as
  do Let's Go.

### Depois de testar no jogo (pedidos do usuário)

- Valores copiados do lab: a cor da grama em fios e o barranco com a terra
  de trilha.
- Arbustos do Let's Go de volta (combinam mais que os dos pacotes).
- Sem as pedrinhas nas trilhas (`pebble` sem densidade).
- **Árvores gigantes** (`giant-tree`, `GIANT_TREES`; pedido do usuário:
  algumas da altura de vários andares): um tipo de árvore novo, a primeira
  a ocupar o chão — bem rara (célula grande), muito maior (o modelo várias
  vezes), com tronco largo e uma copa que não deixa outro tronco nascer
  debaixo. Na floresta, a CommonTree do MegaKit (tronco grosso, copa
  cheia). Como as outras grandes, só cabe no sorteio por bloco de sólidos
  (como o jogo faz); os testes de sorteio que usavam o chunk passaram ao
  bloco.
- **Grama escondida por ora** (`GRASS.VISIBLE`): os dados dos biomas
  continuam com ela, só não é desenhada (a grama em fios e o mato alto do
  Let's Go, em todos os biomas); o F2 "Vegetação → Mostrar → Grama" liga
  ao vivo.
- **Pedras variadas** (eram três do MegaKit, mesma textura e formato
  parecido): entram as cinco do Ultimate Nature (mais altas, cinza-escuro)
  e a grande com musgo do Let's Go. As do Ultimate saíam sem textura (o
  material `Rock`, a imagem `Rocks.png`): o `pack-lab.py` passou a achar a
  imagem pelo nome do material no plural também. O tamanho de cada pedra
  já era sorteado (`ROCKS.SCALE`).
- **Folhas do Let's Go nas árvores dos pacotes** (`LGPE.PACK_LEAVES`, o id
  da árvore de onde vêm; `withBorrowedLeaves` em `lgpeModels.js`): a parte
  de folha de cada árvore dos pacotes passa a usar o material de folha da
  árvore redonda do Let's Go inteiro — o recorte, a cor e o sombreado. Na
  redonda, a textura das folhas é só o recorte (quase preta); a cor vem de
  uma rampa lida pela altura na copa, num segundo UV que os pacotes não
  têm: a vegetação gera esse UV pela altura de cada vértice da folha
  (`withHeightRamp`). O tronco continua o do pacote. Vale ao carregar.

### Efeito nos outros biomas (a ver com o usuário)

O que é do config vale em todo bioma: a planície e a cidade, que usam a
mesma camada de grama no chão, ficam com o tom verde-escuro, e a grama do
Let's Go delas sai mais densa (`CLUMPS_PER_M2`). A savana não tem camada
de grama no chão. Se não ficar bom, o tom e a densidade passam a ser do
bioma.

### Etapas

- [x] Dados da floresta e config com os acertos do lab.
- [x] Pacotes no jogo (script, carregamento, colisores, testes).
- [ ] O usuário testar jogando.
- [x] Medir na GPU (Intel UHD) a floresta nova — Parte 9.
- [x] Medir a planície com a grama mais densa — medida na Parte 13, já
      com a grama em fios.

---

## Parte 9 — Desempenho sem a grama

### O que o usuário pediu

Com a grama escondida (`GRASS.VISIBLE`, Parte 8), achar o que mais pesa
agora. Cada item da lista abaixo vai ser tratado à parte (uma sessão por
item).

### Como foi medido

- Tempo de GPU por quadro na Intel UHD do PC (o timer do WebGL em volta do
  desenho), pelo Chromium do Playwright no WSL. No WSL o tempo absoluto sai
  inflado: os números servem para **ordenar**, não como meta (medidos em
  2026-11-10, no estado de agora).
- Na mesma página, cada parte da cena escondida e mostrada de novo,
  intercalado várias vezes (a GPU integrada oscila), pela mediana da
  diferença; em três ângulos da câmera do jogo.
- Primeiro no lab (ponto da floresta), depois **no jogo**: o save do
  usuário (só lido; nada gravado), o time de três em campo, as selvagens
  em volta, tela cheia — na posição salva e no ponto da floresta do lab.

### Resultado (no jogo)

Vista comum (câmera fora das copas), quanto cai o tempo do quadro sem
cada parte:

| Parte | Custo |
|---|---|
| Terreno | ~7 a 8,5 ms |
| Sombra do sol (desenhar o mapa é cerca de metade) | ~6 a 8 ms |
| Copas das árvores dos pacotes | ~3 a 4 ms |
| Troncos | ~2 ms ou menos |
| Selvagens, o time em campo, o treinador | ~1 ms cada ou menos |
| Água, pedras, arbustos e flores, céu e serras, cidade | dentro do ruído |

**Pior caso — a câmera dentro de uma copa**: apareceu nos dois pontos (um
ângulo em três). As copas sozinhas passam de 15 a 20 ms, a tela inteira
fica coberta por dezenas de camadas de folha por pixel, e o jogo cai para
perto de 15 quadros por segundo, com travadas. É o mesmo caso de "copa
entre a câmera e o treinador" da Parte 5.

O que explica:

- **A cena é limitada por pixel, não por triângulo**: metade da resolução
  tira ~8 ms; os troncos têm centenas de milhares de triângulos e quase não
  pesam.
- **Copa**: o custo é a quantidade de pixel de folha empilhado (folhas de
  dois lados, umas sobre as outras). Desenhar um lado só tira metade dele.
  O ver-através (`seeThrough.js`) não alivia: o pontilhado descarta o pixel
  depois de calcular.
- **Terreno**: cobre ~três quartos da tela e o shader é pesado por pixel —
  cada camada de detalhe lê a textura três vezes (triplanar), mesmo no chão
  plano, mais o ruído das manchas e a luz do `MeshStandardMaterial`. A
  parte da 066 (triplanar da cor só na encosta) é pequena; o custo é de
  antes.
- **Sombra**: cerca de metade é desenhar o mapa (uma centena de chamadas
  de desenho a mais por quadro); o resto, ler a sombra em cada pixel.

O que foi testado e **não ajudou** (para não repetir): filtro da sombra
simples no lugar do PCF; mapa de sombra menor (`SHADOW_MAP_SIZE`); copas
sem o corte de alfa; troncos sem o corte de alfa e de um lado só; copas sem
receber ou sem fazer sombra (pouco cada).

CPU (medido em dev, que infla; conferir numa build de produção):

- só o `render()` do three gasta perto da metade do quadro em JS — ~400
  chamadas de desenho e ~1000 objetos percorridos por quadro;
- `planChunkStreaming` roda a cada quadro mesmo com o treinador parado;
- um shader é compilado na primeira vez que o treinador anda (uma travada
  só, não se repete).

### Itens (um por vez)

1. **Copas perto da câmera** (o pior caso). Sumir com a folha perto da
   câmera, ou na linha câmera → treinador, já no vertex shader (o
   triângulo não vira pixel), no material das copas (`toonMaterial.js`,
   onde o ver-através entra); ou a câmera desviar das copas. Conferir no
   ângulo em que ela entra na copa. À parte, decidir com o usuário se as
   folhas podem ser de um lado só (metade do custo da copa, muda o visual
   de baixo).
2. **Terreno** (`view/terrain/terrainMaterial.js`). Na camada de detalhe
   (`sampleLayer`), ler uma vez só no chão plano, como `colorLayerAt` já
   faz com a cor; ver o custo do ruído das manchas por pixel; avaliar com o
   usuário uma luz mais simples que a do `MeshStandardMaterial`.
3. **Sombra**. Menos objetos fazendo sombra (`VEGETATION_QUALITY`:
   `shadowRing`, `canopyShadow`; quais tipos fazem — troncos, cidade);
   redesenhar o mapa a cada dois quadros (a área de sombra segue o
   treinador: ver se treme). Filtro e tamanho do mapa não adiantam.
4. **Resolução**. Conferir o `devicePixelRatio` do PC do usuário (com o
   Windows em escala acima de 100% a qualidade alta desenha mais pixels,
   até o `maxDpr`); avaliar uma escala de resolução na qualidade.
5. **CPU**. Medir numa build de produção; menos objetos e chamadas de
   desenho por quadro (malhas vazias, partes por bloco); não planejar os
   chunks a cada quadro parado; compilar os shaders no carregamento (sem a
   travada da primeira andada).

Ordem combinada com o usuário: terreno primeiro; as copas perto da câmera
(caso específico) por último.

### Item 2 — terreno: primeira volta (sem mudar o visual)

Três mudanças no shader (`terrainMaterial.js`):

- **Manchas no vértice**: o ruído das manchas grandes (`PATCH_SIZE`) sai
  do pixel e é calculado por vértice (`vGroundPatches`) — as manchas são
  bem maiores que o metro entre vértices. O granulado fino continua no
  pixel.
- **Detalhe só de cima no plano**: a camada de detalhe (`sampleLayer`) lê
  uma vez no chão plano (`FLAT_GROUND`, o mesmo corte da cor) e só faz os
  três lados na encosta.
- **Camadas por grupo**: os pesos vêm em grupos de quatro; o grupo sem
  peso é pulado inteiro e cada camada sai pelo componente, sem o laço que
  procurava o peso por índice (`colorWeightOf` saiu).

Medido no lab (ponto da floresta, três ângulos), trocando o shader antigo
e o novo na mesma página, só o terreno na cena, diferença pareada:

| Mudança | Ganho no quadro |
|---|---|
| As três juntas | ~2,5 ms em dois ângulos; ~0,4 ms no terceiro (pouco chão na tela) |
| Manchas no vértice | ~1,6 ms — quase todo o ganho |
| Camadas por grupo | ~0,7 ms |
| Detalhe só de cima | dentro do ruído |

Visual: a imagem do terreno com o shader antigo e o novo difere no máximo
um nível de cor (de 255) por pixel — o arredondamento.

### Item 2 — terreno: segunda volta (luz do chão)

Duas opções testadas no lab, com o usuário olhando:

- **Luz do chão** (`TERRAIN_LOOK.LIGHTING`): `lambert` (só a luz difusa)
  ou `standard` (com o brilho especular, como era). O terreno passou a ter
  um material por luz (`createTerrainMaterials` → `forLighting`), com as
  mesmas texturas e números; troca ao vivo (lab, "Cor e atmosfera" → "Luz
  do chão"). O usuário não viu diferença: **o jogo passou para
  `lambert`**.
- **Detalhe some longe** (o claro e escuro, o relevo de luz e o granulado
  deixando de ser calculados além de uma distância da câmera): sem ganho
  medido — com a câmera do jogo, quase todo o chão na tela está perto.
  **Saiu do código.**

Medido no lab (só o desenho do terreno, um por medida, pareado):

| Opção | Ganho no terreno | Visual |
|---|---|---|
| Lambert | ~0,5 a 0,7 ms (de ~5 ms) | quase igual (o brilho que sai mal aparecia) |
| Detalhe some longe | dentro do ruído | quase igual |

Para a bancada: o timer da GPU em volta de vários desenhos seguidos (em
lote) não mede direito no WSL — só um desenho por medida.

### Item 2 — na reserva (voltar no fim, se ainda estiver pesado)

Combinado com o usuário: só se, depois de todos os itens e da medição
final, o terreno ainda pesar.

- **Detalhe em cima da cor do Let's Go**: nos biomas com `ground.colors`
  (a floresta), a textura do Let's Go já traz o claro e escuro dela, e por
  cima ainda entram a camada de detalhe (`ground.detail`) e o mapa de
  normal. Tirar o detalhe nessa parte economiza bastante, mas muda o chão
  — decidir olhando no lab.
- **Só as camadas mais fortes por vértice**: mandar os quatro pesos
  maiores com os índices, em vez de todos os pesos de cor. Corta varyings
  e laço, mas mexe no `terrainGeometry.js` e precisa tratar a fronteira
  entre vértices com camadas diferentes. A mais trabalhosa.

Ainda no item 2, se precisar de mais: o granulado no pixel (o mesmo
ruído, uma oitava) virar uma leitura de textura.

### Item 3 — sombra

**Medido** (lab, ponto da floresta, uma medida por desenho, pareado):

- a sombra inteira custa ~2,5 a 6 ms; redesenhar o mapa, só ~1 ms disso
  (as copas são metade; arbustos e pedras, nada);
- o resto é **ler** a sombra em cada pixel, e quem mais lê são as
  **copas**: as folhas empilhadas fazem a leitura várias vezes no mesmo
  pixel (até ~3 ms com copa na tela). O chão, os troncos e o resto, pouco;
- o filtro do three (`PCF`) lê o mapa cinco vezes por pixel; uma leitura
  só tira ~1 a 2,7 ms. (A conclusão antiga, "filtro simples não ajuda",
  vinha da medição com a cena inteira, ruidosa demais.)

**O que mudou:**

- **Sombra numa leitura** (`view/scene/shadowFilter.js`): o trecho do
  three que lê a sombra ganha um caminho de uma leitura (ainda com o filtro
  do hardware), usado pelos materiais com `SHADOW_SINGLE_TAP` — toda a
  vegetação (`toonMaterial.js`) — e por tudo quando a luz pede raio zero.
  Nas folhas, a diferença na imagem é mínima (média de ~1 nível de cor).
- **Menu "Gráficos"** (`tools/menu/GraphicsSettingsPanel.jsx`, pedido do
  usuário): o nível da sombra — desligada, baixa, média e alta
  (`GAME_CONFIG.GRAPHICS.SHADOW`). Vai no save da conta, como o som
  (`GraphicsSettings` no treinador, `definirSombra`, save versão 7 com
  migração). Por nível: se há sombra, tamanho do mapa e da área, a cada
  quantos quadros o mapa é redesenhado, borda macia (várias leituras) ou de
  uma, e se a vegetação recebe sombra. O tamanho da área e do mapa saiu do
  `DAY_CYCLE` para o nível. O lab tem o mesmo nível em "Luz e sombra".
- A ideia de tirar a sombra de arbustos e pedras saiu: não ganha nada.

Ganho no quadro em relação a antes (lab, com e sem copa na tela):

| Nível | Ganho |
|---|---|
| Alta (padrão) | ~2,3 ms com copa na tela; quase nada sem |
| Média | ~2 a 3 ms |
| Baixa | ~2 a 4 ms |
| Desligada | ~3,5 a 5 ms |

O menu "Gráficos" vai ganhando opções aos poucos (para melhor e para
pior), conforme os próximos itens. A wiki entra no fim da feature.

### Item 4 — tamanho da tela

O PC do usuário tem densidade de pixels 1 (Windows em 100%, sem zoom):
nada desenhava pixel a mais. Mesmo assim, desenhar menos pixels virou
opção do menu "Gráficos" (pedido do usuário), para PCs mais fracos.

Como chegou aqui (três voltas com o usuário):

1. **Escala da resolução** (50%, 75%, 100%, Nativa): o canvas na tela
   inteira, desenhando menos pixels e esticando. A primeira versão mudava a
   densidade por fora do `<Canvas>`, e o usuário viu a imagem voltar ao
   normal ao fechar o menu: o R3F reaplica a prop `dpr` do Canvas (o padrão
   dele, sem a prop) a cada render da página. Corrigido passando a prop,
   mas a imagem esticada fica borrada.
2. **Proporção da tela** (pergunta do usuário: "não daria para só diminuir
   o canvas?"): canvas centralizado na proporção escolhida, com faixas
   pretas.
3. **Tamanho da tela** (o que ficou): a escala da resolução saiu — o
   desenho é sempre um pixel por pixel do canvas — e o que varia é o
   tamanho do próprio canvas, de 100% a 50% da janela, mostrado em pixels
   (1920×1080, 1440×810…).

O que ficou no jogo:

- **Proporção** (`GAME_CONFIG.GRAPHICS.ASPECT`, `GraphicsSettings.aspect`,
  `definirProporcao`): Tela (padrão, a janela inteira), 21:9, 16:9, 16:10
  e 4:3.
- **Tamanho da tela** (`GAME_CONFIG.GRAPHICS.CANVAS_SIZE`,
  `GraphicsSettings.canvasScale`, `definirTamanhoDaTela`): controle
  deslizante em passos, com o tamanho em pixels que o canvas terá na janela.
- O `<Canvas>` do jogo e do lab é o `GameCanvas` (`view/scene/`): mede o
  espaço (`ResizeObserver`), calcula o canvas com `canvasSizeOf` (o maior
  retângulo da proporção que cabe, reduzido pelo tamanho) e o centraliza
  com preto em volta, com `dpr` fixo em 1 como prop. A interface (HUD e
  menus) continua na tela inteira. O `maxDpr` da `VEGETATION_QUALITY` saiu.
  Quem tinha tela de alta densidade passa a desenhar um pixel por pixel de
  tela (antes ia até 1,5×).
- Tudo no save da conta, sem subir a versão: um valor ausente ou fora da
  faixa volta ao padrão, e a antiga resolução é ignorada.
- O lab tem as mesmas escolhas em "Luz e sombra".

Conferido no jogo (janela 1920×1080): cada tamanho e proporção encaixa e
centraliza (inclusive ao redimensionar a janela), continua igual ao abrir
e fechar o inventário, e o rótulo do menu bate com o canvas. Ganho no
desenho, no ponto de nascimento, em relação ao canvas cheio:

| Tamanho | Canvas | Ganho |
|---|---|---|
| 75% | 1440×810 | ~1 ms |
| 50% | 960×540 | ~1,5 ms |

O ponto de nascimento pesa pouco por pixel; na floresta densa do lab, a
escala da 1ª volta (que desenhava a mesma quantidade de pixels) chegou a
~11 ms em 50%. O FPS só sobe onde o PC não chegava no limite do jogo
(`RENDER.MAX_FPS`): onde já estava no limite, a folga fica sem aparecer no
contador.

### Item 5 — CPU

Medido numa **build de produção** (cópia enxuta, sem minificar, para o
perfil ter os nomes), no ponto de nascimento, 30 FPS: 10 s parado, duas
andadas de 10 s em frente (as selvagens nascendo em volta) e 10 s parado.
O JS do quadro é a soma do que roda nele; o perfil de CPU diz o que pesou
em cada quadro longo.

O que apareceu:

- **Parado**: ~15 ms de JS por quadro, ~11 ms dele no `render()` do three
  (~600 chamadas de desenho contando a sombra, ~1.600 objetos). Dentro
  disso, 116 malhas instanciadas **vazias** (o LOD deixa a de perto ou a de
  longe sem nenhuma instância) que o three visitava e trocava de programa à
  toa, e o plano dos chunks refeito a cada quadro.
- **Andando**: não era lentidão geral, eram **travadas** (6 a 8 quadros de
  50 a 270 ms a cada 10 s), todas no desenho:
  - a **primeira aparição de cada espécie** compilava o shader do corpo no
    quadro em que ela surgia — e duas vezes: a textura chega alguns quadros
    depois do modelo, então primeiro saía o shader sem textura (e o
    modelo aparecia sem textura), depois o com;
  - **toda criatura que aparecia reenviava a textura da espécie** inteira
    para a placa de vídeo (10 a 35 ms cada), mesmo a já enviada: o código
    marcava a imagem compartilhada como alterada (`needsUpdate`) a cada
    criatura, e o `clone()` do three faz o mesmo por dentro;
  - **as partículas** (poeira, golpes) descartavam material e textura no
    fim de cada efeito: com o último descartado, o three apagava o shader
    e a imagem, e o efeito seguinte compilava e subia tudo de novo (o mesmo
    shader compilado 4 a 5 vezes por andada); cada partícula nova também
    reenviava a imagem (o `clone()`).
- No carregamento, o pré-carregamento da vegetação pedia os modelos dos
  pacotes de fora na pasta do LGPE (18 erros 404) antes de eles se
  registrarem.

O que mudou:

- `instancing.js`: malha instanciada sem instância fica invisível (o three
  nem passa por ela).
- `chunkStreamingSystem.js`: só planeja de novo quando um centro troca de
  chunk ou o terreno muda (a revisão dele); parado, nada.
- `revealWhenReady.js` (novo, `view/materials/`), usado pelo
  `useAnimatedModel`: o modelo nasce invisível; com o material e as
  texturas da espécie no lugar, compila os shaders em paralelo
  (`compileAsync`, fora do quadro), sobe as texturas uma por quadro e só
  então aparece — sem travada e sem o modelo sem textura.
- `textureCache.js`: a imagem chega decodificada (`decode()`, fora do
  quadro) e `cloneTexture` copia uma textura sem marcar a imagem para
  reenvio; `useAnimatedModel` só pede reenvio quando o `flipY` muda (o
  recorte entra como matriz a cada desenho). Usado também nas partículas e
  no feixe de recolher.
- `particleEmitter.js`: no fim de um efeito, os sprites vão para um
  estoque por tipo de partícula (com limite) e o próximo efeito igual os
  reaproveita — material, shader e imagem continuam vivos.
- O pré-carregamento da vegetação (`preloadVegetationModels`) roda depois
  de os pacotes se registrarem.

Antes e depois (mesmo roteiro, build de produção, valores do WSL — servem
para comparar, não como meta):

| | Antes | Depois |
|---|---|---|
| JS por quadro, parado | ~15,5 ms | ~12 ms |
| `render()` do three, parado | ~11,5 ms | ~9 ms |
| Quadros acima de 50 ms, 1ª andada | 8 | 1 |
| Quadros acima de 50 ms, 2ª andada | 6 a 8 | 1 a 4 |
| Shaders compilados no desenho, por andada | 7 a 10 | 0 a 2 |
| Envios da mesma textura | um por criatura | um por espécie |

Conferido: nenhuma criatura fica escondida (todas as malhas com esqueleto
desenhadas depois de andar e parar).

### Item 5 — na reserva

- **Juntar a vegetação de vários blocos.** As ~280 chamadas de desenho da
  vegetação levam ~3,7 instâncias cada (84 com uma só), e mais ~170 na
  sombra; o terreno são 98 malhas pequenas. Juntar blocos cortaria
  centenas de chamadas e alguns ms de CPU por quadro, mas é uma reforma do
  `VegetationView` e tem preço na placa de vídeo: sem o corte por bloco,
  o que está atrás da câmera passa a ser processado. Como o PC do usuário
  é limitado pela placa de vídeo e fica no limite de 30 FPS, fica para o
  fim, se ainda precisar.
- **Sombra do corpo na primeira vez.** A variante de sombra de cada
  combinação de material do corpo (textura recortada, dois lados,
  esqueleto) ainda compila no quadro em que aparece, uma vez por sessão; o
  `compileAsync` não cobre a passada da sombra, e imitar o estado dela é
  frágil.

### Item 1 — copas perto da câmera

O pior caso do jogo: a câmera dentro da copa de uma árvore (no lab, num
ângulo da câmera do jogo em oito). As folhas cobrem a tela inteira com ~25
camadas, e o ver-através não alivia (ele só pontilha um cilindro em volta
da linha câmera → treinador).

O que estiver colado na câmera agora **some** (`CAMERA.NEAR_HIDE`), no
material toon do LGPE (`toonMaterial.js`, `nearHide`):

- Some: as **folhas das árvores** (as partes recortadas com o vento de
  copa, cada uma pela caixa dela — `CANOPY`) e, a pedido do usuário, as
  **pedras e os prédios da cidade** (o modelo inteiro, pela caixa do
  modelo todo, para as partes sumirem juntas — `SOLID`; `lgpeModels.js`).
  A rua não.
- No vertex shader, cada instância mede a distância (com sinal) da câmera
  até a caixa dela. A menos de `HIDE` m, todos os vértices vão para um
  ponto fora da tela: nenhum pixel é calculado. Na faixa seguinte
  (`FADE` m), some em pontilhado, logo no começo do fragmento, para não
  estalar. Cada tipo tem a distância e a faixa dele.
- O tronco e a sombra no chão ficam.
- Vale no jogo e no lab (o material é o mesmo). No lab, na pasta
  "Árvores": ligar e desligar, a distância e a faixa de cada tipo.

Nas pedras e nos prédios o ganho é outro: as paredes são de um lado só,
então de dentro deles a câmera já via através; o que muda é a passagem
pela parede (a câmera cortava a parede ao meio) e as partes de dois lados.
Com a câmera padrão (alta) ela quase não entra neles — só baixa, de lado.
Conferido na cidade: no ângulo em que a câmera entrou num prédio, as 12
partes dele sumiram juntas; nenhum erro de shader.

Medido no lab (um desenho por medida, mediana, pareado), no ângulo em que a
câmera entra na copa:

| | Antes | Depois |
|---|---|---|
| Quadro inteiro | ~17,8 ms | ~8,3 ms |
| Folhas | ~12,1 ms | ~2,4 ms |

Nos outros ângulos nada muda (o custo das folhas fica no ruído). Numa volta
de 16 ângulos, a copa some só nos dois em que a câmera entra nela, e 1 ou 2
árvores pontilham quando a câmera passa colada.

**Folhas de um lado só** (a parte combinada para decidir com o usuário):
desenhar as folhas de um lado só tira cerca de metade do custo da copa em
qualquer ângulo, mas muda o visual de baixo (vendo de baixo, a folha de
costas some). Fica como opção, sem mexer por enquanto.

### Etapas

- [x] Medir no lab e no jogo (com o time em campo), em vários ângulos.
- [x] Item 1 — copas perto da câmera: a copa (e as pedras e os prédios)
      some com a câmera dentro (no vertex shader, sem pixel), com
      pontilhado na transição.
- [x] Item 2 — terreno: manchas no vértice, detalhe só de cima no plano,
      camadas por grupo e luz Lambert no chão.
- [x] Item 3 — sombra: leitura única na vegetação e níveis no menu
      "Gráficos" (salvos na conta).
- [ ] Wiki: o menu "Gráficos" — a feature fechou sem wiki (decisão do
      usuário).
- [x] Item 4 — tamanho da tela: proporção e tamanho do canvas (de 100% a
      50%, em pixels) no menu "Gráficos", salvos na conta.
- [x] Item 5 — CPU: plano dos chunks parado, malhas vazias, criaturas que
      aparecem prontas (shader em paralelo, textura uma vez por espécie),
      estoque de partículas; juntar blocos na reserva.
- [x] Medir de novo depois dos itens, com a grama de volta — Parte 10.

---

## Parte 10 — Grama em manchas

### O que o usuário pediu

Com a grama ligada, o ganho dos itens da Parte 9 não aparecia: a grama em
fios cobrindo o bosque inteiro (Parte 8) era o maior peso do jogo. Em vez
de desligar, a grama da floresta passa a ser **manchas de mato fechadas**,
como o mato alto dos jogos clássicos, com o chão entre elas. Ajuste e
medição **no jogo** (o usuário não confia no lab para comparar desempenho).

### O que mudou

- **Floresta** (`core/data/biomes/forest/`, `clusters` da grama): sem grama
  entre as manchas (`background` zero); manchas menores, de borda seca, sem
  falhas, um pouco mais altas, cobrindo menos chão e de preferência nas
  clareiras.
- **Grama de volta** (`GRASS.VISIBLE`) em todos os biomas.
- **Tufo com menos lâminas e mais largas** (`GRASS_BLADES.COUNT`,
  `WIDTH`).

### Como foi medido

No jogo (dev, cópia no scratchpad), com o save do usuário só lido, o time
de três em campo, tela 1920×1080, Intel UHD pelo WSL. Na mesma página,
cada opção trocada ao vivo (os dados do bioma e o tufo refeitos), em
rodadas intercaladas, pela mediana do tempo de GPU do quadro; dois ou três
ângulos da câmera do jogo. Dois pontos da floresta: o do save (fora de
mancha) e o miolo de uma mancha perto dele.

### Resultado

Quanto a grama soma ao tempo de GPU do quadro:

| Onde | Tapete (antes) | Manchas |
|---|---|---|
| Fora de mancha (ponto do save) | ~19 ms | ~2 a 4 ms |
| No miolo da mancha | ~23 a 27 ms | ~11 a 14 ms |

Dentro da mancha, variações do tufo:

| Variação | Custo da grama |
|---|---|
| Como estava (mais lâminas, finas) | ~11 a 13 ms |
| Menos lâminas, mais largas (**ficou**) | ~6 a 9 ms |
| Ainda menos lâminas, bem mais largas | ~5 a 6 ms |
| Manchas mais baixas | igual |
| Sumir mais perto da câmera | ganho só num ângulo |

O custo segue o **número de lâminas**, não a altura nem a área de grama
na tela: são muitos triângulos finos.

### Ainda a ver

- O usuário ver no jogo o visual das manchas e do tufo novo.
- A planície e a savana com a grama de volta (o mato do Let's Go, já em
  manchas): medir no jogo.
- Se ainda pesar: menos partes por lâmina (`SEGMENTS`) e um nível de grama
  no menu "Gráficos" (desligada, poucas lâminas, mais lâminas).
- A grama em manchas como lugar de encontro de selvagens (como nos jogos
  clássicos) é decisão de jogabilidade: hoje o spawn (062) não olha a
  grama.

### Grama de pé, como no stylized-scene (pedido do usuário)

O tufo virando para a câmera e deitando quando ela subia (Parte 4) ainda
parecia estranho. O usuário quer a grama sempre de pé e todos os tufos
apontando para o mesmo lado — como no stylized-scene, de onde o vento já
tinha vindo. Lá, o tufo não vira para a câmera: fica parado no giro
sorteado, as lâminas apontam para todos os lados e todas dobram para o
lado do vento no mundo (o giro de cada tufo é desfeito antes da dobra).
Antes de mexer, uma demonstração (página com os dois jeitos, lado a lado)
para o usuário confirmar.

O que mudou:

- **Tufo** (`bladeGrass.js`): cada lâmina reta, virada para um lado
  sorteado (uma moita, que aparece de qualquer ângulo); a curva sorteada
  de cada lâmina (`BEND`) saiu — a curva é só a do vento
  (`vegGrassSway`), para o mesmo lado em todo tufo.
- **Material**: a grama em fios não vira mais para a câmera
  (`billboard`) e não deita mais (`TILT`, `uBladeTilt` e o trecho do
  shader saíram). As normais continuam para cima: a luz é igual dos dois
  lados da lâmina.
- Lab: saíram os controles da curva e do deitar.

Medido no jogo (no miolo da mancha, o time em campo, três ângulos), o
tufo antigo e o novo em duas cópias, intercalados (antigo, novo, antigo,
novo), cada medida pareada com a grama escondida na mesma página. Mesma
quantidade de triângulos nos dois:

| Tufo | Custo da grama |
|---|---|
| Virando para a câmera e deitando (antes) | ~5 a 11 ms |
| De pé, parado (agora) | ~3,5 a 6 ms |

Sem a conta de virar e deitar em cada vértice, e com menos área de lâmina
na tela (de lado elas afinam; de cima, de pé, ocupam pouco).

### Grama surgindo do nada ao andar (pedido do usuário)

A grama em fios encolhe e some numa faixa de distância
(`GRASS_BLADES.FADE_START`/`FADE_END`), bem antes da névoa: entre as duas,
onde havia mancha de mato ficava só o chão, e a mancha "nascia" ao chegar
perto. O usuário notou o mesmo corte no remake do Zelda, mas lá quase não
se vê — o chão debaixo da grama já tem a cor dela.

O que mudou:

- **Chão na cor da grama debaixo das manchas** (`terrainGeometry.js`,
  `grassGroundOf` → atributo `groundGrass`; `terrainMaterial.js`): por
  vértice, quanto do chão é mancha de grama em fios — a mesma conta que
  decide onde ela nasce (conjuntos, clareiras, trilhas), sem a densidade,
  só nos biomas com grama em fios, nada na margem da água nem em encosta
  íngreme — e a tinta do bioma. O shader puxa a cor do chão para a da
  grama (`GRASS_BLADES.COLOR` × tinta × `GROUND_SHADE`) por ela
  (`GROUND_COVER`), com o claro e escuro do chão por cima. De longe a
  mancha continua lá; perto, as lâminas brotam em cima da mesma cor. A cor
  da grama vale ao vivo para os dois; com a grama escondida
  (`GRASS.VISIBLE`), o chão volta ao normal.
- **A lâmina se funde no chão ao sumir** (`toonMaterial.js`): na faixa
  em que encolhe, o tom da lâmina (raiz escura, ponta clara, base escura)
  vira o tom chapado do chão (`GROUND_SHADE`).
- Lab, pasta "Grama em fios": quanto o chão puxa e o tom (ao vivo).

O tom foi acertado no jogo: dentro de uma mancha, a cor média da tela
com a grama e só com o chão pintado, para vários tons — o escolhido é o de
menor diferença. Conferido por fotos (antes e depois, três ângulos): a
grama de longe passa a ficar em cima do chão verde, não do chão escuro.

Custo: no desenho, uma mistura de cor por pixel (desprezível). Ao montar o
chunk, a conta da mancha por vértice soma ~2 ms a ~3 ms de antes (em dev,
que infla): se pesar ao andar, calcular a mancha numa grade mais
espaçada e interpolar.

Planície e savana usam a grama do Let's Go (não em fios): o chão delas
não muda.

### Distância de visão no menu "Gráficos" (pedido do usuário)

O raio de chunks carregados (antes `TERRAIN.LOAD_RADIUS`, só no F2) virou
opção do menu: **Distância de visão**, um controle deslizante em chunks,
com até onde a névoa deixa ver em metros (`GAME_CONFIG.GRAPHICS.VIEW_DISTANCE`,
`GraphicsSettings.viewDistance`, `definirDistanciaDeVisao`; no save da conta,
sem subir a versão: ausente ou fora da faixa volta ao padrão). O lab tem a
mesma escolha em "Luz e sombra"; o F2 ficou só com a folga de descarregar
(`TERRAIN.UNLOAD_MARGIN`).

- O `chunkStreamingSystem` carrega pelo raio escolhido (com mais de um
  treinador, o maior) e publica o raio em uso no terreno
  (`terrain.loadRadius()`).
- Tudo que media pelo raio antigo passou a medir pelo raio em uso: a névoa
  (`loadedFogRange`), o corte da vegetação e dos itens além dela e o spawn
  das selvagens (`spawnParams`: a distância de visão e o raio longe do
  despawn, este na proporção do padrão, para ficar dentro do chão
  carregado).
- O mínimo da faixa é o menor raio em que o anel de spawn das selvagens
  ainda cabe no chão carregado.

Conferido no jogo: trocando a distância, os chunks carregam ou saem aos
poucos (os da folga ficam até sair dela), e a névoa e as faixas do spawn
acompanham.

### Etapas

- [x] Floresta com manchas de mato no lugar do tapete; grama de volta.
- [x] Medir no jogo, fora e dentro da mancha, e as variações do tufo.
- [x] Tufo com menos lâminas e mais largas.
- [x] Distância de visão (chunks carregados) no menu "Gráficos".
- [x] Grama de pé, sem virar para a câmera, todas dobrando para o lado do
      vento (como no stylized-scene), medida no jogo.
- [x] Chão na cor da grama debaixo das manchas e a lâmina se fundindo no
      chão ao sumir (sem a grama surgindo do nada).
- [x] O usuário aprovar o visual no jogo.
- [x] Medir a planície e a savana com a grama de volta (Parte 13).

---

## Parte 12 — Planície

### O que já valia antes de começar

As correções de código da floresta já valem na planície (a base no
barranco, o aviso de golpe por cima da grama, a silhueta através das
plantas, o passo na grama, a copa que some perto da câmera e os ganhos de
desempenho da Parte 9). Os da Parte 10 não: são da grama em fios, e a
planície usa o mato do Let's Go.

Valores do config acertados para a floresta que também mudaram a planície
(a rever ao longo desta parte):

- `GRASS.CLUMPS_PER_M2` e `GRASS.HEIGHT`: o mato do Let's Go bem mais denso
  e mais baixo — e sem o corte pela distância que a grama em fios tem
  (custo a medir no fim);
- `TERRAIN_LOOK.TINT`, `TINT_AMOUNT` e `BRIGHTNESS`: o chão de grama da
  planície (todo ele) puxado para o verde-escuro;
- `ROCKS` (`SPACING`, `CHANCE`): bem menos pedras;
- `FLOWERS.CLUMPS_PER_M2`: menos flores.

### Planície isolada (provisório)

Para olhar a planície sozinha: a floresta e a savana em `BIOMES.HIDDEN`
(e, até a grama em fios chegar, a grama escondida em `GRASS.VISIBLE`, já
de volta). Na Parte 13 o isolamento passou para a savana. Voltam antes de fechar a feature — enquanto isso, os testes que
procuram a floresta ou os biomas das espécies no mundo (`groundSurface`,
`terrainGeometry`, `wildSpawn`, `wikiData`) falham.

### Árvores no estilo da floresta

Os capões de árvores redondas do Let's Go saíram
(`core/data/biomes/plains/`):

- **Bosquinhos de NormalTree** (`broadleaf-tree`, em manchas pequenas): a
  árvore dos pacotes mais parecida com as de Paldea.
- **Grandes soltas no campo, raras** (`ancient-tree`): as CommonTree do
  MegaKit.
- Sem os bordos e as gigantes (da mata); arbustos, tufos e flores do Let's
  Go ficam.

As folhas são as da árvore redonda do Let's Go (`LGPE.PACK_LEAVES`), como
na floresta: o tom não muda, só a forma.

### Ressaltos no campo

Os platôs da floresta (Parte 6), em outra regulagem: na planície, nada de
patamares por todo lado (ela perde o campo aberto), e sim ressaltos baixos
e raros, como os das rotas de Kanto (`relief.terraces` da planície).

- **Degrau baixo, barranco seco** (`cliff` no máximo) e **bastante rampa**:
  a maior parte do morro continua subindo suave. Sem montanhas (ficam da
  floresta).
- **Chão médio mais alto** (`baseHeight`): o relevo da planície é baixo, e
  sem isso o patamar de baixo descia quase até a água — boa parte da
  planície virava margem.
- **Barranco com a terra de trilha** (`ground.colors.slope`), como o da
  floresta; vale também para a encosta dos lagos e rios.
- `TERRAIN.GENERATION_VERSION` subiu (o relevo da seed mudou).

Medido na seed atual (os números só ilustram): com o barranco da floresta
(não seco), quase nada da planície virava barranco — o relevo dela é suave
demais para o degrau ficar íngreme; com o barranco seco e o chão mais alto,
por volta de metade da parte de barranco da floresta, e menos chão rente à
água que antes.

### Grama em fios

A grama da planície passou a ser a da floresta (Parte 10): a grama em fios
(`blade-grass`) em manchas de mato fechadas, de borda seca, com o chão
entre elas, no lugar dos conjuntos grandes do mato do Let's Go com grama
rala entre eles. O mato alto do Let's Go (`encounter-grass`) saiu (só
visual: o spawn não usa). A forma das manchas é a da floresta, sem a
preferência por clareira (a planície não tem). Vêm junto, sem mudar nada:
o chão na cor da grama debaixo das manchas e o passo na grama.

### Etapas

- [x] Planície isolada (floresta e savana escondidas, grama escondida).
- [x] Árvores dos pacotes, como na floresta.
- [x] Ressaltos baixos e raros (platôs com degrau baixo e muita rampa).
- [x] Grama em fios em manchas, como na floresta; a grama de volta.
- [x] O usuário olhar as árvores, os ressaltos e a grama no jogo.
- [ ] Testar andar (o ressalto barra, a rampa sobe) e a navegação — ver
      Fechamento.
- [ ] Rever os valores do config que vazaram da floresta — ver Fechamento.
- [x] Desempenho da planície (Parte 13, "Desempenho da planície e da
      savana").
- [x] Desfazer o isolamento.

---

## Parte 13 — Savana

A mesma ideia da planície (Parte 12), aplicada direto nos dados da savana
(`core/data/biomes/savanna/`), para o usuário olhar no jogo.

### Savana isolada (provisório)

A floresta e a planície em `BIOMES.HIDDEN` (no lugar da floresta e da
savana). Voltam antes de fechar a feature; os mesmos testes da Parte 12
falham enquanto isso.

### Árvores

As árvores redondas do Let's Go tingidas saíram: no lugar, as dos pacotes
com tronco à vista e copa alta (com as folhas do Let's Go) — as de tronco
torcido (TwistedTree) e as de copa aberta (NormalTree), esparsas como
antes (`acacia-tree`). A tinta amarelada do bioma continua. O tamanho da
entrada (`scale`) caiu: o de `ACACIAS` foi feito para a árvore redonda,
bem menor que as dos pacotes.

### Ressaltos

Os mesmos da planície (degrau baixo, barranco seco, bastante rampa), mas o
relevo da savana era plano demais para o degrau ficar íngreme (medido:
quase nenhum barranco). Os morros ficaram um pouco mais altos e mais
estreitos e o chão médio subiu junto, para as lagoas da savana (os
bebedouros) não crescerem — na medida, até diminuíram um pouco, e a margem
rente à água também. O barranco com a terra de trilha
(`ground.colors.slope`, antes a savana não tinha cor de encosta).
`TERRAIN.GENERATION_VERSION` subiu.

### Grama em fios

A grama em fios em manchas fechadas, com a forma das manchas da floresta,
de preferência nas manchas de grama do chão (as clareiras da savana); o
mato alto do Let's Go saiu. A tinta amarelada vale para as lâminas (é por
instância, no material toon) e para o chão debaixo das manchas.

**Correção (o usuário viu no jogo):** a mancha do chão debaixo da grama
saía verde como a da floresta — ela levava só a cor `a` da grama, sem a
tinta do bioma. Agora a cor da mancha (`grassGroundOf` em
`terrainGeometry.js`) recebe a tinta do mesmo jeito que o material toon
aplica nas lâminas (o tom da tinta, mantendo a luminância:
`withBiomeTint` em `view/vegetation/biomeColor.js`, com teste). A conta é
feita com a cor da grama em fios ao montar o chunk: mudar a cor dela ao
vivo no lab só acerta a mancha tingida ao remontar.

### O que a savana tem de próprio (pedido do usuário)

Até aqui ela só se diferenciava pela cor. Das ideias levantadas
(afloramentos de pedra, silhueta de acácia, árvores secas, verde em volta
das lagoas, bruma de calor), o usuário escolheu os afloramentos e as
árvores secas.

**Afloramentos de pedra.** As pedras (marca da savana, 054) quase tinham
sumido com o `ROCKS` acertado para a floresta. Sem mexer no config: as
pedras da savana nascem só em manchas (`patches`), grandes (`scale`), e
dentro da mancha a densidade passa de 1 — a chance de cada célula da
grade de `ROCKS` satura e as pedras ficam quase lado a lado, como os
rochedos no meio do capim; fora delas, nada. A pedra de terra do Let's Go
com as altas do Ultimate Nature.

**Árvores secas** (`dead-tree`, raras): as `DeadTree` do Ultimate Nature
empacotadas (`pack-lab.py`, como as outras do pacote `usn`, casca no mesmo
marrom) e levadas para o jogo (`levar-pacotes-para-o-jogo.js`, colisores
refeitos). Ficaram cinco, as de galhos mais abertos; de fora, as estreitas,
a que tem folhas e as duas cujos galhos já são das árvores gigantes. O
tamanho é o de `DEAD_TREES`.

O `pack-natureza.sh` passou a refazer as árvores secas junto com o resto.

**Seixos espalhados** (pedido do usuário): na floresta os seixos saíram;
na savana eles deixam de ficar só na trilha (`place`) e se espalham pelo
bioma inteiro, numa densidade baixa (`density` vezes `PEBBLES.PER_M2`).

Primeiro não funcionou: os seixos continuavam só na trilha. A regra "é de
trilha" (`place: 'trail'`) era decidida por tipo, olhando todos os biomas
— como a floresta e a planície têm o seixo de trilha, ele virava de trilha
na savana também. Agora é por bioma (`createTrailPlacement` em
`core/vegetation/vegetationDensity.js`, com teste): cada bioma pela regra
dele, misturados pelo peso na fronteira.

Depois, a pedido do usuário, a planície e a floresta também: seixos
espalhados pelo bioma, não só na trilha, numa densidade bem baixa (na
floresta eles tinham saído da trilha na Parte 8 e voltam assim).

### Etapas

- [x] Savana isolada (floresta e planície escondidas).
- [x] Árvores dos pacotes, como na floresta.
- [x] Ressaltos baixos e raros (com os morros um pouco mais marcados).
- [x] Grama em fios em manchas, amarelada.
- [x] Afloramentos de pedra (as pedras de volta, em manchas).
- [x] Árvores secas, raras (empacotadas e levadas para o jogo).
- [x] Seixos espalhados pelo bioma, não só na trilha.
- [x] O usuário olhar no jogo.
- [ ] Testar andar (o ressalto barra, a rampa sobe) e a navegação — ver
      Fechamento.
- [ ] Rever os outros valores do config que vazaram da floresta — ver
      Fechamento.
- [x] Desempenho da savana (junto com o da planície).
- [x] Desfazer o isolamento.

### Desempenho da planície e da savana

Medido no jogo (dev, a bancada da Parte 10), com o save do usuário só
lido, o time de três em campo, tela 1920×1080, na Intel UHD pelo WSL: o
miolo de uma mancha de grama em cada bioma (o pior caso da grama), três
ângulos da câmera do jogo, cada parte da vegetação ligada e desligada na
mesma página, intercalado, pela mediana da diferença. A floresta entrou
como referência, no mesmo dia.

| Bioma | Quadro inteiro (GPU) | FPS | Grama | Árvores | Pedras | Sub-bosque |
|---|---|---|---|---|---|---|
| Floresta | ~24 ms | no limite (30) | ~3,5 a 6,5 ms | ~4 ms | ~0 a 2 ms | ~1 a 2 ms |
| Planície | ~23 a 26 ms | no limite (30) | ~6 a 8 ms | ~1 a 2 ms | ~0 (um ângulo ~6 ms) | ~1 a 2,5 ms |
| Savana | ~24,5 a 26,5 ms | no limite (30) | ~3,5 a 7,5 ms | ~0,5 a 4,5 ms | ~0 a 1 ms | ~0 a 2,5 ms |

Os três biomas ficam no mesmo custo e no limite de quadros do jogo
(`RENDER.MAX_FPS`) no PC do usuário. A grama em fios da planície pesa um
pouco mais que a da floresta no miolo da mancha (a planície é aberta: mais
manchas na tela ao mesmo tempo); as pedras da planície pesaram num ângulo
só (uma pedra perto da câmera). O celular segue para a 092.

---

## Fechamento

Fechada depois da savana, a pedido do usuário, sem wiki.

- **Cidade**: estava no escopo do começo (floresta, planície, savana e
  cidade) e não foi revista.
- **Andar nos barrancos e a navegação**: os testes dizem, pela inclinação,
  que o barranco barra e a rampa sobe (floresta, planície e savana); andar
  de verdade e ver as selvagens e o time contornando ficou por fazer.
- **Valores do config acertados para a floresta que valem em todo bioma**
  (Parte 12): tom e brilho do chão de grama (`TERRAIN_LOOK`), pedras
  (`ROCKS`) e flores (`FLOWERS`). A savana contornou as pedras com os
  afloramentos (densidade acima de 1 nas manchas); o resto ficou como está.
- **Do lab, sem levar adiante**: a folhosa do cenário de batalha do Let's
  Go, a cor e a luz da floresta pelo lab, refinar a grama vista de cima e a
  passagem da grama distante, as folhas de um lado só (Parte 9).
- **Na reserva da Parte 9** (só se pesar): detalhe do chão em cima da cor
  do Let's Go, as camadas mais fortes por vértice, juntar a vegetação de
  vários blocos e a sombra do corpo na primeira vez.

---

## Decisões (com o usuário)

1. **Referência da floresta: Scarlet/Violet e Kitakami** (mais do que o Let's
   Go): bosque mais aberto e natural, grama alta solta, horizonte visível.
2. **Assets do Scarlet/Violet** — o depósito pessoal só tem os modelos dos
   Pokémon do SV (formato Trinity: `.trmdl`/`.trmsh`/`.trmbf`/`.trmtr` +
   PNG), nada de cenário. O usuário vai atrás do dump de cenário (árvores,
   arbustos, grama, pedras e texturas do chão). Hoje o conversor
   (`scripts/lgpe/`) só lê o formato do Let's Go (`.gfbmdl`).

*(o resto a fechar ao longo do diagnóstico)*
