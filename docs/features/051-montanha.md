# 🚀 Versão 0.0.51 — Montanha

## Resumo

Sétima feature do Marco 2 (mundo procedural): fecha a **montanha** em cima
da base de vegetação da 049 e do que a 050 acrescentou (cor e tamanho por
bioma). Ela sai do `BIOMES.HIDDEN` e passa a dividir o mundo com a
floresta, a planície e a savana. É o bioma do Spearow (055) e o lugar das
bocas das cavernas (057).

O que entra:

- **Faixas por altura**, de baixo para cima: pé de grama com bosques de
  pinheiro; meio de rocha com pinheiros esparsos e pedregulhos; pico com
  neve, sem vegetação.
- **Linha das árvores**: a vegetação de cada bioma pode ter uma altura
  máxima (`maxHeight` na entrada do `vegetation`) e rareia até sumir
  perto dela.
- **Chão por altura**: textura de grama no pé e de rocha no alto
  (`ground.highTexture`), não só a cor — a encosta da montanha quase nunca
  é íngreme o bastante para pegar a `slopeTexture`.
- **Pedras grandes**: a `rock` maior na montanha (`scale` por bioma, como
  na savana). Sai o tipo `boulder`, que só estava declarado.
- **Picos mais altos**, para a neve aparecer de verdade (antes quase
  nenhum ponto chegava ao `peakHeight`).

Versão: `0.0.51` (`package.json`). Branch: `feature/051-montanha`.

> **Os números deste doc são fictícios (só ilustram).** O valor de verdade é
> o do campo citado (config ou dado do bioma).

---

## O que já existe (ponto de partida)

- **Montanha** (`core/data/biomes/mountain/`): clima (`relief` alto),
  relevo, paleta com `peak` nevado a partir de `peakHeight`, chão `rock`
  com `peakTexture: 'snow'`, `vegetation` com `pine-tree`, `rock` e
  `boulder` (este sem modelo nem tipo no core), tags `mountain`, `rocky` e
  `cave-entrance`, clima com neve.
- **Pinheiro**: modelo, `GAME_CONFIG.PINES`, colisão, LOD e vento (049).
- **Pedra**: `rock` com cor, brilho, musgo e `scale` por bioma (050).
- **Neve caindo** (048) e a camada de chão `snow` (047).

### Medido na seed do jogo (Node, montanha visível)

- A montanha ocupa uns 20% do mapa; a mais perto fica a poucas dezenas de
  metros da origem. A origem continua na planície.
- Só ~1% da montanha passava do `peakHeight` → quase sem neve.
- A encosta mediana é suave (~0,2 rad); a mais íngreme fica abaixo do
  limite de subida do personagem (`MAX_SLOPE_CLIMB`). Pinheiro e pedra
  quase nunca são barrados pelo `MAX_SLOPE` deles.

---

## Decisões

O usuário deixou as escolhas comigo ("pode fazer o que achar melhor, e a
gente vai corrigindo depois"):

1. **Pedras grandes = `rock` com `scale`** no bioma (mesmo caminho da
   savana), sem tipo `boulder` novo. Musgo pouco.
2. **Faixas por altura** como no Resumo, pelo `maxHeight` da entrada.
3. **Neve só no chão**, pela altura (o que já existe), com picos mais
   altos e o `peakHeight` mais baixo. Neve nas copas fica para depois, se
   fizer falta.
4. **Sem trilhas** na montanha.
5. **Encostas para a 057**: nada no código agora. A tag `cave-entrance`
   já marca o bioma; a 057 escolhe o lugar da boca (encosta íngreme) e
   abre o espaço (sem vegetação) quando for feita.

---

## Arquitetura

### Linha das árvores (`maxHeight`)

- **Core** (`createKindDensity`, `vegetationDensity.js`): a entrada do
  `vegetation` ganha `maxHeight` opcional (m acima da água). A densidade
  daquele bioma é multiplicada por um fator que vai de 1 a 0 na faixa
  `VEGETATION_ALTITUDE.FADE` abaixo do `maxHeight` (sem corte seco).
  Vale para sólidos (árvores, pedras) e para o resto (grama, flores),
  porque os dois passam por `createKindDensity`.
- `GENERATION_VERSION` sobe (os sólidos mudam).

### Chão por altura (`ground.highTexture`)

- **View** (`terrainGeometry.js`): a camada do chão plano mistura de
  `texture` para `highTexture` com a mesma curva da cor (`low` → `high`
  até `highHeight`). Sem `highTexture`, nada muda.

### Dados da montanha

- `relief.hillHeight` maior (picos altos), `palette.peakHeight` mais baixo
  (~10% da montanha com neve), `palette.low` verde de pasto alto,
  `high`/`slope` cinza de rocha.
- `ground`: `texture: 'grass'`, `highTexture: 'rock'`, `slopeTexture:
  'rock'`, `peakTexture: 'snow'`.
- `vegetation`: pinheiro em bosques com `maxHeight` (linha das árvores),
  `rock` grande (`scale`) espalhada até perto do pico, grama baixa e rala
  até antes da rocha, poucos arbustos e flores no pé.
- Sai do `BIOMES.HIDDEN`.

### Testes (regras, sem fixar valores)

- `createKindDensity`: acima do `maxHeight` a densidade é zero; bem abaixo
  dele, a mesma de sem `maxHeight`.
- Registro dos biomas: `maxHeight` e `ground.highTexture` válidos.
- `terrainGeometry`: com `highTexture`, o alto usa a camada dela.
- Os que já existem pegam o resto (todo tipo de bioma visível com modelo,
  origem em terra, encosta abaixo do limite de subida).

---

## Etapas

- [x] Bump `package.json` → `0.0.51` e doc da feature.
- [x] `maxHeight` na entrada do `vegetation` (+ config, `_template`,
      registro e testes).
- [x] `ground.highTexture` (+ `_template`, registro e teste).
- [x] Dados da montanha: relevo, paleta, chão, vegetação; `boulder` fora;
      `GENERATION_VERSION`.
- [x] Montanha fora do `BIOMES.HIDDEN`.
- [x] Conferir no jogo (bancada): faixas, neve, bordas com os outros biomas.
- [x] Desempenho na Intel UHD (só GPU parado, em dev).
- [x] Parte 2: horizonte — relevo distante e névoa de bruma.
- [x] Parte 3: relevo da montanha — cristas (`ridges`) e serras mais altas.
- [x] Teste no jogo pelo usuário e ajustes.
- [x] Wiki: página "O mundo" (montanha).
- [x] Roadmap: 051 para "Já feito".
- [x] Gates: `npm test` inteiro, `npm run lint` e build.

---

## Como ficou (implementação)

- **Linha das árvores** (`createKindDensity`, `vegetationDensity.js`):
  com `maxHeight` na entrada, a densidade do bioma é multiplicada por um
  fator que cai de 1 a 0 na faixa `VEGETATION_ALTITUDE.FADE` abaixo dele.
  A altura do chão só é lida quando algum bioma do chunk tem `maxHeight`.
  O `solidPlacement` passa `altitude` e `terrain` adiante (`solidParams`
  ganhou `altitude`). Testes: acima da altura máxima nada nasce, bem
  abaixo é a densidade de sempre, na faixa rareia ao subir — com a faixa
  tirada do relevo do chunk do teste, não do config.
- **Chão por altura** (`addGroundLayers`, `terrainGeometry.js`): o chão
  plano mistura `texture` → `highTexture` com a mesma curva da cor
  (`low` → `high`). O teste das camadas de cada bioma confere o pé
  (`texture`) e o alto (`highTexture`, ou `texture` sem ela).
- **Montanha** (`core/data/biomes/mountain/`): `hillHeight` maior e
  `peakHeight` mais baixo (neve em ~10% da montanha, contra ~1% antes);
  chão de grama no pé, rocha no alto, neve no pico; desenho do chão mais
  suave (`detail`) — com o de antes a rocha parecia um piso de lajotas;
  cinza da rocha mais claro. Vegetação: pinheiros em bosques até a linha
  das árvores, árvore morta rara, pedregulhos de granito (`scale`,
  `color` que tira o verde da textura da pedra, sem musgo) até pouco
  acima da neve, arbustos, flores e grama de pasto (conjuntos baixos)
  só no pé. `boulder` saiu. `GENERATION_VERSION` subiu.
- **Mundo**: montanha fora do `BIOMES.HIDDEN`. Medido em Node na seed do
  jogo: a origem continua na planície e a encosta mais íngreme fica
  abaixo do `MAX_SLOPE_CLIMB`.
- **Conferido no jogo** (bancada Playwright, meio-dia, pé/meio/pico/borda):
  pé verde com pinheiros e lago, meio de rocha com pedregulhos e pinheiros
  rareando, pico branco, borda com a floresta suave.
- **GPU parado** (dev, Intel UHD, duas rodadas intercaladas): montanha
  ~20 ms por quadro, planície da origem ~33 ms — a montanha é mais leve
  (menos grama, campo aberto).

**Notado, não feito** (para o teste do usuário):

- Alguns fios de grama no pico nevado: vêm da mistura com o bioma vizinho
  (a grama dele não tem `maxHeight`).
- A base das pedras continua puxando para o verde (luz do chão, igual nos
  outros biomas).
- A linha da neve é bem marcada (a mesma faixa curta do pico da 047).

**Teste do usuário**: "ainda ficou muito vazio, mas vamos com calma".
Pediu para entender como a montanha funciona (é o próprio relevo, não um
objeto) e notou que o horizonte de todos os biomas era só névoa. Escolheu
fazer o horizonte (Parte 2) e, para a montanha, atacar primeiro o relevo
(Parte 3); objetos de rocha (paredões, pontas) ficam para depois.

---

## Parte 2 — Horizonte (relevo distante)

O mundo carregado vai só até `LOAD_RADIUS` chunks, e a névoa fechava antes
da borda dele: atrás dela, nada. Como nos jogos de mundo aberto (o BotW
desenha o relevo longe em baixa resolução), entra uma malha grossa do mesmo
relevo da seed até o horizonte.

- **Core** (`core/terrain/farTerrain.js`): grade de `FAR_TERRAIN.CELL` m
  até `FAR_TERRAIN.RADIUS`, centrada num canto de chunk (os vértices caem
  nos cantos dos chunks: a malha encosta no chão de verdade na borda
  deles). Montada aos poucos (`fillFarTerrainGrid`, `SAMPLES_PER_FRAME`
  pontos por quadro). O conjunto de chunks expõe `sample` (altura e pesos
  dos biomas) e `recipe`. Testes: centro num canto, montar aos poucos =
  de uma vez, vértices com a altura do chunk, pesos somam 1.
- **View** (`view/scene/FarTerrainView.jsx`, `view/terrain/
  farTerrainGeometry.js`, `farTerrainMaterial.js`): cor da paleta de cada
  bioma (a mesma conta do chão de perto), o tom da copa onde há mata (não
  há árvores longe — `CANOPY_STRENGTH`, pela `density`, manchas,
  clareiras e `maxHeight` das árvores do bioma) e a água por cima do que
  fica abaixo dela. A malha fica `SINK` abaixo do relevo e some (no
  fragmento) onde o chunk de verdade está carregado — uma máscara de um
  texel por chunk — e fora do círculo do raio. Quando a câmera se afasta
  `RECENTER_DISTANCE` do centro (ou a receita muda no F2), monta outra e
  troca quando fica pronta; a velha é liberada.
- **Névoa de bruma** (`fogRange.js`, `FogView.jsx`): com `FAR_TERRAIN.
  ENABLED`, o trecho de névoa do Three vira bruma — começa em
  `FOG.HAZE_START`, engrossa devagar (`HAZE_LENGTH`) até `HAZE_MAX` (os
  morros do fundo continuam como silhueta) e fecha de vez na borda do
  relevo distante (`EDGE_FRACTION`). As plaquinhas de nome somem pela
  mesma conta (`fogFactorAt`). Teste: `hazeFactorAt`.
- **Grama**: montava blocos até onde a névoa fecha; com a bruma ia até a
  borda do mundo carregado inteiro (o dobro de triângulos). Agora vai até
  a borda de antes (`loadedFogRange`), separada da névoa.
- **GPU parado** (dev, Intel UHD): mesmos triângulos e chamadas de antes
  na planície e na montanha (a malha distante é uma chamada só).

**Limites conhecidos**: a mata para na borda do mundo carregado (longe,
só o tom da copa); um chunk que carrega troca a malha grossa pelo chão
detalhado à vista, atrás da bruma. Árvores simplificadas ao longe
(impostores) ficam para depois.

## Parte 3 — Relevo da montanha (cristas)

- **`ridges`** no `relief` do bioma (`terrainHeight.js`): nas duas camadas
  maiores do ruído (`RIDGE_LAYERS`), parte do ruído redondo vira crista
  (`1 − |ruído|` ao quadrado) — serras e picos pontudos. Só nas maiores:
  crista nas camadas pequenas virava vinco íngreme (um quarto da montanha
  impossível de subir). A crista é centralizada (`RIDGE_SHIFT`), senão os
  vales desciam muito mais que os picos subiam (um quarto da montanha
  debaixo da água). O valor final fica entre -1 e 1 (`hillHeight` continua
  sendo o máximo). Testes: `ridges` 0 = sem crista; com crista, mesma
  seed = mesmo relevo, dentro dos limites. F2: "Cristas" no painel do
  relevo (e limites maiores de altura e largura dos morros).
- **Montanha**: morros bem maiores e mais altos, menos detalhe miúdo,
  chão médio mais alto, `ridges`. Medido na seed do jogo (Node): picos
  perto de duas vezes a altura de antes, lagos em ~5% da montanha e ~6%
  dela íngreme demais para subir a pé (paredões nas cristas; ~2% do mundo
  todo). A origem continua na planície. As faixas subiram junto (rocha,
  linha das árvores, neve em ~10% do alto). `GENERATION_VERSION` subiu.
- **Conferido no jogo** (bancada): do pico, serras com neve e cristas, e
  outras montanhas ao longe no relevo distante.

---

## Fechamento

- **Wiki** (página "O mundo"): quatro biomas, seção da montanha (faixas
  por altura, paredões, sem trilhas) e o horizonte com relevo distante e
  bruma. A tabela de clima já traz a montanha (vem dos biomas visíveis).
- **Gates**: `npm test` inteiro, `npm run lint` e `npm run build`
  passando (build na pasta do projeto, sem o `next dev` ligado).
- **Fechada sem mais ajustes** a pedido do usuário: o visual dos biomas
  ainda não tem a "essência Pokémon" que ele quer. A direção de arte (usar
  os assets do Let's Go) fica para depois desta feature, para todos os
  biomas, não só a montanha.

---

## Critérios de Conclusão

- [x] A montanha tem pé verde com pinheiros, meio de rocha com pedregulhos
      e pico nevado.
- [x] Linha das árvores suave (os pinheiros rareiam antes da rocha).
- [x] A montanha aparece no mundo, com borda suave com os outros biomas.
- [x] Dá para subir a montanha a pé (menos os paredões de crista).
- [x] O horizonte mostra o relevo distante em todos os biomas.
- [x] Mesmo mundo para a mesma seed.
- [x] `npm run build`, `npm run lint` e `npm test` passando.
- [x] Wiki atualizada.

---

## Fora de escopo

- **Boca das cavernas** — 057.
- **Neve nas copas dos pinheiros** — depois, se fizer falta.
- **Objetos de rocha da montanha** (paredões, pontas) — depois do relevo,
  a pedido do usuário.
- **Árvores ao longe** (impostores no relevo distante) — depois.
- **Espécies da montanha (Spearow)** — 054/055.
- **Desempenho no celular** — 082.
- **Luz BotW por hora** — 081.
