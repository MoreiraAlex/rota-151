# 🚀 Versão 0.0.54 — Savana com assets do LGPE e saída do MegaKit

## Resumo

Última feature da troca de arte (052 a 054): a **savana** passa a usar só
os modelos e as texturas do **Pokémon Let's Go**, e com ela o **MegaKit sai
do jogo**. A **montanha foi adiada** para depois da beta (decisão de
abertura, ver "Decisões") e passa a ficar escondida, como os outros biomas
sem espécie na beta.

Na beta, a savana é a casa de **Rattata, Spearow e Ekans**. Em Kanto, esses
três vivem nas rotas secas e pedregosas ao pé das montanhas (Rotas 3, 4, 9,
10, 11, 22 e 23), e é nelas que a savana se inspira: chão de terra batida
com manchas de grama, árvores esparsas, pedras na terra e mato alto de
encontro.

O que entra:

- **Busca dos assets da savana** nos mapas das rotas secas do LGPE. O
  inventário está em "Inventário do LGPE".
- **Props e texturas novos** no conversor (`scripts/lgpe/pack-lgpe.js`) e
  os cascos de colisão de novo (`scripts/lgpe/colliders.js`).
- **Savana migrada**: vegetação toda do LGPE, chão com `ground.colors`,
  paleta casada com as texturas (o relevo distante) e o **mato alto de
  encontro** no miolo dos conjuntos de grama.
- **Montanha escondida** (`BIOMES.HIDDEN`).
- **MegaKit fora do jogo**: modelos, materiais, assets e o conversor dele.
  Os biomas escondidos ficam sem vegetação no F2 até serem refinados.
- Os ajustes do usuário no jogo (pelo F2, como na 053).

Versão: `0.0.54` (`package.json`). Branch:
`feature/054-savana-lgpe-e-saida-do-megakit`.

> **Os números deste doc são fictícios (só ilustram).** O valor de verdade é
> o do campo citado (config, dado do bioma ou manifesto). As exceções são as
> medidas do inventário (tamanhos e cores médias tirados dos arquivos do
> jogo).

---

## O que já existe (ponto de partida)

- **Savana** (`core/data/biomes/savanna/`, 050): acácias isoladas, árvore
  morta, arbusto seco (`color`), arenito (`rock` com `color` e `scale`),
  seixos na trilha e a grama do LGPE em conjuntos, tingida de amarelo
  (`colors`). Fora a grama, tudo é MegaKit. O chão é o antigo (paleta +
  claro e escuro), sem `ground.colors`, e não tem mato alto de encontro.
  As trilhas estão ligadas (`trails: true`).
- **Props do LGPE já empacotados** (052, 053): árvores redondas das Rotas 1
  e 3, a moita redonda, arbustos, tufos, o monte de grama, as flores, as
  pedrinhas na grama e na terra (`rock-soil`, `rock-soil-b`), o mato alto,
  o capim (`reeds`), a árvore de Corte e a pedra de Força. Alguns ficaram
  sem uso de propósito, como opção do F2 para este bioma.
- **Camadas de cor do chão do LGPE**: grama, terra (`lgpe-soil`,
  `lgpe-soil-dark`, `lgpe-trail-soil`), areia (`lgpe-sand`), pedra, entre
  outras. **Sobra uma vaga** (`MAX_COLOR_LAYERS`).
- **F2**: "Modelos" por bioma e por tipo (pela categoria do prop) e
  "Texturas do chão" por bioma.
- **MegaKit** (049–051): `public/assets/vegetation/megakit/`,
  `scripts/pack-forest-assets.py`, os modelos padrão por tipo
  (`VEGETATION_MODELS`, `useVegetationModels.js`), os materiais da copa e
  das plantas (`canopyMaterial.js`, `propMaterials.js`) e a dobra das
  plantas dele no empurrão (`grassPush.js`). Hoje só a savana e a montanha
  (e os biomas escondidos, pelo F2) usam.

---

## Inventário do LGPE (levantado na abertura)

Fonte: `LGPE-FieldMaps.7z`, com os mapas das Rotas 4 (`area03/road004_1`,
`area04/road004_2`), 9 (`area04/road009`), 10 (`area04/road010_2`,
`area08/road010_1`), 11 (`area08/road011_2`, `area09/road011_1`), 17
(`area05/road017`) e 23 (`area01/road023`), além do Parque GO
(`gogo_park`) e da pasta `safari`.

**O que se descobriu:** o Let's Go **não tem vegetação seca**. Kanto é
todo verde, e as rotas secas usam as mesmas famílias de árvore, grama e
flor das outras. A pasta `safari` só tem o relevo do Parque GO, sem
objetos. O que faz uma rota "seca" no jogo original é o **chão** (terra
batida cor de areia, penhascos de terra) e as **pedras na terra**. A
savana segue essa receita, e o tom seco da vegetação vem da tinta (ver
"Decisões", item 2).

**Árvores** (tamanho = largura × altura × fundo, medido)
- `road009_00_plant/tree004` e `tree005` (Rotas 9, 10 e 11) — árvore
  redonda de copa cheia, cerca de 4 m, material `FieldTreeShader02`
  (textura `tree21`, verde médio). É a árvore mais comum das rotas secas.
  Nova.
- `tree/tree03_1` (Rota 4) — árvore de copa mais escura (textura `tree22`,
  verde azulado), cerca de 3 m. Nova.
- `road010_2_00_tree08` (Rotas 10, 11 e 23) — moita baixa e larga
  (textura `tree05_01`), cerca de 1,5 m × 0,8 m. Nova.
- `tree006` (redonda pequena) — já é a `round-bush`.
- `tree07`/`tree04` (textura `tree06_01`) — cerca-viva baixa e comprida.
  Fica de fora (parece canteiro, combina mais com estruturas, 057).

**Pedras**
- `road009_00_mountain_rock01` (Rota 9) — pedras na terra
  (`rock01_com` sobre `soil09_com`), de seixo até cerca de 1 m. Nova.
- `road004_1_00_rock03` (Rota 4) — pedras na terra escura (`soil08_com`),
  até cerca de 1 m. Nova.
- `road004_1_00_rock04` (Rota 4) — pedra média na terra clara
  (`soil01_com`), cerca de 1 m. Nova.
- Já empacotadas: `rock-soil`, `rock-soil-b` e a pedra de Força.

**Grama e plantas**
- Os mesmos tipos das outras rotas (tufos, monte de grama, mato alto),
  todos já empacotados.
- `road009_00_mountain_leaf01` (Rota 9) — folhas rasteiras, quase sem
  altura. Só se não brigar com o chão (z-fighting).

**Texturas de chão** (cor média, medida)
- `soil08_com` (`#c99c5a`), `soil01_com` (`#c39549`), `soil09_com`
  (`#bb9261`) e `sand01_com` — já são camadas do jogo.
- `soil10_com` (`#b98a61`) — já empacotada, sem camada.
- `cliff01_com` (`#76613d`) e `cliff02_com` (`#986e49`) — penhasco de
  terra das rotas secas. Candidata à vaga que sobra, como encosta da
  savana.

---

## Decisões

1. **Montanha adiada** (decidido na abertura). Na beta ela não teria
   espécie exclusiva (o Spearow mora na savana) e as cavernas (061) também
   foram para depois da beta. Ela entra em `BIOMES.HIDDEN` e volta com as
   espécies de montanha e caverna. Roadmap atualizado.
2. **O seco vem do chão e da tinta.** Como o LGPE não tem vegetação seca, a
   savana usa mais terra que grama no chão (`ground.colors`), e a
   vegetação do LGPE ganha uma **tinta por entrada** (`tint`, o mesmo
   papel do `colors` da grama) para puxar o verde para o oliva e o
   amarelado. O F2 ajusta ao vivo. *(Proposta: se ficar artificial, a
   savana fica verde como as rotas secas de Kanto e o seco vem só do
   chão.)*
3. **Sem acácia.** A acácia e a árvore morta eram do MegaKit e não existem
   no LGPE. No lugar delas entram as árvores redondas das rotas secas,
   esparsas.
4. **Mato alto de encontro na savana**, como na planície e na floresta.
5. **MegaKit fora nesta feature** (decidido na abertura). Tipo de
   vegetação sem `models` **não nasce** (nem no core): assim os biomas
   escondidos ficam vazios, sem árvore invisível colidindo. Saem os assets,
   o conversor, os modelos padrão por tipo e os materiais só dele. O que
   mais ficar sem uso (tipos, configs) sai na limpeza da 081.
6. **Escolha pelo F2** e "Copiar valores", como na 053: uma primeira versão
   e o usuário ajusta.
7. **Estruturas fora** (cercas, cerca-viva, placas): 057.

---

## Arquitetura (proposta)

### Assets

- `scripts/lgpe/pack-lgpe.js`: mapas das Rotas 4 e 9 na lista;
  `MAP_PROPS` recebe os candidatos do inventário; `GROUND_TEXTURES`, os
  penhascos de terra (se entrarem). Comando de extração no cabeçalho com
  as pastas novas (`area03`, `area04`).
- `scripts/lgpe/colliders.js` de novo para as árvores e pedras novas.

### Tinta da vegetação do LGPE (view)

- `tint` opcional em cada entrada de `vegetation`, puxando o tom do toon
  para uma cor (ver "Como ficou"). Sem `tint`, nada muda nos biomas já
  feitos.
- No F2, junto da densidade e dos "Modelos" de cada tipo.

### Savana (core/data)

- `vegetation`: `models` em todas as entradas; `encounter-grass` novo;
  `tint` onde fizer sentido.
- `ground.colors` (base de terra, grama em manchas, trilha, encosta) e a
  paleta pela média das texturas escolhidas.
- `GENERATION_VERSION` sobe (o sorteio muda).

### Montanha (config)

- `'mountain'` em `GAME_CONFIG.BIOMES.HIDDEN`, e o comentário do campo
  atualizado (a beta tem floresta, planície e savana).

### Saída do MegaKit

- Core: tipo sem `models` não nasce (sorteio e colisão).
- View: saem `VEGETATION_MODELS`/`MODEL_PATHS` do MegaKit
  (`useVegetationModels.js`, `vegetationAssets.js`, `biomeModels.js`), os
  materiais só dele (`canopyMaterial.js`, `propMaterials.js` e o que
  ficar sem uso no `windShader.js`) e a dobra das plantas dele no
  `grassPush.js`.
- Assets: `public/assets/vegetation/megakit/` e
  `scripts/pack-forest-assets.py`.
- Campos do MegaKit nos dados dos biomas (`color` de árvore, arbusto e
  pedra, `moss`) saem do `_template` e dos biomas.
- O 088 (Detalhes da floresta) citava um cogumelo do MegaKit: vai precisar
  de outra fonte quando chegar.

### Testes (regras, sem fixar valores)

- Os da 052/053 valem para a savana: todo `models` existe no manifesto e é
  de uma categoria que o tipo aceita; camadas de cor válidas; mesmo mundo
  para a mesma seed.
- Nenhum bioma visível tem tipo sem `models`.
- Tipo sem `models` não gera instância nem colisor.
- A montanha está entre os escondidos.

---

## Etapas

- [x] Bump `package.json` → `0.0.54` e doc.
- [x] Inventário dos assets do LGPE para a savana.
- [x] Revisão do doc pelo usuário ("pode seguir").
- [x] Conversor: mapas, props e texturas novos; cascos de colisão.
- [x] Montanha escondida.
- [x] Tinta da vegetação do LGPE (`tint`) + F2.
- [x] Savana: primeira versão com os modelos e texturas do LGPE e o mato
      alto de encontro (+ testes).
- [x] Saída do MegaKit (core, view, assets, conversor, dados) (+ testes).
- [x] Conferir no jogo (bancada): savana e planície.
- [ ] Teste no jogo pelo usuário e ajustes.
- [ ] Desempenho na Intel UHD (no fechamento, depois dos ajustes).
- [ ] Limpeza: props que nenhum bioma usa saem do conversor.
- [ ] Wiki: página "O mundo" (savana; montanha some).
- [ ] Roadmap: 054 para "Já feito".
- [ ] Gates: `npm test` inteiro, `npm run lint` e build.

---

## Como ficou (implementação)

- **Conversor** (`scripts/lgpe/pack-lgpe.js`): mapas das Rotas 4, 9 e 10
  (`area03`, `area04`). Props novos: árvores das Rotas 9 e 4 (`dry-tree`,
  `dry-tree-b`, `dark-tree`), a moita baixa da Rota 10 (`low-bush`) e as
  pedras na terra (`rock-dirt`, `rock-dirt-b`, `rock-dirt-c`); textura
  nova do penhasco de terra (`cliff02_com`). Os props antigos saíram
  idênticos (só o nome do gerador no `.glb` mudaria; os arquivos antigos
  ficaram). `colliders.js` rodado de novo.
- **O que o inventário errou** (visto na bancada): as árvores "redondas"
  das Rotas 9 e 4 são **coníferas** (pinheiros) e a moita baixa da Rota 10
  é uma placa achatada. Nenhuma serve à savana; ficam no conversor como
  opção do F2 (podem servir à montanha, depois da beta) até a limpeza.
  A savana usa árvores redondas da Rota 1 e da Rota 3 (053). A
  `round-tree-e` da 053 ("Árvore redonda (Rota 3)") também é um pinheiro
  (o shader de conífera, `FieldTreeShader02`): o nome virou "Pinheiro
  (Rota 3)"; a planície continua com ela.
- **Regra "sem `models`, não nasce"** (`core/vegetation/vegetationEntry.js`,
  `vegetationEntryOf`): a densidade, o tamanho por bioma, as trilhas, o
  bioma dominante e os colisores só enxergam a entrada que diz os modelos.
  Os biomas escondidos (montanha inclusive) ficam só com a grama, que já
  era do LGPE. Marcar modelos no F2 de um bioma escondido faz o tipo
  nascer.
- **Tinta** (`tint: { color, amount }`, `view/vegetation/biomeColor.js`):
  no lugar do `color` do MegaKit, o tom dos modelos puxa para `color`
  (`amount`, 0 a 1) mantendo o claro e escuro — no toon
  (`toonMaterial.js`), no fim, sobre a cor já iluminada: a cor da tinta
  normalizada pelo brilho dela vezes o brilho de cada ponto, misturada
  pela força. Aplicada antes da luz, sobrava verde na borda (a `RimColor`
  de cada material) e na sombra (`SHADOW_TINT`, azul-esverdeada); no fim,
  pega as duas. Vai por instância
  (`aRecolor`, separada do tom de cada planta), misturada pelo peso dos
  biomas. Vale para todos os tipos, a grama inclusive (por cima das
  `colors`). No relevo distante, a copa (`LEAF_COLOR` da espécie) passa
  pela mesma conta. F2: pasta "Tinta" (cor e "Quanto puxa"; 0 tira o
  campo) em cada tipo do "No bioma" e na grama.
  - **Primeira tentativa** (multiplicar a cor): só escurecia ou puxava o
    verde para o oliva — a grama do LGPE é verde puro e multiplicar não
    chega ao amarelo. O usuário pediu o tom mais amarelado nas plantas, e
    a tinta virou "puxar para a cor".
- **Savana** (`core/data/biomes/savanna/`): chão de terra batida
  (`shade`, fora das clareiras) com manchas de grama (`base`, as
  clareiras: `clearings`), terra clara na trilha, areia na margem e o
  penhasco de terra na encosta (camada nova `lgpe-cliff`, a última vaga).
  Árvores redondas da Rota 3 esparsas (o tipo `acacia-tree` continua, pelo
  espaçamento), moita redonda e arbusto, tufos, poucas flores amarelas,
  pedra na terra, pedrinhas na trilha, conjuntos de grama preferindo as
  manchas (`clearingPreference`) e o mato alto de encontro. Paleta pela
  média das texturas. `GENERATION_VERSION` subiu.
- **Lagoas na savana** (pedido do usuário): como na floresta, sem
  mecanismo novo — os vales do relevo da savana passam a descer um pouco
  abaixo da água (`hillHeight` maior que `baseHeight`) e a água de sempre
  (049) aparece neles, com a areia da margem (`shore`). Medido na seed
  (não fictício): uns 4% da savana viram água, em umas 65 lagoas
  espalhadas pela área medida — os bebedouros. Sem nadar nem colidir
  ainda (060).
- **Montanha** em `BIOMES.HIDDEN`; saíram dela os `color` do MegaKit.
- **MegaKit fora**: apagados `public/assets/vegetation/megakit/`,
  `scripts/pack-forest-assets.py`, `vegetationAssets.js`,
  `canopyMaterial.js` e `propMaterials.js`. O `useVegetationModels` só
  carrega o LGPE; as malhas (`instancing.js`) só conhecem as partes do
  toon. Saíram do config os números do material do MegaKit (preenchimento
  da sombra, volume da copa, cor da casca, do musgo e da pedra, tamanhos
  do sub-bosque e das flores, cogumelos) e do F2 os controles deles; a
  `LEAF_COLOR` das espécies ficou, como a cor da copa ao longe.
- **Testes**: todo tipo dos biomas visíveis tem `models`; tipo sem modelos
  não tem densidade; a tinta de um bioma só dá a `tint` dele e não conta
  sem modelos; toda `tint` é uma cor e uma força de 0 a 1. Os testes do MegaKit saíram; os do
  LGPE foram para `lgpeModels.test.js`.
- **Conferido no jogo** (bancada, meio-dia): savana em dois pontos e a
  planície na origem (igual). Sem erro novo no console.

---

## Critérios de Conclusão

- [ ] A savana usa só modelos e texturas do LGPE.
- [ ] Mato alto de encontro no miolo dos conjuntos de grama da savana.
- [ ] A montanha não aparece no mundo (só pelo F2).
- [ ] Nenhum arquivo, modelo ou material do MegaKit no jogo.
- [ ] Floresta e planície iguais.
- [ ] Mesmo mundo para a mesma seed; árvores e pedras colidem (pela malha).
- [ ] Desempenho na Intel UHD na savana no nível de hoje ou melhor.
- [ ] `npm run build`, `npm run lint` e `npm test` passando.
- [ ] Wiki atualizada.

---

## Fora de escopo

- **Montanha e cavernas** — depois da beta (roadmap, "Depois da beta").
- **Vegetação dos biomas escondidos** — quando as espécies deles entrarem.
- **Cercas, cerca-viva, placas e casas** das rotas — estruturas (057).
- **Spawn por bioma** (Rattata, Spearow e Ekans na savana) — 059.
